import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { gunzipSync } from "node:zlib";
import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { initSentry, Sentry } from "./init.js";

/**
 * Spec 50, critère 1 de bout en bout : le vrai SDK, pointé vers un faux Sentry local,
 * n'envoie sur le réseau ni phrase, ni lieu, ni coordonnée, ni en-tête, ni requête d'URL.
 */
let faux: Server;
const recus: string[] = [];

beforeAll(async () => {
  faux = createServer((req, res) => {
    const morceaux: Buffer[] = [];
    req.on("data", (m: Buffer) => morceaux.push(m));
    req.on("end", () => {
      const corps = Buffer.concat(morceaux);
      recus.push(req.headers["content-encoding"] === "gzip" ? gunzipSync(corps).toString("utf8") : corps.toString("utf8"));
      res.writeHead(200).end("{}");
    });
  });
  await new Promise<void>((ok) => faux.listen(0, "127.0.0.1", ok));
  const { port } = faux.address() as AddressInfo;
  expect(initSentry({ SENTRY_DSN_SERVEUR: `http://cle@127.0.0.1:${port}/1`, SENTRY_ENVIRONNEMENT: "test" })).toBe(true);
});

afterAll(async () => {
  await Sentry.close(2000);
  await new Promise<void>((ok) => faux.close(() => ok()));
});

describe("envoi réel vers un faux Sentry (spec 50)", () => {
  it("une erreur et une 500 Fastify partent nettoyées", async () => {
    Sentry.addBreadcrumb({ category: "console", message: "domicile : 18 Boulevard Maréchal de Lattre de Tassigny" });
    Sentry.captureException(new Error("lieux « rendez-vous gare de Joigny » : échec à 47.9918, 3.6170"));

    const app = Fastify();
    app.setErrorHandler((erreur, _requete, reponse) => {
      Sentry.captureException(erreur);
      return reponse.code(500).send({ erreur: "erreur_interne" });
    });
    app.post("/v1/itineraires", async () => {
      throw new Error("plantage pour « Gifi Joigny 2 »");
    });
    const r = await app.inject({
      method: "POST",
      url: "/v1/itineraires?q=Joigny&lat=47.9918",
      headers: { authorization: "Bearer secret-appareil", "content-type": "application/json" },
      payload: { depart: { lat: 47.9918, lon: 3.617 }, texte: "rendez-vous gare de Joigny" },
    });
    expect(r.statusCode).toBe(500);
    await app.close();
    await Sentry.flush(5000);

    // Les lignes de code jointes à la pile (contextLines) sont celles de ce fichier de test, qui cite « Joigny » :
    // en production ce sont celles du serveur. On les retire, puis on cherche les données dans tout le reste.
    const sansCode = (cle: string, v: unknown) => (["pre_context", "context_line", "post_context"].includes(cle) ? undefined : v);
    const tout = recus
      .flatMap((enveloppe) => enveloppe.split("\n"))
      .filter((ligne) => ligne.trim().startsWith("{"))
      .map((ligne) => JSON.stringify(JSON.parse(ligne), sansCode))
      .join("\n");
    expect(recus.length).toBeGreaterThanOrEqual(2);
    expect(tout).toContain("Error"); // les événements sont bien partis
    for (const interdit of ["Joigny", "Gifi", "47.99", "3.617", "Boulevard", "secret-appareil", "Bearer", "q=", "lat="]) {
      expect(tout, interdit).not.toContain(interdit);
    }
  });
});
