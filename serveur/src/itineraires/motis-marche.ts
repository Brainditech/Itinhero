import type { Manifest } from "../manifest.js";
import { normaliser, type EtapeAffichee } from "./normaliser.js";
import { lireReponsePlan, type Point } from "./motis-plan.js";

/**
 * Nouveau chemin à pied (spec 20, D96) : `/api/v6/plan` de MOTIS v2.11.4 sans aucun transport.
 * openapi.yaml du tag v2.11.4 : `transitModes` vide ⇒ « no transit connections will be computed » ;
 * le trajet à pied est rendu dans `direct` (`directModes=WALK`), au plus `maxDirectTime` secondes
 * (plafonné par `street_routing_max_direct_seconds` du serveur MOTIS, plus de 2 h constaté le 2026-11-05).
 */
export const MARCHE_MAX_SECONDES = 3600;

export function construireUrlMarche(motisUrl: string, de: Point, a: Point, instant: Date): URL {
  const url = new URL("/api/v6/plan", motisUrl);
  url.searchParams.set("fromPlace", `${de.lat},${de.lon}`);
  url.searchParams.set("toPlace", `${a.lat},${a.lon}`);
  url.searchParams.set("time", instant.toISOString());
  url.searchParams.set("arriveBy", "false");
  url.searchParams.set("transitModes", ""); // vide : aucun transport
  url.searchParams.set("directModes", "WALK");
  url.searchParams.set("maxDirectTime", String(MARCHE_MAX_SECONDES));
  // Tracé et morceaux de la marche (spec 11) : sources des consignes et de la carte, comme `/v1/itineraires`.
  url.searchParams.set("detailedLegs", "true");
  return url;
}

/**
 * La marche la plus courte rendue par MOTIS, normalisée comme une étape de `/v1/itineraires`
 * (même forme, consignes de la spec 11, source OSM). null : aucun chemin à pied d'au plus 1 h,
 * ou pas de carte OSM dans le manifeste pour la sourcer (invariant 4).
 */
export function lireMarche(brut: unknown, manifest: Manifest): EtapeAffichee | null {
  const marches = lireReponsePlan(brut)
    .filter((p) => p.etapes.length === 1 && p.etapes[0]!.mode === "WALK" && p.etapes[0]!.dureeSecondes <= MARCHE_MAX_SECONDES)
    .sort((x, y) => x.etapes[0]!.dureeSecondes - y.etapes[0]!.dureeSecondes);
  const plusCourte = marches[0];
  if (!plusCourte) return null;
  return normaliser([plusCourte], manifest).possibilites[0]?.etapes[0] ?? null;
}
