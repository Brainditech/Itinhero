import type { Etape, Possibilite } from "./api";
import { comparerPrix, prixTrajet } from "./prix";
import { minutesDeMarche, parArrivee, parMarche } from "./resultat";

export { minutesDeMarche };

// Tris du Résultat (spec 21, D97). Faits sur le téléphone, sans nouvelle recherche : ils rangent les possibilités
// reçues avec leurs heures et leurs durées, sans rien calculer de neuf. « Moins cher » range par les tarifs validés reçus (spec 43).

export const TRIS = ["arrivee", "marche", "sans_reservation", "moins_cher"] as const;
export type Tri = (typeof TRIS)[number];

export const LIBELLES_TRIS: Record<Tri, string> = {
  arrivee: "Arrivée la plus tôt",
  marche: "Moins de marche",
  sans_reservation: "Sans réservation",
  moins_cher: "Moins cher",
};

/** Une possibilité rangée, avec son rang dans la réponse du serveur (l'Étape et le Guidage la retrouvent par lui). */
export type PossibiliteRangee = { possibilite: Possibilite; index: number };

/** Première étape à réserver : passage sur réservation du GTFS (D69) ou taxi (D48, il se réserve toujours). */
export function etapeAReserver(p: Possibilite): Etape | undefined {
  return p.etapes.find((e) => e.reservation === "appel" || e.mode === "taxi");
}

/**
 * Range les possibilités selon `tri` ; à égalité, l'ordre du serveur. Une nuit dehors passe toujours en dernier
 * (D114) ; « Arrivée la plus tôt » met ensuite après les autres les trajets avec une marche longue (D103).
 * « Sans réservation » retire tout trajet avec une étape à réserver, et range le reste comme « Arrivée la plus tôt ».
 * La liste reçue n'est pas modifiée.
 */
export function trier(
  possibilites: Possibilite[],
  tri: Tri,
  cartes: readonly string[] = [],
  trajet: "aller" | "retour" = "aller",
): PossibiliteRangee[] {
  const rangees = possibilites.map((possibilite, index) => ({ possibilite, index }));
  const gardees = tri === "sans_reservation" ? rangees.filter(({ possibilite }) => !etapeAReserver(possibilite)) : rangees;
  // Spec 43 : « Moins cher », trajets sans prix complet à la fin ; à prix égal, « Arrivée la plus tôt ».
  const comparer =
    tri === "marche"
      ? parMarche
      : tri === "moins_cher"
        ? (a: Possibilite, b: Possibilite) => comparerPrix(prixTrajet(a, cartes, trajet), prixTrajet(b, cartes, trajet)) || parArrivee(a, b)
        : parArrivee;
  return gardees.sort((a, b) => comparer(a.possibilite, b.possibilite) || a.index - b.index);
}
