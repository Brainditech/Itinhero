import { beforeEach, describe, expect, it } from "vitest";
import type { PossibiliteAffichee } from "../itineraires/normaliser.js";
import { appNationale } from "./app-nationale.js";

/**
 * Test Joigny aller et retour (spec 19, critère 2 ; PLAN.md phase 3), sur le MOTIS national du PC, jamais en CI.
 * Brienon Mairie → lieu de rendez-vous de Joigny (spec 05), arriver avant 10:00, jeudi 12/11.
 * Aucune heure attendue écrite ici : on vérifie le jour, le sens et les points du retour.
 */
const BRIENON_MAIRIE = { lat: 47.9918, lon: 3.617 };
const LIEU_JOIGNY = { lat: 47.974911, lon: 3.385793 }; // spec 05
const JOUR = "2026-11-12";

let ctx: Awaited<ReturnType<typeof appNationale>>;
let preparation: Promise<void> | undefined;
beforeEach(() => (preparation ??= appNationale().then((c) => void (ctx = c))));

type Sens = { verdict: string; demande: { heure: string }; possibilites: PossibiliteAffichee[] };

async function allerRetour(fin: string): Promise<Sens & { retour: Sens }> {
  const r = await ctx.app.inject({
    method: "POST",
    url: "/v1/itineraires",
    headers: ctx.entete,
    payload: {
      depart: BRIENON_MAIRIE,
      arrivee: LIEU_JOIGNY,
      date: JOUR,
      heure: "10:00",
      sens: "arriver",
      marge: 10,
      noms: { depart: "Brienon", arrivee: "Rendez-vous" },
      fin_rdv: fin,
    },
  });
  expect(r.statusCode, r.body).toBe(200);
  return r.json();
}

const decrire = (ps: PossibiliteAffichee[]) =>
  ps.map((p) => `${p.depart} → ${p.arrivee} (${p.etapes.map((e) => e.ligne ?? e.mode).join(", ")})`).join("\n");

describe("Joigny aller et retour, jeudi 12/11", () => {
  it("fin 11:30 ⇒ un retour du même jour vers Brienon, parti après 11:30", async () => {
    const r = await allerRetour("11:30");
    expect(r.verdict).toBe("possible");
    expect(r.retour.verdict, decrire(r.retour.possibilites)).toBe("possible");
    expect(r.retour.demande.heure).toBe("11:30");
    for (const p of r.retour.possibilites) {
      expect(p.depart_utc >= `${JOUR}T10:30:00.000Z`, `${p.depart} avant 11:30`).toBe(true);
      expect(p.depart_utc < `${JOUR}T23:00:00.000Z`, "part un autre jour").toBe(true);
      expect(p.etapes[0]!.de.nom).toBe("Rendez-vous");
      expect(p.etapes.at(-1)!.a.nom).toBe("Brienon");
      for (const e of p.etapes) expect(e.source).toBeDefined();
    }
    // Au moins un retour qui arrive le jour même (avant minuit, heure de Paris).
    expect(
      r.retour.possibilites.some((p) => p.arrivee_utc < `${JOUR}T23:00:00.000Z`),
      decrire(r.retour.possibilites),
    ).toBe(true);
  });

  it("fin 22:30 ⇒ « impossible », ou un retour qui part le jour même : jamais un départ le lendemain", async () => {
    const r = await allerRetour("22:30");
    if (r.retour.verdict === "impossible") expect(r.retour.possibilites).toEqual([]);
    for (const p of r.retour.possibilites) expect(p.depart_utc < `${JOUR}T23:00:00.000Z`, decrire([p])).toBe(true);
  });
});
