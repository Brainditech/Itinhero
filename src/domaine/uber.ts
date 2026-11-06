import type { Etape, LieuEtape } from "./api";

/**
 * Lien Uber pré-rempli (spec 31, D109, A9) : lien universel `https://m.uber.com/looking` de la doc Uber
 * (« Deep Links », lue le 2026-11-06), prise en charge et dépose en objets Location JSON encodés
 * (`latitude`, `longitude`, `addressLine1` = nom). Sans `client_id` : Itinhero n'a pas de compte développeur Uber.
 * Aucun prix ni attente : Uber les montre lui-même.
 */
export const BASE_UBER = "https://m.uber.com/looking";

type LieuUber = Pick<LieuEtape, "lat" | "lon" | "nom">;
const lieu = (l: LieuUber) => JSON.stringify({ latitude: l.lat, longitude: l.lon, addressLine1: l.nom });

/** Spec 41 : taxi de bout en bout, du départ à l'arrivée de la recherche. */
export function lienUberEntre(de: LieuUber, a: LieuUber): string {
  return `${BASE_UBER}?pickup=${encodeURIComponent(lieu(de))}&${encodeURIComponent("drop[0]")}=${encodeURIComponent(lieu(a))}`;
}

/**
 * Spec 31 : une étape en taxi. Spec 41 (D122, D3) : aussi une marche de plus de 15 min, que le taxi peut remplacer.
 */
export function lienUber(e: Etape): string | null {
  if (e.mode !== "taxi" && !(e.mode === "marche" && e.duree_minutes > 15)) return null;
  return lienUberEntre(e.de, e.a);
}
