import { describe, expect, it } from "vitest";
import { heureParis } from "../temps.js";
import { longuesCorrespondances, meilleurRemplacant, raccourcirCorrespondances } from "./correspondances.js";
import type { DemandeRecherche, Etape, Possibilite } from "./motis-plan.js";

// Issue 0013 (D81) : Brienon → un village de l'Orne près de Flers, jeudi 12/11 — RER B jusqu'à Châtelet 18:56,
// puis 41 min à pied jusqu'à Montparnasse (19:37) pour le train de 19:43, alors que le métro 4 existe.

const P = { lat: 48.86, lon: 2.35 };

function etape(mode: string, nomDe: string, nomA: string, de: string, a: string): Etape {
  const depart = new Date(de);
  const arrivee = new Date(a);
  return {
    mode,
    de: { nom: nomDe },
    a: { nom: nomA },
    depart,
    arrivee,
    departParis: heureParis(depart),
    arriveeParis: heureParis(arrivee),
    dureeSecondes: (arrivee.getTime() - depart.getTime()) / 1000,
    coordDe: P,
    coordA: P,
  };
}

const rer = etape("SUBURBAN", "Gare du Nord", "Châtelet - Les Halles", "2026-11-12T17:53:00Z", "2026-11-12T17:56:00Z");
const aPied = etape("WALK", "Châtelet - Les Halles", "Paris Montparnasse Hall 1 - 2", "2026-11-12T17:56:00Z", "2026-11-12T18:37:00Z");
const nomad = etape("REGIONAL_RAIL", "Paris Montparnasse Hall 1 - 2", "Flers", "2026-11-12T18:43:00Z", "2026-11-12T21:17:00Z");
const VERS_FLERS: Possibilite = { etapes: [rer, aPied, nomad], depart: rer.depart, arrivee: nomad.arrivee };

function possibilite(etapes: Etape[]): Possibilite {
  return { etapes, depart: etapes[0]!.depart, arrivee: etapes[etapes.length - 1]!.arrivee };
}

const METRO_4 = possibilite([
  etape("WALK", "START", "Châtelet", "2026-11-12T17:56:00Z", "2026-11-12T18:00:00Z"),
  etape("SUBWAY", "Châtelet", "Montparnasse Bienvenüe", "2026-11-12T18:01:00Z", "2026-11-12T18:12:00Z"),
  etape("WALK", "Montparnasse Bienvenüe", "END", "2026-11-12T18:12:00Z", "2026-11-12T18:20:00Z"),
]);

describe("longues correspondances à pied (issue 0013)", () => {
  it("repère une marche de plus de 15 min entre deux transports, pas au début ni à la fin", () => {
    expect(longuesCorrespondances(VERS_FLERS)).toEqual([[1, 1]]);
    const courte = etape("WALK", "A", "B", "2026-11-12T17:56:00Z", "2026-11-12T18:10:00Z");
    expect(longuesCorrespondances(possibilite([rer, courte, nomad]))).toEqual([]);
    expect(longuesCorrespondances(possibilite([aPied, nomad]))).toEqual([]);
  });

  it("le métro 4 remplace la marche, avec les lieux de la marche aux deux bouts", () => {
    const r = meilleurRemplacant([aPied], nomad, [METRO_4])!;
    expect(r.map((e) => e.mode)).toEqual(["WALK", "SUBWAY", "WALK"]);
    expect(r[0]!.de.nom).toBe("Châtelet - Les Halles");
    expect(r[2]!.a.nom).toBe("Paris Montparnasse Hall 1 - 2");
  });

  it("regroupe deux longues marches séparées par un RER court en une seule traversée", () => {
    const ter = etape("REGIONAL_RAIL", "Laroche-Migennes", "Paris Bercy", "2026-11-12T16:00:00Z", "2026-11-12T17:27:00Z");
    const m1 = etape("WALK", "Paris Bercy", "Gare de Lyon", "2026-11-12T17:27:00Z", "2026-11-12T17:50:00Z");
    const rerD = etape("SUBURBAN", "Gare de Lyon", "Châtelet - Les Halles", "2026-11-12T17:52:00Z", "2026-11-12T17:56:00Z");
    expect(longuesCorrespondances(possibilite([ter, m1, rerD, aPied, nomad]))).toEqual([[1, 3]]);
  });

  it("préfère le métro direct à une chaîne de transports qui marche un peu moins", () => {
    const chaine = possibilite([
      etape("SUBWAY", "START", "A", "2026-11-12T17:57:00Z", "2026-11-12T18:00:00Z"),
      etape("SUBURBAN", "A", "B", "2026-11-12T18:01:00Z", "2026-11-12T18:05:00Z"),
      etape("BUS", "B", "END", "2026-11-12T18:06:00Z", "2026-11-12T18:15:00Z"),
    ]);
    expect(meilleurRemplacant([aPied], nomad, [chaine, METRO_4])!.map((e) => e.mode)).toEqual(["WALK", "SUBWAY", "WALK"]);
  });

  it("rien ne remplace la marche si le transport arrive moins de 3 min avant le train, ou sans transport", () => {
    const tard = possibilite([etape("SUBWAY", "START", "END", "2026-11-12T18:20:00Z", "2026-11-12T18:41:00Z")]);
    expect(meilleurRemplacant([aPied], nomad, [tard])).toBeNull();
    const aPiedAussi = possibilite([etape("WALK", "START", "END", "2026-11-12T17:56:00Z", "2026-11-12T18:30:00Z")]);
    expect(meilleurRemplacant([aPied], nomad, [aPiedAussi])).toBeNull();
  });

  it("redemande le bout à MOTIS à l'heure où la marche commence, et garde la marche si la recherche échoue", async () => {
    const demandes: DemandeRecherche[] = [];
    const [ok] = await raccourcirCorrespondances([VERS_FLERS], async (d) => {
      demandes.push(d);
      return [METRO_4];
    });
    expect(demandes).toEqual([{ depart: P, arrivee: P, jour: "2026-11-12", sens: "partir", depuisMinutes: 18 * 60 + 56 }]);
    expect(ok!.etapes.map((e) => e.mode)).toEqual(["SUBURBAN", "WALK", "SUBWAY", "WALK", "REGIONAL_RAIL"]);
    expect(ok!.depart).toBe(VERS_FLERS.depart);

    const [garde] = await raccourcirCorrespondances([VERS_FLERS], async () => {
      throw new Error("MOTIS injoignable");
    });
    expect(garde).toEqual(VERS_FLERS);
  });
});
