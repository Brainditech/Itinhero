import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ErreurMotis, type Point } from "../itineraires/motis-plan.js";
import { construireUrlMarche, MARCHE_MAX_SECONDES } from "../itineraires/motis-marche.js";
import type { Moteur } from "../motis.js";
import { appTest, ENTETE, MANIFEST_TEST } from "../outils-test.js";

// Réponse enregistrée le 2026-11-05 sur le MOTIS national : 300 m au nord de la gare de Joigny ⇒ la gare, à pied.
const EXEMPLE = path.join(path.dirname(fileURLToPath(import.meta.url)), "../itineraires/__exemples__/marche-joigny-gare-2026-11-05.json");
type Plan = { itineraries: unknown[]; direct: { duration: number; legs: Record<string, unknown>[] }[] };
const exemple = async (): Promise<Plan> => JSON.parse(await readFile(EXEMPLE, "utf8"));

const CORPS = { de: { lat: 47.97636, lon: 3.39367 }, a: { lat: 47.973656, lon: 3.393667 } };

type Vu = { de?: Point; a?: Point; instant?: Date };
function moteurMarche(reponse: () => Promise<unknown>, vu: Vu = {}): Moteur {
  return {
    plan: () => Promise.reject(new Error("inutile")),
    geocoder: () => Promise.reject(new Error("inutile")),
    marche: async (de, a, instant) => {
      Object.assign(vu, { de, a, instant });
      return reponse();
    },
  };
}

const poster = (app: ReturnType<typeof appTest>, payload: unknown, headers: Record<string, string> = ENTETE) =>
  app.inject({ method: "POST", url: "/v1/marche", headers, payload: payload as object });

describe("POST /v1/marche, entrées (spec 20, critère 1)", () => {
  const mauvais: [string, unknown][] = [
    ["de", { a: CORPS.a }],
    ["a.lat", { ...CORPS, a: { lat: 91, lon: 3 } }],
    ["de.lon", { ...CORPS, de: { lat: 47, lon: -181 } }],
    ["de.lat", { ...CORPS, de: { lat: "47", lon: 3 } }],
    ["(corps)", { ...CORPS, domicile: "secret" }],
  ];
  it.each(mauvais)("champ %s refusé, sans appeler MOTIS ni recopier la valeur", async (champ, corps) => {
    const vu: Vu = {};
    const r = await poster(appTest({ moteur: moteurMarche(exemple, vu) }), corps);
    expect(r.statusCode).toBe(400);
    expect(r.json().champs.join(" ")).toContain(champ);
    expect(r.body).not.toContain("secret");
    expect(vu.de).toBeUndefined();
  });

  it("sans clé ⇒ 401", async () => {
    const r = await poster(appTest({ moteur: moteurMarche(exemple) }), CORPS, {});
    expect(r.statusCode).toBe(401);
  });
});

describe("POST /v1/marche, réponse", () => {
  it("MOTIS reçoit les deux points et l'heure ; la marche a son tracé, ses consignes et sa source OSM", async () => {
    const vu: Vu = {};
    const avant = Date.now();
    const r = await poster(appTest({ moteur: moteurMarche(exemple, vu) }), CORPS);
    expect(r.statusCode).toBe(200);
    expect(vu.de).toEqual(CORPS.de);
    expect(vu.a).toEqual(CORPS.a);
    expect(vu.instant!.getTime()).toBeGreaterThanOrEqual(avant - 1000);
    const m = r.json().marche;
    expect(m.mode).toBe("marche");
    expect(m.source).toEqual({ type: "osm", jeu: "osm", version: "2026-11-04" });
    expect(m.trace.length).toBeGreaterThan(10);
    expect(m.consignes.length).toBeGreaterThan(1);
    expect(m.consignes.at(-1).manoeuvre).toBe("arrivee");
    expect(m.duree_minutes).toBe(6); // 342 s
    expect(m.distance_metres).toBe(389);
    expect(m.depart_utc).toBe("2026-11-12T08:00:00.000Z");
    expect(m.arrivee_utc).toBe("2026-11-12T08:05:00.000Z");
    expect(m.a).toMatchObject({ lat: CORPS.a.lat, lon: CORPS.a.lon });
  });

  it("aucun trajet direct ⇒ marche: null ; une marche de plus de 1 h est écartée", async () => {
    const vide = await poster(appTest({ moteur: moteurMarche(async () => ({ itineraries: [], direct: [] })) }), CORPS);
    expect(vide.statusCode).toBe(200);
    expect(vide.json()).toEqual({ marche: null });
    const longue = async () => {
      const e = await exemple();
      const leg = { ...e.direct[0]!.legs[0]!, duration: MARCHE_MAX_SECONDES + 60 };
      return { ...e, direct: [{ ...e.direct[0]!, legs: [leg] }] };
    };
    const r = await poster(appTest({ moteur: moteurMarche(longue) }), CORPS);
    expect(r.json()).toEqual({ marche: null });
  });

  it("sans carte OSM dans le manifeste, la marche n'a pas de source ⇒ marche: null (invariant 4)", async () => {
    const manifest = { ...MANIFEST_TEST, fichiers: MANIFEST_TEST.fichiers.filter((f) => f.type !== "osm") };
    const r = await poster(appTest({ manifest, moteur: moteurMarche(exemple) }), CORPS);
    expect(r.json()).toEqual({ marche: null });
  });

  it("MOTIS en panne ⇒ 503 ; moteur sans marche ⇒ 503 ; réponse hors schéma ⇒ 502", async () => {
    const enPanne = appTest({ moteur: moteurMarche(() => Promise.reject(new ErreurMotis("MOTIS injoignable"))) });
    expect((await poster(enPanne, CORPS)).statusCode).toBe(503);
    expect((await poster(appTest(), CORPS)).statusCode).toBe(503);
    const illisible = appTest({ moteur: moteurMarche(async () => ({ direct: "x" })) });
    expect((await poster(illisible, CORPS)).statusCode).toBe(502);
  });

  it("aucune coordonnée ni clé dans les journaux", async () => {
    const lignes: string[] = [];
    const corps = { de: { lat: 12.345678, lon: 98.765432 }, a: { lat: 11.223344, lon: 99.887766 } };
    for (const moteur of [moteurMarche(() => Promise.reject(new ErreurMotis("MOTIS injoignable"))), moteurMarche(exemple)]) {
      const app = appTest({ moteur, fluxJournal: { write: (l) => void lignes.push(l) } });
      await poster(app, corps);
      await poster(app, { ...corps, de: { lat: 95.123456, lon: 1 } });
    }
    const journal = lignes.join("\n");
    expect(lignes.length).toBeGreaterThan(0);
    for (const interdit of ["12.345678", "98.765432", "11.223344", "99.887766", "95.123456", ENTETE.authorization.slice(7)]) {
      expect(journal).not.toContain(interdit);
    }
  });
});

describe("URL de MOTIS (openapi.yaml v2.11.4)", () => {
  it("plan sans transport, à pied seulement, au plus 1 h, avec le détail des marches", () => {
    const url = construireUrlMarche("http://motis:8080", CORPS.de, CORPS.a, new Date("2026-11-12T08:00:00Z"));
    expect(url.pathname).toBe("/api/v6/plan");
    const q = url.searchParams;
    expect(q.get("fromPlace")).toBe("47.97636,3.39367");
    expect(q.get("toPlace")).toBe("47.973656,3.393667");
    expect(q.get("time")).toBe("2026-11-12T08:00:00.000Z");
    expect(q.get("arriveBy")).toBe("false");
    expect(q.get("transitModes")).toBe("");
    expect(q.get("directModes")).toBe("WALK");
    expect(q.get("maxDirectTime")).toBe("3600");
    expect(q.get("detailedLegs")).toBe("true");
  });
});
