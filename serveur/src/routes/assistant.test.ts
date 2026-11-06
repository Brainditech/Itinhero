import { describe, expect, it } from "vitest";
import type { AppelAssistant } from "../assistant/assistant.js";
import { CompteurCout } from "../comprendre/cout.js";
import { appTest, ENTETE } from "../outils-test.js";
import type { Claude } from "./comprendre.js";

/** Spec 37, critère 1. */
const REGLAGES = {
  depart: { type: "domicile" },
  arrivee: { type: "texte", texte: "France Travail Joigny" },
  date: "2026-11-12",
  heure: "10:00",
  sens: "arriver_avant",
  marge: 10,
  retour: null,
};
const VIDE = {
  action: "relancer",
  date: null,
  heure: null,
  sens: null,
  marge: null,
  depart: null,
  depart_texte: null,
  arrivee_texte: null,
  retour: null,
  sans_retour: null,
  tri: null,
  conseil_id: null,
};
const JETONS = { input_tokens: 1000, output_tokens: 100 };

function claudeTest(sortie: () => unknown, vu: { appels: number } = { appels: 0 }, compteur = new CompteurCout(10)): Claude {
  const assistant: AppelAssistant = async () => {
    vu.appels++;
    return { sortie: sortie(), jetons: JETONS, refus: false };
  };
  return { appel: async () => ({ sortie: null, jetons: JETONS, refus: false }), assistant, modele: "claude-haiku-5-5", compteur };
}

const poster = (app: ReturnType<typeof appTest>, payload: unknown, headers: Record<string, string> = ENTETE) =>
  app.inject({ method: "POST", url: "/v1/assistant", headers, payload: payload as object });

describe("POST /v1/assistant (spec 37)", () => {
  it("« 20 min d'avance au lieu de 10 » ⇒ 200, seule la marge change", async () => {
    const app = appTest({ claude: claudeTest(() => ({ ...VIDE, marge: 20, heure: "10:00" })) });
    const r = await poster(app, { phrase: "Je voudrais 20 min d'avance au lieu de 10.", reglages: REGLAGES });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ reponse: { action: "relancer", changements: { marge: 20 } } });
  });

  it.each([
    ["sans réglages", { phrase: "plus de marge" }],
    ["coordonnées dans un bout", { phrase: "plus de marge", reglages: { ...REGLAGES, depart: { type: "domicile", lat: 47.9, lon: 3.5 } } }],
    ["lieu choisi avec son point", { phrase: "plus de marge", reglages: { ...REGLAGES, arrivee: { type: "lieu", nom: "x", lat: 1, lon: 1 } } }],
    ["historique en plus", { phrase: "plus de marge", reglages: REGLAGES, historique: ["a"] }],
    ["marge hors bornes", { phrase: "plus de marge", reglages: { ...REGLAGES, marge: 500 } }],
  ])("entrée %s ⇒ 400 sans appeler Claude", async (_cas, corps) => {
    const vu = { appels: 0 };
    const app = appTest({ claude: claudeTest(() => VIDE, vu) });
    expect((await poster(app, corps)).statusCode).toBe(400);
    expect(vu.appels).toBe(0);
  });

  it("sans clé ⇒ 401 ; au-delà de la limite ⇒ 429", async () => {
    const vu = { appels: 0 };
    const app = appTest({ claude: claudeTest(() => ({ ...VIDE, marge: 20 }), vu), parMinute: 1 });
    const corps = { phrase: "20 min d'avance", reglages: REGLAGES };
    expect((await poster(app, corps, {})).statusCode).toBe(401);
    expect((await poster(app, corps)).statusCode).toBe(200);
    expect((await poster(app, corps)).statusCode).toBe(429);
    expect(vu.appels).toBe(1);
  });

  it("plafond atteint ⇒ 503 plafond_atteint sans appel (même compteur que /v1/comprendre)", async () => {
    const compteur = new CompteurCout(0.0001);
    compteur.ajouter(0.0002);
    const vu = { appels: 0 };
    const app = appTest({ claude: claudeTest(() => VIDE, vu, compteur) });
    const r = await poster(app, { phrase: "20 min d'avance", reglages: REGLAGES });
    expect(r.statusCode).toBe(503);
    expect(r.json()).toEqual({ erreur: "plafond_atteint" });
    expect(vu.appels).toBe(0);
  });

  it.each([
    ["heure impossible", { ...VIDE, heure: "25:00" }],
    ["action inconnue", { ...VIDE, action: "horaire" }],
    ["marge négative", { ...VIDE, marge: -5 }],
    ["sortie vide", null],
  ])("sortie hors schéma (%s) ⇒ 503 assistant_indisponible", async (_cas, sortie) => {
    const app = appTest({ claude: claudeTest(() => sortie) });
    const r = await poster(app, { phrase: "20 min d'avance", reglages: REGLAGES });
    expect(r.statusCode).toBe(503);
    expect(r.json()).toEqual({ erreur: "assistant_indisponible" });
  });

  it("Claude non configuré ⇒ 503 assistant_indisponible", async () => {
    const r = await poster(appTest(), { phrase: "20 min d'avance", reglages: REGLAGES });
    expect(r.statusCode).toBe(503);
    expect(r.json()).toEqual({ erreur: "assistant_indisponible" });
  });

  it("ni la demande ni la sortie dans les journaux", async () => {
    const lignes: string[] = [];
    const app = appTest({
      claude: claudeTest(() => ({ ...VIDE, arrivee_texte: "CANARI-SORTIE", heure: "99:99" })),
      fluxJournal: { write: (l) => void lignes.push(l) },
    });
    await poster(app, { phrase: "CANARI-PHRASE demain", reglages: { ...REGLAGES, arrivee: { type: "texte", texte: "CANARI-LIEU" } } });
    const tout = lignes.join("\n");
    expect(tout).toContain("sortie_hors_schema");
    expect(tout).not.toMatch(/CANARI/);
  });
});
