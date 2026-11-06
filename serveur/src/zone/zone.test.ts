import { describe, expect, it } from "vitest";
import { dansAnneau, dansZoneCouverte } from "./zone.js";

// Coordonnées relevées sur OpenStreetMap (gares, mairies), 2026-11-06.
const DEDANS: [string, number, number][] = [
  ["Brienon-sur-Armançon, mairie", 47.9918, 3.617],
  ["Joigny, gare", 47.9767, 3.3928],
  ["Flers, gare", 48.7457, -0.5658],
  ["Paris, Châtelet", 48.8584, 2.347],
  ["Brest, gare", 48.388, -4.4794],
  ["Strasbourg, gare", 48.5851, 7.7344],
  ["Nice, gare", 43.7046, 7.2619],
  ["Perpignan, gare", 42.6961, 2.8794],
  ["Ajaccio, gare", 41.9268, 8.7362],
  ["Bastia, gare", 42.7008, 9.4436],
  ["Dunkerque, gare", 51.0313, 2.3683],
  ["Hendaye, gare", 43.3536, -1.7822],
];
const DEHORS: [string, number, number][] = [
  ["Madrid", 40.4168, -3.7038],
  ["Londres", 51.5074, -0.1278],
  ["Bruxelles", 50.8467, 4.3525],
  ["Turin", 45.0703, 7.6869],
  ["Francfort", 50.1109, 8.6821],
  ["Pointe-à-Pitre (Guadeloupe)", 16.2411, -61.5331],
  ["Saint-Denis (La Réunion)", -20.8789, 55.4481],
  ["Golfe de Gascogne, au large", 45.5, -4],
];

describe("zone couverte (spec 27, critère 1)", () => {
  it.each(DEDANS)("%s est dans la zone", (_nom, lat, lon) => {
    expect(dansZoneCouverte({ lat, lon })).toBe(true);
  });
  it.each(DEHORS)("%s est hors de la zone", (_nom, lat, lon) => {
    expect(dansZoneCouverte({ lat, lon })).toBe(false);
  });
  it("lancer de rayon sur un carré", () => {
    const carre = [[0, 0], [2, 0], [2, 2], [0, 2]] as const;
    expect(dansAnneau({ lat: 1, lon: 1 }, carre)).toBe(true);
    expect(dansAnneau({ lat: 3, lon: 1 }, carre)).toBe(false);
    expect(dansAnneau({ lat: 1, lon: -1 }, carre)).toBe(false);
  });
});
