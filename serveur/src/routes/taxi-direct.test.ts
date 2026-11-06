import { describe, expect, it } from "vitest";
import { construireUrlPlan, lireReponsePlan } from "../itineraires/motis-plan.js";
import { taxiDeBoutEnBout } from "./itineraires.js";

/** Spec 41 (D122) : Brienon → Flers en voiture, 15 698 s et 458 km (constaté sur le MOTIS national le 2026-11-06). */
const lieu = (name: string, lat: number, lon: number) => ({ name, lat, lon });
const voiture = {
  itineraries: [],
  direct: [
    {
      legs: [
        {
          mode: "CAR",
          from: lieu("START", 47.9918, 3.617),
          to: lieu("END", 48.7495, -0.5698),
          startTime: "2026-11-12T07:00:00Z",
          endTime: "2026-11-12T11:21:38Z",
          duration: 15698,
          distance: 458196,
        },
      ],
    },
  ],
};
const commun = { depart: { lat: 47.9918, lon: 3.617 }, arrivee: { lat: 48.7495, lon: -0.5698 }, jour: "2026-11-12" };

describe("Taxi de bout en bout (spec 41, critère 4)", () => {
  it("URL : voiture seule, sans transport en commun, 6 h au plus", () => {
    const u = construireUrlPlan("http://motis:8080", { ...commun, sens: "partir", depuisMinutes: 480, taxiDirect: true });
    expect(u.searchParams.get("directModes")).toBe("CAR");
    expect(u.searchParams.get("transitModes")).toBe("WALK");
    expect(u.searchParams.get("maxDirectTime")).toBe("21600");
  });

  it("« arriver avant 15:00, marge 10 » ⇒ départ 10:28, arrivée 14:50 ; « partir à 08:00 » ⇒ 08:00 → 12:22", () => {
    const ps = lireReponsePlan(voiture);
    expect(taxiDeBoutEnBout(ps, { ...commun, sens: "arriver", limiteMinutes: 14 * 60 + 50 })).toEqual({
      duree_minutes: 262,
      distance_metres: 458196,
      depart: "10:28",
      arrivee: "14:50",
      depart_utc: "2026-11-12T09:28:00.000Z",
      arrivee_utc: "2026-11-12T13:50:00.000Z",
    });
    expect(taxiDeBoutEnBout(ps, { ...commun, sens: "partir", depuisMinutes: 480 })).toMatchObject({ depart: "08:00", arrivee: "12:22" });
  });

  it("aucune route en voiture ⇒ null", () => {
    expect(taxiDeBoutEnBout(lireReponsePlan({ itineraries: [], direct: [] }), { ...commun, sens: "partir", depuisMinutes: 480 })).toBeNull();
  });
});
