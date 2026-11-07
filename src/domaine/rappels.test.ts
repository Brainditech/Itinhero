import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { Etape, Possibilite } from "./api";
import { actionsDuTrajet, appelsAVenir, instantDeParis, livraisonDe, rappelsDuTrajet, rappelVeille } from "./rappels";

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

describe("Rappels à l'heure exacte (issue 0026, D120)", () => {
  it("« Partez » et « Appelez le taxi » en alarme ; veille et réservation exactes", () => {
    expect(livraisonDe("partir")).toBe("alarme");
    expect(livraisonDe("taxi")).toBe("alarme");
    expect(livraisonDe("veille")).toBe("exacte");
    expect(livraisonDe("reserver")).toBe("exacte");
  });
});

describe("« À faire » d'un trajet enregistré (spec 40, critère 1)", () => {
  const taxi: Etape = { ...BRIENON_DIJON.etapes[1]!, mode: "taxi", reservation: null, depart: "08:25", depart_utc: "2026-11-14T07:25:00.000Z" };
  const AVEC_TAXI = { ...BRIENON_DIJON, etapes: [BRIENON_DIJON.etapes[0]!, taxi, ...BRIENON_DIJON.etapes.slice(2)] };

  it("réservation : la veille 10:00, délai non connu, aucun numéro ; puis partir 15 min avant", () => {
    expect(actionsDuTrajet(BRIENON_DIJON, "Dijon", AVANT)).toEqual([
      {
        cle: "reserver-1",
        type: "reserver",
        titre: "Réserver : Bus 803 de 08:25",
        detail: "Passage sur réservation à Mairie.",
        rappel: "Rappel la veille à 10:00",
        passe: false,
        contact: null,
        delai: "Délai non connu",
      },
      {
        cle: "partir",
        type: "partir",
        titre: "Partir",
        detail: "Départ de la porte à 08:14.",
        rappel: "Rappel à 07:59",
        passe: false,
        contact: null,
        delai: null,
      },
    ]);
    expect(rappelVeille(BRIENON_DIJON, "Dijon")).toBe("Rappel la veille à 19:00");
  });

  it("taxi : « Appeler le taxi », prise en charge, rappel 60 min avant, numéro sourcé repris", () => {
    const contact = { nom: "Taxi X", numero: "03 86 00 00 00", source: "fiche" as const, url: "https://exemple.fr", lu_le: "2026-11-06", verifie: true, delai: "La veille" };
    const p = { ...AVEC_TAXI, etapes: AVEC_TAXI.etapes.map((e, i) => (i === 1 ? { ...e, contact } : e)) };
    const [a] = actionsDuTrajet(p, "Dijon", AVANT);
    expect(a).toMatchObject({ type: "taxi", titre: "Appeler le taxi", detail: "Prise en charge à 08:25, Mairie.", rappel: "Rappel à 07:25", contact, delai: "La veille" });
  });

  it("rappel passé marqué ; « 1 appel » tant que le taxi est à venir, 0 après", () => {
    expect(appelsAVenir(AVEC_TAXI, "Dijon", AVANT)).toBe(1);
    const apres = new Date("2026-11-14T06:30:00Z");
    expect(actionsDuTrajet(AVEC_TAXI, "Dijon", apres).find((a) => a.type === "taxi")?.passe).toBe(true);
    expect(appelsAVenir(AVEC_TAXI, "Dijon", apres)).toBe(0);
    expect(appelsAVenir(BRIENON_DIJON, "Dijon", AVANT)).toBe(1);
  });
});

describe("Taxi à l'arrivée : appel pendant le trajet (issue 0031, D48)", () => {
  // Brienon → Dijon, dernière marche remplacée par un taxi pris à Dijon à 10:24 (après le départ de la porte, 08:14).
  const fin: Etape = { ...BRIENON_DIJON.etapes[4]!, mode: "taxi", reservation: null, depart: "10:24", depart_utc: "2026-11-14T09:24:00.000Z" };
  const p: Possibilite = { ...BRIENON_DIJON, etapes: [...BRIENON_DIJON.etapes.slice(0, 4), fin] };

  it("le rappel du taxi d'arrivée est programmé 60 min avant sa prise en charge, même après le départ", () => {
    const r = rappelsDuTrajet(p, "Dijon", AVANT).find((x) => x.type === "taxi");
    expect(r).toMatchObject({ cle: "taxi-4", titre: "Appelez le taxi maintenant" });
    expect(r?.instant.toISOString()).toBe("2026-11-14T08:24:00.000Z");
  });

  it("« À faire » : « Appeler le taxi » à sa place dans l'ordre du temps, et « 2 appels à passer »", () => {
    const actions = actionsDuTrajet(p, "Dijon", AVANT);
    expect(actions.map((a) => a.type)).toEqual(["reserver", "partir", "taxi"]);
    expect(actions.at(-1)).toMatchObject({ titre: "Appeler le taxi", detail: "Prise en charge à 10:24, Dijon.", rappel: "Rappel à 09:24" });
    expect(appelsAVenir(p, "Dijon", AVANT)).toBe(2);
  });

  it("les autres rappels gardent la règle de la spec 30 : rien après le départ de la porte", () => {
    expect(rappelsDuTrajet(p, "Dijon", AVANT).filter((x) => x.type !== "taxi").every((x) => x.instant.getTime() < new Date(p.depart_utc).getTime())).toBe(true);
  });

  it("taxi d'arrivée le lendemain : « Rappel le 15/11 à … », jamais « la veille »", () => {
    const lendemain: Etape = { ...fin, depart: "06:10", depart_utc: "2026-11-15T05:10:00.000Z" };
    const q: Possibilite = { ...p, etapes: [...p.etapes.slice(0, 4), lendemain] };
    expect(actionsDuTrajet(q, "Dijon", AVANT).find((a) => a.type === "taxi")?.rappel).toBe("Rappel le 15/11 à 05:10");
  });
});
