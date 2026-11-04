import { beforeEach, describe, expect, it } from "vitest";
import type { PossibiliteAffichee } from "../itineraires/normaliser.js";
import { appNationale, distanceMetres } from "./app-nationale.js";

/**
 * Régression de l'issue 0007 (spec 09, §4.7), sur le MOTIS national du PC, jamais en CI.
 * Passe par les routes du serveur, jamais par MOTIS en direct.
 * Seuils tirés de l'issue 0007 (comparaison avec SNCF Connect et Google Maps), pas des fixtures :
 * exception assumée à l'invariant 15, qui vise le test Joigny.
 */
const BRIENON_MAIRIE = { lat: 47.9918, lon: 3.617 };
const CITE_JUDICIAIRE_DIJON = { lat: 47.3297, lon: 5.045 };
const LIEU_JOIGNY = { lat: 47.974911, lon: 3.385793 }; // spec 05
const JOUR = "2026-11-12";

let ctx: Awaited<ReturnType<typeof appNationale>>;
let preparation: Promise<void> | undefined;
beforeEach(() => (preparation ??= appNationale().then((c) => void (ctx = c))));

async function partir(heure: string): Promise<{ verdict: string; possibilites: PossibiliteAffichee[] }> {
  const r = await ctx.app.inject({
    method: "POST",
    url: "/v1/itineraires",
    headers: ctx.entete,
    payload: { depart: BRIENON_MAIRIE, arrivee: CITE_JUDICIAIRE_DIJON, date: JOUR, heure, sens: "partir" },
  });
  expect(r.statusCode, r.body).toBe(200);
  const corps = r.json();
  for (const p of corps.possibilites as PossibiliteAffichee[]) {
    expect(p.depart_utc >= new Date(`${JOUR}T${heure}:00+01:00`).toISOString(), `${p.depart} avant ${heure}`).toBe(true);
    expect(p.depart_utc < `${JOUR}T23:00:00.000Z`, "part un autre jour").toBe(true);
    for (const e of p.etapes) expect(e.source).toBeDefined();
  }
  return corps;
}

const decrire = (ps: PossibiliteAffichee[]) =>
  ps.map((p) => `${p.depart} → ${p.arrivee} (${p.etapes.map((e) => e.ligne ?? e.mode).join(", ")})`).join("\n");

describe("issue 0007 : Brienon → Dijon, jeudi 12/11", () => {
  it("partir dès 06:00 ⇒ une arrivée au plus tard à 09:50", async () => {
    const r = await partir("06:00");
    expect(r.verdict).toBe("possible");
    expect(r.possibilites.some((p) => p.arrivee <= "09:50"), decrire(r.possibilites)).toBe(true);
  });

  it("partir dès 08:00 ⇒ départ 08:24 par le car 803, arrivée au plus tard à 10:45", async () => {
    const r = await partir("08:00");
    const ok = r.possibilites.some(
      (p) => p.depart === "08:24" && p.arrivee <= "10:45" && p.etapes.some((e) => e.ligne === "803"),
    );
    expect(ok, decrire(r.possibilites)).toBe(true);
  });
});

describe("géocodeur national", () => {
  async function candidats(q: string) {
    const r = await ctx.app.inject({ method: "GET", url: `/v1/lieux?q=${encodeURIComponent(q)}`, headers: ctx.entete });
    expect(r.statusCode).toBe(200);
    return r.json().candidats as { nom: string; commune: string | null; lat: number; lon: number }[];
  }

  it("« route de Chamvres Joigny » ⇒ un candidat à Joigny à moins de 500 m du lieu de rendez-vous", async () => {
    const c = await candidats("route de Chamvres Joigny");
    expect(c.some((x) => x.commune === "Joigny" && distanceMetres(x, LIEU_JOIGNY) < 500)).toBe(true);
  });

  it("« tribunal judiciaire Dijon » ⇒ un candidat à moins de 500 m de la Cité judiciaire", async () => {
    const c = await candidats("tribunal judiciaire Dijon");
    expect(c.some((x) => distanceMetres(x, CITE_JUDICIAIRE_DIJON) < 500)).toBe(true);
  });
});
