import { heureParis, instantParis } from "../temps.js";
import type { Possibilite } from "./motis-plan.js";

/**
 * Tri et verdict (spec 05, D44, invariant 13). Une possibilité ne compte que si elle
 * PART le jour demandé et ARRIVE au plus tard à H − M (heure de Paris).
 * C'est la logique que `POST /v1/itineraires` reprendra en phase 3.
 */
export function retenir(possibilites: Possibilite[], jour: string, limiteMinutes: number): Possibilite[] {
  const limite = instantParis(jour, limiteMinutes).getTime();
  return possibilites.filter(
    (p) => heureParis(p.depart).jour === jour && p.arrivee.getTime() <= limite,
  );
}

export type Verdict = "possible" | "impossible";

export function verdict(retenues: readonly unknown[]): Verdict {
  return retenues.length > 0 ? "possible" : "impossible";
}

/**
 * « Partir à H le jour J » (D57) : une possibilité ne compte que si elle PART le jour J,
 * à H ou après (heure de Paris). Aucune marge dans ce sens.
 */
export function retenirPartir(possibilites: Possibilite[], jour: string, depuisMinutes: number): Possibilite[] {
  const depuis = instantParis(jour, depuisMinutes).getTime();
  return possibilites.filter((p) => heureParis(p.depart).jour === jour && p.depart.getTime() >= depuis);
}
