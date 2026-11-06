import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { Etape, Possibilite } from "./api";
import { instantDeParis, rappelsDuTrajet } from "./rappels";

// Possibilité réelle (samedi 14/11/2026) : marche 08:14, bus 803 sur réservation 08:25, marche, TER K7 09:10, marche.
const BRIENON_DIJON: Possibilite = JSON.parse(readFileSync(path.join(__dirname, "__exemples__/possibilite-brienon-dijon.json"), "utf8"));
const AVANT = new Date("2026-11-10T08:00:00Z");

const resume = (rs: ReturnType<typeof rappelsDuTrajet>) => rs.map((r) => [r.type, r.instant.toISOString()]);

describe("instantDeParis (spec 30)", () => {
  it("heure d'hiver, heure d'été, jour du changement", () => {
    expect(instantDeParis("2026-11-13", "19:00").toISOString()).toBe("2026-11-13T18:00:00.000Z");
    expect(instantDeParis("2026-07-14", "19:00").toISOString()).toBe("2026-07-14T17:00:00.000Z");
    expect(instantDeParis("2026-10-25", "10:00").toISOString()).toBe("2026-10-25T09:00:00.000Z");
  });
});

describe("rappelsDuTrajet (spec 30, critère 1)", () => {
  it("veille 19:00, réservation la veille 10:00, partir 15 min avant ; rangés dans l'ordre", () => {
    expect(resume(rappelsDuTrajet(BRIENON_DIJON, "Dijon", AVANT))).toEqual([
      ["reserver", "2026-11-13T09:00:00.000Z"],
      ["veille", "2026-11-13T18:00:00.000Z"],
      ["partir", "2026-11-14T06:59:00.000Z"],
    ]);
  });

  it("textes tirés de la possibilité, sans numéro de téléphone", () => {
    const rs = rappelsDuTrajet(BRIENON_DIJON, "Dijon", AVANT);
    expect(rs.find((r) => r.type === "veille")).toMatchObject({
      titre: "Demain : trajet vers Dijon",
      corps: "Départ 08:14, Bus 803 à 08:25. Arrivée prévue 10:44.",
    });
    expect(rs.find((r) => r.type === "reserver")).toMatchObject({
      titre: "À réserver : Bus 803 de 08:25",
      corps: "Passage sur réservation à Mairie. Délai non connu : réservez au plus tôt.",
    });
    expect(rs.find((r) => r.type === "partir")?.titre).toBe("Partez dans 15 min");
    for (const r of rs) expect(`${r.titre} ${r.corps}`).not.toMatch(/\d{2} ?\d{2} ?\d{2} ?\d{2} ?\d{2}/);
  });

  it("taxi : « Appelez le taxi maintenant » 60 min avant la prise en charge", () => {
    const taxi: Etape = { ...BRIENON_DIJON.etapes[1]!, mode: "taxi", reservation: null, depart: "08:25", depart_utc: "2026-11-14T07:25:00.000Z" };
    const p = { ...BRIENON_DIJON, etapes: [BRIENON_DIJON.etapes[0]!, taxi, ...BRIENON_DIJON.etapes.slice(2)] };
    const r = rappelsDuTrajet(p, "Dijon", AVANT).find((x) => x.type === "taxi");
    expect(r).toMatchObject({ cle: "taxi-1", titre: "Appelez le taxi maintenant", corps: "Prise en charge à 08:25, Mairie. Délai pour appeler non connu." });
    expect(r?.instant.toISOString()).toBe("2026-11-14T06:25:00.000Z");
  });

  it("enregistré la veille à 20:00 : seul « partir » reste ; trajet passé : aucun (critère 2)", () => {
    expect(resume(rappelsDuTrajet(BRIENON_DIJON, "Dijon", new Date("2026-11-13T19:00:00Z")))).toEqual([["partir", "2026-11-14T06:59:00.000Z"]]);
    expect(rappelsDuTrajet(BRIENON_DIJON, "Dijon", new Date("2026-11-14T07:00:00Z"))).toEqual([]);
  });
});
