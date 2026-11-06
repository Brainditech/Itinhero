import { CONTOUR_FRANCE } from "./contour-france.js";

type Point = { lat: number; lon: number };

/** Point dans un anneau [lon, lat] (lancer de rayon vers l'est ; un point sur le bord peut tomber d'un côté ou de l'autre). */
export function dansAnneau(p: Point, anneau: readonly (readonly [number, number])[]): boolean {
  let dedans = false;
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
    const [xi, yi] = anneau[i]!;
    const [xj, yj] = anneau[j]!;
    if (yi > p.lat !== yj > p.lat && p.lon < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

/** Spec 27 (D105) : le point est-il dans l'extrait OSM chargé (France métropolitaine et Corse) ? */
export function dansZoneCouverte(p: Point): boolean {
  return dansAnneau(p, CONTOUR_FRANCE);
}
