import type { Etape, EtatCourse, Possibilite } from "./api";
import { libelleEtape } from "./resultat";

/**
 * Temps réel d'un trajet enregistré (spec 42, D123, D21, D51). L'état vient de `POST /v1/etat-courses` (GTFS-RT via
 * MOTIS, invariant 12) ; sans flux, tout reste « horaire prévu ».
 */

/** Seuil de D21 : un retard compte à partir de 5 min. */
export const RETARD_SIGNALE_MIN = 5;

/** Étapes en véhicule suivies : celles qui ont une course MOTIS (le taxi et la marche n'en ont pas). */
export function etapesSuivies(p: Possibilite): { index: number; etape: Etape; course: string }[] {
  return p.etapes.flatMap((etape, index) => (etape.course && etape.mode !== "taxi" && etape.mode !== "marche" ? [{ index, etape, course: etape.course }] : []));
}

/** Pastille d'une étape : « En direct, à l'heure », « Retard 7 min », « Supprimé », ou « Horaire prévu ». */
export function libelleEtat(e: EtatCourse | undefined): { texte: string; ton: "prevu" | "direct" | "retard" | "supprime" } {
  if (!e || e.etat === "prevu" || e.etat === "inconnu") return { texte: "Horaire prévu, sans suivi en direct", ton: "prevu" };
  if (e.etat === "supprime") return { texte: "Supprimé", ton: "supprime" };
  if (e.etat === "retard") return { texte: `Retard ${e.retard_minutes} min`, ton: "retard" };
  return { texte: e.retard_minutes > 0 ? `En direct, ${e.retard_minutes} min de retard` : "En direct, à l'heure", ton: "direct" };
}

export type Alerte = { cle: string; course: string; titre: string; corps: string; supprime: boolean };

/** Ce qui a déjà été dit pour une course : « supprime » ou le retard signalé. */
export type DejaDit = Record<string, "supprime" | number>;

/**
 * Alertes nouvelles depuis la dernière relève (D21) : une suppression une fois ; un retard de 5 min ou plus, puis à
 * chaque nouvelle hausse de 5 min. Rien pour « prévu », « inconnu », ni un retard qui baisse.
 */
export function alertesNouvelles(p: Possibilite, etats: EtatCourse[], dejaDit: DejaDit): { alertes: Alerte[]; dejaDit: DejaDit } {
  const suite: DejaDit = { ...dejaDit };
  const alertes: Alerte[] = [];
  for (const { etape, course } of etapesSuivies(p)) {
    const e = etats.find((x) => x.course === course);
    if (!e) continue;
    const quoi = `${libelleEtape(etape)} de ${etape.depart}`;
    if (e.etat === "supprime" && suite[course] !== "supprime") {
      suite[course] = "supprime";
      alertes.push({
        cle: `${course}|supprime`,
        course,
        titre: `Supprimé : ${quoi}`,
        corps: "Touchez pour chercher une autre solution depuis cet arrêt.",
        supprime: true,
      });
    } else if (e.etat === "retard" && e.retard_minutes >= RETARD_SIGNALE_MIN) {
      const avant = suite[course];
      if (avant === "supprime") continue;
      if (avant === undefined || e.retard_minutes >= avant + RETARD_SIGNALE_MIN) {
        suite[course] = e.retard_minutes;
        alertes.push({
          cle: `${course}|${e.retard_minutes}`,
          course,
          titre: `Retard de ${e.retard_minutes} min : ${quoi}`,
          corps: `Départ prévu ${etape.depart} à ${etape.de.nom}. Horaire en direct.`,
          supprime: false,
        });
      }
    }
  }
  return { alertes, dejaDit: suite };
}

/**
 * Autre solution après une suppression (D51) : une nouvelle recherche depuis l'arrêt de montée de l'étape supprimée,
 * « partir à » son heure de départ prévue (ou maintenant si elle est passée), vers la même arrivée. Rien n'est
 * remplacé sans que la personne choisisse (D51).
 */
export function departAutreSolution(p: Possibilite, course: string): { etape: Etape } | null {
  const s = etapesSuivies(p).find((x) => x.course === course);
  return s ? { etape: s.etape } : null;
}
