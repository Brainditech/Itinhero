import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { DemandeRecherche } from "../itineraires/motis-plan.js";
import { construireUrlPlan } from "../itineraires/motis-plan.js";
import { lireTripId, modeAffiche, modePrecise, nomLigne, retirerDomines, type PossibiliteAffichee } from "../itineraires/normaliser.js";
import { appTest, ENTETE, moteurEnPanne } from "../outils-test.js";

const EXEMPLE = path.join(path.dirname(fileURLToPath(import.meta.url)), "../itineraires/__exemples__/plan-brienon-dijon-2026-11-12.json");
const exemple = async (): Promise<{ itineraries: { legs: Record<string, unknown>[] }[] }> =>
  JSON.parse(await readFile(EXEMPLE, "utf8"));

function moteurPlan(reponse: () => Promise<unknown>, vu: { d?: DemandeRecherche } = {}) {
  return {
    plan: async (d: DemandeRecherche) => {
      vu.d = d;
      return reponse();
    },
    geocoder: () => Promise.reject(new Error("inutile")),
  };
}

const CORPS = {
  depart: { lat: 47.9918, lon: 3.617 },
  arrivee: { lat: 47.3297, lon: 5.045 },
  date: "2026-11-12",
  heure: "08:00",
  sens: "partir",
};

const poster = (app: ReturnType<typeof appTest>, payload: unknown) =>
  app.inject({ method: "POST", url: "/v1/itineraires", headers: ENTETE, payload: payload as object });

describe("POST /v1/itineraires, entrées (critère 5)", () => {
  const mauvais: [string, unknown][] = [
    ["date", { ...CORPS, date: "2026-11-31" }],
    ["heure", { ...CORPS, heure: "24:00" }],
    ["heure", { ...CORPS, heure: "8:00" }],
    ["sens", { ...CORPS, sens: "avant" }],
    ["marge", { ...CORPS, marge: 121 }],
    ["marge", { ...CORPS, marge: 1.5 }],
    ["(corps)", { ...CORPS, domicile: "secret" }],
    ["depart.lat", { ...CORPS, depart: { lat: 91, lon: 3 } }],
    ["arrivee", { ...CORPS, arrivee: undefined }],
    ["marge", { ...CORPS, sens: "arriver", heure: "00:05", marge: 10 }],
  ];
  it.each(mauvais)("champ %s refusé, sans recopier la valeur", async (champ, corps) => {
    const r = await poster(appTest({ moteur: moteurPlan(exemple) }), corps);
    expect(r.statusCode).toBe(400);
    expect(r.json().erreur).toBe("requete_invalide");
    expect(r.json().champs.join(" ")).toContain(champ);
    expect(r.body).not.toContain("secret");
  });

  it("JSON illisible ⇒ 400 ; corps de plus de 8 Kio ⇒ 413", async () => {
    const app = appTest({ moteur: moteurPlan(exemple) });
    const illisible = await app.inject({
      method: "POST",
      url: "/v1/itineraires",
      headers: { ...ENTETE, "content-type": "application/json" },
      payload: "{pas du json",
    });
    expect(illisible.statusCode).toBe(400);
    const gros = await poster(app, { ...CORPS, x: "a".repeat(9000) });
    expect(gros.statusCode).toBe(413);
  });
});

describe("POST /v1/itineraires, normalisation (critère 6)", () => {
  it("chaque étape a sa source ; jeu, trip_id, date de service, version ; marche ⇒ OSM", async () => {
    const r = await poster(appTest({ moteur: moteurPlan(exemple) }), CORPS);
    expect(r.statusCode).toBe(200);
    const corps = r.json();
    expect(corps.verdict).toBe("possible");
    expect(corps.demande).toEqual({ date: "2026-11-12", heure: "08:00", sens: "partir", marge: null, limite: null });
    expect(corps.possibilites.length).toBe(2); // la possibilité du 13/11 est écartée
    for (const p of corps.possibilites) {
      for (const e of p.etapes) {
        expect(e.source, JSON.stringify(e)).toBeDefined();
        expect(e.etat).toBe("prevu");
        if (e.mode === "marche") expect(e.source).toEqual({ type: "osm", jeu: "osm", version: "2026-11-04" });
        else expect(e.source.type).toBe("gtfs");
      }
    }
    const p = corps.possibilites[0];
    expect(p).toMatchObject({ depart: "08:24", arrivee: "10:43", correspondances: 2 });
    expect(p.etapes[0].de.nom).toBe("Départ");
    expect(p.etapes.at(-1).a.nom).toBe("Arrivée");
    const car = p.etapes[1];
    expect(car).toMatchObject({ mode: "bus", mode_motis: "BUS", ligne: "803", exploitant: "MOBIGO 89", depart: "08:25" });
    expect(car.source).toEqual({ type: "gtfs", jeu: "r84072", version: "2026-09-21", trip_id: "1014608-1-1", date_service: "2026-11-12" });
    expect(car.de.arret).toBe("600326");
    const train = p.etapes[3];
    expect(train).toMatchObject({ mode: "train", ligne: "K7" });
    expect(train.source.version).toBe("2026-10-30"); // feed_version d'abord
  });

  it("aucune trace du champ source de MOTIS (chemins du PC) dans la réponse", async () => {
    const brut = await exemple();
    brut.itineraries[0]!.legs[1]!.source = "/donnees/gtfs/r84072.zip/stop_times.txt:192:201";
    const r = await poster(appTest({ moteur: moteurPlan(async () => brut) }), CORPS);
    expect(r.body).not.toContain("/donnees");
  });

  it("tripId illisible ou jeu inconnu ⇒ la possibilité est retirée, les autres gardées", async () => {
    const brut = await exemple();
    brut.itineraries[0]!.legs[1]!.tripId = "illisible";
    brut.itineraries[1]!.legs[1]!.tripId = "20261112_09:25_r99999_x";
    const r = await poster(appTest({ moteur: moteurPlan(async () => brut) }), CORPS);
    expect(r.json().possibilites).toEqual([]);
    expect(r.json().verdict).toBe("impossible");
  });

  it("manifeste sans OSM ⇒ aucune marche sourcée ⇒ possibilités retirées", async () => {
    const app = appTest({
      moteur: moteurPlan(exemple),
      manifest: { version: 1, fichiers: [] as never },
    });
    expect((await poster(app, CORPS)).json().verdict).toBe("impossible");
  });

  it("table des modes et lecture du tripId", () => {
    expect(["WALK", "COACH", "ODM", "SUBWAY", "SUBURBAN", "HIGHSPEED_RAIL", "FERRY", "NOUVEAU"].map(modeAffiche)).toEqual([
      "marche", "car", "transport_a_la_demande", "metro", "train_banlieue", "train", "bateau", "autre",
    ]);
    expect(lireTripId("20261112_07:34_r83582_OCESN17769F1187_F:TER:FR")).toEqual({
      date_service: "2026-11-12", jeu: "r83582", trip_id: "OCESN17769F1187_F:TER:FR",
    });
    expect(lireTripId("pas_un_trip")).toBeNull();
    expect(modePrecise("BUS", "K941", "SNCF")).toBe("car");
    expect(modePrecise("BUS", "803", "MOBIGO 89")).toBe("bus");
    expect(modePrecise("REGIONAL_RAIL", "A", "RATP")).toBe("train_banlieue");
    expect(modePrecise("REGIONAL_RAIL", "K7", "SNCF VOYAGEURS")).toBe("train");
    expect(["803", "FlixBus 712", "", " ", "INCONNU", "Paris-Gare-de-Lyon/Lyon-Perrache-Voyageurs", undefined].map(nomLigne)).toEqual([
      "803", "FlixBus 712", null, null, null, null, null,
    ]);
  });
});

describe("POST /v1/itineraires, sens et jour (critère 7)", () => {
  it("« partir » 08:00 ⇒ MOTIS interrogé à 07:00Z (D58) ; tri par départ", async () => {
    const vu: { d?: DemandeRecherche } = {};
    const r = await poster(appTest({ moteur: moteurPlan(exemple, vu) }), CORPS);
    const url = construireUrlPlan("http://motis:8080", vu.d!);
    expect(url.searchParams.get("time")).toBe("2026-11-12T07:00:00.000Z");
    expect(url.searchParams.get("arriveBy")).toBe("false");
    const departs = r.json().possibilites.map((p: { depart_utc: string }) => p.depart_utc);
    expect(departs).toEqual([...departs].sort());
  });

  it("« partir » 09:00 ⇒ le départ de 08:24 est écarté", async () => {
    const r = await poster(appTest({ moteur: moteurPlan(exemple) }), { ...CORPS, heure: "09:00" });
    expect(r.json().possibilites.map((p: { depart: string }) => p.depart)).toEqual(["09:24"]);
  });

  it("« arriver » 11:00, marge 10 ⇒ requête D44 et limite 10:50", async () => {
    const vu: { d?: DemandeRecherche } = {};
    const r = await poster(appTest({ moteur: moteurPlan(exemple, vu) }), { ...CORPS, sens: "arriver", heure: "11:00" });
    expect(vu.d).toMatchObject({ sens: "arriver", limiteMinutes: 650 });
    expect(r.json().demande).toMatchObject({ marge: 10, limite: "10:50" });
    expect(r.json().possibilites.map((p: { arrivee: string }) => p.arrivee)).toEqual(["10:43"]);
  });

  it("moteur en panne ⇒ 503 ; réponse hors schéma ⇒ 502", async () => {
    expect((await poster(appTest({ moteur: moteurEnPanne }), CORPS)).statusCode).toBe(503);
    expect((await poster(appTest({ moteur: moteurPlan(async () => ({ rien: 1 })) }), CORPS)).statusCode).toBe(502);
  });
});

describe("journaux sans donnée personnelle (critère 8)", () => {
  it("ni le lieu, ni les coordonnées, ni la clé dans les journaux, moteur en panne", async () => {
    const lignes: string[] = [];
    const app = appTest({ moteur: moteurEnPanne, fluxJournal: { write: (l) => void lignes.push(l) } });
    await app.inject({ method: "GET", url: "/v1/lieux?q=CANARI-LIEU", headers: ENTETE });
    await poster(app, { ...CORPS, depart: { lat: 12.345678, lon: 98.765432 } });
    await app.inject({
      method: "POST",
      url: "/v1/itineraires",
      headers: { ...ENTETE, "content-type": "application/json" },
      payload: '{"CANARI-CORPS',
    });
    const journal = lignes.join("\n");
    expect(lignes.length).toBeGreaterThan(0);
    for (const interdit of ["CANARI", "12.345678", "98.765432", ENTETE.authorization.slice(7)]) {
      expect(journal).not.toContain(interdit);
    }
  });
});

describe("possibilités rendues inutiles par une autre", () => {
  const p = (dep: string, arr: string, corr: number) =>
    ({ depart_utc: `2026-11-13T${dep}:00.000Z`, arrivee_utc: `2026-11-13T${arr}:00.000Z`, correspondances: corr }) as PossibiliteAffichee;
  it("partir plus tôt pour arriver 13 min plus tard sans correspondance ⇒ retirée", () => {
    const longue = p("06:01", "06:49", 0);
    const bonne = p("06:02", "06:36", 1);
    expect(retirerDomines([longue, bonne])).toEqual([bonne]);
  });
  it("un direct 6 min plus lent reste à côté d'un trajet avec correspondance", () => {
    const direct = p("09:00", "09:43", 0);
    const corr = p("09:02", "09:37", 1);
    expect(retirerDomines([direct, corr])).toEqual([direct, corr]);
  });
  it("même départ, même arrivée, plus de correspondances ⇒ retirée ; doublon exact gardé une fois", () => {
    const a = p("09:00", "09:30", 0);
    const b = p("09:00", "09:30", 2);
    expect(retirerDomines([a, b])).toEqual([a]);
    const c = { ...a };
    expect(retirerDomines([a, c])).toEqual([a]);
  });
});
