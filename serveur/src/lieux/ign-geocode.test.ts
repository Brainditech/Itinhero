import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { appTest, ENTETE } from "../outils-test.js";
import { construireUrlIgn, fusionner, lireReponseIgn, transportDesCategories, type CandidatNote } from "./ign-geocode.js";
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

  // Doublons constatés le 2026-11-05 dans les suggestions (spec 18, §12).
  it("« de » ne sépare pas deux noms : Basilique de Saint-Denis = Basilique Saint-Denis à 35 m", () => {
    const a = ign("Basilique de Saint-Denis", 0.9, 48.9355, 2.3597, "Saint-Denis");
    const b = { ...motis("Basilique Saint-Denis", 48.9358, 2.3591), type: "lieu" as const, commune: "Saint-Denis" };
    expect(fusionner([a], [b], undefined, "basilique saint denis").map((c) => c.nom)).toEqual(["Basilique de Saint-Denis"]);
  });

  it("même nom, même nature, même commune à moins de 300 m : une fois (Châtelet à 210 m)", () => {
    const a = { ...ign("Châtelet", 0.9, 48.8577, 2.3474, "Paris"), code_postal: "75001" };
    const b = { ...ign("Châtelet", 0.8, 48.8596, 2.3471, "Paris"), code_postal: "75001" };
    expect(fusionner([a, b], [], undefined, "chatelet")).toHaveLength(1);
  });

  it("la commune donnée quatre fois n'apparaît qu'une fois, l'arrêt du même nom reste", () => {
    const commune = { ...ign("Saint-Michel-sur-Orge", 0.87, 48.6332, 2.3127, "Saint-Michel-sur-Orge"), code_postal: "91240" };
    const sansCommune = { ...ign("Saint-Michel-sur-Orge", 0.54, 48.6336, 2.3106), commune: null, code_postal: "91240" };
    const ville = { ...motis("Saint-Michel-sur-Orge", 48.6303, 2.3027), type: "lieu" as const, commune: "Saint-Michel-sur-Orge", code_postal: "91240" };
    const gare = { ...motis("Saint-Michel-sur-Orge", 48.6358, 2.3065), commune: "Saint-Michel-sur-Orge", code_postal: "91240" };
    const r = fusionner([commune, sansCommune], [gare, ville], undefined, "saint michel sur orge");
    expect(r.map((c) => c.type)).toEqual(["lieu", "arret"]);
  });

  it("même nom dans deux communes, ou loin dans la même : gardés tous les deux", () => {
    const conches = { ...ign("le Châtelet", 0.5, 48.8594, 2.7192, "Conches-sur-Gondoire"), code_postal: "77600" };
    const vernouillet = { ...ign("le Châtelet", 0.5, 48.9676, 1.9758, "Vernouillet"), code_postal: "78540" };
    const pont1 = ign("Pont", 0.3, 48.625, 2.3145, "Saint-Michel-sur-Orge");
    const pont2 = ign("Pont", 0.3, 48.6341, 2.2939, "Saint-Michel-sur-Orge");
    expect(fusionner([conches, vernouillet, pont1, pont2], [], undefined, "x")).toHaveLength(4);
  });

  it("une gare de l'IGN et l'arrêt de MOTIS du même nom : une seule gare, même à cheval sur deux arrondissements", () => {
    const stationIgn = { ...ign("Châtelet", 0.9, 48.8577, 2.3474, "Paris"), code_postal: "75001", transport: "metro" as const };
    const arret = { ...motis("Châtelet", 48.8584, 2.3485), commune: "Paris", code_postal: "75004", transport: "metro" as const };
    expect(fusionner([stationIgn], [arret], PARIS, "chatelet")).toHaveLength(1);
    // Le monument et la station de métro du même nom restent deux lieux (Basilique de Saint-Denis).
    const monument = ign("Basilique de Saint-Denis", 0.9, 48.9355, 2.3597, "Saint-Denis");
    const metro = { ...motis("Basilique de Saint-Denis", 48.9377, 2.36), commune: "Saint-Denis", transport: "metro" as const };
    expect(fusionner([monument], [metro], undefined, "basilique saint denis")).toHaveLength(2);
  });

  it("à distance et note voisines, la gare passe devant l'arrêt de bus du même nom", () => {
    const bus = { ...motis("Centre", 48.0, 3.0), transport: "bus" as const };
    const gare = { ...motis("Centre", 48.3, 3.0), transport: "train" as const };
    expect(fusionner([], [bus, gare], { lat: 47.9, lon: 3.0 }, "centre")[0]!.transport).toBe("train");
  });

  // Constaté le 2026-11-05 depuis l'Yonne (spec 18, §12) : la rue de Joigny absente des suggestions.
  it("« 3 rue de la gare joigny » : Joigny (89) avant Joigny-sur-Meuse, la rue gardée à côté de l'arrêt du même nom", () => {
    const yonne = { lat: 47.9997, lon: 3.7272 };
    const adresse = (nom: string, score: number, lat: number, lon: number, commune: string) => ({ ...ign(nom, score, lat, lon, commune), type: "adresse" as const });
    const meuse = adresse("3 Rue de la Gare", 0.788, 49.81, 4.83, "Joigny-sur-Meuse");
    const meuse31 = { ...motis("Rue de la Gare 31", 49.81, 4.831), type: "adresse" as const, commune: "Joigny-sur-Meuse" };
    const rue = adresse("Rue de la Gare", 0.785, 47.9785, 3.3966, "Joigny");
    const arret = { ...motis("3 RUE DE LA GARE", 47.9787, 3.3968), commune: "Joigny", transport: "bus" as const };
    const r = fusionner([meuse, rue], [arret, meuse31], yonne, "3 rue de la gare joigny");
    expect(r.slice(0, 2).map((c) => c.commune)).toEqual(["Joigny", "Joigny"]);
    expect(r.map((c) => c.nom)).toContain("Rue de la Gare");
  });

  it("un numéro se retrouve en entier et compte pour moitié : la rue de Rivoli avant la rue de Paris au 10", () => {
    const rivoli107 = { ...ign("Rue de Rivoli 107", 0.6, 48.8606, 2.3376, "Paris"), type: "adresse" as const };
    const dannemoine = { ...ign("Rue de Paris à Genève 10", 0.7, 47.89, 3.96, "Dannemoine"), type: "adresse" as const };
    expect(fusionner([dannemoine, rivoli107], [], { lat: 47.9997, lon: 3.7272 }, "10 rue de rivoli paris")[0]!.nom).toBe("Rue de Rivoli 107");
  });

  it("« chatelet » depuis l'Yonne : le métro de Paris avant les arrêts de bus plus proches du même nom", () => {
    const montereau = { ...motis("Châtelet", 48.385, 2.95), commune: "Montereau-Fault-Yonne", transport: "bus" as const };
    const corquilleroy = { ...motis("Châtelet", 48.04, 2.71), commune: "Corquilleroy", transport: "bus" as const };
    const rouen = { ...motis("Châtelet", 49.44, 1.09), commune: "Rouen", transport: "bus" as const };
    const champetieres = { ...motis("Châtelet", 45.51, 3.69), commune: "Champétières", transport: "bus" as const };
    const lieux = [1, 2, 3].map((i) => ({ ...motis(`Le Châtelet ${i}`, 47.6, 3.3 + i), type: "lieu" as const }));
    const paris = { ...motis("Châtelet", 48.8584, 2.3485), commune: "Paris", transport: "metro" as const };
    const r = fusionner([], [montereau, corquilleroy, ...lieux, champetieres, rouen, paris], { lat: 47.9997, lon: 3.7272 }, "chatelet");
    expect(r[0]!.commune).toBe("Paris");
  });

  it("un arrêt au nom exact passe devant le parking du même nom", () => {
    const parking = ign("Parking Gare de Lyon", 0.9, 48.8438, 2.373, "Paris");
    const arret = motis("Gare de Lyon", 48.8446, 2.3751);
    expect(fusionner([parking], [arret], PARIS, "gare de lyon")[0]!.nom).toBe("Gare de Lyon");
  });
});

describe("transportDesCategories (D92)", () => {
  it("gare de la BD TOPO ⇒ transport ; autre catégorie ⇒ rien", () => {
    expect(transportDesCategories(["gare voyageurs et fret", "transport", "équipement de transport"])).toBe("train");
    expect(transportDesCategories(["gare voyageurs uniquement"])).toBe("train");
    expect(transportDesCategories(["gare routière", "transport"])).toBe("car");
    expect(transportDesCategories(["lieu-dit habité", "zone d'habitation"])).toBeUndefined();
    expect(transportDesCategories(undefined)).toBeUndefined();
  });

  it("une gare lue chez l'IGN garde son transport", () => {
    const brut = {
      features: [
        {
          geometry: { coordinates: [3.5851, 47.7973] },
          properties: { _type: "poi", name: ["Gare d'Auxerre-Saint-Gervais"], city: ["Auxerre"], postcode: ["89000"], category: ["gare voyageurs et fret", "transport"], score: 0.85 },
        },
      ],
    };
    expect(lireReponseIgn(brut)[0]!.transport).toBe("train");
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
