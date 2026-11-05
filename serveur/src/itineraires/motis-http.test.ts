import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server, type Socket } from "node:net";
import { ErreurMotis, lireMotis } from "./motis-plan.js";

/**
 * Issue 0020 : MOTIS v2.11.4 répond sans `Content-Length` ni `Transfer-Encoding: chunked`,
 * la fin du corps n'étant signalée que par la fermeture de la connexion. `lireMotis` lit
 * désormais par `node:http` ; ces tests fixent son contrat sur des réponses de cette forme.
 *
 * Le plantage d'undici lui-même ne se reproduit qu'avec le vrai MOTIS (même ses octets exacts,
 * rejoués par un faux serveur, ne le déclenchent pas) : sa preuve est au §6 de l'issue.
 */

let faux: Server | undefined;
const connexions = new Set<Socket>();
afterEach(async () => {
  for (const c of connexions) c.destroy();
  connexions.clear();
  await new Promise<void>((r) => (faux ? faux.close(() => r()) : r()));
  faux = undefined;
});

/** Faux MOTIS au niveau TCP ; `repondre` écrit sur la connexion après la requête. */
async function fauxServeur(repondre: (s: Socket) => void): Promise<string> {
  faux = createServer((socket) => {
    connexions.add(socket);
    socket.on("error", () => {});
    socket.once("data", () => repondre(socket));
  });
  await new Promise<void>((r) => faux!.listen(0, "127.0.0.1", () => r()));
  const adresse = faux.address();
  if (adresse === null || typeof adresse === "string") throw new Error("adresse inattendue");
  return `http://127.0.0.1:${adresse.port}`;
}

/** Réponse comme MOTIS : en-têtes sans longueur, corps, puis fermeture. */
function commeMotis(corps: Buffer, statut = "200 OK"): (s: Socket) => void {
  const entete = `HTTP/1.1 ${statut}\r\nContent-Type: application/json\r\nServer: MOTIS v2.11.4\r\n\r\n`;
  return (s) => s.end(Buffer.concat([Buffer.from(entete), corps]));
}

/** ~5 Mo de JSON, comme `/api/v6/plan` avec le taxi sur un trajet d'Île-de-France. */
function grosJson(): { objet: unknown; octets: Buffer } {
  const objet = {
    itineraries: Array.from({ length: 20_000 }, (_, i) => ({
      i,
      legGeometry: { points: "é".repeat(100), precision: 6, length: 42 },
    })),
  };
  return { objet, octets: Buffer.from(JSON.stringify(objet)) };
}

async function erreurDe(p: Promise<unknown>): Promise<ErreurMotis> {
  const e: unknown = await p.then(
    () => undefined,
    (x: unknown) => x,
  );
  expect(e).toBeInstanceOf(ErreurMotis);
  return e as ErreurMotis;
}

describe("lireMotis (issue 0020)", () => {
  it("lit en entier 3 gros corps terminés par la fermeture, en parallèle, plusieurs tours", async () => {
    const { objet, octets } = grosJson();
    expect(octets.length).toBeGreaterThan(5_000_000);
    const base = await fauxServeur(commeMotis(octets));
    for (let tour = 0; tour < 5; tour++) {
      const lus = await Promise.all(
        [1, 2, 3].map((n) => lireMotis(new URL(`/api/v6/plan?n=${n}`, base), 30_000)),
      );
      for (const lu of lus) expect(lu).toEqual(objet);
    }
  }, 60_000);

  it("statut d'erreur ⇒ ErreurMotis, sans la requête de l'URL (invariant 10)", async () => {
    const base = await fauxServeur(commeMotis(Buffer.from("{}"), "500 Internal Server Error"));
    const e = await erreurDe(lireMotis(new URL("/api/v6/plan?fromPlace=48.1,2.3", base), 5_000));
    expect(e.message).toContain("500");
    expect(e.message).not.toContain("48.1");
  });

  it("JSON illisible ⇒ ErreurMotis", async () => {
    const base = await fauxServeur(commeMotis(Buffer.from("pas du json")));
    await erreurDe(lireMotis(new URL("/api/v6/plan", base), 5_000));
  });

  it("serveur absent ⇒ ErreurMotis, sans la requête de l'URL", async () => {
    const e = await erreurDe(lireMotis(new URL("http://127.0.0.1:1/api/v6/plan?fromPlace=48.1,2.3"), 2_000));
    expect(e.message).not.toContain("48.1");
  });

  it("aucune réponse avant le délai ⇒ ErreurMotis", async () => {
    const base = await fauxServeur(() => {});
    const debut = Date.now();
    const e = await erreurDe(lireMotis(new URL("/api/v6/plan", base), 200));
    expect(e.message).toContain("délai dépassé");
    expect(Date.now() - debut).toBeLessThan(2_000);
  });

  it("corps commencé puis bloqué au-delà du délai ⇒ ErreurMotis, jamais un corps tronqué", async () => {
    const base = await fauxServeur((s) =>
      s.write('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"itineraries":['),
    );
    const debut = Date.now();
    await erreurDe(lireMotis(new URL("/api/v6/plan", base), 300));
    expect(Date.now() - debut).toBeLessThan(2_000);
  });
});
