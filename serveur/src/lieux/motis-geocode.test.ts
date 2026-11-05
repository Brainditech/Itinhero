import { describe, expect, it } from "vitest";
import { lireReponseGeocode } from "./motis-geocode.js";

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
});
