import type { Etape, LieuEtape } from "./api";

/**
 * Lien Uber pré-rempli (spec 31, D109, A9) : lien universel `https://m.uber.com/looking` de la doc Uber
 * (« Deep Links », lue le 2026-11-06), prise en charge et dépose en objets Location JSON encodés
 * (`latitude`, `longitude`, `addressLine1` = nom). Sans `client_id` : Itinhero n'a pas de compte développeur Uber.
 * Aucun prix ni attente : Uber les montre lui-même.
 */
export const BASE_UBER = "https://m.uber.com/looking";

const lieu = (l: LieuEtape) => JSON.stringify({ latitude: l.lat, longitude: l.lon, addressLine1: l.nom });

export function lienUber(e: Etape): string | null {
  if (e.mode !== "taxi") return null;
  return `${BASE_UBER}?pickup=${encodeURIComponent(lieu(e.de))}&${encodeURIComponent("drop[0]")}=${encodeURIComponent(lieu(e.a))}`;
}
