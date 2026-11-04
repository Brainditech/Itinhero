import { describe, expect, it } from "vitest";

import { domicileDepuisCandidat, lireDomicile } from "./domicile";

const CANDIDAT = {
  nom: "Mairie",
  type: "lieu" as const,
  commune: "Brienon-sur-Armançon",
  code_postal: "89210",
  lat: 47.9918,
  lon: 3.617,
  distance_metres: 120,
};

describe("domicile (D65)", () => {
  it("candidat ⇒ domicile, sans la distance", () => {
    expect(domicileDepuisCandidat(CANDIDAT)).toEqual({
      libelle: "Mairie",
      detail: "Brienon-sur-Armançon, 89210",
      lat: 47.9918,
      lon: 3.617,
    });
    expect(domicileDepuisCandidat({ ...CANDIDAT, commune: null, code_postal: null }).detail).toBeNull();
  });

  it("aller-retour par la base", () => {
    const d = domicileDepuisCandidat(CANDIDAT);
    expect(lireDomicile(JSON.stringify(d))).toEqual(d);
  });

  it.each([
    ["absent", null],
    ["vide", ""],
    ["illisible", "{pas du json"],
    ["incomplet", JSON.stringify({ libelle: "Mairie" })],
    ["hors bornes", JSON.stringify({ libelle: "x", detail: null, lat: 120, lon: 3 })],
  ])("valeur %s ⇒ null", (_cas, texte) => {
    expect(lireDomicile(texte)).toBeNull();
  });
});
