export type Verdict = "possible" | "impossible";

/**
 * Verdict d'un trajet (D17) : possible si l'arrivée est au plus tard
 * à l'heure du rendez-vous moins la marge, égalité comprise.
 * Ne fait que comparer les valeurs reçues ; n'en invente aucune.
 */
export function verdict(arrivee: Date, rendezVous: Date, margeMin: number): Verdict {
  if (!Number.isInteger(margeMin) || margeMin < 0) {
    throw new RangeError(`Marge invalide : ${margeMin} (entier de minutes ≥ 0 attendu)`);
  }
  if (Number.isNaN(arrivee.getTime()) || Number.isNaN(rendezVous.getTime())) {
    throw new RangeError("Date d'arrivée ou de rendez-vous invalide");
  }
  const limite = rendezVous.getTime() - margeMin * 60_000;
  return arrivee.getTime() <= limite ? "possible" : "impossible";
}
