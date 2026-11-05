import { z } from "zod";
import { heureParis } from "../temps.js";
import { nomAffichable } from "./noms.js";

// Tous les arrêts d'une course (spec 17, D87) : `/api/v6/trip` de MOTIS (openapi.yaml du tag v2.11.4),
// avant la montée et après la descente compris, pour la fenêtre d'une étape en véhicule.

/** Identifiant MOTIS d'une course : `20261112_08:33_r83582_<trip_id du GTFS>` (spec 05 §11). */
export const MOTIF_COURSE = /^\d{8}_\d{2}:\d{2}_[a-z0-9-]+_.+$/;

export function construireUrlCourse(motisUrl: string, course: string): URL {
  const url = new URL("/api/v6/trip", motisUrl);
  url.searchParams.set("tripId", course);
  // Pas de tracé : seuls les arrêts sont montrés.
  url.searchParams.set("detailedLegs", "false");
  return url;
}

const schemaArret = z.object({
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  arrival: z.iso.datetime().optional(),
  departure: z.iso.datetime().optional(),
});

const schemaReponseCourse = z.object({
  legs: z
    .array(
      z.object({
        from: schemaArret,
        to: schemaArret,
        startTime: z.iso.datetime(),
        endTime: z.iso.datetime(),
        intermediateStops: z.array(schemaArret).optional(),
      }),
    )
    .min(1),
});

export type ArretCourse = { nom: string; lat: number; lon: number; passage: string | null };

/**
 * Réponse de MOTIS ⇒ arrêts dans l'ordre de passage, avec leur heure de Paris.
 * Un arrêt à 0,0 n'a pas de coordonnées (issue 0019) : il n'est pas rendu. Hors schéma ⇒ ZodError (502).
 */
export function lireReponseCourse(brut: unknown): ArretCourse[] {
  const { legs } = schemaReponseCourse.parse(brut);
  const arret = (a: z.infer<typeof schemaArret>, instant: string | undefined): ArretCourse => ({
    nom: nomAffichable(a.name),
    lat: a.lat,
    lon: a.lon,
    passage: instant ? heureParis(new Date(instant)).hhmm : null,
  });
  const arrets: ArretCourse[] = [];
  legs.forEach((l, i) => {
    // Une course en plusieurs morceaux : l'arrivée d'un morceau est le départ du suivant, gardée une fois.
    if (i === 0) arrets.push(arret(l.from, l.startTime));
    for (const a of l.intermediateStops ?? []) arrets.push(arret(a, a.arrival ?? a.departure));
    arrets.push(arret(l.to, l.endTime));
  });
  return arrets.filter((a) => !(a.lat === 0 && a.lon === 0));
}
