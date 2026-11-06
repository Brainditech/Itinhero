import type { Etape, Possibilite } from "./api";

// Tris du Résultat (spec 21, D97). Faits sur le téléphone, sans nouvelle recherche : ils rangent les possibilités
// reçues avec leurs heures et leurs durées, sans rien calculer de neuf. « Moins cher » attend `data/tarifs.json`.

export const TRIS = ["arrivee", "marche", "sans_reservation"] as const;
export type Tri = (typeof TRIS)[number];

export const LIBELLES_TRIS: Record<Tri, string> = {
  arrivee: "Arrivée la plus tôt",
  marche: "Moins de marche",
  sans_reservation: "Sans réservation",
};

/** Une possibilité rangée, avec son rang dans la réponse du serveur (l'Étape et le Guidage la retrouvent par lui). */
export type PossibiliteRangee = { possibilite: Possibilite; index: number };

/** Minutes à pied au total : somme des étapes `marche`. */
export function minutesDeMarche(p: Possibilite): number {
  return p.etapes.reduce((n, e) => (e.mode === "marche" ? n + e.duree_minutes : n), 0);
}

/** Première étape à réserver : passage sur réservation du GTFS (D69) ou taxi (D48, il se réserve toujours). */
export function etapeAReserver(p: Possibilite): Etape | undefined {
  return p.etapes.find((e) => e.reservation === "appel" || e.mode === "taxi");
}

type Comparer = (a: Possibilite, b: Possibilite) => number;

/** Arrivée la plus tôt ; puis départ le plus tard ; puis moins de correspondances. */
const parArrivee: Comparer = (a, b) =>
  a.arrivee_utc.localeCompare(b.arrivee_utc) || b.depart_utc.localeCompare(a.depart_utc) || a.correspondances - b.correspondances;

const parMarche: Comparer = (a, b) => minutesDeMarche(a) - minutesDeMarche(b) || parArrivee(a, b);

/**
 * Range les possibilités selon `tri` ; à égalité, l'ordre du serveur. « Sans réservation » retire tout trajet
 * avec une étape à réserver, et range le reste comme « Arrivée la plus tôt ». La liste reçue n'est pas modifiée.
 */
export function trier(possibilites: Possibilite[], tri: Tri): PossibiliteRangee[] {
  const rangees = possibilites.map((possibilite, index) => ({ possibilite, index }));
  const gardees = tri === "sans_reservation" ? rangees.filter(({ possibilite }) => !etapeAReserver(possibilite)) : rangees;
  const comparer = tri === "marche" ? parMarche : parArrivee;
  return gardees.sort((a, b) => comparer(a.possibilite, b.possibilite) || a.index - b.index);
}
