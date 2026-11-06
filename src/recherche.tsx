import { createContext, use, useState, type ReactNode } from "react";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";

import { allerALAccueil } from "@/composants/BarreOnglets";
import { messageEchec, type Candidat, type Comprehension, type Point, type ReponseItineraires } from "@/domaine/api";
import { appliquerLieux, lieuDeLaPhrase, type LieuVerifie } from "@/domaine/comprendre";
import {
  demandeRecalcul,
  maintenantAParis,
  versRequeteItineraires,
  type Bout,
  type BoutLieu,
  type ChampsFormulaire,
  type CoteBout,
  type Demande,
  type ErreursFormulaire,
  type Trajet,
} from "@/domaine/demande";
import { adresseBout, nomBout, type SourceAdresse } from "@/domaine/resultat";
import { boutDuCandidat, candidatDuBout, MESSAGES_SUGGESTIONS, SUGGESTION_MIN } from "@/domaine/suggestions";
import { champsDepuisVoyage, resumeVoyage, type Voyage } from "@/domaine/voyages";
import { useClient, useSession } from "@/session";
import { MESSAGES_POSITION, MESSAGES_POSITION_GUIDAGE, lirePosition, lirePositionSiAccordee } from "@/stockage/position";
import { lireDomicileEnBase } from "@/stockage/reglages";

// Recherche en cours : Formulaire (onglet Accueil) ⇒ Résultat (onglet Trajet, spec 34) ; plus de Confirmation (D91).
// En mémoire seulement : rien n'est gardé ni envoyé ailleurs qu'à l'API (invariant 6).

/** Un bout trouvé : son point, le nom envoyé à l'API et affiché, et son adresse connue sur le téléphone (spec 14). */
export type LieuChoisi = { point: Point; nom: string; adresse: string | null };

/** Pour chaque bout (spec 13, §4.4) : le lieu retenu, null tant qu'il est à chercher. */
export type EtatBout = { lieu: LieuChoisi | null };

export type Recherche = {
  demande: Demande;
  depart: EtatBout;
  arrivee: EtatBout;
  reponse: ReponseItineraires | null;
  /** Trajet rouvert depuis Mes trajets (spec 22, D98) : sa clé et le trajet enregistré ; absent pour une recherche. */
  rouvert?: { cle: string; voyage: Voyage };
  /** Recherche lancée par « Modifier » (spec 24, D100, D101) : clé du trajet que la disquette remplace. */
  remplace?: string;
};

/**
 * « Modifier » touché dans Mes trajets (spec 24, D100) : ce que le formulaire reprend, et le voyage à remplacer.
 * `jeton` change à chaque toucher : le formulaire déjà ouvert reprend les valeurs même pour le même voyage.
 */
/**
 * Formulaire pré-rempli : par « Modifier » d'un trajet enregistré (`remplace`, spec 24) ou par la phrase
 * comprise de l'Accueil (`remplace` null, spec 28 : le formulaire demande de vérifier avant « Chercher »).
 */
export type Modification = {
  remplace: { cle: string; titre: string } | null;
  champs: ChampsFormulaire;
  jeton: number;
  /** « Modifier la recherche » du Résultat (spec 34) : la recherche en cours reprise, sans bandeau « Vérifiez ». */
  reprise?: true;
  /** Spec 35 : lieux de la phrase déjà cherchés par l'Accueil : listes à ouvrir sous les champs, et leurs messages. */
  aChoisir?: Partial<Record<CoteBout, Candidat[]>>;
  erreurs?: ErreursFormulaire;
};

/**
 * Spec 35 (D113) : l'Accueil cherche chaque lieu de la phrase par `GET /v1/lieux` avant d'ouvrir le formulaire,
 * le départ d'abord, près du domicile (départ Domicile) ou de la position si son accès est déjà accordé (D78) ;
 * l'arrivée près du départ trouvé. Rend les champs, listes et messages du formulaire, ou null si la clé est refusée.
 */
export function useLieuxDeLaPhrase() {
  const client = useClient();
  const db = useSQLiteContext();
  const { oublierCle } = useSession();
  return async (c: Comprehension, champs: ChampsFormulaire) => {
    let proche: Point | undefined;
    if (champs.depart.type === "domicile") {
      const d = await lireDomicileEnBase(db);
      if (d) proche = { lat: d.lat, lon: d.lon };
    }
    proche ??= (await lirePositionSiAccordee()) ?? undefined;
    const verifies: Partial<Record<CoteBout, LieuVerifie>> = {};
    const zones: [CoteBout, string | null][] = [
      ["depart", c.depart_zone ?? null],
      ["arrivee", c.lieu_zone ?? null],
    ];
    for (const [cote, zone] of zones) {
      const bout = champs[cote];
      if (bout.type !== "texte" || bout.texte.trim().length < SUGGESTION_MIN) continue;
      const r = await client.lieux(bout.texte.trim(), proche);
      if (r.etat === "cle_refusee") {
        await oublierCle();
        return null;
      }
      const v = lieuDeLaPhrase(r, zone);
      verifies[cote] = v;
      if (v.etat === "retenu") proche = { lat: v.bout.lat, lon: v.bout.lon };
    }
    return appliquerLieux(champs, verifies);
  };
}

/**
 * Échec à montrer : sous un champ du formulaire (`champ`), ou dans la carte d'erreur (`champ` null).
 * `candidats` : texte ambigu, la liste s'ouvre sous son champ pour choisir (D91).
 */
export type EchecRecherche = { champ: CoteBout | null; message: string; candidats?: Candidat[] };

/** Texte tapé retenu à « Chercher » (un seul lieu trouvé) : le formulaire l'écrit dans son champ (D91). */
export type SurLieuRetenu = (cote: CoteBout, texteCherche: string, lieu: BoutLieu) => void;

export const DOMICILE_ABSENT = "Indiquez votre domicile dans Réglages.";

const COTES: readonly CoteBout[] = ["depart", "arrivee"];
const autreCote = (c: CoteBout): CoteBout => (c === "depart" ? "arrivee" : "depart");

/** Le lieu retenu pour un bout, d'après le candidat choisi (texte) ou le point lu (domicile, position). */
export function lieuChoisi(bout: Bout, point: Point & { nom?: string } & SourceAdresse): LieuChoisi {
  return {
    point: { lat: point.lat, lon: point.lon },
    nom: nomBout(bout, point.nom != null ? { nom: point.nom } : null),
    adresse: adresseBout(bout, point),
  };
}

type ContexteValeur = {
  recherche: Recherche | null;
  setRecherche: (r: Recherche | null) => void;
  modification: Modification | null;
  setModification: (m: Modification | null) => void;
};

const Contexte = createContext<ContexteValeur | null>(null);

export function FournisseurRecherche({ children }: { children: ReactNode }) {
  const [recherche, setRecherche] = useState<Recherche | null>(null);
  const [modification, setModification] = useState<Modification | null>(null);
  return <Contexte value={{ recherche, setRecherche, modification, setModification }}>{children}</Contexte>;
}

export function useRecherche(): ContexteValeur {
  const v = use(Contexte);
  if (!v) throw new Error("useRecherche hors de FournisseurRecherche");
  return v;
}

/**
 * Toucher un trajet de Mes trajets (spec 22, D98) : le trajet enregistré devient la recherche en cours, sans
 * réseau, et le Résultat s'ouvre dans l'onglet Trajet (spec 34), sur le tri gardé (D101).
 */
export function useOuvrirVoyage() {
  const { setRecherche } = useRecherche();
  return (cle: string, v: Voyage) => {
    setRecherche({
      demande: v.demande,
      depart: { lieu: v.depart },
      arrivee: { lieu: v.arrivee },
      reponse: v.reponse,
      rouvert: { cle, voyage: v },
    });
    router.navigate("/resultat");
  };
}

/**
 * Crayon du trajet rouvert (spec 24, D100, §7.3) : le formulaire de l'onglet Accueil s'ouvre, pré-rempli avec
 * le trajet ; le trajet trouvé ensuite remplace celui-ci à l'enregistrement.
 */
export function useModifierVoyage() {
  const { setModification } = useRecherche();
  return (cle: string, v: Voyage) => {
    const r = resumeVoyage(v);
    setModification({
      remplace: { cle, titre: `${r.jour} · ${r.titre}` },
      champs: champsDepuisVoyage(v, maintenantAParis(new Date()).date),
      jeton: Date.now(),
    });
    // Le formulaire de l'onglet Accueil (spec 34) : sa pile revient à la première page, puis le formulaire s'ouvre.
    allerALAccueil(() => router.push("/formulaire"));
  };
}

/**
 * Déroule la recherche dans l'ordre de D78 :
 * 1. `demarrer` lit les bouts sans texte (domicile, position) ;
 * 2. `avancer` cherche chaque texte par `GET /v1/lieux`, le départ d'abord, près de l'autre bout s'il est connu,
 *    sinon près de la position si l'accès est déjà accordé ; un seul lieu ⇒ retenu, et écrit dans son champ ;
 *    plusieurs ⇒ la liste s'ouvre sous ce champ (D91) ;
 * 3. les deux bouts connus ⇒ `POST /v1/itineraires`, puis le Résultat.
 * Rend l'échec à montrer, ou null (écran suivant ouvert, ou clé refusée : l'écran de la clé s'ouvre).
 */
export function useDeroulerRecherche() {
  const client = useClient();
  const db = useSQLiteContext();
  const { oublierCle } = useSession();
  const { setRecherche } = useRecherche();

  /**
   * `revenir` : le Résultat déjà ouvert sous l'écran courant reprend la nouvelle réponse, et tout ce qui est
   * au-dessus de lui (le guidage) se ferme, au lieu d'un nouveau Résultat empilé par-dessus.
   */
  async function avancer(
    r: Recherche,
    ouvrir: "pousser" | "revenir" = "pousser",
    surLieuRetenu?: SurLieuRetenu,
  ): Promise<EchecRecherche | null> {
    let courante = r;
    for (const cote of COTES) {
      const bout = courante.demande[cote];
      if (courante[cote].lieu || bout.type !== "texte") continue;
      const proche = courante[autreCote(cote)].lieu?.point ?? (await lirePositionSiAccordee()) ?? undefined;
      const res = await client.lieux(bout.texte, proche);
      if (res.etat === "cle_refusee") {
        await oublierCle();
        return null;
      }
      if (res.etat !== "ok") return { champ: null, message: messageEchec(res) };
      const candidats = res.donnees.slice(0, 5);
      if (candidats.length === 0) return { champ: cote, message: MESSAGES_SUGGESTIONS.aucun(bout.texte) };
      // Plusieurs lieux : on choisit dans la liste, sous le champ (D91), jamais d'office.
      if (candidats.length > 1) return { champ: cote, message: MESSAGES_SUGGESTIONS.choisir, candidats };
      const lieu = boutDuCandidat(candidats[0]!);
      surLieuRetenu?.(cote, bout.texte, lieu);
      courante = { ...courante, [cote]: { lieu: lieuChoisi(lieu, candidats[0]!) } };
    }

    const depart = courante.depart.lieu;
    const arrivee = courante.arrivee.lieu;
    if (!depart || !arrivee) return { champ: null, message: "La recherche a échoué." };
    const requete = versRequeteItineraires(courante.demande, depart.point, arrivee.point, { depart: depart.nom, arrivee: arrivee.nom });
    const res = await client.itineraires(requete);
    if (res.etat === "cle_refusee") {
      await oublierCle();
      return null;
    }
    // Spec 27 : un seul point hors zone ⇒ le message va sous son champ.
    if (res.etat === "hors_zone") return { champ: res.points.length === 1 ? res.points[0]! : null, message: messageEchec(res) };
    if (res.etat !== "ok") return { champ: null, message: messageEchec(res) };
    setRecherche({ ...courante, reponse: res.donnees });
    // Spec 34 : le Résultat de l'onglet Trajet ; déjà ouvert, on y revient (le guidage au-dessus se ferme)
    // au lieu d'en empiler un second.
    if (ouvrir === "revenir") router.dismissTo("/resultat");
    else router.navigate("/resultat");
    return null;
  }

  /** Bout sans texte ⇒ son lieu, ou le message à mettre sous son champ. */
  async function lieuFixe(cote: CoteBout, bout: Bout): Promise<LieuChoisi | EchecRecherche | null> {
    if (bout.type === "domicile") {
      const domicile = await lireDomicileEnBase(db);
      return domicile ? lieuChoisi(bout, domicile) : { champ: cote, message: DOMICILE_ABSENT };
    }
    if (bout.type === "position") {
      const lue = await lirePosition();
      return lue.etat === "ok" ? lieuChoisi(bout, lue.point) : { champ: cote, message: MESSAGES_POSITION[lue.etat] };
    }
    // Lieu choisi dans les suggestions : retenu tel quel, sans réseau (spec 18, §4.3).
    if (bout.type === "lieu") return lieuChoisi(bout, candidatDuBout(bout));
    return null;
  }

  /** `remplace` : la recherche vient de « Modifier » (spec 24) ; le voyage de cette clé sera remplacé. */
  async function demarrer(demande: Demande, surLieuRetenu?: SurLieuRetenu, remplace?: string): Promise<EchecRecherche | null> {
    const r: Recherche = { demande, depart: { lieu: null }, arrivee: { lieu: null }, reponse: null, ...(remplace ? { remplace } : {}) };
    for (const cote of COTES) {
      const fixe = await lieuFixe(cote, demande[cote]);
      if (fixe && "message" in fixe) return fixe;
      r[cote] = { lieu: fixe };
    }
    return avancer(r, "pousser", surLieuRetenu);
  }

  /**
   * « Recalculer depuis ici » (spec 12, §7) : départ à la position lue maintenant, même arrivée (déjà trouvée,
   * sans nouvelle confirmation), même rendez-vous et même marge ; en « partir à », à partir de maintenant.
   * Le guidage en cours se ferme : on revient au Résultat, qui montre la nouvelle réponse.
   * Pendant un retour (spec 19, D94) : vers le départ de l'aller, sans nouveau retour.
   */
  async function recalculer(r: Recherche, trajet: Trajet = "aller", ici?: Point): Promise<EchecRecherche | null> {
    const demande = demandeRecalcul(r.demande, new Date(), trajet);
    // `ici` : position déjà lue par le guidage (spec 20 : celle du chemin à pied demandé juste avant).
    let point = ici;
    if (!point) {
      const lue = await lirePosition();
      // Dans le guidage, pas de choix « Domicile » : le message dit seulement quoi faire pour la position.
      if (lue.etat !== "ok") return { champ: null, message: MESSAGES_POSITION_GUIDAGE[lue.etat] };
      point = lue.point;
    }
    const depart = lieuChoisi(demande.depart, point);
    const arrivee = trajet === "retour" ? r.depart : r.arrivee;
    return avancer({ demande, depart: { lieu: depart }, arrivee, reponse: null }, "revenir");
  }

  return { demarrer, recalculer };
}
