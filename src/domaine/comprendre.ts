import type { Candidat, Comprehension, ResultatApi } from "./api";
import type { Bout, BoutLieu, ChampsFormulaire, CoteBout, ErreursFormulaire } from "./demande";
import { boutDuCandidat, MESSAGES_SUGGESTIONS, SUGGESTIONS_MAX } from "./suggestions";
import { filtrerParZone } from "./zones";

/** Marge par défaut (D17), quand la phrase n'en dit pas. */
export const MARGE_DEFAUT = 10;

/**
 * Phrase comprise ⇒ champs du formulaire (spec 28, D106). Le formulaire s'ouvre avec ces champs et un bandeau
 * « Vérifiez » : rien n'est cherché sans que la personne touche « Chercher ».
 * - Lieu non dit ⇒ champ d'arrivée vide, avec le message `LIEU_NON_COMPRIS` (issue 0023, `erreursSansLieu`).
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

/** Issue 0023 : phrase comprise sans aucun lieu ⇒ le champ vide dit pourquoi, au lieu de rester muet. */
export const LIEU_NON_COMPRIS = "Je n'ai pas trouvé le lieu dans votre phrase. Écrivez-le ici.";

/** Message sous l'Arrivée quand la phrase n'a donné aucun lieu (champ texte vide) ; rien sinon. */
export function erreursSansLieu(champs: ChampsFormulaire): ErreursFormulaire {
  const a = champs.arrivee;
  return a.type === "texte" && a.texte.trim() === "" ? { arrivee: LIEU_NON_COMPRIS } : {};
}

// ——— Spec 35 (D113) : l'Accueil cherche les lieux de la phrase avant d'ouvrir le formulaire ———

/** Ce que la recherche d'un lieu de la phrase donne pour son champ. */
export type LieuVerifie =
  | { etat: "retenu"; bout: BoutLieu }
  | { etat: "choisir"; candidats: Candidat[] }
  | { etat: "aucun" }
  | { etat: "inconnu" };

/**
 * Réponse de `GET /v1/lieux` pour un lieu de la phrase ⇒ ce qu'en fait le formulaire. La zone dite (« basse
 * normandie ») ne garde que ses lieux. Un seul ⇒ retenu (D91) ; plusieurs ⇒ à choisir, jamais d'office ;
 * recherche impossible ⇒ inconnu (le « Chercher » du formulaire la refera).
 */
export function lieuDeLaPhrase(resultat: ResultatApi<Candidat[]>, zone: string | null): LieuVerifie {
  if (resultat.etat !== "ok") return { etat: "inconnu" };
  const candidats = filtrerParZone(resultat.donnees, zone).slice(0, SUGGESTIONS_MAX);
  if (candidats.length === 0) return { etat: "aucun" };
  if (candidats.length === 1) return { etat: "retenu", bout: boutDuCandidat(candidats[0]!) };
  return { etat: "choisir", candidats };
}

/** Lieux vérifiés ⇒ champs du formulaire, listes ouvertes sous les champs et messages. */
export function appliquerLieux(
  champs: ChampsFormulaire,
  verifies: Partial<Record<CoteBout, LieuVerifie>>,
): { champs: ChampsFormulaire; aChoisir: Partial<Record<CoteBout, Candidat[]>>; erreurs: ErreursFormulaire } {
  let suite = champs;
  const aChoisir: Partial<Record<CoteBout, Candidat[]>> = {};
  const erreurs: ErreursFormulaire = {};
  for (const [cote, v] of Object.entries(verifies) as [CoteBout, LieuVerifie][]) {
    const bout = suite[cote];
    if (v.etat === "retenu") suite = { ...suite, [cote]: v.bout };
    else if (v.etat === "choisir") {
      aChoisir[cote] = v.candidats;
      erreurs[cote] = MESSAGES_SUGGESTIONS.choisir;
    } else if (v.etat === "aucun" && bout.type === "texte") erreurs[cote] = MESSAGES_SUGGESTIONS.aucun(bout.texte);
  }
  return { champs: suite, aChoisir, erreurs: { ...erreursSansLieu(suite), ...erreurs } };
}
