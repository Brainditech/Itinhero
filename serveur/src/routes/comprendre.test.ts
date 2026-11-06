import { describe, expect, it } from "vitest";
import { schemaSortieClaude, type AppelClaude, type Contexte } from "../comprendre/comprendre.js";
import { CompteurCout, coutEur } from "../comprendre/cout.js";
import { appTest, ENTETE } from "../outils-test.js";
import { contexteParis, type Claude } from "./comprendre.js";

const SORTIE = {
  lieu_texte: "France Travail Joigny",
  depart_texte: null,
  date: "2026-11-12",
  heure: "10:00",
  sens: "arriver",
  marge: null,
  fin_rdv: "11:30",
};
const JETONS = { input_tokens: 1000, output_tokens: 100 };

function claudeTest(
  reponse: () => Promise<{ sortie: unknown; refus?: boolean }>,
  vu: { appels: number; contexte?: Contexte; phrase?: string } = { appels: 0 },
  compteur = new CompteurCout(10),
): Claude {
  const appel: AppelClaude = async (phrase, contexte) => {
    vu.appels++;
    Object.assign(vu, { phrase, contexte });
    const r = await reponse();
    return { sortie: r.sortie, jetons: JETONS, refus: r.refus ?? false };
  };
  return { appel, modele: "claude-haiku-5-5", compteur };
}

const poster = (app: ReturnType<typeof appTest>, payload: unknown, headers: Record<string, string> = ENTETE) =>
  app.inject({ method: "POST", url: "/v1/comprendre", headers, payload: payload as object });

describe("POST /v1/comprendre (spec 28)", () => {
  it("phrase comprise ⇒ 200 avec les champs de la requête, rien d'autre (critère 1)", async () => {
    const vu = { appels: 0 } as { appels: number; phrase?: string };
    const app = appTest({ claude: claudeTest(async () => ({ sortie: SORTIE }), vu) });
    const r = await poster(app, { phrase: "  jeudi 10h RDV France Travail Joigny jusqu'à 11h30 " });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ comprehension: SORTIE });
    expect(vu.phrase).toBe("jeudi 10h RDV France Travail Joigny jusqu'à 11h30");
  });

  it.each([
    ["absente", {}],
    ["trop courte", { phrase: "a" }],
    ["trop longue", { phrase: "x".repeat(301) }],
    ["champ en plus (historique, coordonnées)", { phrase: "jeudi 10h Joigny", lat: 47.9 }],
  ])("phrase %s ⇒ 400 sans appeler Claude (critère 2)", async (_cas, corps) => {
    const vu = { appels: 0 };
    const app = appTest({ claude: claudeTest(async () => ({ sortie: SORTIE }), vu) });
    expect((await poster(app, corps)).statusCode).toBe(400);
    expect(vu.appels).toBe(0);
  });

  it("sans clé d'appareil ⇒ 401 ; au-delà de la limite par minute ⇒ 429 (critère 3)", async () => {
    const vu = { appels: 0 };
    const app = appTest({ claude: claudeTest(async () => ({ sortie: SORTIE }), vu), parMinute: 1 });
    expect((await poster(app, { phrase: "jeudi 10h Joigny" }, {})).statusCode).toBe(401);
    expect((await poster(app, { phrase: "jeudi 10h Joigny" })).statusCode).toBe(200);
    expect((await poster(app, { phrase: "jeudi 10h Joigny" })).statusCode).toBe(429);
    expect(vu.appels).toBe(1);
  });

  it.each([
    ["heure impossible", { ...SORTIE, heure: "25:00" }],
    ["date impossible", { ...SORTIE, date: "2026-02-30" }],
    ["marge hors bornes", { ...SORTIE, marge: 500 }],
    ["champ en plus (un horaire de train)", { ...SORTIE, train: "08:50" }],
    ["champ manquant", { lieu_texte: "Joigny" }],
    ["lieu d'un caractère", { ...SORTIE, lieu_texte: "J" }],
    ["rien (sortie illisible)", null],
  ])("sortie de Claude hors schéma (%s) ⇒ 503 comprendre_indisponible (critère 4)", async (_cas, sortie) => {
    const app = appTest({ claude: claudeTest(async () => ({ sortie })) });
    const r = await poster(app, { phrase: "jeudi 10h Joigny" });
    expect(r.statusCode).toBe(503);
    expect(r.json()).toEqual({ erreur: "comprendre_indisponible" });
  });

  it("refus, panne de Claude ou Claude non configuré ⇒ 503 comprendre_indisponible (critère 5)", async () => {
    const refus = appTest({ claude: claudeTest(async () => ({ sortie: SORTIE, refus: true })) });
    const panne = appTest({ claude: claudeTest(() => Promise.reject(new Error("réseau"))) });
    const absent = appTest();
    for (const app of [refus, panne, absent]) {
      const r = await poster(app, { phrase: "jeudi 10h Joigny" });
      expect(r.statusCode).toBe(503);
      expect(r.json()).toEqual({ erreur: "comprendre_indisponible" });
    }
  });

  it("plafond du mois atteint ⇒ 503 plafond_atteint sans appeler Claude ; remis à zéro le mois suivant (critère 6)", async () => {
    let instant = new Date("2026-11-30T20:00:00Z");
    // Un appel coûte 1000 × 0,1 + 100 × 0,5 = 150 millionièmes ; plafond de 200 : le deuxième passe, le troisième non.
    const compteur = new CompteurCout(0.0002, () => instant);
    const vu = { appels: 0 };
    const app = appTest({ claude: claudeTest(async () => ({ sortie: SORTIE }), vu, compteur) });
    expect((await poster(app, { phrase: "jeudi 10h Joigny" })).statusCode).toBe(200);
    expect((await poster(app, { phrase: "jeudi 10h Joigny" })).statusCode).toBe(200);
    const r = await poster(app, { phrase: "jeudi 10h Joigny" });
    expect(r.statusCode).toBe(503);
    expect(r.json()).toEqual({ erreur: "plafond_atteint" });
    expect(vu.appels).toBe(2);
    instant = new Date("2026-11-30T23:30:00Z"); // 1er décembre 00:30 à Paris
    expect((await poster(app, { phrase: "jeudi 10h Joigny" })).statusCode).toBe(200);
  });

  it("ni la phrase ni la sortie dans les journaux (critère 7)", async () => {
    const lignes: string[] = [];
    const app = appTest({
      claude: claudeTest(async () => ({ sortie: { ...SORTIE, lieu_texte: "CANARI-SORTIE", heure: "99:99" } })),
      fluxJournal: { write: (l) => void lignes.push(l) },
    });
    await poster(app, { phrase: "CANARI-PHRASE jeudi" });
    const journal = lignes.join("\n");
    expect(lignes.length).toBeGreaterThan(0);
    expect(journal).not.toContain("CANARI");
  });
});

describe("contexte et coût (spec 28)", () => {
  it("date, jour et heure de Paris fournis par le serveur, changement d'heure compris (critère 8)", () => {
    expect(contexteParis(new Date("2026-11-12T06:05:00Z"))).toEqual({ aujourdhui: "2026-11-12", jourSemaine: "jeudi", heure: "07:05" });
    expect(contexteParis(new Date("2026-07-14T22:30:00Z"))).toEqual({ aujourdhui: "2026-07-15", jourSemaine: "mercredi", heure: "00:30" });
  });
  it("coût en euros, un dollar compté pour un euro, cache au prix d'entrée (×1,25 à l'écriture)", () => {
    expect(coutEur("claude-opus-5-5", { input_tokens: 1_000_000, output_tokens: 0 })).toBe(4);
    expect(coutEur("claude-opus-5-5", { input_tokens: 0, output_tokens: 1_000_000 })).toBe(20);
    expect(coutEur("claude-haiku-5-5", { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 1_000_000, cache_read_input_tokens: 1_000_000 })).toBeCloseTo(0.225);
  });
  it("la forme demandée à Claude a tous ses champs obligatoires (sortie structurée)", () => {
    expect(Object.keys(schemaSortieClaude.shape).sort()).toEqual(["date", "depart_texte", "fin_rdv", "heure", "lieu_texte", "marge", "sens"]);
  });
});
