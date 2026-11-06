import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { schemaPossibilite, type Etape, type Possibilite, type ReponseItineraires } from "./api";
import {
  BUDGET_TUILES,
  ZOOM_MAX_TUILES,
  agrandir,
  etatCarte,
  fusionner,
  lireMetaPack,
  tuilesBoite,
  tuilesZone,
  zonesVoyage,
  type Boite,
} from "./pack-carte";
import type { Voyage } from "./voyages";

/** Spec 23 (D99), critère 1. Base : la possibilité d'exemple Brienon → Dijon (marche, bus 803, marche, TER, marche). */
const DIJON: Possibilite = schemaPossibilite.parse(
  JSON.parse(readFileSync(path.join(__dirname, "__exemples__/possibilite-brienon-dijon.json"), "utf8")),
);

function sens(possibilites: Possibilite[]) {
  return {
    verdict: "possible" as const,
    demande: { date: "2026-11-12", heure: "10:00", sens: "arriver" as const, marge: 10, limite: "09:50" },
    arrivee: { nom: "Dijon", adresse: null },
    possibilites,
  };
}

function voyage(possibilites: Possibilite[], retour: Possibilite[] | null = null): Voyage {
  const reponse: ReponseItineraires = { ...sens(possibilites), retour: retour ? sens(retour) : null };
  return {
    enregistre_le: "2026-11-06T13:32:00.000Z",
    demande: {
      depart: { type: "domicile" },
      arrivee: { type: "texte", texte: "Dijon" },
      date: "2026-11-12",
      heure: "10:00",
      sens: "arriver_avant",
      marge: 10,
    },
    depart: { point: { lat: 47.9918, lon: 3.617 }, nom: "Domicile", adresse: null },
    // L'arrivée est celle de la première possibilité : un voyage court reste court.
    arrivee: { point: { lat: possibilites[0]!.etapes.at(-1)!.a.lat, lon: possibilites[0]!.etapes.at(-1)!.a.lon }, nom: "Arrivée", adresse: null },
    reponse,
  };
}

/** Possibilité courte autour de Brienon : les trois premières étapes (marche, bus, marche jusqu'à la gare). */
const BRIENON: Possibilite = { ...DIJON, etapes: DIJON.etapes.slice(0, 3) as [Etape, ...Etape[]] };

describe("tuilesBoite", () => {
  it("compte les tuiles d'une boîte à un zoom donné (Web Mercator)", () => {
    // Le monde entier au zoom 0 : une tuile ; au zoom 2 : 16.
    expect(tuilesBoite([-180, -85, 180, 85], 0)).toBe(1);
    expect(tuilesBoite([-180, -85, 180, 85], 2)).toBe(16);
    // Un point seul : une tuile, quel que soit le zoom.
    expect(tuilesBoite([3.617, 47.9918, 3.617, 47.9918], 14)).toBe(1);
    // Autour de Brienon au zoom 14 : x de 8355 (3,60° E) à 8358 (3,65° E), y de 5693 (48,02° N) à 5697 (47,97° N).
    expect(tuilesBoite([3.6, 47.97, 3.65, 48.02], 14)).toBe(4 * 5);
  });

  it("additionne les zooms d'une zone", () => {
    expect(tuilesZone({ bornes: [-180, -85, 180, 85], zoomMin: 0, zoomMax: 2 })).toBe(1 + 4 + 16);
  });
});

describe("agrandir et fusionner", () => {
  it("agrandit une boîte d'un nombre de mètres de chaque côté", () => {
    const [o, s, e, n] = agrandir([3.617, 47.99, 3.617, 47.99], 500);
    // 500 m ≈ 0,0045° de latitude, ≈ 0,0067° de longitude à 48° N.
    expect(n - 47.99).toBeCloseTo(0.0045, 3);
    expect(47.99 - s).toBeCloseTo(0.0045, 3);
    expect(e - 3.617).toBeCloseTo(0.0067, 3);
    expect(3.617 - o).toBeCloseTo(0.0067, 3);
  });

  it("fusionne les boîtes qui se touchent, garde les autres", () => {
    const a: Boite = [0, 0, 1, 1];
    const b: Boite = [0.5, 0.5, 2, 2];
    const c: Boite = [10, 10, 11, 11];
    expect(fusionner([a, c, b])).toEqual([[0, 0, 2, 2], c]);
  });

  it("fusionne en chaîne : a touche b, b touche c", () => {
    expect(fusionner([[0, 0, 1, 1], [2, 2, 3, 3], [0.9, 0.9, 2.1, 2.1]])).toEqual([[0, 0, 3, 3]]);
  });
});

describe("zonesVoyage", () => {
  it("Brienon → gare de Saint-Florentin : une zone d'ensemble et des zones de détail, chacune dans le budget", () => {
    const zones = zonesVoyage(voyage([BRIENON]));
    const [ensemble, ...details] = zones;
    expect(ensemble!.zoomMin).toBe(5);
    // Petite zone : le budget laisse aller jusqu'au zoom 13.
    expect(ensemble!.zoomMax).toBe(13);
    expect(details.length).toBeGreaterThanOrEqual(1);
    for (const z of details) {
      expect(z.zoomMax).toBe(ZOOM_MAX_TUILES);
      expect(z.zoomMin).toBe(12);
    }
    for (const z of zones) {
      expect(z.tuiles).toBe(tuilesZone(z));
      expect(z.tuiles).toBeLessThanOrEqual(BUDGET_TUILES);
      expect(z.zoomMax).toBeLessThanOrEqual(ZOOM_MAX_TUILES);
    }
  });

  it("chaque marche et chaque lieu de montée est dans une zone de détail", () => {
    const zones = zonesVoyage(voyage([DIJON])).slice(1);
    const dedans = (p: { lat: number; lon: number }) =>
      zones.some(({ bornes: [o, s, e, n] }) => p.lon >= o && p.lon <= e && p.lat >= s && p.lat <= n);
    for (const e of DIJON.etapes) {
      expect(dedans(e.de)).toBe(true);
      expect(dedans(e.a)).toBe(true);
    }
  });

  it("Brienon → Dijon : la zone d'ensemble descend de zoom pour tenir le budget", () => {
    const [ensemble] = zonesVoyage(voyage([DIJON]));
    expect(ensemble!.zoomMax).toBeLessThan(13);
    expect(ensemble!.zoomMax).toBeGreaterThanOrEqual(8);
    expect(ensemble!.tuiles).toBeLessThanOrEqual(BUDGET_TUILES);
    // Un zoom de plus dépasserait le budget.
    expect(tuilesZone({ ...ensemble!, zoomMax: ensemble!.zoomMax + 1 })).toBeGreaterThan(BUDGET_TUILES);
  });

  it("le domicile et la marche de départ (même endroit) ne font qu'une zone de détail", () => {
    const zones = zonesVoyage(voyage([BRIENON])).slice(1);
    const autourDuDomicile = zones.filter(({ bornes: [o, s, e, n] }) => 3.617 >= o && 3.617 <= e && 47.9918 >= s && 47.9918 <= n);
    expect(autourDuDomicile).toHaveLength(1);
  });

  it("le retour compte aussi : ses points sont dans la zone d'ensemble", () => {
    const ailleurs: Possibilite = {
      ...BRIENON,
      etapes: BRIENON.etapes.map((e) => ({ ...e, de: { ...e.de, lat: e.de.lat + 0.2 }, a: { ...e.a, lat: e.a.lat + 0.2 }, trace: null })) as [
        Etape,
        ...Etape[],
      ],
    };
    const [ensemble] = zonesVoyage(voyage([BRIENON], [ailleurs]));
    expect(ensemble!.bornes[3]).toBeGreaterThan(47.99 + 0.2);
  });

  it("une marche démesurée (au-delà du budget même au zoom 14) est laissée à la zone d'ensemble", () => {
    const geante: Etape = {
      ...DIJON.etapes[0]!,
      de: { ...DIJON.etapes[0]!.de, lat: 45, lon: 1 },
      a: { ...DIJON.etapes[0]!.a, lat: 49, lon: 6 },
      trace: null,
    };
    const zones = zonesVoyage(voyage([{ ...DIJON, etapes: [geante] }]));
    for (const z of zones) expect(z.tuiles).toBeLessThanOrEqual(BUDGET_TUILES);
  });
});

describe("lireMetaPack", () => {
  it("relit les métadonnées d'un pack d'Itinhero", () => {
    expect(lireMetaPack({ voyage: "[1]", version: 1, zone: 0, total: 3 })).toEqual({ voyage: "[1]", version: 1, zone: 0, total: 3 });
  });

  it("autre forme ou vide ⇒ null", () => {
    expect(lireMetaPack({})).toBeNull();
    expect(lireMetaPack({ voyage: "[1]", version: 2, zone: 0, total: 3 })).toBeNull();
    expect(lireMetaPack({ voyage: "", version: 1, zone: 0, total: 3 })).toBeNull();
    expect(lireMetaPack(null)).toBeNull();
  });
});

describe("etatCarte", () => {
  const pack = (zone: number, state: "inactive" | "active" | "complete", percentage: number, total = 2) => ({
    meta: { voyage: "v", version: 1 as const, zone, total },
    statut: { state, percentage },
  });

  it("aucun pack ⇒ absente", () => {
    expect(etatCarte([])).toEqual({ etat: "absente" });
  });

  it("tous les packs complets ⇒ enregistrée", () => {
    expect(etatCarte([pack(0, "complete", 100), pack(1, "complete", 100)])).toEqual({ etat: "enregistree" });
  });

  it("un pack manquant ⇒ pas enregistrée", () => {
    expect(etatCarte([pack(0, "complete", 100)])).toEqual({ etat: "absente" });
  });

  it("un pack actif ⇒ en cours, pourcentage de l'ensemble des zones", () => {
    expect(etatCarte([pack(0, "complete", 100), pack(1, "active", 50)])).toEqual({ etat: "enCours", pourcentage: 75 });
    // Le second pack n'existe pas encore : il compte pour 0.
    expect(etatCarte([pack(0, "active", 50)])).toEqual({ etat: "enCours", pourcentage: 25 });
  });

  it("un pack arrêté avant la fin ⇒ absente (à relancer)", () => {
    expect(etatCarte([pack(0, "complete", 100), pack(1, "inactive", 40)])).toEqual({ etat: "absente" });
  });
});
