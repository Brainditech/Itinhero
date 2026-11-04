import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { construireUrlPlan, lireReponsePlan } from "./motis-plan.js";

const EXEMPLE = path.join(path.dirname(fileURLToPath(import.meta.url)), "__exemples__/plan-2026-11-12.json");
const lireExemple = async (): Promise<unknown> => JSON.parse(await readFile(EXEMPLE, "utf8"));

describe("construireUrlPlan (D44)", () => {
  it("cherche au départ, de 00:00 à H − M heure de Paris", () => {
    const url = construireUrlPlan("http://127.0.0.1:8080", {
      depart: { lat: 47.99, lon: 3.61 },
      arrivee: { lat: 47.97, lon: 3.38 },
      jour: "2026-11-12",
      limiteMinutes: 590,
    });
    expect(url.pathname).toBe("/api/v6/plan");
    expect(url.searchParams.get("time")).toBe("2026-11-11T23:00:00.000Z");
    expect(url.searchParams.get("searchWindow")).toBe(String(590 * 60));
    expect(url.searchParams.get("arriveBy")).toBe("false");
    expect(url.searchParams.get("useRoutedTransfers")).toBe("true");
    expect(url.searchParams.get("fromPlace")).toBe("47.99,3.61");
  });

  it("jour de changement d'heure : la fenêtre suit l'horloge de Paris", () => {
    const url = construireUrlPlan("http://127.0.0.1:8080", {
      depart: { lat: 0, lon: 0 },
      arrivee: { lat: 0, lon: 0 },
      jour: "2027-03-28",
      limiteMinutes: 590,
    });
    expect(url.searchParams.get("searchWindow")).toBe(String(530 * 60)); // une heure de moins
  });
});

describe("schéma de la réponse MOTIS", () => {
  it("la réponse enregistrée passe le schéma, heures converties en heure de Paris", async () => {
    const p = lireReponsePlan(await lireExemple());
    expect(p.length).toBeGreaterThan(0);
    for (const x of p) {
      expect(x.etapes.length).toBeGreaterThan(0);
      for (const e of x.etapes) expect(e.departParis.hhmm).toMatch(/^\d{2}:\d{2}$/);
    }
    const car = p[0]!.etapes.find((e) => e.mode === "BUS")!;
    expect(car.departParis).toEqual({ jour: "2026-11-12", minutes: 387, hhmm: "06:27" });
  });

  it("une réponse sans itineraries ⇒ rejet", () => {
    expect(() => lireReponsePlan({ from: {}, to: {} })).toThrow();
  });

  it("une heure illisible ⇒ rejet", async () => {
    const brut = (await lireExemple()) as { itineraries: { legs: { startTime: string }[] }[] };
    brut.itineraries[0]!.legs[0]!.startTime = "12/11/2026 06:27";
    expect(() => lireReponsePlan(brut)).toThrow();
  });
});
