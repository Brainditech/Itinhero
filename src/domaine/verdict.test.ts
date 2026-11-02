import { describe, expect, it } from "vitest";

import { verdict } from "./verdict";

// Heures de Paris le 12/11/2026 (UTC+1), scénario Joigny.
const le12 = (hhmm: string) => new Date(`2026-11-12T${hhmm}:00+01:00`);

describe("verdict", () => {
  it("possible quand l'arrivée est pile à rendez-vous moins la marge", () => {
    expect(verdict(le12("09:50"), le12("10:00"), 10)).toBe("possible");
  });

  it("impossible une minute après rendez-vous moins la marge", () => {
    expect(verdict(le12("09:51"), le12("10:00"), 10)).toBe("impossible");
  });

  it("marge 0 : possible jusqu'à l'heure du rendez-vous incluse", () => {
    expect(verdict(le12("10:00"), le12("10:00"), 0)).toBe("possible");
    expect(verdict(le12("10:01"), le12("10:00"), 0)).toBe("impossible");
  });

  it("refuse une marge négative ou non entière", () => {
    expect(() => verdict(le12("09:00"), le12("10:00"), -5)).toThrow(RangeError);
    expect(() => verdict(le12("09:00"), le12("10:00"), 7.5)).toThrow(RangeError);
    expect(() => verdict(le12("09:00"), le12("10:00"), Number.NaN)).toThrow(RangeError);
  });

  it("refuse une date invalide", () => {
    expect(() => verdict(new Date("pas une date"), le12("10:00"), 10)).toThrow(RangeError);
  });
});
