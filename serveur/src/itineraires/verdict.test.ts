import { describe, expect, it } from "vitest";
import type { Possibilite } from "./motis-plan.js";
import { retenir, retenirPartir, verdict } from "./verdict.js";

/** Possibilité minimale : seules les heures de départ et d'arrivée comptent pour le tri. */
function possibilite(depart: string, arrivee: string): Possibilite {
  return { etapes: [], depart: new Date(depart), arrivee: new Date(arrivee) };
}

const JOUR = "2026-11-12";
const LIMITE = 9 * 60 + 50; // 10:00 moins 10 min

describe("retenir (D44)", () => {
  it("une possibilité du 10/11 est ignorée pour une demande du 12/11", () => {
    const p = [possibilite("2026-11-10T05:26:00Z", "2026-11-10T08:24:00Z")];
    expect(retenir(p, JOUR, LIMITE)).toEqual([]);
  });

  it("arrivée égale à H − M ⇒ gardée ; une minute après ⇒ écartée", () => {
    const pile = possibilite("2026-11-12T06:00:00Z", "2026-11-12T08:50:00Z");
    const tard = possibilite("2026-11-12T06:00:00Z", "2026-11-12T08:51:00Z");
    expect(retenir([pile, tard], JOUR, LIMITE)).toEqual([pile]);
  });

  it("le jour se juge à l'heure de Paris, pas en UTC", () => {
    // 23:30 UTC le 11/11 = 00:30 le 12/11 à Paris : part bien le 12/11.
    const nuit = possibilite("2026-11-11T23:30:00Z", "2026-11-12T01:00:00Z");
    // 22:30 UTC le 11/11 = 23:30 le 11/11 à Paris : part la veille.
    const veille = possibilite("2026-11-11T22:30:00Z", "2026-11-12T01:00:00Z");
    expect(retenir([nuit, veille], JOUR, LIMITE)).toEqual([nuit]);
  });
});

describe("verdict", () => {
  it("liste vide ⇒ « impossible », au moins une ⇒ « possible »", () => {
    expect(verdict([])).toBe("impossible");
    expect(verdict([possibilite("2026-11-12T06:00:00Z", "2026-11-12T08:00:00Z")])).toBe("possible");
  });
});

describe("retenirPartir (D57)", () => {
  const H = 8 * 60; // 08:00
  it("garde un départ à H ou après le jour J, écarte avant H et le lendemain", () => {
    const pile = possibilite("2026-11-12T07:00:00Z", "2026-11-12T09:00:00Z"); // 08:00 Paris
    const avant = possibilite("2026-11-12T06:59:00Z", "2026-11-12T09:00:00Z"); // 07:59
    const lendemain = possibilite("2026-11-13T05:26:00Z", "2026-11-13T08:46:00Z");
    const soir = possibilite("2026-11-12T22:30:00Z", "2026-11-13T01:00:00Z"); // 23:30, arrive le 13
    expect(retenirPartir([pile, avant, lendemain, soir], JOUR, H)).toEqual([pile, soir]);
  });
});
