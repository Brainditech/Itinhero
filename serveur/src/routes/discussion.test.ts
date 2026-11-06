import { describe, expect, it } from "vitest";
import type { AppelDiscussion } from "../assistant/discussion.js";
import { REMPLACEMENTS } from "../assistant/filtre.js";
import { CompteurCout } from "../comprendre/cout.js";
import { appTest, ENTETE } from "../outils-test.js";
import { ENTETES_SECURITE } from "../securite.js";
import type { Claude } from "./comprendre.js";

/** Spec 39 : `POST /v1/assistant/discussion`. */
const JETONS = { input_tokens: 2000, output_tokens: 300 };
const URL_ROUTE = "/v1/assistant/discussion";

const RECHERCHE = {
  depart: "Domicile",
  arrivee: "Flers",
  date: "2026-11-12",
  heure: "10:00",
  sens: "arriver_avant",
  marge: 10,
  possibilites: [{ modes: ["marche", "car", "train", "taxi"], correspondances: 2, marche_minutes: 12, alertes: ["taxi_a_reserver"] }],
};
const QUESTION = { messages: [{ role: "personne", texte: "Explique-moi mon trajet" }], recherche: RECHERCHE };

type Vu = { appels: number; signal?: AbortSignal; entree?: unknown };

function claudeTest(
  morceaux: string[],
  { vu = { appels: 0 } as Vu, compteur = new CompteurCout(10), panne = false, refus = false } = {},
): Claude {
  const discussion: AppelDiscussion = async (entree, _contexte, surTexte, signal) => {
    vu.appels++;
    vu.signal = signal;
    vu.entree = entree;
    for (const m of morceaux) surTexte(m);
    if (panne) throw new Error("panne");
    return { jetons: JETONS, refus };
  };
  return { appel: async () => ({ sortie: null, jetons: JETONS, refus: false }), discussion, modele: "claude-haiku-5-5", compteur };
}

/** Événements d'un corps `text/event-stream`. */
function evenements(corps: string): { evenement: string; donnees: Record<string, unknown> }[] {
  return corps
    .split("\n\n")
    .filter((b) => b.trim() !== "")
    .map((b) => {
      const evenement = /^event: (.+)$/m.exec(b)?.[1] ?? "";
      const donnees = JSON.parse(/^data: (.+)$/m.exec(b)?.[1] ?? "{}") as Record<string, unknown>;
      return { evenement, donnees };
    });
}
const texteDe = (corps: string) =>
  evenements(corps)
    .filter((e) => e.evenement === "texte")
    .map((e) => e.donnees.texte)
    .join("");

const poster = (app: ReturnType<typeof appTest>, payload: unknown) =>
  app.inject({ method: "POST", url: URL_ROUTE, headers: ENTETE, payload: payload as object });

describe("POST /v1/assistant/discussion (spec 39)", () => {
  it("flux : morceaux filtrés puis `fin`, en-têtes de sécurité, coût ajouté au compteur", async () => {
    const compteur = new CompteurCout(10);
    const app = appTest({
      claude: claudeTest(["Votre car part à 14:", "48. Gardez 20 minutes de marge ; le taxi coûte 12 ", "€, appelez le 03 86 ", "12 34 56."], {
        compteur,
      }),
    });
    const r = await poster(app, QUESTION);
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toBe("text/event-stream; charset=utf-8");
    for (const [nom, valeur] of Object.entries(ENTETES_SECURITE)) expect(r.headers[nom], nom).toBe(valeur);
    const ev = evenements(r.body);
    expect(ev.at(-1)).toEqual({ evenement: "fin", donnees: {} });
    expect(texteDe(r.body)).toBe(
      `Votre car part à ${REMPLACEMENTS.heure}. Gardez 20 minutes de marge ; le taxi coûte ${REMPLACEMENTS.prix}, appelez le ${REMPLACEMENTS.numero}.`,
    );
    for (const interdit of ["14:", "48.", "12 €", "86 12"]) expect(r.body).not.toContain(interdit);
    expect(compteur.depense()).toBeCloseTo((2000 * 0.1 + 300 * 0.5) / 1_000_000);
  });

  it("un long texte part en plusieurs morceaux, pas d'un bloc", async () => {
    const mots = Array.from({ length: 120 }, (_, i) => `mot${"abcdefghij"[i % 10]} `);
    const app = appTest({ claude: claudeTest(mots) });
    const r = await poster(app, QUESTION);
    expect(evenements(r.body).filter((e) => e.evenement === "texte").length).toBeGreaterThan(5);
    expect(texteDe(r.body)).toBe(mots.join(""));
  });

  it("transmet la discussion et le résumé de la recherche à Claude", async () => {
    const vu: Vu = { appels: 0 };
    const app = appTest({ claude: claudeTest(["D'accord."], { vu }) });
    await poster(app, QUESTION);
    expect(vu.entree).toEqual(QUESTION);
  });

  const message = (texte: string, role = "personne") => ({ role, texte });
  it.each([
    ["coordonnées dans la recherche", { ...QUESTION, recherche: { ...RECHERCHE, lat: 47.9, lon: 3.5 } }],
    ["coordonnées dans un trajet", { ...QUESTION, recherche: { ...RECHERCHE, possibilites: [{ ...RECHERCHE.possibilites[0], depart: { lat: 1, lon: 1 } }] } }],
    ["coordonnées dans un lieu", { ...QUESTION, recherche: { ...RECHERCHE, depart: "47.98, 3.39" } }],
    ["coordonnées dans un message", { messages: [message("Je suis au 47.98123, 3.39456")] }],
    ["plus de 20 messages", { messages: Array.from({ length: 21 }, (_, i) => message("Bonjour", i % 2 ? "assistant" : "personne")) }],
    ["message de plus de 1 000 caractères", { messages: [message("a".repeat(1001))] }],
    ["dernier message de l'Assistant", { messages: [message("Bonjour"), message("Bonjour !", "assistant")] }],
    ["aucun message", { messages: [] }],
    ["champ inconnu", { ...QUESTION, historique: [] }],
    ["horaire dans un trajet", { ...QUESTION, recherche: { ...RECHERCHE, possibilites: [{ ...RECHERCHE.possibilites[0], depart: "08:12" }] } }],
  ])("%s ⇒ 400 sans appeler Claude", async (_cas, corps) => {
    const vu: Vu = { appels: 0 };
    const app = appTest({ claude: claudeTest(["x"], { vu }) });
    const r = await poster(app, corps);
    expect(r.statusCode).toBe(400);
    expect(r.json().erreur).toBe("requete_invalide");
    expect(vu.appels).toBe(0);
  });

  it("20 messages de 1 000 caractères sont acceptés", async () => {
    const messages = Array.from({ length: 20 }, (_, i) => message("é".repeat(1000), i % 2 ? "assistant" : "personne")).reverse();
    const app = appTest({ claude: claudeTest(["Oui."]) });
    const r = await poster(app, { messages: messages.reverse().map((m, i, t) => (i === t.length - 1 ? { ...m, role: "personne" } : m)) });
    expect(r.statusCode).toBe(200);
  });

  it("sans recherche en cours : accepté", async () => {
    const app = appTest({ claude: claudeTest(["Bonjour."]) });
    const r = await poster(app, { messages: [message("Comment réserver un transport à la demande ?")] });
    expect(r.statusCode).toBe(200);
    expect(texteDe(r.body)).toBe("Bonjour.");
  });

  it("plafond atteint ⇒ `erreur` `indisponible`, sans appeler Claude (critère 8)", async () => {
    const vu: Vu = { appels: 0 };
    const compteur = new CompteurCout(1);
    compteur.ajouter(1);
    const app = appTest({ claude: claudeTest(["x"], { vu, compteur }) });
    const r = await poster(app, QUESTION);
    expect(r.statusCode).toBe(200);
    expect(evenements(r.body)).toEqual([{ evenement: "erreur", donnees: { erreur: "indisponible" } }]);
    expect(vu.appels).toBe(0);
  });

  it("Claude non configuré ⇒ `erreur` `indisponible`", async () => {
    const app = appTest();
    const r = await poster(app, QUESTION);
    expect(evenements(r.body)).toEqual([{ evenement: "erreur", donnees: { erreur: "indisponible" } }]);
  });

  it("panne de Claude en cours de route ⇒ le texte déjà parti reste, puis `erreur`", async () => {
    const debut = "Bonjour, voici quelques explications utiles sur votre trajet de demain, étape par étape. ";
    const app = appTest({ claude: claudeTest([debut, "Ensuite"], { panne: true }) });
    const r = await poster(app, QUESTION);
    const ev = evenements(r.body);
    expect(ev.at(-1)).toEqual({ evenement: "erreur", donnees: { erreur: "indisponible" } });
    expect(texteDe(r.body).length).toBeGreaterThan(0);
  });

  it("refus de Claude ⇒ `erreur` `indisponible`", async () => {
    const app = appTest({ claude: claudeTest(["Non."], { refus: true }) });
    const r = await poster(app, QUESTION);
    expect(evenements(r.body).at(-1)).toEqual({ evenement: "erreur", donnees: { erreur: "indisponible" } });
  });

  it("le journal ne contient aucun texte de la discussion (critère 9)", async () => {
    const lignes: string[] = [];
    const app = appTest({ claude: claudeTest(["CANARI-REPONSE et la suite du texte."]), fluxJournal: { write: (l) => void lignes.push(l) } });
    await poster(app, { messages: [message("CANARI-QUESTION")], recherche: { ...RECHERCHE, arrivee: "CANARI-LIEU" } });
    const journal = lignes.join("\n");
    expect(journal).toContain("discussion de l'Assistant");
    expect(journal).toContain('"issue":"complete"');
    expect(journal).not.toContain("CANARI");
  });

  it("l'app ferme la connexion ⇒ l'appel à Claude est coupé (critère 3)", async () => {
    // La connexion fermée par l'app se voit côté serveur par l'événement `close` de la réponse : il est émis ici.
    let brut: { emit(evenement: "close"): boolean } | undefined;
    let signal: AbortSignal | undefined;
    const discussion: AppelDiscussion = (_e, _c, surTexte, s) =>
      new Promise((resoudre) => {
        signal = s;
        s.addEventListener("abort", () => resoudre({ jetons: JETONS, refus: false }));
        surTexte("Un premier morceau assez long pour partir tout de suite vers le téléphone, sans attendre la suite. ".repeat(2));
        brut!.emit("close");
      });
    const compteur = new CompteurCout(10);
    const lignes: string[] = [];
    const app = appTest({
      claude: { appel: async () => ({ sortie: null, jetons: JETONS, refus: false }), discussion, modele: "claude-haiku-5-5", compteur },
      fluxJournal: { write: (l) => void lignes.push(l) },
    });
    app.addHook("onRequest", async (_requete, reponse) => {
      brut = reponse.raw;
    });
    // Côté client, une réponse fermée avant la fin : l'injection échoue comme la lecture de l'app.
    await expect(poster(app, QUESTION)).rejects.toThrow("destroyed before completion");
    expect(signal?.aborted).toBe(true);
    await expect.poll(() => lignes.join("\n")).toContain('"issue":"arretee"');
    expect(compteur.depense()).toBeGreaterThan(0);
  });
});

describe("Spec 45 (D126) : recherche proposée et pièce jointe", () => {
  const claudeAvecRecherche = (recherches: unknown[]): Claude => {
    const discussion: AppelDiscussion = async (_e, _c, surTexte) => {
      surTexte("Je lance la recherche.");
      return { jetons: JETONS, refus: false, recherches };
    };
    return { appel: async () => ({ sortie: null, jetons: JETONS, refus: false }), discussion, modele: "claude-haiku-5-5", compteur: new CompteurCout(10) };
  };
  const PROPOSITION = { depart: "domicile", arrivee: "19 route de Chamvres, Joigny", date: "2099-11-12", heure: "10:00", sens: "arriver_avant" };

  it("la recherche proposée part en événement `recherche`, revalidée ; jour passé ou hors schéma : rien", async () => {
    const r = await poster(appTest({ claude: claudeAvecRecherche([PROPOSITION]) }), QUESTION);
    const ev = evenements(r.body);
    expect(ev.map((e) => e.evenement)).toEqual(["texte", "recherche", "fin"]);
    expect(ev[1]!.donnees).toEqual(PROPOSITION);
    const passe = await poster(appTest({ claude: claudeAvecRecherche([{ ...PROPOSITION, date: "2020-01-01" }]) }), QUESTION);
    expect(evenements(passe.body).map((e) => e.evenement)).toEqual(["texte", "fin"]);
    const faux = await poster(appTest({ claude: claudeAvecRecherche([{ ...PROPOSITION, arrivee: "47.98, 3.39", lat: 1 }]) }), QUESTION);
    expect(evenements(faux.body).map((e) => e.evenement)).toEqual(["texte", "fin"]);
  });

  it("pièce jointe : image reçue sur le dernier message ; sur un ancien message, ou pas en base64 ⇒ 400 ; jamais au journal", async () => {
    const vu: Vu = { appels: 0 };
    const lignes: string[] = [];
    const app = appTest({ claude: claudeTest(["Lu."], { vu }), fluxJournal: { write: (l: string) => void lignes.push(l) } });
    const image = { type: "image", media_type: "image/jpeg", donnees: "Q0FOQVJJLUlNQUdF" };
    const ok = await poster(app, { messages: [{ role: "personne", texte: "Ma convocation", piece_jointe: image }] });
    expect(ok.statusCode).toBe(200);
    expect(JSON.stringify(vu.entree)).toContain("Q0FOQVJJLUlNQUdF");
    expect(lignes.join("")).not.toContain("Q0FOQVJJLUlNQUdF");
    const ancien = await poster(app, {
      messages: [
        { role: "personne", texte: "Ma convocation", piece_jointe: image },
        { role: "assistant", texte: "Lu." },
        { role: "personne", texte: "Et ensuite ?" },
      ],
    });
    expect(ancien.statusCode).toBe(400);
    const pasBase64 = await poster(app, { messages: [{ role: "personne", texte: "x", piece_jointe: { ...image, donnees: "pas du base64 !" } }] });
    expect(pasBase64.statusCode).toBe(400);
  });
});
