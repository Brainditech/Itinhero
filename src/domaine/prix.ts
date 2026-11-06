import type { Etape, Possibilite, TarifEtape } from "./api";
import { libelleEtape } from "./resultat";

/**
 * Prix d'un trajet (spec 43, D124, invariant 5) : la somme des tarifs validés de ses étapes en véhicule, chacun
 * réduit par la meilleure carte cochée sur le téléphone (invariant 7). Une étape en véhicule sans tarif rend le
 * prix incomplet : « prix non publié » pour elle, jamais un prix estimé. Taxi : jamais de prix.
 */
export type PrixTrajet =
  | { etat: "complet"; total: number }
  | { etat: "partiel"; connu: number; nonPublies: string[] }
  | { etat: "non_publie" };

const enVehicule = (e: Etape) => e.mode !== "marche";

/**
 * Montant de l'étape avec la meilleure réduction des cartes possédées : le montant réduit **publié** quand il existe
 * (1,30 € pour IDFM, pas 1,27 € calculé), sinon le pourcentage, en centimes entiers. Une réduction « aller
 * seulement » ne vaut pas au retour (revue de la PR #61).
 */
export function montantReduit(t: TarifEtape, cartes: readonly string[], trajet: "aller" | "retour" = "aller"): number {
  const centimes = Math.round(t.montant_eur * 100);
  const possibles = t.reductions
    .filter((r) => cartes.includes(r.carte) && !(r.seulement_aller && trajet === "retour"))
    .map((r) => (r.montant_eur !== null ? Math.round(r.montant_eur * 100) : Math.round((centimes * (100 - r.pourcentage)) / 100)));
  return Math.min(centimes, ...possibles) / 100;
}

export function prixTrajet(p: Possibilite, cartes: readonly string[], trajet: "aller" | "retour" = "aller"): PrixTrajet {
  const etapes = p.etapes.filter(enVehicule);
  let connu = 0;
  const nonPublies: string[] = [];
  let auMoinsUn = false;
  for (const e of etapes) {
    if (e.tarif && e.mode !== "taxi") {
      connu += montantReduit(e.tarif, cartes, trajet);
      auMoinsUn = true;
    } else {
      nonPublies.push(libelleEtape(e));
    }
  }
  connu = Math.round(connu * 100) / 100;
  if (nonPublies.length === 0 && auMoinsUn) return { etat: "complet", total: connu };
  if (!auMoinsUn) return { etat: "non_publie" };
  return { etat: "partiel", connu, nonPublies };
}

/** « 2,55 € » */
export function euros(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

/** Ligne de la carte : « Prix : 4,55 € », « 2,00 € + prix non publié (TER K7) », « Prix non publié ». */
export function textePrix(prix: PrixTrajet): string {
  if (prix.etat === "complet") return `Prix : ${euros(prix.total)}`;
  if (prix.etat === "partiel") return `${euros(prix.connu)} + prix non publié (${prix.nonPublies.join(", ")})`;
  return "Prix non publié";
}

/** Rang pour « Moins cher » : complets d'abord par total, puis partiels, puis sans prix (D97, spec 43). */
export function comparerPrix(a: PrixTrajet, b: PrixTrajet): number {
  const rang = (x: PrixTrajet) => (x.etat === "complet" ? 0 : x.etat === "partiel" ? 1 : 2);
  const r = rang(a) - rang(b);
  if (r !== 0) return r;
  if (a.etat === "complet" && b.etat === "complet") return a.total - b.total;
  if (a.etat === "partiel" && b.etat === "partiel") return a.connu - b.connu;
  return 0;
}
