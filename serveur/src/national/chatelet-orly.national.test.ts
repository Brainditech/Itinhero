import { beforeEach, describe, expect, it } from "vitest";
import type { PossibiliteAffichee } from "../itineraires/normaliser.js";
import { appNationale } from "./app-nationale.js";

/**
 * Régression de l'issue 0008 (D62), sur le MOTIS national du PC, jamais en CI.
 * Passe par la route du serveur, jamais par MOTIS en direct.
 * Seuil tiré de l'issue 0008 (Google Maps : 07:01 → 07:29, métro 14 direct), pas des fixtures :
 * exception assumée à l'invariant 15, comme pour l'issue 0007.
 */
const PLACE_DU_CHATELET = { lat: 48.85835, lon: 2.34849 }; // zone d'arrêt IDFM:71264
const PONT_DE_RUNGIS = { lat: 48.74803, lon: 2.37267 };

let ctx: Awaited<ReturnType<typeof appNationale>>;
let preparation: Promise<void> | undefined;
beforeEach(() => (preparation ??= appNationale().then((c) => void (ctx = c))));

describe("issue 0008 : Châtelet → Pont de Rungis, vendredi 13/11, partir à 07:00", () => {
  it("le métro 14 direct depuis le quai profond de Châtelet, 30 min au plus", async () => {
    await preparation;
    const r = await ctx.app.inject({
      method: "POST",
      url: "/v1/itineraires",
      headers: ctx.entete,
      payload: { depart: PLACE_DU_CHATELET, arrivee: PONT_DE_RUNGIS, date: "2026-11-13", heure: "07:00", sens: "partir" },
    });
    expect(r.statusCode, r.body).toBe(200);
    const ps = r.json().possibilites as PossibiliteAffichee[];
    const decrire = ps.map((p) => `${p.depart} → ${p.arrivee} (${p.etapes.map((e) => e.ligne ?? e.mode).join(", ")})`).join("\n");
    const directe = ps.find((p) => p.duree_minutes <= 30 && p.correspondances === 0 && p.etapes.some((e) => e.ligne === "14"));
    expect(directe, decrire).toBeDefined();
    // Avant D62 : 21 min à pied jusqu'à Pyramides. La marche d'approche reste courte.
    expect(directe!.etapes[0]!.mode).toBe("marche");
    expect(directe!.etapes[0]!.duree_minutes).toBeLessThanOrEqual(6);
  });
});
