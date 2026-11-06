import { createContext, use, useState, type ReactNode } from "react";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";

import { messageEchec, type Candidat, type Point, type ReponseItineraires } from "@/domaine/api";
import { demandeRecalcul, versRequeteItineraires, type Bout, type BoutLieu, type CoteBout, type Demande, type Trajet } from "@/domaine/demande";
import { adresseBout, nomBout, type SourceAdresse } from "@/domaine/resultat";
import { boutDuCandidat, candidatDuBout, MESSAGES_SUGGESTIONS } from "@/domaine/suggestions";
import type { Voyage } from "@/domaine/voyages";
import { useClient, useSession } from "@/session";
import { MESSAGES_POSITION, MESSAGES_POSITION_GUIDAGE, lirePosition, lirePositionSiAccordee } from "@/stockage/position";
import { lireDomicileEnBase } from "@/stockage/reglages";

// Recherche en cours dans la pile de l'onglet Chercher : Formulaire ⇒ Résultat (plus de Confirmation, D91).
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
  /** Voyage rouvert depuis Mes trajets (spec 22, D98) : instant de son enregistrement ; absent pour une recherche. */
  enregistre_le?: string;
};

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

type ContexteValeur = { recherche: Recherche | null; setRecherche: (r: Recherche | null) => void };

const Contexte = createContext<ContexteValeur | null>(null);

export function FournisseurRecherche({ children }: { children: ReactNode }) {
  const [recherche, setRecherche] = useState<Recherche | null>(null);
  return <Contexte value={{ recherche, setRecherche }}>{children}</Contexte>;
}

export function useRecherche(): ContexteValeur {
  const v = use(Contexte);
  if (!v) throw new Error("useRecherche hors de FournisseurRecherche");
  return v;
}

/**
 * « Ouvrir le trajet » (spec 22, D98) : le voyage enregistré devient la recherche en cours, sans réseau,
 * et le Résultat s'ouvre dans l'onglet Chercher.
 */
export function useOuvrirVoyage() {
  const { setRecherche } = useRecherche();
  return (v: Voyage) => {
    setRecherche({
      demande: v.demande,
      depart: { lieu: v.depart },
      arrivee: { lieu: v.arrivee },
      reponse: v.reponse,
      enregistre_le: v.enregistre_le,
    });
    router.navigate("/resultat");
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
    if (res.etat !== "ok") return { champ: null, message: messageEchec(res) };
    setRecherche({ ...courante, reponse: res.donnees });
    if (ouvrir === "revenir") router.dismissTo("/resultat");
    else router.push("/resultat");
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

  async function demarrer(demande: Demande, surLieuRetenu?: SurLieuRetenu): Promise<EchecRecherche | null> {
    const r: Recherche = { demande, depart: { lieu: null }, arrivee: { lieu: null }, reponse: null };
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
