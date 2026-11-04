import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { appTest, ENTETE } from "../outils-test.js";
import { construireUrlIgn, fusionner, lireReponseIgn, type CandidatNote } from "./ign-geocode.js";
import type { Candidat } from "./motis-geocode.js";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const exemple = async (): Promise<unknown> =>
  JSON.parse(await readFile(path.join(ICI, "__exemples__/ign-place-republique.json"), "utf8"));
const PARIS = { lat: 48.8566, lon: 2.3522 };

const ign = (nom: string, score: number, lat: number, lon: number, commune = "X"): CandidatNote => ({
  nom, type: "lieu", commune, code_postal: null, lat, lon, source: "ign", score,
});
const motis = (nom: string, lat: number, lon: number): Candidat => ({
  nom, type: "arret", commune: "X", code_postal: null, lat, lon, source: "motis",
});

describe("géocodeur de l'IGN (D60)", () => {
  it("URL : index demandé, 10 résultats, point de référence facultatif", () => {
    const u = construireUrlIgn("Gare d'Auxerre", { lat: 47.8, lon: 3.57 }, "address");
    expect(u.origin + u.pathname).toBe("https://data.geopf.fr/geocodage/search");
    expect(u.searchParams.get("index")).toBe("address");
    expect(construireUrlIgn("x").searchParams.get("index")).toBe("poi");
    expect(u.searchParams.get("limit")).toBe("10");
    expect(u.searchParams.get("lat")).toBe("47.8");
    expect(construireUrlIgn("x").searchParams.has("lat")).toBe(false);
  });

  it("réponse enregistrée : adresses lues, commune, code postal, source ign", async () => {
    const c = lireReponseIgn(await exemple());
    expect(c.length).toBeGreaterThan(1);
    const paris = c.find((x) => x.commune === "Paris")!;
    expect(paris).toMatchObject({ nom: "Place de la République", type: "adresse", source: "ign" });
    expect(paris.code_postal).toMatch(/^75\d{3}$/);
  });

  it("lieu de la BD TOPO : nom en liste, plusieurs codes postaux ⇒ le premier", () => {
    const c = lireReponseIgn({
      features: [{
        geometry: { coordinates: [3.585093, 47.797265] },
        properties: { _type: "poi", score: 0.86, name: ["Gare d'Auxerre-Saint-Gervais"], city: ["Auxerre"], postcode: ["89000", "89290"] },
      }],
    });
    expect(c).toEqual([{ nom: "Gare d'Auxerre-Saint-Gervais", type: "lieu", commune: "Auxerre", code_postal: "89000", lat: 47.797265, lon: 3.585093, source: "ign", score: 0.86 }]);
  });

  it("un lieu majeur (classification 1) passe devant une école (9) à note égale", () => {
    const [basilique, ecole] = lireReponseIgn({
      features: [
        { geometry: { coordinates: [2.343, 48.8868] }, properties: { _type: "poi", score: 0.779, name: ["Basilique du Sacré-Cœur"], classification: 1 } },
        { geometry: { coordinates: [2.3263, 48.834] }, properties: { _type: "poi", score: 0.775, name: ["École Primaire le Sacré-Cœur"], classification: 9 } },
      ],
    });
    expect(fusionner([ecole!, basilique!], [], PARIS, "Sacré-Cœur")[0]!.nom).toBe("Basilique du Sacré-Cœur");
  });

  it("réponse hors schéma ⇒ rejet", () => {
    expect(() => lireReponseIgn({ features: [{ geometry: { coordinates: [200, 0] }, properties: { _type: "poi" } }] })).toThrow();
  });
});

describe("classement IGN + MOTIS (D60)", () => {
  it("à mots et note égaux, le plus proche du point d'abord (Paris avant Montreuil)", () => {
    const montreuil = { ...ign("Place de la République", 0.97, 48.8537, 2.424, "Montreuil"), type: "adresse" as const };
    const paris = { ...ign("Place de la République", 0.97, 48.8668, 2.3654, "Paris"), type: "adresse" as const };
    expect(fusionner([montreuil, paris], [], PARIS, "Place de la République").map((c) => c.commune)).toEqual(["Paris", "Montreuil"]);
  });

  it("tous les mots retrouvés d'abord : Dijon avant Albi ; sans le score dans la sortie", () => {
    const albi = motis("Tribunal judiciaire d'Albi", 43.92, 2.14);
    const dijon = ign("Tribunal Judiciaire de Dijon", 0.57, 47.328, 5.048, "Dijon");
    const r = fusionner([dijon], [albi], undefined, "tribunal judiciaire Dijon");
    expect(r.map((c) => c.nom)).toEqual(["Tribunal Judiciaire de Dijon", "Tribunal judiciaire d'Albi"]);
    expect(r[0]).not.toHaveProperty("score");
  });

  it("près de Paris, la basilique avant le lieu-dit de la Marne, même mieux noté", () => {
    const lieuDit = { ...ign("Sacré Cœur", 0.9, 49.4, 4.0, "Condé-sur-Suippe"), type: "adresse" as const };
    const basilique = ign("Basilique du Sacré-Cœur", 0.78, 48.8868, 2.343, "Paris");
    expect(fusionner([lieuDit, basilique], [], PARIS, "Sacré-Cœur")[0]!.nom).toBe("Basilique du Sacré-Cœur");
  });

  it("avec un numéro, l'adresse d'abord ; sans numéro, le lieu d'abord", () => {
    const rue = { ...ign("Aeroport d'Orly", 0.9, 48.74, 2.4, "Orly"), type: "adresse" as const };
    const aeroport = ign("Aéroport d'Orly", 0.85, 48.7287, 2.3622, "Paray-Vieille-Poste");
    expect(fusionner([rue, aeroport], [], PARIS, "Aéroport d'Orly")[0]!.type).toBe("lieu");
    const numero = { ...ign("10 Rue de Rivoli", 0.97, 48.8555, 2.3604, "Paris"), type: "adresse" as const };
    const hotel = ign("Hôtel Rivoli", 0.95, 48.8568, 2.3552, "Paris");
    expect(fusionner([hotel, numero], [], PARIS, "10 rue de Rivoli")[0]!.nom).toBe("10 Rue de Rivoli");
  });

  it("un lieu d'OSM au nom identique ne passe pas devant le lieu notable de l'IGN", () => {
    const oeuvre = { ...motis("Le Sacré-Cœur", 48.8512, 2.3347), type: "lieu" as const };
    const basilique = ign("Basilique du Sacré-Cœur", 0.78, 48.8868, 2.343, "Paris");
    expect(fusionner([basilique], [oeuvre], PARIS, "Sacré-Cœur")[0]!.nom).toBe("Basilique du Sacré-Cœur");
  });

  it("un même lieu donné par les deux n'apparaît qu'une fois ; au plus 10", () => {
    const a = ign("Gare d'Auxerre-Saint-Gervais", 0.86, 47.79727, 3.58509);
    const b = motis("Gare d'Auxerre", 47.7975, 3.585);
    expect(fusionner([a], [b], undefined, "Gare d'Auxerre").length).toBe(1);
    const beaucoup = Array.from({ length: 15 }, (_, i) => motis(`Arrêt ${i}`, 45 + i, 2));
    expect(fusionner([], beaucoup, undefined, "arret").length).toBe(10);
  });
});

describe("GET /v1/lieux avec l'IGN", () => {
  const moteurMotis = { plan: () => Promise.reject(new Error("inutile")), geocoder: async () => [] };

  it("l'IGN en panne ⇒ MOTIS seul, 200", async () => {
    const app = appTest({ moteur: moteurMotis, geocodeurIgn: () => Promise.reject(new Error("panne")) });
    const r = await app.inject({ method: "GET", url: "/v1/lieux?q=Joigny", headers: ENTETE });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ candidats: [] });
  });

  it("l'IGN répond ⇒ ses adresses sont dans la réponse", async () => {
    const app = appTest({ moteur: moteurMotis, geocodeurIgn: exemple });
    const r = await app.inject({ method: "GET", url: "/v1/lieux?q=Place%20de%20la%20R%C3%A9publique&proche=48.8566,2.3522", headers: ENTETE });
    expect(r.json().candidats[0]).toMatchObject({ commune: "Paris", source: "ign" });
  });
});
