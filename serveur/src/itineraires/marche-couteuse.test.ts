import { describe, expect, it } from "vitest";
import { construireUrlAPied } from "../motis.js";
import { arretsMasques, COUT_ELARGI_SECONDES, marchesAdmises, planComplet, type AppelsMotis } from "./marche-couteuse.js";
import { construireUrlPlan, MARCHE_AUX_BOUTS_SECONDES, type DemandeRecherche } from "./motis-plan.js";

// Issue 0008 : valeurs tirées de la reproduction à Châtelet (quai du métro 14 à 4 min réelles,
// hors de portée avec la limite de coût de 30 min).
const QUAI_14 = "r80921_IDFM:21959";
const DEMANDE: DemandeRecherche = {
  depart: { lat: 48.8577, lon: 2.34738 },
  arrivee: { lat: 48.72935, lon: 2.36833 },
  jour: "2026-11-13",
  sens: "partir",
  depuisMinutes: 420,
};

const lieu = (name: string, stopId?: string) => ({ name, stopId, lat: 48.85, lon: 2.34 });
const marche = (debut: string, fin: string, secondes: number) => ({
  mode: "WALK",
  from: lieu("START"),
  to: lieu("Châtelet", QUAI_14),
  startTime: debut,
  endTime: fin,
  duration: secondes,
});
const metro = (debut: string, fin: string) => ({
  mode: "SUBWAY",
  from: lieu("Châtelet", QUAI_14),
  to: lieu("Thiais", "r80921_IDFM:490833"),
  startTime: debut,
  endTime: fin,
  duration: (Date.parse(fin) - Date.parse(debut)) / 1000,
  tripId: "20261113_07:05_r80921_x",
  routeShortName: "14",
});
const IT_ORDINAIRE = { legs: [marche("2026-11-13T06:00:00Z", "2026-11-13T06:21:00Z", 1260), metro("2026-11-13T06:22:00Z", "2026-11-13T06:44:00Z")] };
const IT_COURTE = { legs: [marche("2026-11-13T06:01:00Z", "2026-11-13T06:05:00Z", 240), metro("2026-11-13T06:05:00Z", "2026-11-13T06:27:00Z")] };
const IT_LONGUE = { legs: [marche("2026-11-13T06:00:00Z", "2026-11-13T06:40:00Z", 2400), metro("2026-11-13T06:40:00Z", "2026-11-13T07:02:00Z")] };

const atteints = (...arrets: [string, number][]) => ({ all: arrets.map(([stopId, duration]) => ({ place: { stopId }, duration, k: 0 })) });

describe("arrêts masqués par le coût de la marche (issue 0008)", () => {
  it("à 15 min réelles ou moins, absent avec la limite ordinaire ⇒ masqué ; plus loin ⇒ ignoré", () => {
    const ordinaire = atteints(["r80921_IDFM:463060", 4]);
    const elargi = atteints(["r80921_IDFM:463060", 4], [QUAI_14, 4], ["lointain", 16]);
    expect(arretsMasques(ordinaire, elargi)).toEqual([QUAI_14]);
    expect(arretsMasques(elargi, elargi)).toEqual([]);
  });

  it("réponse de MOTIS hors schéma ⇒ rejet (invariant 9)", () => {
    expect(() => arretsMasques({ rien: 1 }, atteints())).toThrow();
  });

  it("marche réelle au départ ou à l'arrivée de plus de 30 min ⇒ possibilité écartée", () => {
    expect(marchesAdmises([IT_COURTE, IT_LONGUE] as never)).toEqual([IT_COURTE]);
  });
});

describe("planComplet : recherche ordinaire, complétée si besoin", () => {
  function appels(o: { masque: boolean; elargi?: unknown; panneDetection?: boolean; panneOrdinaire?: boolean }) {
    const vues: DemandeRecherche[] = [];
    const ordinaire = { itineraries: [IT_ORDINAIRE], direct: [] };
    const m: AppelsMotis = {
      plan: async (d) => {
        vues.push(d);
        if (d.coutMarche) return o.elargi;
        if (o.panneOrdinaire) throw new Error("panne");
        return ordinaire;
      },
      aPied: async (_p, cote, _i, cout) => {
        if (o.panneDetection) throw new Error("panne");
        return o.masque && cote === "depart" && cout === COUT_ELARGI_SECONDES ? atteints([QUAI_14, 4]) : atteints();
      },
    };
    return { m, vues, ordinaire };
  }

  it("aucun arrêt masqué ⇒ la réponse ordinaire, telle quelle, en une seule recherche", async () => {
    const { m, vues, ordinaire } = appels({ masque: false });
    expect(await planComplet(m, DEMANDE)).toBe(ordinaire);
    expect(vues).toHaveLength(1);
  });

  it("arrêt masqué au départ ⇒ seconde recherche élargie de ce côté seulement ; ses marches de plus de 30 min écartées", async () => {
    const { m, vues } = appels({ masque: true, elargi: { itineraries: [IT_COURTE, IT_LONGUE] } });
    const r = (await planComplet(m, DEMANDE)) as { itineraries: unknown[] };
    expect(vues).toHaveLength(2);
    expect(vues[1]!.coutMarche).toEqual({ depart: COUT_ELARGI_SECONDES, arrivee: MARCHE_AUX_BOUTS_SECONDES });
    expect(r.itineraries).toEqual([IT_ORDINAIRE, IT_COURTE]);
  });

  it("détection ou seconde recherche en panne ⇒ la réponse ordinaire", async () => {
    const a = appels({ masque: false, panneDetection: true });
    expect(await planComplet(a.m, DEMANDE)).toBe(a.ordinaire);
    const b = appels({ masque: true, elargi: { pas: "un plan" } });
    expect(await planComplet(b.m, DEMANDE)).toBe(b.ordinaire);
  });

  it("recherche ordinaire en panne ⇒ l'erreur remonte (503 dans la route)", async () => {
    const { m } = appels({ masque: false, panneOrdinaire: true });
    await expect(planComplet(m, DEMANDE)).rejects.toThrow("panne");
  });
});

describe("URL de MOTIS", () => {
  it("limite de coût de la marche : ordinaire par défaut, élargie à la demande", () => {
    const ordinaire = construireUrlPlan("http://motis:8080", DEMANDE);
    expect(ordinaire.searchParams.get("maxPreTransitTime")).toBe("1800");
    expect(ordinaire.searchParams.get("maxPostTransitTime")).toBe("1800");
    const elargie = construireUrlPlan("http://motis:8080", { ...DEMANDE, coutMarche: { depart: 3600, arrivee: 1800 } });
    expect(elargie.searchParams.get("maxPreTransitTime")).toBe("3600");
    expect(elargie.searchParams.get("maxPostTransitTime")).toBe("1800");
  });

  it("à pied seulement : aucun transport, sens et limite du bon côté", () => {
    const instant = new Date("2026-11-13T06:00:00Z");
    const dep = construireUrlAPied("http://motis:8080", DEMANDE.depart, "depart", instant, 3600);
    expect(dep.pathname).toBe("/api/v6/one-to-all");
    expect(dep.searchParams.get("transitModes")).toBe("");
    expect(dep.searchParams.get("arriveBy")).toBe("false");
    expect(dep.searchParams.get("maxPreTransitTime")).toBe("3600");
    expect(dep.searchParams.get("maxTravelTime")).toBe("60");
    const arr = construireUrlAPied("http://motis:8080", DEMANDE.arrivee, "arrivee", instant, 1800);
    expect(arr.searchParams.get("arriveBy")).toBe("true");
    expect(arr.searchParams.get("maxPostTransitTime")).toBe("1800");
    expect(arr.searchParams.has("maxPreTransitTime")).toBe(false);
  });
});
