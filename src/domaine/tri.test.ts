import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { schemaPossibilite, type Etape, type Possibilite } from "./api";
import { etapeAReserver, LIBELLES_TRIS, minutesDeMarche, TRIS, trier, type Tri } from "./tri";

/**
 * Spec 21 (D97), critères 1 et 2. Base : Brienon → Dijon, samedi 14/11/2026 (bus 803 sur réservation, TER K7) ;
 * chaque cas est fait de marches et du TER K7, et change seulement ce qu'il teste.
 */
const BASE = schemaPossibilite.parse(
  JSON.parse(readFileSync(path.join(__dirname, "__exemples__/possibilite-brienon-dijon.json"), "utf8")),
);
const MARCHE = BASE.etapes.find((e) => e.mode === "marche")!;
const TRANSPORT = BASE.etapes.find((e) => e.mode === "train")!;

const utc = (hhmm: string) => `2026-11-14T${hhmm}:00.000Z`;

/** Une possibilité de `depart` à `arrivee` : une marche par durée de `marches`, puis un transport. */
function possibilite(
  depart: string,
  arrivee: string,
  options: { marches?: number[]; correspondances?: number; transport?: Partial<Etape> } = {},
): Possibilite {
  const marches = (options.marches ?? [5]).map((m) => ({ ...MARCHE, duree_minutes: m }));
  return {
    ...BASE,
    depart,
    arrivee,
    depart_utc: utc(depart),
    arrivee_utc: utc(arrivee),
    correspondances: options.correspondances ?? 0,
    etapes: [...marches, { ...TRANSPORT, ...options.transport }],
  };
}

/** Heures des possibilités dans l'ordre rendu, avec leur rang dans la réponse. */
const ordre = (ps: Possibilite[], tri: Tri) => trier(ps, tri).map(({ possibilite: p, index }) => `${index}:${p.depart}-${p.arrivee}`);

describe("D97 : arrivée la plus tôt", () => {
  it("met d'abord celle qui arrive le plus tôt, même partie plus tard", () => {
    const ps = [possibilite("08:24", "10:43"), possibilite("08:40", "10:30")];
    expect(ordre(ps, "arrivee")).toEqual(["1:08:40-10:30", "0:08:24-10:43"]);
  });

  it("à arrivée égale, le départ le plus tard d'abord (moins de temps en route)", () => {
    const ps = [possibilite("08:00", "10:30"), possibilite("08:20", "10:30")];
    expect(ordre(ps, "arrivee")).toEqual(["1:08:20-10:30", "0:08:00-10:30"]);
  });

  it("à heures égales, moins de correspondances d'abord", () => {
    const ps = [possibilite("08:00", "10:30", { correspondances: 2 }), possibilite("08:00", "10:30", { correspondances: 1 })];
    expect(trier(ps, "arrivee").map((x) => x.index)).toEqual([1, 0]);
  });

  it("tout égal : l'ordre du serveur", () => {
    const ps = [possibilite("08:00", "10:30"), possibilite("08:00", "10:30"), possibilite("08:00", "10:30")];
    expect(trier(ps, "arrivee").map((x) => x.index)).toEqual([0, 1, 2]);
  });
});

describe("D97 : moins de marche", () => {
  it("additionne les marches d'une possibilité", () => {
    expect(minutesDeMarche(possibilite("08:00", "10:00", { marches: [4, 48, 7] }))).toBe(59);
    expect(minutesDeMarche(possibilite("08:00", "10:00", { marches: [] }))).toBe(0);
  });

  it("met la voie de Saint-Florentin (48 min à pied) après un trajet de 9 min de marche, même arrivé plus tôt", () => {
    const ps = [possibilite("06:27", "09:09", { marches: [48] }), possibilite("07:30", "09:40", { marches: [9] })];
    expect(ordre(ps, "marche")).toEqual(["1:07:30-09:40", "0:06:27-09:09"]);
  });

  it("à marche égale, l'arrivée la plus tôt d'abord", () => {
    const ps = [possibilite("08:00", "10:40", { marches: [9] }), possibilite("08:10", "10:20", { marches: [9] })];
    expect(ordre(ps, "marche")).toEqual(["1:08:10-10:20", "0:08:00-10:40"]);
  });

  it("un trajet en taxi sans marche passe devant", () => {
    const taxi = possibilite("08:00", "10:40", { marches: [], transport: { mode: "taxi" } });
    const ps = [possibilite("08:00", "10:20", { marches: [3] }), taxi];
    expect(trier(ps, "marche").map((x) => x.index)).toEqual([1, 0]);
  });
});

describe("D97 : sans réservation", () => {
  const appel = possibilite("08:00", "10:00", { transport: { reservation: "appel" } });
  const taxi = possibilite("08:10", "10:05", { transport: { mode: "taxi" } });
  const libre = possibilite("08:20", "10:30");

  it("retire les trajets avec un passage sur réservation ou un taxi, et range le reste par arrivée", () => {
    const autreLibre = possibilite("08:15", "10:20");
    expect(ordre([appel, libre, taxi, autreLibre], "sans_reservation")).toEqual(["3:08:15-10:20", "1:08:20-10:30"]);
  });

  it("tous à réserver ⇒ liste vide", () => {
    expect(trier([appel, taxi], "sans_reservation")).toEqual([]);
  });
});

describe("D97 : rang et liste reçue", () => {
  it("chaque possibilité garde son rang dans la réponse, et la liste reçue n'est pas modifiée", () => {
    const ps = [possibilite("08:24", "10:43"), possibilite("08:40", "10:30"), possibilite("07:00", "09:00")];
    const copie = structuredClone(ps);
    const range = trier(ps, "arrivee");
    expect(range.map((x) => x.index)).toEqual([2, 1, 0]);
    range.forEach(({ possibilite: p, index }) => expect(p).toBe(ps[index]));
    expect(ps).toEqual(copie);
  });

  it("trois puces, sans « Moins cher » (D97)", () => {
    expect(TRIS.map((t) => LIBELLES_TRIS[t])).toEqual(["Arrivée la plus tôt", "Moins de marche", "Sans réservation"]);
  });
});

describe("Spec 21, critère 2 : l'étape à réserver, même règle que la carte", () => {
  it("Brienon → Dijon : le bus 803 sur réservation (D69) est l'étape à réserver", () => {
    expect(etapeAReserver(BASE)).toBe(BASE.etapes[1]);
    expect(BASE.etapes[1]!.ligne).toBe("803");
  });

  it("sans passage « appel » ni taxi : aucune étape à réserver", () => {
    const sans = { ...BASE, etapes: BASE.etapes.map((e) => ({ ...e, reservation: null })) };
    expect(etapeAReserver(sans)).toBeUndefined();
  });

  it("un passage « appel » ou un taxi est l'étape à réserver", () => {
    const sans = { ...BASE, etapes: BASE.etapes.map((e) => ({ ...e, reservation: null })) };
    const i = sans.etapes.findIndex((e) => e.mode === "train");
    const avecAppel = { ...sans, etapes: sans.etapes.map((e, k) => (k === i ? { ...e, reservation: "appel" as const } : e)) };
    expect(etapeAReserver(avecAppel)).toBe(avecAppel.etapes[i]);
    const avecTaxi = { ...sans, etapes: sans.etapes.map((e, k) => (k === i ? { ...e, mode: "taxi" } : e)) };
    expect(etapeAReserver(avecTaxi)).toBe(avecTaxi.etapes[i]);
  });
});
