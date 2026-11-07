import { describe, expect, it } from "vitest";

import { boite, boiteAuMoins } from "./geo";

// Issue 0032 : la marche de 1 min à la gare de Flers (deux points à quelques mètres) donnait un cadre minuscule,
// la caméra zoomait au-delà de ce que montrent les tuiles : carte vide, en ligne comme hors réseau.
const metresLat = (b: number[]) => (b[3]! - b[1]!) * 111_320;
const metresLon = (b: number[]) => (b[2]! - b[0]!) * 111_320 * Math.cos((((b[1]! + b[3]!) / 2) * Math.PI) / 180);

describe("boiteAuMoins (issue 0032)", () => {
  const flers = [
    { lat: 48.74478, lon: -0.57325 },
    { lat: 48.74483, lon: -0.57321 },
  ];

  it("deux points à quelques mètres ⇒ au moins 200 m de chaque sens, même centre", () => {
    const b = boiteAuMoins(flers);
    expect(metresLat(b)).toBeCloseTo(200, 0);
    expect(metresLon(b)).toBeCloseTo(200, 0);
    const [o, s, e, n] = boite(flers);
    expect((b[0] + b[2]) / 2).toBeCloseTo((o + e) / 2, 9);
    expect((b[1] + b[3]) / 2).toBeCloseTo((s + n) / 2, 9);
  });

  it("un seul point ⇒ 200 m autour de lui", () => {
    expect(metresLat(boiteAuMoins([flers[0]!]))).toBeCloseTo(200, 0);
  });

  it("une étape plus grande que 200 m garde sa boîte", () => {
    const loin = [flers[0]!, { lat: 48.76, lon: -0.55 }];
    expect(boiteAuMoins(loin)).toEqual(boite(loin));
  });
});
