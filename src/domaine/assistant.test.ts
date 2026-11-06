import { describe, expect, it } from "vitest";
import { appliquerChangements, pucesReglages, reglagesDepuisChamps, remplirConseil, schemaReponseAssistant } from "./assistant";
import type { ChampsFormulaire } from "./demande";

/** Spec 37, critère 3. La recherche de la maquette 09 : jeudi 12/11, arriver avant 10:00, marge 10. */
const CHAMPS: ChampsFormulaire = {
  depart: { type: "domicile" },
  arrivee: { type: "lieu", nom: "France Travail Joigny", lat: 47.98, lon: 3.39, nature: "lieu", commune: null, code_postal: null },
  date: "2026-11-12",
  heure: "10:00",
  sens: "arriver_avant",
  marge: "10",
  retour: null,
};

describe("Assistant : réglages envoyés (D31)", () => {
  it("les lieux partent en texte, sans coordonnées", () => {
    const r = reglagesDepuisChamps(CHAMPS);
    expect(r).toEqual({
      depart: { type: "domicile" },
      arrivee: { type: "texte", texte: "France Travail Joigny" },
      date: "2026-11-12",
      heure: "10:00",
      sens: "arriver_avant",
      marge: 10,
      retour: null,
    });
    expect(JSON.stringify(r)).not.toMatch(/lat|lon|47\.98/);
  });

  it("marge illisible ⇒ 0", () => {
    expect(reglagesDepuisChamps({ ...CHAMPS, marge: "abc" }).marge).toBe(0);
  });
});

describe("Assistant : changements et puces", () => {
  it("« 20 min d'avance au lieu de 10 » : seule la marge change, l'arrivée garde son point", () => {
    const n = appliquerChangements(CHAMPS, { marge: 20 });
    expect(n).toEqual({ ...CHAMPS, marge: "20" });
    expect(pucesReglages(n, { marge: 20 })).toEqual([
      { cle: "jour", libelle: "Jeudi 12/11", change: false },
      { cle: "heure", libelle: "Arriver avant 10:00", change: false },
      { cle: "marge", libelle: "Marge 20 min", change: true },
      { cle: "depart", libelle: "Depuis Domicile", change: false },
      { cle: "arrivee", libelle: "Vers France Travail Joigny", change: false },
    ]);
  });

  it("nouveau départ en texte, « partir à », retour : puces marquées, pas de marge en « Partir à »", () => {
    const ch = { depart: { type: "texte" as const, texte: "gare de Sens" }, sens: "partir_a" as const, heure: "08:00", retour: "16:00" };
    const n = appliquerChangements(CHAMPS, ch);
    expect(n.depart).toEqual({ type: "texte", texte: "gare de Sens" });
    expect(pucesReglages(n, ch).map((p) => [p.libelle, p.change])).toEqual([
      ["Jeudi 12/11", false],
      ["Partir à 08:00", true],
      ["Depuis gare de Sens", true],
      ["Vers France Travail Joigny", false],
      ["Retour après 16:00", true],
    ]);
  });

  it("retour retiré ⇒ puce « Sans retour » marquée", () => {
    const avec = { ...CHAMPS, retour: "16:00" };
    expect(pucesReglages(appliquerChangements(avec, { retour: null }), { retour: null }).at(-1)).toEqual({ cle: "retour", libelle: "Sans retour", change: true });
  });

  it("rien n'est relancé ici : appliquer ne fait que rendre de nouveaux champs (confirmation à l'écran)", () => {
    const avant = structuredClone(CHAMPS);
    appliquerChangements(CHAMPS, { marge: 30, date: "2026-11-13" });
    expect(CHAMPS).toEqual(avant);
  });
});

describe("Assistant : conseils (D31)", () => {
  it("valeurs remplies ; absente ou vide ⇒ « — »", () => {
    expect(remplirConseil("Pour aller à {arrivee} depuis {depart}.", { arrivee: "Joigny", depart: "" })).toBe("Pour aller à Joigny depuis —.");
    expect(remplirConseil("Départ {heure_depart}.", {})).toBe("Départ —.");
  });
});

describe("Assistant : réponse du serveur", () => {
  it("lit les quatre actions ; refuse une action inconnue", () => {
    expect(schemaReponseAssistant.safeParse({ reponse: { action: "relancer", changements: { marge: 20 } } }).success).toBe(true);
    expect(schemaReponseAssistant.safeParse({ reponse: { action: "trier", tri: "marche" } }).success).toBe(true);
    expect(schemaReponseAssistant.safeParse({ reponse: { action: "conseil", conseil: { id: "a", titre: "b", texte: "c" } } }).success).toBe(true);
    expect(schemaReponseAssistant.safeParse({ reponse: { action: "incompris" } }).success).toBe(true);
    expect(schemaReponseAssistant.safeParse({ reponse: { action: "horaire", heure: "08:12" } }).success).toBe(false);
  });
});
