import type { Possibilite } from "./api";
import { avecTaxi } from "./resultat";

/**
 * Covoiturage (spec 47, D128, D50) : lien de recherche BlaBlaCar pré-rempli. Aucun accès développeur ouvert
 * (constat du 2026-11-06 : portail en 404, API fermée par clé) ; le format `fn`/`fc`/`tn`/`tc`/`db`/`seats`
 * a été constaté dans un navigateur, sans doc officielle lisible. Aucun prix ni place : BlaBlaCar les montre.
 * Coordonnées arrondies au centième (≈ 1 km) et nom de commune plutôt que l'adresse : le domicile exact ne part pas.
 */
export const BASE_BLABLACAR = "https://www.blablacar.fr/search";

export type LieuCovoiturage = { lat: number; lon: number; nom: string; adresse: string | null };

const arrondi = (x: number) => (Math.round(x * 100) / 100).toFixed(2);

/** Commune lue après le code postal (« 12 rue X, 89300 Joigny », « Arrêt, 89300 Joigny ») ; sinon le nom du lieu. */
export function communeDuLieu(l: LieuCovoiturage): string {
  const m = l.adresse?.match(/\b\d{5}\s+([^,]+?)\s*$/);
  return m?.[1] ?? l.nom;
}

export function lienBlaBlaCar(de: LieuCovoiturage, a: LieuCovoiturage, date: string): string {
  const p = new URLSearchParams({
    fn: communeDuLieu(de),
    fc: `${arrondi(de.lat)},${arrondi(de.lon)}`,
    tn: communeDuLieu(a),
    tc: `${arrondi(a.lat)},${arrondi(a.lon)}`,
    db: date,
    seats: "1",
  });
  return `${BASE_BLABLACAR}?${p.toString()}`;
}

/** D50 : aucun trajet de transport public (sans taxi) ce jour-là ⇒ le covoiturage passe en tête du sens. */
export function covoiturageEnTete(possibilites: readonly Possibilite[]): boolean {
  return !possibilites.some((p) => !avecTaxi(p));
}

/** Phrase de la carte : exacte selon qu'il n'y a aucun trajet, des trajets avec un taxi seulement, ou des trajets. */
export function phraseCovoiturage(possibilites: readonly Possibilite[]): string {
  if (!covoiturageEnTete(possibilites)) return "Autre possibilité : partager la voiture d'un conducteur.";
  const debut = possibilites.length === 0 ? "Aucun transport public n'arrive à l'heure ce jour-là." : "Sans taxi, aucun transport public n'arrive à l'heure.";
  return `${debut} Un conducteur fait peut-être ce trajet.`;
}
