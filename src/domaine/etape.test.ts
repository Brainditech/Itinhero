import { describe, expect, it } from "vitest";

import type { Etape } from "./api";
import { REPONSE_CHATELET } from "./reponse-chatelet";
import { arretsDuTrajet, enteteEtape, hauteursPanneau, pointsEtape, positionLachee, positionSuivante } from "./etape";

const chatelet = REPONSE_CHATELET.possibilites[0]!;
const marche = chatelet.etapes[0]!;
const metro = chatelet.etapes[1]!;

const bus: Etape = {
  ...metro,
  mode: "bus",
  ligne: "K941",
  direction: "Saint-Florentin",
  numero: null,
  de: { nom: "Brienon-sur-Armançon Mairie", type: "arret", arret: "x", lat: 47.99, lon: 3.61 },
  a: { nom: "Saint-Florentin-Ville", type: "arret", arret: "y", lat: 47.99, lon: 3.73 },
  depart: "06:27",
  arrivee: "06:37",
  duree_minutes: 10,
  arrets: [
    { nom: "Avrolles", lat: 47.98, lon: 3.67, passage: "06:31" },
    { nom: "Arrêt sans coordonnées", lat: 0, lon: 0, passage: "06:33" },
  ],
};

describe("enteteEtape (spec 17, §4.2)", () => {
  it("marche : titre, horaire, durée et distance", () => {
    const e = enteteEtape({ ...marche, depart: "06:17", arrivee: "06:22", duree_minutes: 5, distance_metres: 310 });
    expect(e).toEqual({ titre: "Marche", direction: null, horaire: "06:17 → 06:22 · 5 min · 310 m" });
  });
  it("véhicule : ligne, direction, horaire sans distance", () => {
    expect(enteteEtape(bus)).toEqual({ titre: "Bus K941", direction: "vers Saint-Florentin", horaire: "06:27 → 06:37 · 10 min" });
  });
  it("taxi : « Taxi », sans répéter la durée dans le titre", () => {
    expect(enteteEtape({ ...bus, mode: "taxi", ligne: null, direction: null, arrets: [] }).titre).toBe("Taxi");
  });
});

describe("arretsDuTrajet (spec 17, critère 4)", () => {
  it("montée, arrêts intermédiaires avec leur heure, descente ; jamais un arrêt à 0,0 (issue 0019)", () => {
    expect(arretsDuTrajet(bus)).toEqual([
      { lat: 47.99, lon: 3.61, nom: "arrêt Brienon-sur-Armançon Mairie", heure: "06:27", role: "montee" },
      { lat: 47.98, lon: 3.67, nom: "Avrolles", heure: "06:31", role: "intermediaire" },
      { lat: 47.99, lon: 3.73, nom: "arrêt Saint-Florentin-Ville", heure: "06:37", role: "descente" },
    ]);
  });
  it("train direct : la montée et la descente seulement", () => {
    expect(arretsDuTrajet({ ...bus, arrets: [] }).map((a) => a.role)).toEqual(["montee", "descente"]);
  });
  it("rien pour la marche ni pour un taxi", () => {
    expect(arretsDuTrajet(marche)).toEqual([]);
    expect(arretsDuTrajet({ ...bus, mode: "taxi", arrets: [] })).toEqual([]);
  });
});

describe("pointsEtape", () => {
  it("sans tracé : le départ et l'arrivée", () => {
    expect(pointsEtape({ ...bus, trace: null })).toEqual([
      { lat: 47.99, lon: 3.61 },
      { lat: 47.99, lon: 3.73 },
    ]);
  });
});

describe("panneau du bas (D85)", () => {
  const h = hauteursPanneau(800, 120);
  it("trois hauteurs : l'en-tête, 45 % et 85 % de l'écran", () => {
    expect(h).toEqual({ repliee: 120, milieu: 360, depliee: 680 });
  });
  it("sur un petit écran, chaque position reste plus haute que la précédente", () => {
    const p = hauteursPanneau(400, 200);
    expect(p.milieu).toBeGreaterThan(p.repliee);
    expect(p.depliee).toBeGreaterThan(p.milieu);
  });
  it("la poignée fait le tour des trois positions", () => {
    expect(positionSuivante("repliee")).toBe("milieu");
    expect(positionSuivante("milieu")).toBe("depliee");
    expect(positionSuivante("depliee")).toBe("repliee");
  });
  it("lâché lentement : la position la plus proche", () => {
    expect(positionLachee(150, 0, h)).toBe("repliee");
    expect(positionLachee(400, 0, h)).toBe("milieu");
    expect(positionLachee(600, 0, h)).toBe("depliee");
  });
  it("lancé : la position suivante dans le sens du geste", () => {
    expect(positionLachee(370, -1200, h)).toBe("depliee");
    expect(positionLachee(350, 1200, h)).toBe("repliee");
    expect(positionLachee(680, -1200, h)).toBe("depliee");
    expect(positionLachee(120, 1200, h)).toBe("repliee");
  });
});
