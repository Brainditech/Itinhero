import { describe, expect, it } from "vitest";
import { conseilsValides, controlerSortie, GABARITS, inviteAssistant, messageAssistant, type Gabarit, type Reglages } from "./assistant.js";

/** Spec 37 §3.3 : ce que le serveur garde de la sortie de Claude. */
const R: Reglages = {
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
const G: Gabarit[] = [
  { id: "valide_un", situation: "situation une", titre: "Titre", texte: "Texte du conseil {arrivee}.", valide: true },
  { id: "pas_relu", situation: "situation deux", titre: "Titre 2", texte: "Texte non relu.", valide: false },
];

describe("controlerSortie (spec 37)", () => {
  it("ne garde que ce qui change vraiment", () => {
    expect(controlerSortie({ ...VIDE, marge: 20, heure: "10:00", sens: "arriver", depart: "domicile" }, "20 min d'avance", R)).toEqual({
      action: "relancer",
      changements: { marge: 20 },
    });
  });

  it("départ en texte, arrivée nouvelle, retour, sens", () => {
    const s = { ...VIDE, depart: "texte", depart_texte: "gare de Sens", arrivee_texte: "mairie de Joigny", retour: "16:00", sens: "partir", heure: "08:00" };
    expect(controlerSortie(s, "partir de la gare de Sens à 8h", R)).toEqual({
      action: "relancer",
      changements: {
        depart: { type: "texte", texte: "gare de Sens" },
        arrivee: { type: "texte", texte: "mairie de Joigny" },
        retour: "16:00",
        sens: "partir_a",
        heure: "08:00",
      },
    });
    expect(controlerSortie({ ...VIDE, depart: "position" }, "d'ici", R)).toEqual({ action: "relancer", changements: { depart: { type: "position" } } });
  });

  it("sans retour : seulement s'il y en avait un", () => {
    expect(controlerSortie({ ...VIDE, sans_retour: true }, "pas de retour", { ...R, retour: "16:00" })).toEqual({
      action: "relancer",
      changements: { retour: null },
    });
    expect(controlerSortie({ ...VIDE, sans_retour: true }, "pas de retour", R)).toEqual({ action: "incompris" });
  });

  it("date ignorée si la phrase ne dit pas de jour (D113)", () => {
    expect(controlerSortie({ ...VIDE, date: "2026-11-13" }, "plus de marge", R)).toEqual({ action: "incompris" });
    expect(controlerSortie({ ...VIDE, date: "2026-11-13" }, "plutôt demain", R)).toEqual({ action: "relancer", changements: { date: "2026-11-13" } });
    // Jeu de 30 demandes, 2026-11-06 : « la veille » était écartée (mot absent de phraseDitUnJour).
    expect(controlerSortie({ ...VIDE, date: "2026-11-11" }, "la veille", R)).toEqual({ action: "relancer", changements: { date: "2026-11-11" } });
  });

  it("relancer sans changement ⇒ incompris", () => {
    expect(controlerSortie(VIDE, "euh", R)).toEqual({ action: "incompris" });
  });

  it("trier", () => {
    expect(controlerSortie({ ...VIDE, action: "trier", tri: "marche" }, "moins de marche", R)).toEqual({ action: "trier", tri: "marche" });
    expect(controlerSortie({ ...VIDE, action: "trier" }, "trie", R)).toEqual({ action: "incompris" });
  });

  it("conseil : seulement validé ; inconnu ou non relu ⇒ incompris", () => {
    expect(controlerSortie({ ...VIDE, action: "conseil", conseil_id: "valide_un" }, "si je rate", R, G)).toEqual({
      action: "conseil",
      conseil: { id: "valide_un", titre: "Titre", texte: "Texte du conseil {arrivee}." },
    });
    expect(controlerSortie({ ...VIDE, action: "conseil", conseil_id: "pas_relu" }, "x", R, G)).toEqual({ action: "incompris" });
    expect(controlerSortie({ ...VIDE, action: "conseil", conseil_id: "inconnu" }, "x", R, G)).toEqual({ action: "incompris" });
  });

  it("hors schéma ⇒ null", () => {
    expect(controlerSortie({ ...VIDE, heure: "1000" }, "x", R)).toBeNull();
    expect(controlerSortie({ ...VIDE, marge: 121 }, "x", R)).toBeNull();
    expect(controlerSortie({ ...VIDE, depart_texte: "x".repeat(201), depart: "texte" }, "x", R)).toBeNull();
  });
});

describe("gabarits et invite (spec 37)", () => {
  it("conseils.json se charge ; seuls les gabarits validés vont dans l'invite", () => {
    expect(GABARITS.length).toBeGreaterThan(0);
    expect(conseilsValides(G).map((g) => g.id)).toEqual(["valide_un"]);
    const invite = inviteAssistant(G);
    expect(invite).toContain("valide_un");
    expect(invite).not.toContain("pas_relu");
    expect(inviteAssistant(G.filter((g) => !g.valide))).toContain("n'utilise jamais l'action « conseil »");
  });

  it("le message à Claude porte les réglages en mots, sans coordonnées", () => {
    const m = messageAssistant("20 min d'avance", R, { aujourdhui: "2026-11-06", jourSemaine: "vendredi", heure: "14:00" });
    expect(m).toContain("départ Domicile ; arrivée France Travail Joigny ; le 2026-11-12 ; arriver avant 10:00 (rendez-vous), marge 10 min");
    expect(m).toContain("Demande : 20 min d'avance");
  });
});
