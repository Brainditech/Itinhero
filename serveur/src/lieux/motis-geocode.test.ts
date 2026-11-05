import { describe, expect, it } from "vitest";
import { lireReponseGeocode, transportDesModes } from "./motis-geocode.js";

describe("lireReponseGeocode", () => {
  // Issue 0019 : l'arrêt UT89:ST:06391 du jeu r83931 est placé à 0,0 dans son GTFS
  // (réponse de MOTIS v2.11.4 relevée le 2026-11-05, réduite aux champs lus).
  it("écarte un lieu placé à 0,0 exactement et garde les autres", () => {
    const brut = [
      { type: "STOP", name: "3 RUE DE LA GARE", lat: 47.9742, lon: 3.3938, areas: [] },
      { type: "STOP", name: "JOIGNY-3 RUE DE LA GARE", lat: 0, lon: 0, areas: [] },
    ];
    expect(lireReponseGeocode(brut).map((c) => c.nom)).toEqual(["3 RUE DE LA GARE"]);
  });

  it("garde un lieu dont une seule coordonnée vaut 0", () => {
    const brut = [{ type: "PLACE", name: "Méridien de Greenwich", lat: 48.5, lon: 0, areas: [] }];
    expect(lireReponseGeocode(brut)).toHaveLength(1);
  });

  // Modes relevés sur le MOTIS national le 2026-11-05 (spec 18, §12).
  it("un arrêt garde son transport le plus lourd ; un lieu ou une adresse n'en a pas", () => {
    const brut = [
      { type: "STOP", name: "Châtelet", lat: 48.8584, lon: 2.3485, areas: [], modes: ["SUBWAY", "BUS"] },
      { type: "STOP", name: "Domer - Garibaldi", lat: 45.75, lon: 4.85, areas: [], modes: [] },
      { type: "PLACE", name: "Saint-Michel-sur-Orge", lat: 48.63, lon: 2.3, areas: [], modes: ["BUS"] },
    ];
    const [chatelet, sansMode, commune] = lireReponseGeocode(brut);
    expect(chatelet!.transport).toBe("metro");
    expect(sansMode).not.toHaveProperty("transport");
    expect(commune).not.toHaveProperty("transport");
  });
});

describe("transportDesModes (D92)", () => {
  it("le plus lourd l'emporte", () => {
    expect(transportDesModes(["REGIONAL_RAIL", "SUBWAY", "BUS"])).toBe("train"); // Gare de Lyon
    expect(transportDesModes(["SUBWAY", "BUS"])).toBe("metro"); // Châtelet
    expect(transportDesModes(["REGIONAL_RAIL", "TRAM", "BUS"])).toBe("train"); // Dijon Gare
    expect(transportDesModes(["TRAM", "BUS"])).toBe("tram");
    expect(transportDesModes(["COACH", "BUS"])).toBe("car");
    expect(transportDesModes(["BUS"])).toBe("bus");
    expect(transportDesModes(["ODM"])).toBe("bus");
    expect(transportDesModes(["FERRY"])).toBe("bateau");
    expect(transportDesModes(["SUBURBAN"])).toBe("train");
  });

  it("aucun mode connu ⇒ rien", () => {
    expect(transportDesModes([])).toBeUndefined();
    expect(transportDesModes(undefined)).toBeUndefined();
    expect(transportDesModes(["AERIAL_LIFT"])).toBeUndefined();
  });
});
