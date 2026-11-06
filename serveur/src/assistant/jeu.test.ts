import { describe, expect, it } from "vitest";
import { controlerSortie, schemaReglages } from "./assistant.js";
import { conforme, JEU } from "./jeu.js";

describe("jeu de 30 demandes (spec 37, critère 2)", () => {
  it("30 demandes, réglages valides, attendus atteignables par le contrôle du serveur", () => {
    expect(JEU.demandes).toHaveLength(30);
    expect(schemaReglages.safeParse(JEU.reglages).success).toBe(true);
    for (const c of JEU.demandes) {
      expect(["relancer", "trier", "conseil", "incompris"], c.phrase).toContain(c.attendu.action);
      if (c.attendu.action === "relancer") expect(Object.keys(c.attendu.changements).length, c.phrase).toBeGreaterThan(0);
    }
  });

  it("notation : lieux sans casse ni accents ; autres champs exacts", () => {
    const attendu = { action: "relancer" as const, changements: { depart: { type: "texte" as const, texte: "gare de Sens" } } };
    expect(conforme({ action: "relancer", changements: { depart: { type: "texte", texte: "Gare de SENS" } } }, attendu)).toBe(true);
    expect(conforme({ action: "relancer", changements: { depart: { type: "texte", texte: "gare de Sens" }, marge: 20 } }, attendu)).toBe(false);
    expect(conforme({ action: "incompris" }, attendu)).toBe(false);
    expect(conforme(null, attendu)).toBe(false);
  });

  it("une sortie parfaite de Claude pour la première demande est notée juste", () => {
    const sortie = { action: "relancer", date: null, heure: null, sens: null, marge: 20, depart: null, depart_texte: null, arrivee_texte: null, retour: null, sans_retour: null, tri: null, conseil_id: null };
    const c = JEU.demandes[0]!;
    expect(conforme(controlerSortie(sortie, c.phrase, JEU.reglages), c.attendu)).toBe(true);
  });
});
