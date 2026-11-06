import { beforeEach, describe, expect, it } from "vitest";
import type { PossibiliteAffichee } from "../itineraires/normaliser.js";
import { appNationale } from "./app-nationale.js";

/**
 * Phase 2 bis (D46, spec 08 §7) : les deux trajets nationaux de PLAN.md, sur le MOTIS national du PC, jamais en CI.
 * Passe par les routes du serveur. Seuils tirés de la recherche de la spec 08 §7 (chaîne TER + métro + K4 arrivée
 * à Flers 10:09 ; car + train + RER B + bus arrivée à Wissous 10:18), à quelques minutes près : exception assumée
 * à l'invariant 15, qui vise le test Joigny.
 */
const LAROCHE_MIGENNES = { lat: 47.96108, lon: 3.51268 };
const GARE_DE_FLERS = { lat: 48.74479, lon: -0.57322 };
const BRIENON_MAIRIE = { lat: 47.9918, lon: 3.617 };
const WISSOUS = { lat: 48.73164, lon: 2.32687 };
const JOUR = "2026-11-12";

let ctx: Awaited<ReturnType<typeof appNationale>>;
let preparation: Promise<void> | undefined;
beforeEach(() => (preparation ??= appNationale().then((c) => void (ctx = c))));

async function partir(depart: typeof LAROCHE_MIGENNES, arrivee: typeof LAROCHE_MIGENNES, heure: string) {
  const r = await ctx.app.inject({
    method: "POST",
    url: "/v1/itineraires",
    headers: ctx.entete,
    payload: { depart, arrivee, date: JOUR, heure, sens: "partir" },
  });
  expect(r.statusCode, r.body).toBe(200);
  const corps = r.json() as { verdict: string; possibilites: PossibiliteAffichee[] };
  for (const p of corps.possibilites) for (const e of p.etapes) expect(e.source).toBeDefined();
  return corps;
}

const decrire = (ps: PossibiliteAffichee[]) =>
  ps.map((p) => `${p.depart} → ${p.arrivee} (${p.etapes.map((e) => `${e.mode}${e.ligne ? ` ${e.ligne}` : ""}`).join(", ")})`).join("\n");

describe("Laroche-Migennes → Flers par Paris, jeudi 12/11 (issue 0006)", () => {
  it("dès 05:00 : une arrivée au plus tard à 10:15, avec un métro ou un RER à Paris", async () => {
    const r = await partir(LAROCHE_MIGENNES, GARE_DE_FLERS, "05:00");
    console.info(`Laroche-Migennes → Flers :
${decrire(r.possibilites)}`); // preuve consignée (PLAN, phase 2 bis)
    expect(r.verdict).toBe("possible");
    const parParis = r.possibilites.filter((p) => p.etapes.some((e) => e.mode === "metro" || e.mode === "train_banlieue"));
    expect(parParis.some((p) => p.arrivee <= "10:15"), decrire(r.possibilites)).toBe(true); // constaté : 10:02
    // Le détour de 16:16 de l'issue 0006 n'est jamais la meilleure arrivée.
    expect(r.possibilites.map((p) => p.arrivee).sort()[0]! < "16:16", decrire(r.possibilites)).toBe(true);
  });
});

describe("Brienon-sur-Armançon → Wissous, jeudi 12/11 (GTFS régionaux et urbains)", () => {
  it("dès 05:00 : sans taxi, une arrivée au plus tard à 10:25, avec un car ou un bus et un train", async () => {
    const r = await partir(BRIENON_MAIRIE, WISSOUS, "05:00");
    console.info(`Brienon → Wissous :
${decrire(r.possibilites)}`);
    expect(r.verdict).toBe("possible");
    const ok = r.possibilites.some(
      (p) => p.arrivee <= "10:25" && !p.etapes.some((e) => e.mode === "taxi") && p.etapes.some((e) => e.mode === "bus" || e.mode === "car") && p.etapes.some((e) => /train|ter|intercites|tgv/i.test(e.mode)),
    );
    expect(ok, decrire(r.possibilites)).toBe(true); // constaté : 06:21 → 10:18
  });
});
