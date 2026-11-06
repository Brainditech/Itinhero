import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { Possibilite } from "./api";
import { BASE_BLABLACAR, communeDuLieu, covoiturageEnTete, lienBlaBlaCar, phraseCovoiturage } from "./covoiturage";

const P: Possibilite = JSON.parse(readFileSync(path.join(__dirname, "__exemples__/possibilite-brienon-dijon.json"), "utf8"));
const AVEC_TAXI: Possibilite = { ...P, etapes: [{ ...P.etapes[1]!, mode: "taxi" }] };

const DOMICILE = { lat: 47.982345, lon: 3.398765, nom: "Domicile", adresse: "12 rue des Lilas, 89300 Joigny" };
const GARE = { lat: 48.8396, lon: 2.3828, nom: "Paris Bercy", adresse: "75012 Paris" };

describe("lienBlaBlaCar (spec 47, critères 1 et 2)", () => {
  it("recherche pré-remplie : communes, coordonnées au centième, date, une place, rien d'autre", () => {
    const url = new URL(lienBlaBlaCar(DOMICILE, GARE, "2026-11-12"));
    expect(`${url.origin}${url.pathname}`).toBe(BASE_BLABLACAR);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      fn: "Joigny",
      fc: "47.98,3.40",
      tn: "Paris",
      tc: "48.84,2.38",
      db: "2026-11-12",
      seats: "1",
    });
  });
  it("le domicile exact ne part pas : ni la rue ni les coordonnées précises", () => {
    const url = lienBlaBlaCar(DOMICILE, GARE, "2026-11-12");
    expect(url).not.toContain("Lilas");
    expect(url).not.toContain("47.982");
    expect(url).not.toContain("Domicile");
  });
  it("sans code postal, le nom du lieu ; un nom avec « & » reste dans son paramètre", () => {
    expect(communeDuLieu({ ...GARE, adresse: null, nom: "Ma position" })).toBe("Ma position");
    expect(communeDuLieu({ ...GARE, adresse: "Arrêt, 89100 Sens" })).toBe("Sens");
    const url = new URL(lienBlaBlaCar(DOMICILE, { ...GARE, adresse: null, nom: "Gare & Café" }, "2026-11-12"));
    expect(url.searchParams.get("tn")).toBe("Gare & Café");
  });
});

describe("covoiturageEnTete (spec 47, critère 3, D50)", () => {
  it("aucun trajet ⇒ en tête", () => expect(covoiturageEnTete([])).toBe(true));
  it("seulement des trajets avec un taxi ⇒ en tête", () => expect(covoiturageEnTete([AVEC_TAXI])).toBe(true));
  it("un trajet de transport public ⇒ en option, après les trajets", () => expect(covoiturageEnTete([P, AVEC_TAXI])).toBe(false));
});

describe("phraseCovoiturage (spec 47)", () => {
  it("aucun trajet, taxi seulement, ou trajets : une phrase exacte pour chacun", () => {
    expect(phraseCovoiturage([])).toBe("Aucun transport public n'arrive à l'heure ce jour-là. Un conducteur fait peut-être ce trajet.");
    expect(phraseCovoiturage([AVEC_TAXI])).toBe("Sans taxi, aucun transport public n'arrive à l'heure. Un conducteur fait peut-être ce trajet.");
    expect(phraseCovoiturage([P])).toBe("Autre possibilité : partager la voiture d'un conducteur.");
  });
});
