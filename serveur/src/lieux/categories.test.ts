import { describe, expect, it } from "vitest";
import { reduire } from "../donnees/lieux.js";
import { appTest, ENTETE } from "../outils-test.js";
import { comprendreCategorie, IndexLieux, type LieuOsm } from "./categories.js";

const PARIS = { lat: 48.8566, lon: 2.3522 };
const L = (n: string, k: string, la: number, lo: number, c?: string[]): LieuOsm => ({ n, k, la, lo, ...(c ? { c } : {}) });

describe("comprendreCategorie (D61)", () => {
  it("catégorie et cuisine", () => {
    expect(comprendreCategorie("restaurant chinois")).toEqual({ categories: ["restaurant", "fast_food"], cuisines: ["chinese", "asian"] });
    expect(comprendreCategorie("Pharmacie")).toEqual({ categories: ["pharmacy"], cuisines: [] });
    expect(comprendreCategorie("un resto japonais")?.cuisines).toContain("japanese");
  });
  it("une cuisine seule cherche un restaurant", () => {
    expect(comprendreCategorie("pizzeria")?.categories).toEqual(["restaurant", "fast_food"]);
  });
  it("un nom propre n'est pas une catégorie", () => {
    expect(comprendreCategorie("Restaurant du Canal Saint-Martin")).toBeNull();
    expect(comprendreCategorie("Tour Eiffel")).toBeNull();
    expect(comprendreCategorie("docteur Martin")).toBeNull();
  });
});

describe("IndexLieux", () => {
  const index = new IndexLieux([
    L("Le Dragon d'Or", "restaurant", 48.857, 2.353, ["chinese"]),
    L("Pizza Roma", "restaurant", 48.8567, 2.3523, ["pizza"]),
    L("Grand Wok", "restaurant", 48.86, 2.36, ["asian"]),
    L("Chinois de Lyon", "restaurant", 45.76, 4.85, ["chinese"]),
    L("Pharmacie Centrale", "pharmacy", 48.8568, 2.3524),
  ]);
  it("les plus proches de la catégorie et de la cuisine, dans le rayon", () => {
    const r = index.chercher({ categories: ["restaurant"], cuisines: ["chinese", "asian"] }, PARIS);
    expect(r.map((c) => c.nom)).toEqual(["Le Dragon d'Or", "Grand Wok"]);
    expect(r[0]).toMatchObject({ type: "lieu", source: "osm" });
  });
  it("une catégorie sans cuisine ; rien au-delà du rayon", () => {
    expect(index.chercher({ categories: ["pharmacy"], cuisines: [] }, PARIS).map((c) => c.nom)).toEqual(["Pharmacie Centrale"]);
    expect(index.chercher({ categories: ["pharmacy"], cuisines: [] }, { lat: 43.3, lon: 5.4 })).toEqual([]);
  });
  it("route : catégorie d'abord, seulement avec un point `proche`", async () => {
    const moteur = { plan: () => Promise.reject(new Error("inutile")), geocoder: async () => [] };
    const app = appTest({ moteur, lieux: index });
    const avec = await app.inject({ method: "GET", url: "/v1/lieux?q=restaurant%20chinois&proche=48.8566,2.3522", headers: ENTETE });
    expect(avec.json().candidats.map((c: { nom: string }) => c.nom)).toEqual(["Le Dragon d'Or", "Grand Wok"]);
    expect(avec.json().candidats[0].distance_metres).toBe(70); // 48.857,2.353 depuis 48.8566,2.3522 : 72 m
    const sans = await app.inject({ method: "GET", url: "/v1/lieux?q=restaurant%20chinois", headers: ENTETE });
    expect(sans.json().candidats).toEqual([]);
  });
});

describe("réduction des lieux d'OSM", () => {
  it("nom, catégorie, cuisines, commune ; surface ramenée à un point ; sans nom ⇒ écarté", () => {
    expect(
      reduire({ geometry: { type: "Point", coordinates: [2.35, 48.85] }, properties: { name: "Wok", amenity: "restaurant", cuisine: "chinese; Asian", "addr:city": "Paris" } }),
    ).toEqual({ n: "Wok", k: "restaurant", c: ["chinese", "asian"], v: "Paris", la: 48.85, lo: 2.35 });
    const surface = reduire({ geometry: { type: "Polygon", coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2]]] }, properties: { name: "Clinique", healthcare: "clinic" } });
    expect(surface).toMatchObject({ k: "clinic", la: 1, lo: 1 });
    expect(reduire({ geometry: { type: "Point", coordinates: [0, 0] }, properties: { amenity: "bar" } })).toBeNull();
  });
});
