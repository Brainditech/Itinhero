import { describe, expect, it } from "vitest";
import { CONSIGNES, contexteDiscussion, messagesClaude, OUTIL_RECHERCHE, schemaPropositionRecherche, schemaRequeteDiscussion } from "./discussion.js";
import { CONTEXTE_JEU, INTERDITS, QUESTIONS_JEU, RECHERCHE_JEU } from "./jeu-discussion.js";
import { filtrerTexte } from "./filtre.js";

/** Spec 39 §3 et §8. */
describe("discussion de l'Assistant (spec 39)", () => {
  it("messages pour l'API : rôles traduits, consécutifs réunis, l'Assistant ne commence jamais", () => {
    expect(
      messagesClaude([
        { role: "assistant", texte: "Bonjour" },
        { role: "personne", texte: "Je rate le car" },
        { role: "personne", texte: "Je rate le car" },
        { role: "assistant", texte: "Pas de panique." },
        { role: "personne", texte: "Merci" },
      ]),
    ).toEqual([
      { role: "user", content: [{ type: "text", text: "Je rate le car" }, { type: "text", text: "Je rate le car" }] },
      { role: "assistant", content: [{ type: "text", text: "Pas de panique." }] },
      { role: "user", content: [{ type: "text", text: "Merci" }] },
    ]);
  });

  it("contexte : date de Paris, lieux en texte, trajets sans horaire", () => {
    const c = contexteDiscussion(CONTEXTE_JEU, RECHERCHE_JEU);
    expect(c).toContain("vendredi 2026-11-06");
    expect(c).toContain("de Domicile à Flers, le 2026-11-12, arriver avant 10:00 (rendez-vous), marge 10 min");
    expect(c).toContain("Trajet 2 : marche puis car puis train puis taxi ; 2 correspondances ; 6 min de marche ; taxi à réserver.");
    expect(c).toContain("Trajet 3 : marche puis train puis transport à la demande ; 1 correspondance");
    expect(contexteDiscussion(CONTEXTE_JEU, undefined)).toContain("Aucune recherche en cours.");
  });

  it("jeu de 20 questions : entrées valides pour la route", () => {
    expect(QUESTIONS_JEU).toHaveLength(20);
    for (const q of QUESTIONS_JEU) {
      const corps = { messages: [{ role: "personne", texte: q.question }], ...(q.avecRecherche ? { recherche: RECHERCHE_JEU } : {}) };
      expect(schemaRequeteDiscussion.safeParse(corps).success, q.question).toBe(true);
    }
  });

  it("les motifs interdits du jeu ne survivent jamais au filtre", () => {
    const texte = "Départ 14:48 ou 9h30, 12 €, 3 euros, appelez le 03 86 12 34 56 ou le +33 3 86 12 34 56.";
    expect(INTERDITS.some((r) => r.test(texte))).toBe(true);
    expect(INTERDITS.every((r) => !r.test(filtrerTexte(texte)))).toBe(true);
  });
});

describe("Spec 45 (D126)", () => {
  it("la pièce jointe passe avant le texte de son message ; l'outil de recherche est déclaré", () => {
    expect(
      messagesClaude([{ role: "personne", texte: "Voici ma convocation", piece_jointe: { type: "pdf", media_type: "application/pdf", donnees: "QUJD" } }]),
    ).toEqual([
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: "QUJD" } },
          { type: "text", text: "Voici ma convocation" },
        ],
      },
    ]);
    expect(OUTIL_RECHERCHE.input_schema.required).toEqual(["depart", "arrivee", "date", "heure", "sens"]);
    expect(CONSIGNES).toContain("proposer_recherche");
  });

  it("proposition : `marge: null` vaut sans marge, une clé en trop est ignorée, une heure fausse est refusée", () => {
    const p = { depart: "domicile", arrivee: "Gare de Joigny", date: "2026-11-12", heure: "10:00", sens: "arriver_avant" };
    expect(schemaPropositionRecherche.parse({ ...p, marge: null })).toEqual(p);
    expect(schemaPropositionRecherche.parse({ ...p, marge: 15, raison: "rendez-vous" })).toEqual({ ...p, marge: 15 });
    expect(schemaPropositionRecherche.safeParse({ ...p, heure: "25:00" }).success).toBe(false);
  });
});
