import { z } from "zod";
import { heureParis, instantParis, type HeureParis } from "../temps.js";
import type { Morceau } from "./consignes.js";
import { ErreurLecture, lireHttp, type ReponseBrute } from "./motis-http.js";

/**
 * Appel de `/api/v6/plan` de MOTIS v2.11.4 (D58, qui révise D44 et D57) :
 * - « partir à H » : `arriveBy=false`, `time` = H ;
 * - « arriver avant H avec une marge M » : `arriveBy=true`, `time` = H − M ;
 * dans les deux cas une fenêtre d'une heure et `numItineraries=5` : MOTIS élargit la fenêtre
 * jusqu'à trouver au moins 5 possibilités (constaté : 1,8 s à Paris au lieu de 27 s avec une
 * fenêtre jusqu'à minuit ; à la campagne, il va chercher le car de 06:26 depuis 09:50).
 * MOTIS rend donc souvent des possibilités d'autres jours : c'est `verdict.ts` qui les écarte, jamais MOTIS.
 */
export type Point = { lat: number; lon: number };

type Commun = {
  depart: Point;
  arrivee: Point;
  jour: string /* « 2026-11-12 » */;
  /**
   * Limite de COÛT de la marche au départ et à l'arrivée, en secondes osr (issue 0008, D62) ;
   * absente ⇒ MARCHE_AUX_BOUTS_SECONDES. Ce n'est pas une durée : voir `marche-couteuse.ts`.
   */
  coutMarche?: { depart: number; arrivee: number };
  /**
   * Spec 16 (D48, D80) : un taxi permis au début (départ → premier arrêt) OU à la fin (dernier arrêt → arrivée),
   * jamais aux deux : sinon MOTIS encadre un bus d'une minute par deux trajets en voiture (constaté le 2026-11-05).
   */
  taxi?: "debut" | "fin";
  /** Spec 41 (D122) : la route en voiture de bout en bout seulement (taxi direct), sans transport en commun. */
  taxiDirect?: boolean;
};

export type DemandeRecherche =
  | (Commun & { sens?: "arriver"; limiteMinutes: number /* H − M, minutes depuis minuit, Paris */ })
  | (Commun & { sens: "partir"; depuisMinutes: number /* H, minutes depuis minuit, Paris */ });

export const FENETRE_SECONDES = 3600;
/**
 * Marche la plus longue entre le départ et le premier arrêt, et entre le dernier arrêt et l'arrivée.
 * MOTIS : 15 min par défaut. Constaté le 2026-11-04 : La Défense → château de Versailles, Google Maps
 * prend le Transilien L puis 24 min à pied (arrivée 14:52) ; à 15 min, nous arrivions à 15:00.
 * Au-delà de 15 min, l'app avertit et propose un taxi pour cette étape (D3, D42).
 */
export const MARCHE_AUX_BOUTS_SECONDES = 1800;

export const NB_MINIMUM = 5;

/** Route la plus longue d'un taxi au début ou à la fin (D80) : 15 min. */
export const TAXI_MAX_SECONDES = 900;

/** Spec 41 : au-delà de 6 h de route, aucun taxi de bout en bout n'est proposé. */
export const TAXI_DIRECT_MAX_SECONDES = 6 * 3600;

/** Instant UTC de référence : H (partir) ou H − M (arriver), heure de Paris. */
export function instantReference(d: DemandeRecherche): Date {
  return d.sens === "partir" ? instantParis(d.jour, d.depuisMinutes) : instantParis(d.jour, d.limiteMinutes);
}

export function construireUrlPlan(motisUrl: string, d: DemandeRecherche): URL {
  const url = new URL("/api/v6/plan", motisUrl);
  url.searchParams.set("fromPlace", `${d.depart.lat},${d.depart.lon}`);
  url.searchParams.set("toPlace", `${d.arrivee.lat},${d.arrivee.lon}`);
  url.searchParams.set("time", instantReference(d).toISOString());
  url.searchParams.set("arriveBy", d.sens === "partir" ? "false" : "true");
  url.searchParams.set("searchWindow", String(FENETRE_SECONDES));
  url.searchParams.set("numItineraries", String(NB_MINIMUM));
  // Tracé de chaque étape et morceaux de chaque marche (spec 11, D70) : sources des consignes et de la carte.
  url.searchParams.set("detailedLegs", "true");
  url.searchParams.set("maxPreTransitTime", String(d.coutMarche?.depart ?? MARCHE_AUX_BOUTS_SECONDES));
  url.searchParams.set("maxPostTransitTime", String(d.coutMarche?.arrivee ?? MARCHE_AUX_BOUTS_SECONDES));
  url.searchParams.set("useRoutedTransfers", "true"); // obligatoire, spec 04 §11
  if (d.taxiDirect) {
    // openapi.yaml v2.11.4 : `directModes=CAR` ; `transitModes=WALK` ne laisse aucun transport en commun (constaté :
    // 0 itinéraire, 1 trajet direct). 6 h de route au plus.
    url.searchParams.set("directModes", "CAR");
    url.searchParams.set("maxDirectTime", String(TAXI_DIRECT_MAX_SECONDES));
    url.searchParams.set("transitModes", "WALK");
    url.searchParams.set("numItineraries", "1");
  }
  if (d.taxi) {
    // openapi.yaml v2.11.4 : `CAR` est un mode de rue, permis avant (`preTransitModes`) ou après (`postTransitModes`)
    // les transports en commun. Le trajet direct reste à pied (`directModes` par défaut) : jamais un taxi de bout en bout.
    // 15 min de route au plus : MOTIS doit aller jusqu'à la gare la plus proche du domicile ou du rendez-vous (D80).
    const cote = d.taxi === "debut" ? "Pre" : "Post";
    url.searchParams.set(`${cote.toLowerCase()}TransitModes`, "WALK,CAR");
    url.searchParams.set(`max${cote}TransitTime`, String(TAXI_MAX_SECONDES));
  }
  return url;
}

// Sous-ensemble utile de la réponse (openapi.yaml du tag v2.11.4).
const schemaLieu = z.object({
  name: z.string(),
  stopId: z.string().optional(),
  lat: z.number(),
  lon: z.number(),
});

const schemaTrace = z.object({ points: z.string(), precision: z.number().int().min(1).max(7).default(6) });

// Morceau de marche (`StepInstruction`, spec 11) : distance, rue, tracé, niveaux.
const schemaMorceau = z.object({
  distance: z.number().nonnegative(),
  streetName: z.string().optional(),
  relativeDirection: z.string().optional(),
  polyline: schemaTrace,
  fromLevel: z.number().optional(),
  toLevel: z.number().optional(),
});

const schemaEtape = z.object({
  mode: z.string().min(1),
  from: schemaLieu,
  to: schemaLieu,
  startTime: z.iso.datetime(),
  endTime: z.iso.datetime(),
  duration: z.number().nonnegative(),
  distance: z.number().nonnegative().optional(),
  tripId: z.string().optional(),
  routeShortName: z.string().optional(),
  headsign: z.string().optional(),
  // Vrai terminus de la course : le GTFS SNCF met le numéro du train dans `headsign` (issue 0010, A).
  tripTo: z.object({ name: z.string() }).optional(),
  agencyName: z.string().optional(),
  legGeometry: schemaTrace.optional(),
  steps: z.array(schemaMorceau).optional(),
  // Arrêts desservis entre la montée et la descente (spec 12, guidage dans le véhicule).
  intermediateStops: z
    .array(z.object({ name: z.string(), lat: z.number(), lon: z.number(), arrival: z.iso.datetime().optional(), departure: z.iso.datetime().optional() }))
    .optional(),
});

const schemaItineraire = z.object({ legs: z.array(schemaEtape).min(1) });

export const schemaReponsePlan = z.object({
  itineraries: z.array(schemaItineraire),
  // Trajets sans transport en commun (à pied, `directModes=WALK` par défaut, au plus 30 min).
  direct: z.array(schemaItineraire).default([]),
});

export type Etape = {
  mode: string;
  de: { nom: string; arret?: string };
  a: { nom: string; arret?: string };
  depart: Date;
  arrivee: Date;
  departParis: HeureParis;
  arriveeParis: HeureParis;
  dureeSecondes: number;
  distanceMetres?: number;
  tripId?: string;
  ligne?: string;
  direction?: string;
  terminus?: string;
  exploitant?: string;
  coordDe: Point;
  coordA: Point;
  /** Tracé de l'étape, encodé (précision 6), tel que rendu par MOTIS. */
  trace?: { points: string; precision: number };
  /** Morceaux de la marche (spec 11). */
  morceaux?: Morceau[];
  /** Arrêts intermédiaires d'une étape en véhicule (spec 12). */
  arrets?: { nom: string; coord: Point; passage: Date | null }[];
};

export type Possibilite = { etapes: Etape[]; depart: Date; arrivee: Date };

/** Valide la réponse de MOTIS (Zod) et convertit les heures en heure de Paris. */
export function lireReponsePlan(brut: unknown): Possibilite[] {
  const reponse = schemaReponsePlan.parse(brut);
  return [...reponse.itineraries, ...reponse.direct].map((it) => {
    const etapes: Etape[] = it.legs.map((l) => {
      const depart = new Date(l.startTime);
      const arrivee = new Date(l.endTime);
      return {
        mode: l.mode,
        de: { nom: l.from.name, arret: l.from.stopId },
        a: { nom: l.to.name, arret: l.to.stopId },
        depart,
        arrivee,
        departParis: heureParis(depart),
        arriveeParis: heureParis(arrivee),
        dureeSecondes: l.duration,
        distanceMetres: l.distance,
        tripId: l.tripId,
        ligne: l.routeShortName,
        direction: l.headsign,
        terminus: l.tripTo?.name,
        exploitant: l.agencyName,
        coordDe: { lat: l.from.lat, lon: l.from.lon },
        coordA: { lat: l.to.lat, lon: l.to.lon },
        trace: l.legGeometry,
        morceaux: l.steps,
        arrets: l.intermediateStops?.map((a) => {
          const h = a.arrival ?? a.departure;
          return { nom: a.name, coord: { lat: a.lat, lon: a.lon }, passage: h ? new Date(h) : null };
        }),
      };
    });
    return { etapes, depart: etapes[0]!.depart, arrivee: etapes[etapes.length - 1]!.arrivee };
  });
}

export class ErreurMotis extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurMotis";
  }
}

/**
 * JSON brut d'une URL de MOTIS. Le message d'erreur ne contient jamais l'URL complète :
 * elle porte des coordonnées ou le texte d'un lieu (invariant 10).
 */
export async function lireMotis(url: URL, delaiMs: number): Promise<unknown> {
  let reponse: ReponseBrute;
  try {
    // Jamais `fetch` : il fait planter le processus sur les réponses de MOTIS (issue 0020).
    reponse = await lireHttp(url, delaiMs);
  } catch (e) {
    const raison = e instanceof ErreurLecture ? e.message : ((e as NodeJS.ErrnoException).code ?? (e as Error).name);
    throw new ErreurMotis(`MOTIS injoignable (${url.origin}${url.pathname}) : ${raison}`);
  }
  if (reponse.statut < 200 || reponse.statut > 299) {
    throw new ErreurMotis(`MOTIS a répondu ${reponse.statut} à ${url.pathname}`);
  }
  try {
    return JSON.parse(reponse.corps.toString("utf8"));
  } catch {
    throw new ErreurMotis(`MOTIS a rendu un JSON illisible à ${url.pathname}`);
  }
}

export async function chercherPlan(
  motisUrl: string,
  demande: DemandeRecherche,
  delaiMs = 30_000,
): Promise<Possibilite[]> {
  return lireReponsePlan(await lireMotis(construireUrlPlan(motisUrl, demande), delaiMs));
}
