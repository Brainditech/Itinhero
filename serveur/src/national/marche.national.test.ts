import { beforeEach, describe, expect, it } from "vitest";
import { MARCHE_MAX_SECONDES } from "../itineraires/motis-marche.js";
import { appNationale, distanceMetres } from "./app-nationale.js";

/**
 * Nouveau chemin à pied (spec 20, critère 3), sur le MOTIS national du PC, jamais en CI.
 * Aucune durée attendue écrite ici : on vérifie qu'une marche existe, où elle finit, et qu'elle a ses consignes.
 */
const GARE_JOIGNY = { lat: 47.973656, lon: 3.393667 }; // arrêt « Joigny » du GTFS (géocodage MOTIS, 2026-11-05)
const A_300_M = { lat: 47.97636, lon: 3.39367 }; // 300 m au nord de la gare
const BRIENON_MAIRIE = { lat: 47.9918, lon: 3.617 }; // 17 km

let ctx: Awaited<ReturnType<typeof appNationale>>;
let preparation: Promise<void> | undefined;
beforeEach(() => (preparation ??= appNationale().then((c) => void (ctx = c))));

type Marche = {
  mode: string;
  a: { lat: number; lon: number };
  duree_minutes: number;
  consignes: { manoeuvre: string; lat: number; lon: number }[] | null;
  source: { type: string };
  trace: string | null;
} | null;

async function marche(de: { lat: number; lon: number }): Promise<Marche> {
  const r = await ctx.app.inject({ method: "POST", url: "/v1/marche", headers: ctx.entete, payload: { de, a: GARE_JOIGNY } });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().marche;
}

describe("nouveau chemin à pied vers la gare de Joigny", () => {
  it("à 300 m : une marche qui finit à la gare, avec ses consignes", async () => {
    const m = await marche(A_300_M);
    expect(m).not.toBeNull();
    expect(m!.mode).toBe("marche");
    expect(m!.source.type).toBe("osm");
    expect(m!.trace).not.toBeNull();
    expect(distanceMetres(m!.a, GARE_JOIGNY)).toBeLessThan(5);
    expect(m!.consignes!.length).toBeGreaterThan(1);
    const fin = m!.consignes!.at(-1)!;
    expect(fin.manoeuvre).toBe("arrivee");
    expect(distanceMetres(fin, GARE_JOIGNY)).toBeLessThan(30);
    expect(m!.duree_minutes).toBeLessThan(15);
  });

  it("depuis Brienon (17 km) : aucune marche d'au plus 1 h", async () => {
    const m = await marche(BRIENON_MAIRIE);
    if (m !== null) expect(m.duree_minutes * 60).toBeLessThanOrEqual(MARCHE_MAX_SECONDES);
    expect(m).toBeNull();
  });
});
