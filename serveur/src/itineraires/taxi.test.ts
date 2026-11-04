import { describe, expect, it } from "vitest";
import { MANIFEST_TEST } from "../outils-test.js";
import { construireUrlPlan, lireReponsePlan } from "./motis-plan.js";
import { modeAffiche, normaliser, taxisUtiles, type PossibiliteAffichee } from "./normaliser.js";

// Spec 16 (D48, D80) : taxi comme étape au début et à la fin.

const LIEU = { name: "X", lat: 47.9, lon: 3.5 };
const TRIP = "20261112_22:30_r84072_1014608-1-1";

/** Une réponse MOTIS : train 18:40 → 19:30 (UTC 17:40 → 18:30), puis voiture 12 min jusqu'à l'arrivée. */
const REPONSE_TAXI = {
  itineraries: [
    {
      legs: [
        { mode: "WALK", from: { ...LIEU, name: "START" }, to: LIEU, startTime: "2026-11-12T17:30:00Z", endTime: "2026-11-12T17:35:00Z", duration: 300 },
        { mode: "REGIONAL_RAIL", from: LIEU, to: { ...LIEU, name: "Laroche-Migennes" }, startTime: "2026-11-12T17:40:00Z", endTime: "2026-11-12T18:30:00Z", duration: 3000, tripId: TRIP, routeShortName: "P5" },
        { mode: "CAR", from: { ...LIEU, name: "Laroche-Migennes" }, to: { ...LIEU, name: "END" }, startTime: "2026-11-12T18:30:00Z", endTime: "2026-11-12T18:42:00Z", duration: 720, distance: 11000 },
      ],
    },
  ],
};

function possibilite(depart: string, arrivee: string, taxi: number, commun: number): PossibiliteAffichee {
  // Heures de jour qui se suivent : aucune attente de nuit.
  const etape = (mode: string, duree: number, type: "gtfs" | "osm") =>
    ({ mode, depart: "12:00", arrivee: "12:00", duree_minutes: duree, source: { type } }) as unknown as PossibiliteAffichee["etapes"][number];
  return {
    depart: "",
    arrivee: "",
    depart_utc: depart,
    arrivee_utc: arrivee,
    duree_minutes: 0,
    correspondances: 0,
    montee: null,
    etapes: [etape("train", commun, "gtfs"), ...(taxi > 0 ? [etape("taxi", taxi, "osm")] : [])],
  };
}

describe("recherche avec taxi (spec 16)", () => {
  it("demande la voiture à un seul bout, 15 min au plus, jamais de bout en bout", () => {
    const base = { depart: { lat: 48, lon: 3 }, arrivee: { lat: 47, lon: 3 }, jour: "2026-11-12", sens: "partir" as const, depuisMinutes: 1020 };
    const fin = construireUrlPlan("http://m", { ...base, taxi: "fin" });
    expect(fin.searchParams.get("postTransitModes")).toBe("WALK,CAR");
    expect(fin.searchParams.get("maxPostTransitTime")).toBe("900");
    expect(fin.searchParams.get("preTransitModes")).toBeNull();
    expect(fin.searchParams.get("directModes")).toBeNull();
    const debut = construireUrlPlan("http://m", { ...base, taxi: "debut" });
    expect(debut.searchParams.get("preTransitModes")).toBe("WALK,CAR");
    expect(debut.searchParams.get("maxPreTransitTime")).toBe("900");
    expect(debut.searchParams.get("postTransitModes")).toBeNull();
    const sans = construireUrlPlan("http://m", base);
    expect(sans.searchParams.get("postTransitModes")).toBeNull();
  });

  it("une étape CAR devient un taxi sourcé par la carte OSM, sans compter de correspondance", () => {
    expect(modeAffiche("CAR")).toBe("taxi");
    const { possibilites, retirees } = normaliser(lireReponsePlan(REPONSE_TAXI), MANIFEST_TEST);
    expect(retirees).toBe(0);
    const p = possibilites[0]!;
    const taxi = p.etapes[2]!;
    expect(taxi.mode).toBe("taxi");
    expect(taxi.source.type).toBe("osm");
    expect(taxi.de.type).toBe("gare"); // la gare du train qui précède, pas « arrêt »
    expect(taxi.depart).toBe("19:30");
    expect(taxi.arrivee).toBe("19:42");
    expect(taxi.duree_minutes).toBe(12);
    expect(p.correspondances).toBe(0);
    expect(p.montee?.vehicule).toBe("18:40"); // la première montée est le train, pas le taxi
  });
});

describe("taxi au début : heure de prise en charge (D48)", () => {
  it("= départ du train − marge avant la montée (5 min) − durée de route", () => {
    const reponse = {
      itineraries: [
        {
          legs: [
            // Taxi 12 min, déposé 3 min avant le train : la sortie avance de 2 min pour garder 5 min à la gare (D68).
            { mode: "CAR", from: { ...LIEU, name: "START" }, to: { ...LIEU, name: "Laroche-Migennes" }, startTime: "2026-11-12T06:00:00Z", endTime: "2026-11-12T06:12:00Z", duration: 720 },
            { mode: "REGIONAL_RAIL", from: { ...LIEU, name: "Laroche-Migennes" }, to: { ...LIEU, name: "END" }, startTime: "2026-11-12T06:15:00Z", endTime: "2026-11-12T07:00:00Z", duration: 2700, tripId: TRIP },
          ],
        },
      ],
    };
    const p = normaliser(lireReponsePlan(reponse), MANIFEST_TEST).possibilites[0]!;
    expect(p.etapes[0]!.mode).toBe("taxi");
    expect(p.etapes[0]!.depart).toBe("06:58"); // 07:15 − 5 − 12
    expect(p.etapes[0]!.a.type).toBe("gare");
    expect(p.montee).toEqual({ arriver_a: "07:10", vehicule: "07:15", marge_minutes: 5 });
    expect(p.depart).toBe("06:58");
  });
});

describe("taxisUtiles (D80)", () => {
  const nuit = possibilite("2026-11-12T22:07:00Z", "2026-11-13T05:32:00Z", 0, 30);

  it("« partir » : garde un taxi qui arrive au moins 30 min avant le premier trajet sans taxi", () => {
    const soir = possibilite("2026-11-12T16:10:00Z", "2026-11-12T17:05:00Z", 12, 40);
    expect(taxisUtiles([soir], [nuit], "partir")).toEqual([soir]);
    const presque = possibilite("2026-11-13T04:00:00Z", "2026-11-13T05:10:00Z", 12, 40);
    expect(taxisUtiles([presque], [nuit], "partir")).toEqual([]);
  });

  it("jamais un taxi sans transport en commun", () => {
    const toutTaxi = possibilite("2026-11-12T16:10:00Z", "2026-11-12T16:40:00Z", 19, 0);
    expect(taxisUtiles([toutTaxi], [nuit], "partir")).toEqual([]);
    // Joigny → Laroche-Migennes en TER (7 min), puis 12 min de taxi : constaté le 2026-11-05.
    const soir = possibilite("2026-11-12T16:27:00Z", "2026-11-12T17:07:00Z", 12, 7);
    expect(taxisUtiles([soir], [nuit], "partir")).toEqual([soir]);
  });

  it("jamais un taxi qui laisse quand même une nuit dehors (Flers, 2026-11-05)", () => {
    const etape = (mode: string, depart: string, arrivee: string, type: "gtfs" | "osm") =>
      ({ mode, depart, arrivee, duree_minutes: 30, source: { type } }) as unknown as PossibiliteAffichee["etapes"][number];
    const nuitAFlers: PossibiliteAffichee = {
      ...possibilite("2026-11-12T14:16:00Z", "2026-11-13T06:30:00Z", 15, 60),
      etapes: [etape("train", "19:43", "22:17", "gtfs"), etape("bus", "07:00", "07:15", "gtfs"), etape("taxi", "07:15", "07:30", "osm")],
    };
    expect(taxisUtiles([nuitAFlers], [], "partir")).toEqual([]);
  });

  it("sans trajet sans taxi, les deux arrivées les plus tôt", () => {
    const a = possibilite("2026-11-12T16:00:00Z", "2026-11-12T17:00:00Z", 10, 40);
    const b = possibilite("2026-11-12T16:30:00Z", "2026-11-12T17:30:00Z", 10, 40);
    const c = possibilite("2026-11-12T17:00:00Z", "2026-11-12T18:00:00Z", 10, 40);
    expect(taxisUtiles([c, b, a], [], "partir")).toEqual([a, b]);
  });

  it("« arriver » : garde un taxi qui part au moins 30 min après le dernier départ sans taxi", () => {
    const bus = possibilite("2026-11-12T05:17:00Z", "2026-11-12T07:32:00Z", 0, 60);
    const taxi = possibilite("2026-11-12T06:30:00Z", "2026-11-12T08:20:00Z", 15, 40);
    const taxiTot = possibilite("2026-11-12T05:30:00Z", "2026-11-12T07:30:00Z", 15, 40);
    expect(taxisUtiles([taxi, taxiTot], [bus], "arriver")).toEqual([taxi]);
  });
});
