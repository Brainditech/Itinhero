import { describe, expect, it } from "vitest";
import { appTest, ENTETE, moteurEnPanne } from "./outils-test.js";
import { ENTETES_SECURITE, routesDeclarees } from "./securite.js";

/**
 * Spec 26 (phase 9) : en-têtes de sécurité, entrée invalide ⇒ 400 sur chaque route, journaux sans donnée personnelle.
 * Une route ajoutée sans entrée invalide dans `INVALIDES` fait échouer le test « chaque route est couverte ».
 */
type Requete = { method: "GET" | "POST" | "DELETE"; url: string; payload?: string };

/** Une entrée invalide par route de `/v1` (paramètre inconnu ou champ hors schéma). */
const INVALIDES: Record<string, Requete> = {
  "GET /v1/lieux": { method: "GET", url: "/v1/lieux?q=Joigny&inconnu=1" },
  "GET /v1/course": { method: "GET", url: "/v1/course?id=abc" },
  "POST /v1/itineraires": { method: "POST", url: "/v1/itineraires", payload: JSON.stringify({ date: "2026-13-01" }) },
  "POST /v1/marche": { method: "POST", url: "/v1/marche", payload: JSON.stringify({ de: { lat: 95, lon: 0 } }) },
  "POST /v1/comprendre": { method: "POST", url: "/v1/comprendre", payload: JSON.stringify({ phrase: "jeudi", lat: 47 }) },
  "POST /v1/abonnements": { method: "POST", url: "/v1/abonnements", payload: JSON.stringify({ trip_id: "x" }) },
  "DELETE /v1/abonnements/:id": { method: "DELETE", url: "/v1/abonnements/pas-un-id" },
};
/** Routes sans entrée à valider, ou validées ailleurs. */
const SANS_ENTREE = new Set(["GET /health"]);

const envoyer = (app: ReturnType<typeof appTest>, r: Requete, entetes: Record<string, string> = ENTETE) =>
  app.inject({
    method: r.method,
    url: r.url,
    headers: r.payload ? { ...entetes, "content-type": "application/json" } : entetes,
    ...(r.payload ? { payload: r.payload } : {}),
  });

function verifierEntetes(entetes: Record<string, unknown>, cas: string): void {
  for (const [nom, valeur] of Object.entries(ENTETES_SECURITE)) expect(entetes[nom], `${cas} : ${nom}`).toBe(valeur);
  expect(entetes["x-powered-by"], cas).toBeUndefined();
}

describe("en-têtes HTTP de sécurité (critère 1)", () => {
  it("sur /health, une 400, une 401, une 404, une 413, une 429 et une 503", async () => {
    const app = appTest({ moteur: moteurEnPanne, parMinute: 1, parJour: 1 });
    const cas: [string, () => Promise<{ statusCode: number; headers: Record<string, unknown> }>][] = [
      ["200 /health", () => app.inject({ method: "GET", url: "/health" })],
      ["401", () => app.inject({ method: "GET", url: "/v1/lieux?q=Joigny" })],
      ["404", () => app.inject({ method: "GET", url: "/inconnue" })],
      ["400", () => envoyer(app, INVALIDES["GET /v1/lieux"]!)],
      ["429", () => app.inject({ method: "GET", url: "/v1/lieux?q=Joigny", headers: ENTETE })],
    ];
    const attendus = [200, 401, 404, 400, 429];
    for (const [i, [nom, appel]] of cas.entries()) {
      const r = await appel();
      expect(r.statusCode, nom).toBe(attendus[i]);
      verifierEntetes(r.headers, nom);
    }
    const app2 = appTest({ moteur: moteurEnPanne });
    const panne = await app2.inject({ method: "GET", url: "/v1/lieux?q=Joigny", headers: ENTETE });
    expect(panne.statusCode).toBe(503);
    verifierEntetes(panne.headers, "503");
    const gros = await envoyer(app2, { method: "POST", url: "/v1/marche", payload: JSON.stringify({ x: "y".repeat(5000) }) });
    expect(gros.statusCode).toBe(413);
    verifierEntetes(gros.headers, "413");
  });
});

describe("chaque route refuse une entrée invalide par un 400 (critère 2)", () => {
  it("chaque route déclarée est couverte par ce test", async () => {
    const app = appTest();
    await app.ready();
    expect(routesDeclarees(app)).toEqual(expect.arrayContaining([...SANS_ENTREE, ...Object.keys(INVALIDES)]));
    const nonCouvertes =routesDeclarees(app).filter((r) => !(r in INVALIDES) && !SANS_ENTREE.has(r));
    expect(nonCouvertes).toEqual([]);
  });
  it.each(Object.entries(INVALIDES))("%s ⇒ 400 qui nomme les champs sans recopier la valeur", async (_nom, requete) => {
    const app = appTest();
    const r = await envoyer(app, requete);
    expect(r.statusCode).toBe(400);
    expect(r.json().erreur).toBe("requete_invalide");
    expect(r.body).not.toContain("2026-13-01");
  });
});

describe("journaux sans donnée personnelle, sur toutes les routes (critère 3)", () => {
  it("ni lieu, ni coordonnées, ni identifiant de course, ni clé, ni corps illisible", async () => {
    const lignes: string[] = [];
    const app = appTest({ moteur: moteurEnPanne, fluxJournal: { write: (l) => void lignes.push(l) } });
    const canaris: Requete[] = [
      { method: "GET", url: "/v1/lieux?q=CANARI-LIEU&proche=12.345678,98.765432" },
      { method: "GET", url: "/v1/course?id=CANARI-COURSE" },
      {
        method: "POST",
        url: "/v1/itineraires",
        payload: JSON.stringify({
          depart: { lat: 12.345678, lon: 98.765432 },
          arrivee: { lat: 12.345679, lon: 98.765433 },
          date: "2026-11-12",
          heure: "08:00",
          sens: "partir",
        }),
      },
      { method: "POST", url: "/v1/marche", payload: JSON.stringify({ de: { lat: 12.345678, lon: 98.765432 }, a: { lat: 12.345679, lon: 98.765433 } }) },
      { method: "POST", url: "/v1/marche", payload: '{"CANARI-CORPS' },
      { method: "GET", url: "/v1/lieux?q=CANARI-SANS-CLE" },
    ];
    for (const [i, c] of canaris.entries()) await envoyer(app, c, i === canaris.length - 1 ? {} : ENTETE);
    const journal = lignes.join("\n");
    expect(lignes.length).toBeGreaterThan(0);
    for (const interdit of ["CANARI", "12.34567", "98.76543", ENTETE.authorization.slice(7)]) {
      expect(journal).not.toContain(interdit);
    }
  });
});
