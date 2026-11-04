import { z } from "zod";
import type { Point } from "../itineraires/motis-plan.js";

/**
 * Géocodeur de MOTIS v2.11.4 (`/api/v1/geocode`, openapi.yaml du tag, lu le 2026-11-04).
 * `place` + `placeBias` font remonter les candidats proches d'un point (constat du 2026-11-04 :
 * sans biais, « Tour Eiffel » donne d'abord Le Pellerin ; avec un point à Paris et un biais de 5, Paris).
 */
export const BIAIS_PROCHE = 5;

export function construireUrlGeocode(motisUrl: string, texte: string, proche?: Point): URL {
  const url = new URL("/api/v1/geocode", motisUrl);
  url.searchParams.set("text", texte);
  url.searchParams.set("language", "fr");
  url.searchParams.set("numResults", "10");
  if (proche) {
    url.searchParams.set("place", `${proche.lat},${proche.lon}`);
    url.searchParams.set("placeBias", String(BIAIS_PROCHE));
  }
  return url;
}

const schemaMatch = z.object({
  type: z.enum(["ADDRESS", "PLACE", "STOP"]),
  name: z.string(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  zip: z.string().optional(),
  category: z.string().optional(),
  areas: z.array(z.object({ name: z.string(), default: z.boolean().optional() })).default([]),
});

export const schemaReponseGeocode = z.array(schemaMatch);

export type Candidat = {
  nom: string;
  type: "adresse" | "lieu" | "arret";
  commune: string | null;
  code_postal: string | null;
  lat: number;
  lon: number;
  /**
   * D'où vient le candidat : la Géoplateforme de l'IGN (BAN, BD TOPO), MOTIS (OSM, arrêts GTFS)
   * ou la recherche par catégorie dans les lieux d'OSM (D61).
   */
  source: "ign" | "motis" | "osm";
};

const TYPES = { ADDRESS: "adresse", PLACE: "lieu", STOP: "arret" } as const;

/** Un code postal par commune ; MOTIS liste tous ceux de Paris (« 75000;75001;… ») : on n'en garde aucun. */
function codePostal(zip: string | undefined): string | null {
  if (!zip) return null;
  return /^\d{5}$/.test(zip) ? zip : null;
}

export function lireReponseGeocode(brut: unknown): Candidat[] {
  return schemaReponseGeocode.parse(brut).map((m) => ({
    nom: m.name,
    type: TYPES[m.type],
    commune: m.areas.find((a) => a.default)?.name ?? null,
    code_postal: codePostal(m.zip),
    lat: m.lat,
    lon: m.lon,
    source: "motis" as const,
  }));
}
