import { z } from "zod";

import type { Point, ReponseSens } from "./api";
import { pointsEtape } from "./etape";
import { boite } from "./geo";
import type { Voyage } from "./voyages";

// Pack de carte de la zone du trajet (spec 23, D99) : pur TypeScript, testé sous Node.
// Chaque zone devient un pack MapLibre, c'est-à-dire un téléchargement au sens d'OpenFreeMap
// (au plus 3 000 tuiles ou 50 Mo, conditions lues le 2026-11-06) : on reste à 1 000 tuiles par zone.

/** [ouest, sud, est, nord], en degrés. */
export type Boite = [number, number, number, number];

export type Zone = { bornes: Boite; zoomMin: number; zoomMax: number };
export type ZoneCarte = Zone & { tuiles: number };

/** Au plus 1 000 tuiles par pack (OpenFreeMap en permet 3 000 ; la marge tient aussi les 50 Mo). */
export const BUDGET_TUILES = 1000;
/** Les tuiles vectorielles d'OpenFreeMap s'arrêtent au zoom 14 ; MapLibre agrandit au-delà. */
export const ZOOM_MAX_TUILES = 14;

const ENSEMBLE = { marge: 1000, zoomMin: 5, zoomMaxHaut: 13, zoomMaxBas: 8 };
const DETAIL = { marge: 500, zoomMin: 12 };

const tuileX = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);
function tuileY(lat: number, z: number): number {
  const r = (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}
const borner = (v: number, z: number) => Math.max(0, Math.min(2 ** z - 1, v));

/** Nombre de tuiles qui touchent la boîte au zoom donné (Web Mercator). */
export function tuilesBoite([o, s, e, n]: Boite, zoom: number): number {
  const x = borner(tuileX(e, zoom), zoom) - borner(tuileX(o, zoom), zoom) + 1;
  const y = borner(tuileY(s, zoom), zoom) - borner(tuileY(n, zoom), zoom) + 1;
  return x * y;
}

export function tuilesZone(z: Zone): number {
  let total = 0;
  for (let zoom = z.zoomMin; zoom <= z.zoomMax; zoom++) total += tuilesBoite(z.bornes, zoom);
  return total;
}

const METRES_PAR_DEGRE = 111_320;

/** La boîte agrandie de `metres` de chaque côté. */
export function agrandir([o, s, e, n]: Boite, metres: number): Boite {
  const dLat = metres / METRES_PAR_DEGRE;
  const dLon = metres / (METRES_PAR_DEGRE * Math.cos((((s + n) / 2) * Math.PI) / 180));
  return [o - dLon, s - dLat, e + dLon, n + dLat];
}

const touche = (a: Boite, b: Boite) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const unir = (a: Boite, b: Boite): Boite => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];

/** Fusionne les boîtes qui se touchent, jusqu'à ce qu'aucune n'en touche une autre. Garde l'ordre d'arrivée. */
export function fusionner(boites: Boite[]): Boite[] {
  const restantes = [...boites];
  const sortie: Boite[] = [];
  while (restantes.length > 0) {
    let courante = restantes.shift()!;
    let change = true;
    while (change) {
      change = false;
      for (let i = restantes.length - 1; i >= 0; i--) {
        if (touche(courante, restantes[i]!)) {
          courante = unir(courante, restantes.splice(i, 1)[0]!);
          change = true;
        }
      }
    }
    // Une boîte déjà sortie peut toucher la nouvelle, agrandie : on la reprend.
    const deja = sortie.findIndex((b) => touche(b, courante));
    if (deja >= 0) restantes.unshift(unir(sortie.splice(deja, 1)[0]!, courante));
    else sortie.push(courante);
  }
  return sortie;
}

const sens = (v: Voyage): ReponseSens[] => (v.reponse.retour ? [v.reponse, v.reponse.retour] : [v.reponse]);
const etapes = (v: Voyage) => sens(v).flatMap((r) => r.possibilites.flatMap((p) => p.etapes));
const point = (p: Point): Boite => [p.lon, p.lat, p.lon, p.lat];

/**
 * Zones à télécharger pour un voyage (D99, §3.2) : la zone d'ensemble d'abord, du zoom 5 au plus grand zoom
 * qui tient dans le budget ; puis les zones de détail autour des marches et des lieux de montée ou de descente.
 */
export function zonesVoyage(v: Voyage): ZoneCarte[] {
  const tous: Point[] = [v.depart.point, v.arrivee.point, ...etapes(v).flatMap(pointsEtape)];
  const bornesEnsemble = agrandir(boite(tous), ENSEMBLE.marge);
  let ensemble: ZoneCarte | null = null;
  for (let zoomMax = ENSEMBLE.zoomMaxHaut; zoomMax >= ENSEMBLE.zoomMaxBas; zoomMax--) {
    const zone = { bornes: bornesEnsemble, zoomMin: ENSEMBLE.zoomMin, zoomMax };
    const tuiles = tuilesZone(zone);
    if (tuiles <= BUDGET_TUILES) {
      ensemble = { ...zone, tuiles };
      break;
    }
  }

  const boites: Boite[] = [point(v.depart.point), point(v.arrivee.point)];
  for (const e of etapes(v)) {
    if (e.mode === "marche") boites.push(boite(pointsEtape(e)));
    else boites.push(point(e.de), point(e.a));
  }
  const details: ZoneCarte[] = [];
  for (const bornes of fusionner(boites.map((b) => agrandir(b, DETAIL.marge)))) {
    // Trop grande : on perd d'abord le zoom 12, puis le 13 ; au-delà, la zone d'ensemble la couvre seule.
    for (let zoomMin = DETAIL.zoomMin; zoomMin <= ZOOM_MAX_TUILES; zoomMin++) {
      const zone = { bornes, zoomMin, zoomMax: ZOOM_MAX_TUILES };
      const tuiles = tuilesZone(zone);
      if (tuiles <= BUDGET_TUILES) {
        details.push({ ...zone, tuiles });
        break;
      }
    }
  }
  return ensemble ? [ensemble, ...details] : details;
}

/** Métadonnées d'un pack d'Itinhero : à quel voyage il appartient, quelle zone sur combien. */
export const schemaMetaPack = z.object({
  voyage: z.string().min(1),
  version: z.literal(1),
  zone: z.number().int().nonnegative(),
  total: z.number().int().positive(),
});
export type MetaPack = z.infer<typeof schemaMetaPack>;

/** Métadonnées relues de la base de MapLibre ⇒ celles d'Itinhero, ou null (autre forme, invariant 9). */
export function lireMetaPack(brut: unknown): MetaPack | null {
  const lu = schemaMetaPack.safeParse(brut);
  return lu.success ? lu.data : null;
}

export type StatutPack = { state: "inactive" | "active" | "complete"; percentage: number };
export type EtatCarte = { etat: "absente" } | { etat: "enCours"; pourcentage: number } | { etat: "enregistree" };

/**
 * État de la carte d'un voyage, d'après ses packs (D99, §3.4) : enregistrée si chaque zone a un pack complet ;
 * en cours si l'un se télécharge ; sinon absente (jamais commencée, arrêtée, ou une zone manque).
 */
export function etatCarte(packs: { meta: MetaPack; statut: StatutPack }[]): EtatCarte {
  if (packs.length === 0) return { etat: "absente" };
  const total = Math.max(...packs.map((p) => p.meta.total));
  const parZone = new Map<number, StatutPack>();
  for (const p of packs) parZone.set(p.meta.zone, p.statut);
  const complets = [...parZone.values()].filter((s) => s.state === "complete").length;
  if (complets >= total) return { etat: "enregistree" };
  if ([...parZone.values()].some((s) => s.state === "active")) {
    let somme = 0;
    for (const s of parZone.values()) somme += s.state === "complete" ? 100 : Math.max(0, Math.min(100, s.percentage));
    return { etat: "enCours", pourcentage: Math.floor(somme / total) };
  }
  return { etat: "absente" };
}
