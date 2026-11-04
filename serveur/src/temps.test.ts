import { describe, expect, it } from "vitest";
import { debutJourParis, heureParis, hhmm, instantParis, minutesDepuis } from "./temps.js";

describe("heure de Paris", () => {
  it("2026-11-12T05:27:00Z ⇒ 06:27 à Paris (heure d'hiver)", () => {
    expect(heureParis(new Date("2026-11-12T05:27:00Z"))).toEqual({
      jour: "2026-11-12",
      minutes: 387,
      hhmm: "06:27",
    });
  });

  it("passage à l'heure d'été du 2027-03-28", () => {
    expect(heureParis(new Date("2027-03-28T00:59:00Z")).hhmm).toBe("01:59");
    expect(heureParis(new Date("2027-03-28T01:00:00Z")).hhmm).toBe("03:00");
    expect(debutJourParis("2027-03-28").toISOString()).toBe("2027-03-27T23:00:00.000Z");
    expect(debutJourParis("2027-03-29").toISOString()).toBe("2027-03-28T22:00:00.000Z");
    expect(instantParis("2027-03-28", 9 * 60 + 50).toISOString()).toBe("2027-03-28T07:50:00.000Z");
  });

  it("instantParis et heureParis sont réciproques un jour ordinaire", () => {
    const i = instantParis("2026-11-12", 590);
    expect(i.toISOString()).toBe("2026-11-12T08:50:00.000Z");
    expect(heureParis(i).minutes).toBe(590);
  });

  it("minutesDepuis compte au-delà de minuit et avant le jour", () => {
    expect(minutesDepuis("2026-11-12", new Date("2026-11-12T23:30:00Z"))).toBe(1470);
    expect(minutesDepuis("2026-11-12", new Date("2026-11-11T22:00:00Z"))).toBe(-60);
  });

  it("hhmm", () => {
    expect(hhmm(590)).toBe("09:50");
    expect(hhmm(7)).toBe("00:07");
  });

  it("refuse un jour illisible", () => {
    expect(() => instantParis("12/11/2026", 0)).toThrow();
  });
});
