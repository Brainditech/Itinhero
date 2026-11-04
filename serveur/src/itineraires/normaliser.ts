import type { Manifest } from "../manifest.js";
import type { Etape, Possibilite } from "./motis-plan.js";

/**
 * Normalisation de la réponse de MOTIS en possibilités affichables (spec 09, §4.5).
 * Chaque étape porte sa `source` (invariant 4). Une possibilité dont une étape n'a pas
 * de source est retirée : on ne montre jamais une étape d'origine inconnue.
 * Rien d'autre de MOTIS ne sort (ni son champ `source`, chemins du PC, ni ses identifiants internes).
 */
export type Mode =
  | "marche"
  | "bus"
  | "car"
  | "transport_a_la_demande"
  | "tram"
  | "metro"
  | "train_banlieue"
  | "train"
  | "bateau"
  | "remontee"
  | "autre";

const MODES: Record<string, Mode> = {
  WALK: "marche",
  BUS: "bus",
  COACH: "car",
  ODM: "transport_a_la_demande",
  FLEX: "transport_a_la_demande",
  TRAM: "tram",
  SUBWAY: "metro",
  METRO: "metro",
  SUBURBAN: "train_banlieue",
  HIGHSPEED_RAIL: "train",
  LONG_DISTANCE: "train",
  NIGHT_RAIL: "train",
  REGIONAL_RAIL: "train",
  REGIONAL_FAST_RAIL: "train",
  RAIL: "train",
  FERRY: "bateau",
  FUNICULAR: "remontee",
  AERIAL_LIFT: "remontee",
  AREAL_LIFT: "remontee",
  CABLE_CAR: "remontee",
};

export const modeAffiche = (modeMotis: string): Mode => MODES[modeMotis] ?? "autre";

/**
 * Mode affiché, précisé par la ligne et l'exploitant (constats du 2026-11-04, comparés à Google Maps) :
 * - un « bus » exploité par la SNCF est un car TER (K941, P85) : `car` ;
 * - un train dont la ligne est une seule lettre (RER A à E, Transilien H à V) : `train_banlieue`.
 */
export function modePrecise(modeMotis: string, ligne: string | null, exploitant: string | null): Mode {
  const m = modeAffiche(modeMotis);
  if (m === "bus" && exploitant && /\bSNCF\b/i.test(exploitant)) return "car";
  if (m === "train" && ligne && /^[A-Z]$/.test(ligne)) return "train_banlieue";
  return m;
}

export type SourceEtape =
  | { type: "gtfs"; jeu: string; version: string; trip_id: string; date_service: string }
  | { type: "osm"; jeu: string; version: string };

export type LieuEtape = { nom: string; arret: string | null; lat: number; lon: number };

export type EtapeAffichee = {
  mode: Mode;
  mode_motis: string;
  ligne: string | null;
  direction: string | null;
  exploitant: string | null;
  de: LieuEtape;
  a: LieuEtape;
  depart: string;
  arrivee: string;
  duree_minutes: number;
  distance_metres: number | null;
  etat: "prevu";
  source: SourceEtape;
};

export type PossibiliteAffichee = {
  depart: string;
  arrivee: string;
  depart_utc: string;
  arrivee_utc: string;
  duree_minutes: number;
  correspondances: number;
  etapes: EtapeAffichee[];
};

/** `20261112_08:25_r84072_1014608-1-1` ⇒ date de service, jeu, trip_id (format constaté, spec 05 §11). */
export function lireTripId(tripId: string): { date_service: string; jeu: string; trip_id: string } | null {
  const m = /^(\d{4})(\d{2})(\d{2})_\d{2}:\d{2}_([a-z0-9-]+)_(.+)$/.exec(tripId);
  if (!m) return null;
  return { date_service: `${m[1]}-${m[2]}-${m[3]}`, jeu: m[4]!, trip_id: m[5]! };
}

type IndexManifest = { gtfs: Map<string, string>; osm: { jeu: string; version: string } | null };

export function indexer(manifest: Manifest): IndexManifest {
  const gtfs = new Map<string, string>();
  let osm: IndexManifest["osm"] = null;
  for (const f of manifest.fichiers) {
    const version = f.feed_version ?? f.date_fichiers ?? f.date_telechargement;
    if (f.type === "gtfs") gtfs.set(f.jeu, version);
    else osm ??= { jeu: f.jeu, version: f.date_fichiers ?? f.date_telechargement };
  }
  return { gtfs, osm };
}

function sourceEtape(e: Etape, idx: IndexManifest): SourceEtape | null {
  if (e.tripId) {
    const t = lireTripId(e.tripId);
    const version = t ? idx.gtfs.get(t.jeu) : undefined;
    if (!t || !version) return null;
    return { type: "gtfs", jeu: t.jeu, version, trip_id: t.trip_id, date_service: t.date_service };
  }
  if (e.mode === "WALK" && idx.osm) return { type: "osm", jeu: idx.osm.jeu, version: idx.osm.version };
  return null;
}

/** `r84072_600326` ⇒ `600326` (préfixe du jeu retiré). */
function arretGtfs(id: string | undefined, idx: IndexManifest): string | null {
  if (!id) return null;
  const i = id.indexOf("_");
  return i > 0 && idx.gtfs.has(id.slice(0, i)) ? id.slice(i + 1) : id;
}

const minutes = (secondes: number) => Math.round(secondes / 60);

/** MOTIS nomme le point de départ « START » et l'arrivée « END » (constaté le 2026-11-04). */
export function nomLieu(nom: string): string {
  return nom === "START" ? "Départ" : nom === "END" ? "Arrivée" : nom;
}

/**
 * Nom court de ligne affichable, ou null : certains GTFS mettent « INCONNU », une chaîne vide
 * ou un nom de relation (« Paris-Gare-de-Lyon/Lyon-Perrache-Voyageurs ») dans `route_short_name`
 * (constaté le 2026-11-04). La direction et l'exploitant restent affichés à côté.
 */
export function nomLigne(brut: string | undefined): string | null {
  const n = brut?.trim();
  if (!n || /^(inconnu|unknown|n\/a|-)$/i.test(n)) return null;
  if (n.length > 14 || n.includes("/")) return null;
  return n;
}

function etapeAffichee(e: Etape, source: SourceEtape, idx: IndexManifest): EtapeAffichee {
  const ligne = nomLigne(e.ligne);
  return {
    mode: modePrecise(e.mode, ligne, e.exploitant ?? null),
    mode_motis: e.mode,
    ligne,
    direction: e.direction ?? null,
    exploitant: e.exploitant ?? null,
    de: { nom: nomLieu(e.de.nom), arret: arretGtfs(e.de.arret, idx), lat: e.coordDe.lat, lon: e.coordDe.lon },
    a: { nom: nomLieu(e.a.nom), arret: arretGtfs(e.a.arret, idx), lat: e.coordA.lat, lon: e.coordA.lon },
    depart: e.departParis.hhmm,
    arrivee: e.arriveeParis.hhmm,
    duree_minutes: minutes(e.dureeSecondes),
    distance_metres: e.distanceMetres === undefined ? null : Math.round(e.distanceMetres),
    etat: "prevu", // aucun GTFS-RT branché (invariant 12)
    source,
  };
}

export type Normalisation = { possibilites: PossibiliteAffichee[]; retirees: number };

export function normaliser(possibilites: Possibilite[], manifest: Manifest): Normalisation {
  const idx = indexer(manifest);
  const gardees: PossibiliteAffichee[] = [];
  let retirees = 0;
  for (const p of possibilites) {
    const etapes: EtapeAffichee[] = [];
    for (const e of p.etapes) {
      const s = sourceEtape(e, idx);
      if (!s) break;
      etapes.push(etapeAffichee(e, s, idx));
    }
    if (etapes.length !== p.etapes.length) {
      retirees++;
      continue;
    }
    const enCommun = etapes.filter((e) => e.source.type === "gtfs").length;
    const premiere = p.etapes[0]!;
    const derniere = p.etapes[p.etapes.length - 1]!;
    gardees.push({
      depart: premiere.departParis.hhmm,
      arrivee: derniere.arriveeParis.hhmm,
      depart_utc: p.depart.toISOString(),
      arrivee_utc: p.arrivee.toISOString(),
      duree_minutes: Math.round((p.arrivee.getTime() - p.depart.getTime()) / 60_000),
      correspondances: Math.max(0, enCommun - 1),
      etapes,
    });
  }
  gardees.sort((a, b) => a.depart_utc.localeCompare(b.depart_utc) || a.arrivee_utc.localeCompare(b.arrivee_utc));
  return { possibilites: retirerDomines(gardees), retirees };
}

/** Écart d'arrivée au-delà duquel une correspondance de plus vaut la peine (comparé à Google Maps, 2026-11-04). */
export const GAIN_POUR_UNE_CORRESPONDANCE_MINUTES = 10;

/**
 * Retire les possibilités qu'une autre rend inutiles : une autre part au même moment ou plus tard,
 * arrive au même moment ou plus tôt, et
 * - n'a pas plus de correspondances (et fait strictement mieux sur un point), ou
 * - n'a qu'une correspondance de plus mais arrive au moins 10 min plus tôt.
 * Constaté le 2026-11-04 : Châtelet → Orly, 07:01 → 07:49 (longue marche jusqu'au métro 14)
 * à côté de 07:02 → 07:36. Le bus 72 direct (10:00 → 10:43) reste à côté du métro + bus (10:02 → 10:37).
 */
export function retirerDomines(ps: PossibiliteAffichee[]): PossibiliteAffichee[] {
  const t = (iso: string) => Date.parse(iso);
  const domine = (q: PossibiliteAffichee, p: PossibiliteAffichee) => {
    if (q === p || t(q.depart_utc) < t(p.depart_utc) || t(q.arrivee_utc) > t(p.arrivee_utc)) return false;
    const mieux = t(q.depart_utc) > t(p.depart_utc) || t(q.arrivee_utc) < t(p.arrivee_utc) || q.correspondances < p.correspondances;
    if (q.correspondances <= p.correspondances) return mieux;
    const gain = (t(p.arrivee_utc) - t(q.arrivee_utc)) / 60_000;
    return q.correspondances === p.correspondances + 1 && gain >= GAIN_POUR_UNE_CORRESPONDANCE_MINUTES;
  };
  const vues = new Set<string>();
  const uniques = ps.filter((p) => {
    const cle = `${p.depart_utc}|${p.arrivee_utc}|${(p.etapes ?? []).map((e) => `${e.ligne}@${e.depart}`).join(",")}`;
    if (vues.has(cle)) return false;
    vues.add(cle);
    return true;
  });
  return uniques.filter((p) => !uniques.some((q) => domine(q, p)));
}
