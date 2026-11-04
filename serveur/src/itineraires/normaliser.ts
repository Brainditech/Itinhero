import type { Manifest } from "../manifest.js";
import { heureParis } from "../temps.js";
import type { IndexHoraires, ReservationEtape } from "./horaires-gtfs.js";
import type { Etape, Possibilite } from "./motis-plan.js";
import { nomAffichable, typeLieuDuMode, type TypeLieu } from "./noms.js";

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
  | "taxi"
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
  CAR: "taxi", // la voiture n'est demandée à MOTIS que pour un taxi (spec 16, D48)
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
  | {
      type: "gtfs";
      jeu: string;
      version: string;
      trip_id: string;
      date_service: string;
      /** Dernier jour couvert par le jeu (issue 0010, H) ; null si inconnu. */
      fin_validite: string | null;
    }
  | { type: "osm"; jeu: string; version: string };

export type LieuEtape = { nom: string; type: TypeLieu; arret: string | null; lat: number; lon: number };

export type EtapeAffichee = {
  mode: Mode;
  mode_motis: string;
  ligne: string | null;
  /** Terminus de la course (issue 0010, A). */
  direction: string | null;
  /** Numéro de la course quand le GTFS le donne à la place de la direction (« 17769 »). */
  numero: string | null;
  /** « appel » : passage sur réservation d'après le GTFS (D69). null : rien de tel dans le GTFS. */
  reservation: ReservationEtape;
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

/**
 * Arrivée à l'arrêt de la première montée, avant le véhicule (D68) : « Arrivez à l'arrêt à 08:20,
 * le bus passe à 08:25 ». `marge_minutes` est l'écart réel (plus court que D68 s'il n'y a pas la place).
 */
export type Montee = { arriver_a: string; vehicule: string; marge_minutes: number };

export type PossibiliteAffichee = {
  /** Heure de sortie, marge avant la première montée comprise (D68). */
  depart: string;
  arrivee: string;
  depart_utc: string;
  arrivee_utc: string;
  duree_minutes: number;
  correspondances: number;
  montee: Montee | null;
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

function sourceEtape(e: Etape, idx: IndexManifest, horaires?: IndexHoraires): SourceEtape | null {
  if (e.tripId) {
    const t = lireTripId(e.tripId);
    const version = t ? idx.gtfs.get(t.jeu) : undefined;
    if (!t || !version) return null;
    const fin_validite = horaires?.finValidite(t.jeu) ?? null;
    return { type: "gtfs", jeu: t.jeu, version, trip_id: t.trip_id, date_service: t.date_service, fin_validite };
  }
  // Marche et taxi : routage de MOTIS sur la carte OSM chargée.
  if ((e.mode === "WALK" || e.mode === "CAR") && idx.osm) return { type: "osm", jeu: idx.osm.jeu, version: idx.osm.version };
  return null;
}

/** `r84072_600326` ⇒ `600326` (préfixe du jeu retiré). */
function arretGtfs(id: string | undefined, idx: IndexManifest): string | null {
  if (!id) return null;
  const i = id.indexOf("_");
  return i > 0 && idx.gtfs.has(id.slice(0, i)) ? id.slice(i + 1) : id;
}

const minutes = (secondes: number) => Math.round(secondes / 60);

/** Noms du départ et de l'arrivée choisis dans l'app (issue 0010, C) ; jamais gardés ni journalisés. */
export type NomsDemande = { depart?: string; arrivee?: string };

/**
 * MOTIS nomme le point de départ « START » et l'arrivée « END » (constaté le 2026-11-04) :
 * ils prennent le nom donné par l'app, sinon « Départ » et « Arrivée ». Les autres noms sont remis en forme.
 */
export function nomLieu(nom: string, noms: NomsDemande = {}): { nom: string; type: TypeLieu | null } {
  if (nom === "START") return { nom: noms.depart ?? "Départ", type: "depart" };
  if (nom === "END") return { nom: noms.arrivee ?? "Arrivée", type: "arrivee" };
  return { nom: nomAffichable(nom), type: null };
}

/**
 * Direction affichée (issue 0010, A) : le GTFS SNCF met le numéro du train dans `trip_headsign`
 * (« 17769 ») ; le vrai terminus est alors `tripTo` (« Lyon Part Dieu »).
 */
export function directionEtNumero(
  direction: string | undefined,
  terminus: string | undefined,
): { direction: string | null; numero: string | null } {
  const d = direction?.trim();
  const t = terminus?.trim();
  if (d && /^\d+$/.test(d)) return { direction: t ? nomAffichable(t) : null, numero: d };
  return { direction: d ? nomAffichable(d) : t ? nomAffichable(t) : null, numero: null };
}

/** Marge avant la première montée (D68), en minutes : 5, et 10 pour un passage sur réservation. */
export const MARGE_MONTEE_MINUTES = 5;
export const MARGE_MONTEE_RESERVATION_MINUTES = 10;

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

type Contexte = { idx: IndexManifest; horaires?: IndexHoraires; noms: NomsDemande };

function lieu(l: { nom: string; arret?: string }, coord: { lat: number; lon: number }, mode: Mode, ctx: Contexte): LieuEtape {
  const n = nomLieu(l.nom, ctx.noms);
  // Le type d'un lieu de marche est repris de l'étape voisine (`typerMarches`).
  const type = n.type ?? (mode === "marche" || mode === "taxi" ? "arret" : typeLieuDuMode(mode));
  return { nom: n.nom, type, arret: arretGtfs(l.arret, ctx.idx), lat: coord.lat, lon: coord.lon };
}

function etapeAffichee(e: Etape, source: SourceEtape, ctx: Contexte, avanceMs: number): EtapeAffichee {
  const ligne = nomLigne(e.ligne);
  const mode = modePrecise(e.mode, ligne, e.exploitant ?? null);
  const de = lieu(e.de, e.coordDe, mode, ctx);
  const a = lieu(e.a, e.coordA, mode, ctx);
  const reservation =
    source.type === "gtfs" && ctx.horaires ? ctx.horaires.reservation(source.jeu, source.trip_id, de.arret, a.arret) : null;
  return {
    mode,
    mode_motis: e.mode,
    ligne,
    ...directionEtNumero(e.direction, e.terminus),
    reservation,
    exploitant: e.exploitant ?? null,
    de,
    a,
    depart: avanceMs > 0 ? heureParis(new Date(e.depart.getTime() - avanceMs)).hhmm : e.departParis.hhmm,
    arrivee: avanceMs > 0 ? heureParis(new Date(e.arrivee.getTime() - avanceMs)).hhmm : e.arriveeParis.hhmm,
    duree_minutes: minutes(e.dureeSecondes),
    distance_metres: e.distanceMetres === undefined ? null : Math.round(e.distanceMetres),
    etat: "prevu", // aucun GTFS-RT branché (invariant 12)
    source,
  };
}

/** Une marche ou un taxi qui mène à un arrêt (ou en part) prend le type de lieu de l'étape en commun voisine. */
function typerMarches(etapes: EtapeAffichee[]): void {
  etapes.forEach((e, i) => {
    if (e.mode !== "marche" && e.mode !== "taxi") return;
    const avant = etapes[i - 1];
    const apres = etapes[i + 1];
    const enCommun = (x: EtapeAffichee | undefined) => x && x.mode !== "marche" && x.mode !== "taxi";
    if (e.de.type === "arret" && enCommun(avant)) e.de = { ...e.de, type: avant!.a.type };
    if (e.a.type === "arret" && enCommun(apres)) e.a = { ...e.a, type: apres!.de.type };
  });
}

/**
 * Avance des marches avant la première montée (D68) : on sort assez tôt pour être à l'arrêt
 * 5 min (10 sur réservation) avant le véhicule. La marche ne change pas ; seule l'heure de sortie
 * avance, sans passer avant `auPlusTot` (l'heure demandée en « partir », minuit du jour en « arriver »).
 */
export function avanceMontee(
  p: Possibilite,
  reservation: boolean,
  auPlusTot: Date | undefined,
): { avanceMs: number; indexMontee: number } {
  // Première montée dans un transport en commun : un taxi au départ n'en est pas une (spec 16).
  const k = p.etapes.findIndex((e) => e.mode !== "WALK" && e.mode !== "CAR");
  if (k < 0) return { avanceMs: 0, indexMontee: -1 };
  const vehicule = p.etapes[k]!;
  const arriveeArret = k > 0 ? p.etapes[k - 1]!.arrivee : vehicule.depart;
  const ecart = vehicule.depart.getTime() - arriveeArret.getTime();
  const voulu = (reservation ? MARGE_MONTEE_RESERVATION_MINUTES : MARGE_MONTEE_MINUTES) * 60_000;
  let avance = Math.max(0, voulu - ecart);
  if (auPlusTot) avance = Math.min(avance, Math.max(0, p.etapes[0]!.depart.getTime() - auPlusTot.getTime()));
  return { avanceMs: avance, indexMontee: k };
}

export type Normalisation = { possibilites: PossibiliteAffichee[]; retirees: number };

export type OptionsNormalisation = {
  /** Passages sur réservation et fins de validité (D69) ; absent ⇒ inconnus. */
  horaires?: IndexHoraires;
  noms?: NomsDemande;
  /** Heure de sortie la plus tôt que permet la marge avant la première montée (D68). */
  auPlusTot?: Date;
};

export function normaliser(possibilites: Possibilite[], manifest: Manifest, options: OptionsNormalisation = {}): Normalisation {
  const ctx: Contexte = { idx: indexer(manifest), horaires: options.horaires, noms: options.noms ?? {} };
  const gardees: PossibiliteAffichee[] = [];
  let retirees = 0;
  for (const p of possibilites) {
    const sources: SourceEtape[] = [];
    for (const e of p.etapes) {
      const s = sourceEtape(e, ctx.idx, ctx.horaires);
      if (!s) break;
      sources.push(s);
    }
    if (sources.length !== p.etapes.length) {
      retirees++;
      continue;
    }
    // Sans avance d'abord : il faut savoir si la première montée est sur réservation.
    const brutes = p.etapes.map((e, i) => etapeAffichee(e, sources[i]!, ctx, 0));
    const k = brutes.findIndex((e) => e.mode_motis !== "WALK" && e.mode_motis !== "CAR");
    const { avanceMs, indexMontee } = avanceMontee(p, k >= 0 && brutes[k]!.reservation !== null, options.auPlusTot);
    const etapes = p.etapes.map((e, i) =>
      i < indexMontee && avanceMs > 0 ? etapeAffichee(e, sources[i]!, ctx, avanceMs) : brutes[i]!,
    );
    typerMarches(etapes);

    const depart = new Date(p.depart.getTime() - avanceMs);
    let montee: Montee | null = null;
    if (indexMontee >= 0) {
      const v = p.etapes[indexMontee]!;
      const aLArret = indexMontee > 0 ? new Date(p.etapes[indexMontee - 1]!.arrivee.getTime() - avanceMs) : v.depart;
      montee = {
        arriver_a: heureParis(aLArret).hhmm,
        vehicule: v.departParis.hhmm,
        marge_minutes: Math.round((v.depart.getTime() - aLArret.getTime()) / 60_000),
      };
    }
    const enCommun = etapes.filter((e) => e.source.type === "gtfs").length;
    const derniere = p.etapes[p.etapes.length - 1]!;
    gardees.push({
      depart: heureParis(depart).hhmm,
      arrivee: derniere.arriveeParis.hhmm,
      depart_utc: depart.toISOString(),
      arrivee_utc: p.arrivee.toISOString(),
      duree_minutes: Math.round((p.arrivee.getTime() - depart.getTime()) / 60_000),
      correspondances: Math.max(0, enCommun - 1),
      montee,
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

// ——— Taxi comme étape (spec 16, D48, D80) ———

/** Gain minimal d'un taxi sur le meilleur trajet sans taxi, en minutes (D80). */
export const GAIN_TAXI_MINUTES = 30;
/** Au plus deux possibilités avec taxi sont montrées (D80). */
export const MAX_TAXIS = 2;

const minutesDe = (ps: EtapeAffichee[], garder: (e: EtapeAffichee) => boolean) =>
  ps.filter(garder).reduce((n, e) => n + e.duree_minutes, 0);

/**
 * Possibilités avec taxi qui valent d'être montrées (D80) :
 * - au moins une étape en taxi et une en transport en commun (15 min de route au plus, demandé à MOTIS) ;
 * - sans nuit dehors (D79) : un taxi qui laisse quand même dormir dehors n'aide pas (constaté le 2026-11-05, Flers) ;
 * - « partir » : elle arrive au moins 30 min avant la première arrivée sans taxi (ou il n'y en a aucune) ;
 * - « arriver » : elle part au moins 30 min après le dernier départ sans taxi (ou il n'y en a aucun) ;
 * - deux au plus : les arrivées les plus tôt (« partir »), les départs les plus tard (« arriver »).
 */
export function taxisUtiles(
  avecTaxi: PossibiliteAffichee[],
  sansTaxi: PossibiliteAffichee[],
  sens: "partir" | "arriver",
): PossibiliteAffichee[] {
  const t = (iso: string) => Date.parse(iso);
  const gain = GAIN_TAXI_MINUTES * 60_000;
  const candidats = avecTaxi.filter((p) => {
    const taxi = minutesDe(p.etapes, (e) => e.mode === "taxi");
    const commun = minutesDe(p.etapes, (e) => e.source.type === "gtfs");
    return taxi > 0 && commun > 0 && !avecNuitDehors(p);
  });
  if (sens === "partir") {
    const meilleure = Math.min(...sansTaxi.map((p) => t(p.arrivee_utc)));
    return candidats
      .filter((p) => t(p.arrivee_utc) <= meilleure - gain)
      .sort((a, b) => t(a.arrivee_utc) - t(b.arrivee_utc))
      .slice(0, MAX_TAXIS);
  }
  const meilleur = Math.max(...sansTaxi.map((p) => t(p.depart_utc)));
  return candidats
    .filter((p) => t(p.depart_utc) >= meilleur + gain)
    .sort((a, b) => t(b.depart_utc) - t(a.depart_utc))
    .slice(0, MAX_TAXIS);
}

/** Nuit dehors (D79, même règle que l'app) : une attente d'au moins 60 min entre deux étapes qui touche 22:00 – 05:00. */
export function avecNuitDehors(p: PossibiliteAffichee): boolean {
  const m = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  return p.etapes.some((e, i) => {
    const suivante = p.etapes[i + 1];
    if (!suivante) return false;
    const debut = m(e.arrivee);
    const duree = (m(suivante.depart) - debut + 1440) % 1440;
    if (duree < 60) return false;
    for (let t = 0; t <= duree; t += 5) {
      const h = (debut + t) % 1440;
      if (h >= 22 * 60 || h < 5 * 60) return true;
    }
    return false;
  });
}
