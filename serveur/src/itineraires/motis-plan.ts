import { z } from "zod";
import { debutJourParis, heureParis, instantParis, type HeureParis } from "../temps.js";

/**
 * Appel de `/api/v6/plan` de MOTIS v2.11.4 (spec 05, D44).
 * Recherche AU DÉPART sur le jour demandé : de 00:00 à H − M (heure de Paris), `arriveBy=false`.
 * MOTIS peut renvoyer des possibilités d'autres jours (`timetableView`, `numItineraries` minimum) :
 * c'est `verdict.ts` qui les écarte, jamais MOTIS.
 */
export type Point = { lat: number; lon: number };

export type DemandeRecherche = {
  depart: Point;
  arrivee: Point;
  jour: string; // « 2026-11-12 »
  limiteMinutes: number; // H − M, minutes depuis minuit (heure de Paris)
};

export function construireUrlPlan(motisUrl: string, d: DemandeRecherche): URL {
  const debut = debutJourParis(d.jour);
  const limite = instantParis(d.jour, d.limiteMinutes);
  const url = new URL("/api/v6/plan", motisUrl);
  url.searchParams.set("fromPlace", `${d.depart.lat},${d.depart.lon}`);
  url.searchParams.set("toPlace", `${d.arrivee.lat},${d.arrivee.lon}`);
  url.searchParams.set("time", debut.toISOString());
  url.searchParams.set("arriveBy", "false");
  url.searchParams.set("searchWindow", String(Math.round((limite.getTime() - debut.getTime()) / 1000)));
  url.searchParams.set("useRoutedTransfers", "true"); // obligatoire, spec 04 §11
  return url;
}

// Sous-ensemble utile de la réponse (openapi.yaml du tag v2.11.4).
const schemaLieu = z.object({
  name: z.string(),
  stopId: z.string().optional(),
  lat: z.number(),
  lon: z.number(),
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
});

export const schemaReponsePlan = z.object({
  itineraries: z.array(z.object({ legs: z.array(schemaEtape).min(1) })),
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
};

export type Possibilite = { etapes: Etape[]; depart: Date; arrivee: Date };

/** Valide la réponse de MOTIS (Zod) et convertit les heures en heure de Paris. */
export function lireReponsePlan(brut: unknown): Possibilite[] {
  const reponse = schemaReponsePlan.parse(brut);
  return reponse.itineraries.map((it) => {
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

export async function chercherPlan(
  motisUrl: string,
  demande: DemandeRecherche,
  delaiMs = 30_000,
): Promise<Possibilite[]> {
  const url = construireUrlPlan(motisUrl, demande);
  let reponse: Response;
  try {
    reponse = await fetch(url, { signal: AbortSignal.timeout(delaiMs) });
  } catch (e) {
    throw new ErreurMotis(`MOTIS injoignable (${motisUrl}) : ${(e as Error).message}`);
  }
  if (!reponse.ok) throw new ErreurMotis(`MOTIS a répondu ${reponse.status} à /api/v6/plan`);
  return lireReponsePlan(await reponse.json());
}
