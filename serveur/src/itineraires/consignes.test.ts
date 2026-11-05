import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  calculerConsignes,
  cap,
  decoderTrace,
  ecartCap,
  encoderTrace,
  manoeuvreDuVirage,
  pointCardinal,
  type Consigne,
  type Coord,
  type Morceau,
} from "./consignes.js";

/**
 * Spec 11 (D70, D71) : consignes de marche sur la réponse du MOTIS national enregistrée le 2026-11-04
 * (Brienon → tribunal administratif de Dijon, samedi 14/11, `detailedLegs=true`).
 */
const ICI = path.dirname(fileURLToPath(import.meta.url));
const PLAN = path.join(ICI, "__exemples__/plan-brienon-dijon-2026-11-14-detaille.json");

type Leg = { mode: string; from: { name: string }; to: Coord & { name: string }; steps?: Morceau[] };
let legs: Leg[][];

beforeAll(async () => {
  const brut = JSON.parse(await readFile(PLAN, "utf8")) as { itineraries: { legs: Leg[] }[] };
  legs = brut.itineraries.map((i) => i.legs);
});

const consignesDe = (l: Leg): Consigne[] => calculerConsignes(l.steps ?? [], l.to);

/** Petit morceau de test : une ligne droite encodée. */
const morceau = (points: Coord[], rue = "", distance?: number): Morceau => ({
  distance: distance ?? Math.round(points.slice(1).reduce((n, p, i) => n + Math.hypot((p.lat - points[i]!.lat) * 111_000, (p.lon - points[i]!.lon) * 75_000), 0)),
  streetName: rue,
  relativeDirection: "CONTINUE",
  polyline: { points: encoderTrace(points), precision: 6 },
});

describe("tracés", () => {
  it("encoder puis décoder rend les mêmes points (précision 6)", () => {
    const pts = [
      { lat: 47.32341, lon: 5.027221 },
      { lat: 47.323473, lon: 5.027269 },
      { lat: -12.5, lon: -0.000001 },
    ];
    expect(decoderTrace(encoderTrace(pts))).toEqual(pts);
  });
  it("décode un tracé de MOTIS", () => {
    expect(decoderTrace("k~dpzAomw{E[tJ", 6)).toEqual([
      { lat: 47.991798, lon: 3.617 },
      { lat: 47.991812, lon: 3.616813 },
    ]);
  });
});

describe("caps et manœuvres (D71, 3)", () => {
  it("cap vers le nord et vers l'est", () => {
    expect(cap({ lat: 47, lon: 5 }, { lat: 47.001, lon: 5 })).toBeCloseTo(0, 0);
    expect(cap({ lat: 47, lon: 5 }, { lat: 47, lon: 5.001 })).toBeCloseTo(90, 0);
    expect(pointCardinal(44)).toBe("nord-est");
    expect(pointCardinal(350)).toBe("nord");
  });
  it("seuils 25°, 60°, 150°", () => {
    expect(ecartCap(350, 10)).toBe(20);
    expect(manoeuvreDuVirage(20)).toBe("tout_droit");
    expect(manoeuvreDuVirage(-40)).toBe("legerement_gauche");
    expect(manoeuvreDuVirage(90)).toBe("droite");
    expect(manoeuvreDuVirage(-90)).toBe("gauche");
    expect(manoeuvreDuVirage(170)).toBe("demi_tour");
  });
});

describe("cas construits", () => {
  // Vers le nord 100 m rue A, puis vers l'est 100 m rue B.
  const a = { lat: 47, lon: 5 };
  const b = { lat: 47.0009, lon: 5 };
  const c = { lat: 47.0009, lon: 5.0013 };
  it("un virage à droite d'une rue à l'autre, arrivée devant", () => {
    const cs = calculerConsignes([morceau([a, b], "Rue A"), morceau([b, c], "Rue B")], c);
    expect(cs.map((x) => [x.manoeuvre, x.rue])).toEqual([
      ["depart", "Rue A"],
      ["droite", "Rue B"],
      ["arrivee", null],
    ]);
    expect(cs[0]!.cap).toBe("nord");
    expect(cs[2]!.cote_arrivee).toBe("devant");
  });
  it("même rue en ligne droite coupée en morceaux : pas de consigne au milieu", () => {
    const m = { lat: 47.0004, lon: 5 };
    const cs = calculerConsignes([morceau([a, m], "Rue A"), morceau([m, b], "Rue A")], b);
    expect(cs.map((x) => x.manoeuvre)).toEqual(["depart", "arrivee"]);
    expect(cs[0]!.distance_metres).toBe(cs.length && Math.round(morceau([a, m]).distance + morceau([m, b]).distance));
  });
  it("arrivée sur la gauche quand le lieu est à l'ouest du bout du chemin vers le nord", () => {
    const cs = calculerConsignes([morceau([a, b], "Rue A")], { lat: 47.0009, lon: 4.9998 });
    expect(cs[cs.length - 1]!.cote_arrivee).toBe("gauche");
  });
  it("escalier et changement de niveau", () => {
    const esc: Morceau = { ...morceau([b, { lat: 47.0010, lon: 5 }]), relativeDirection: "STAIRS", fromLevel: 0, toLevel: 1 };
    const cs = calculerConsignes([morceau([a, b], "Rue A"), esc, morceau([{ lat: 47.001, lon: 5 }, { lat: 47.0019, lon: 5 }], "Rue A")], { lat: 47.0019, lon: 5 });
    expect(cs.find((x) => x.manoeuvre === "escalier")).toMatchObject({ niveau: "monter", rue: null });
  });
  it("aucun morceau : aucune consigne", () => {
    expect(calculerConsignes([], a)).toEqual([]);
  });
});

describe("Brienon → Dijon (réponse enregistrée)", () => {
  it("critère 1 : gare de Dijon → tribunal, au plus 8 consignes, un virage, arrivée à gauche ou à droite, aucune répétée", () => {
    const marche = legs[4]![4]!;
    expect(marche).toMatchObject({ mode: "WALK", from: { name: "Dijon" }, to: { name: "END" } });
    const cs = consignesDe(marche);
    expect(cs.length).toBeLessThanOrEqual(8);
    expect(cs.some((x) => x.manoeuvre === "gauche" || x.manoeuvre === "droite")).toBe(true);
    expect(["gauche", "droite"]).toContain(cs[cs.length - 1]!.cote_arrivee);
    cs.forEach((x, i) => {
      if (i > 0) expect([x.manoeuvre, x.rue]).not.toEqual([cs[i - 1]!.manoeuvre, cs[i - 1]!.rue]);
    });
    expect(cs[0]).toMatchObject({ manoeuvre: "depart", rue: "Cour de la Gare Pierre Semard" });
    expect(cs.map((x) => x.rue)).toContain("Avenue Maréchal Foch");
  });

  it("critère 2 : la marche de 14 min à Saint-Florentin suit la route de la Gare, puis la D 43 et la N 77", () => {
    const marche = legs[3]![2]!;
    expect(marche.from.name).toBe("SAINT FLORENTIN-VERGIGNY 3 RUE DE LA GARE");
    const rues = consignesDe(marche).map((x) => x.rue).filter((r): r is string => r !== null);
    const i = (r: string) => rues.indexOf(r);
    expect(i("Route de la Gare")).toBeGreaterThanOrEqual(0);
    expect(i("Route de la Gare")).toBeLessThan(i("D 43"));
    expect(i("D 43")).toBeLessThan(i("N 77"));
  });

  it("critère 3 : un morceau sans nom ne produit jamais un nom de rue", () => {
    for (const it of legs) {
      for (const l of it) {
        if (l.mode !== "WALK" || !l.steps) continue;
        const noms = new Set(l.steps.map((s) => s.streetName?.trim()).filter(Boolean));
        for (const c of consignesDe(l)) if (c.rue !== null) expect(noms.has(c.rue)).toBe(true);
      }
    }
  });

  it("les distances des consignes font la longueur de la marche (à 1 m près par consigne)", () => {
    const marche = legs[4]![4]!;
    const cs = consignesDe(marche);
    const total = (marche.steps ?? []).reduce((n, s) => n + s.distance, 0);
    expect(Math.abs(cs.reduce((n, c) => n + c.distance_metres, 0) - total)).toBeLessThanOrEqual(cs.length);
  });
});
