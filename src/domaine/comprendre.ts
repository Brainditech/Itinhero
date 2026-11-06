import type { Comprehension } from "./api";
import type { Bout, ChampsFormulaire } from "./demande";

/** Marge par défaut (D17), quand la phrase n'en dit pas. */
export const MARGE_DEFAUT = 10;

/**
 * Phrase comprise ⇒ champs du formulaire (spec 28, D106). Le formulaire s'ouvre avec ces champs et un bandeau
 * « Vérifiez » : rien n'est cherché sans que la personne touche « Chercher ».
 * - Lieu non dit ⇒ champ d'arrivée vide (le formulaire dira « Indiquez l'arrivée. »).
 * - Départ non dit ⇒ celui choisi sur l'Accueil (Domicile ou Ma position).
 * - Jour non dit ⇒ aujourd'hui ; heure non dite ⇒ « Partir à » maintenant.
 * - Fin du rendez-vous gardée seulement si elle tombe après l'heure (sinon le serveur la refuserait).
 */
export function champsDepuisComprehension(
  c: Comprehension,
  departAccueil: Bout,
  maintenant: { date: string; heure: string },
): ChampsFormulaire {
  const heure = c.heure ?? maintenant.heure;
  const sens = c.sens ?? (c.heure ? "arriver" : "partir");
  return {
    depart: c.depart_texte ? { type: "texte", texte: c.depart_texte } : departAccueil,
    arrivee: { type: "texte", texte: c.lieu_texte ?? "" },
    date: c.date ?? maintenant.date,
    heure,
    sens: sens === "arriver" ? "arriver_avant" : "partir_a",
    marge: String(c.marge ?? MARGE_DEFAUT),
    retour: c.fin_rdv !== null && c.fin_rdv > heure ? c.fin_rdv : null,
  };
}
