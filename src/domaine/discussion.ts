import { z } from "zod";

import type { Possibilite, ReponseSens } from "./api";
import type { Bout, Demande } from "./demande";
import { aMarcheLongue, avecTaxi, minutesDeMarche, nomBout, nuitDehors, parArrivee } from "./resultat";

// Assistant en discussion (spec 39, D117) : la discussion et le résumé de la recherche en cours partent à
// `POST /v1/assistant/discussion` ; la réponse arrive en flux `text/event-stream`, déjà filtrée par le serveur.
// Rien n'est enregistré : la discussion ne vit que dans la mémoire de l'app ouverte.

export const MESSAGES_MAX = 20;
export const TEXTE_MAX = 1000;

export type RoleMessage = "personne" | "assistant";
/** Spec 45 (D126) : photo ou PDF joint au message, en base64 (lu par Claude pour cette réponse seulement). */
export type PieceJointe = { type: "image"; media_type: "image/jpeg" | "image/png" | "image/webp"; donnees: string } | { type: "pdf"; media_type: "application/pdf"; donnees: string };
export type MessageEnvoye = { role: RoleMessage; texte: string; piece_jointe?: PieceJointe };

/** Recherche proposée par l'Assistant (spec 45) : l'app la lance elle-même et montre les trajets en cartes. */
export const schemaPropositionRecherche = z.object({
  depart: z.string().min(1).max(200),
  arrivee: z.string().min(1).max(200),
  date: z.iso.date(),
  heure: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  sens: z.enum(["arriver_avant", "partir_a"]),
  marge: z.number().int().min(0).max(120).optional(),
});
export type PropositionRecherche = z.infer<typeof schemaPropositionRecherche>;

/** « domicile » / « position » / un lieu à chercher ⇒ la demande que lance la recherche ordinaire (D78). */
export function demandeDeProposition(p: PropositionRecherche): Demande {
  const bout = (t: string): Bout => {
    const s = t.trim().toLowerCase();
    if (["domicile", "maison", "chez moi"].includes(s)) return { type: "domicile" };
    if (["position", "ma position", "ici"].includes(s)) return { type: "position" };
    return { type: "texte", texte: t.trim() };
  };
  return { depart: bout(p.depart), arrivee: bout(p.arrivee), date: p.date, heure: p.heure, sens: p.sens, marge: p.marge ?? 10, retour: null }; // D17 : 10 min par défaut
}

export type Alerte = "nuit_dehors" | "taxi_a_reserver" | "transport_a_reserver" | "marche_longue" | "sans_reservation";
export type PossibiliteResumee = { modes: string[]; correspondances: number; marche_minutes: number; alertes: Alerte[] };

/** Résumé de la recherche en cours (spec 39 §3) : lieux en texte, ni horaire de trajet, ni coordonnée, ni prix. */
export type RechercheResumee = {
  depart: string;
  arrivee: string;
  date: string;
  heure: string;
  sens: "arriver_avant" | "partir_a";
  marge: number;
  possibilites: PossibiliteResumee[];
};

/** Alertes déjà calculées par l'app pour une possibilité (D3, D48, D69, D79). */
export function alertesPossibilite(p: Possibilite): Alerte[] {
  const a: Alerte[] = [];
  if (nuitDehors(p)) a.push("nuit_dehors");
  const taxi = avecTaxi(p);
  const reservation = p.etapes.some((e) => e.reservation === "appel");
  if (taxi) a.push("taxi_a_reserver");
  if (reservation) a.push("transport_a_reserver");
  if (aMarcheLongue(p)) a.push("marche_longue");
  if (!taxi && !reservation) a.push("sans_reservation");
  return a;
}

const MODE = /^[a-z_]{2,30}$/;
const borne = (n: number, max: number) => Math.min(max, Math.max(0, Math.round(n)));

/**
 * Résumé envoyé avec chaque message : les lieux par leur nom (« Domicile », « Ma position » ou le lieu choisi), la
 * demande, et les possibilités de l'aller dans l'ordre de la liste par défaut (D114), dix au plus.
 */
export function resumeRecherche(
  demande: Demande,
  depart: { bout: Bout; choisi: { nom: string } | null },
  arrivee: { bout: Bout; choisi: { nom: string } | null },
  reponse: ReponseSens | null,
): RechercheResumee {
  const possibilites = [...(reponse?.possibilites ?? [])].sort(parArrivee).slice(0, 10);
  return {
    depart: nomBout(depart.bout, depart.choisi).slice(0, 200),
    arrivee: nomBout(arrivee.bout, arrivee.choisi).slice(0, 200),
    date: demande.date,
    heure: demande.heure,
    sens: demande.sens,
    marge: borne(demande.marge, 120),
    possibilites: possibilites.map((p) => ({
      modes: p.etapes.map((e) => e.mode).filter((m) => MODE.test(m)).slice(0, 15),
      correspondances: borne(p.correspondances, 15),
      marche_minutes: borne(minutesDeMarche(p), 600),
      alertes: alertesPossibilite(p),
    })).filter((p) => p.modes.length > 0),
  };
}

/** Un message du fil, à l'écran. `etat` d'une réponse : en cours d'écriture, complète, arrêtée ou en échec. */
export type MessageFil =
  | { id: number; role: "personne"; texte: string; piece_jointe?: PieceJointe & { nom: string } }
  | { id: number; role: "recherche"; proposition: PropositionRecherche }
  | { id: number; role: "assistant"; texte: string; etat: "ecrit" | "complete" | "arretee" | "echec"; erreur?: string; reessayer?: boolean };

/**
 * Messages envoyés au serveur : les réponses vides ou en échec sont laissées de côté, chaque texte est borné à
 * 1 000 caractères, et seuls les 20 derniers partent (le dernier est la question de la personne).
 */
export function messagesAEnvoyer(fil: MessageFil[]): MessageEnvoye[] {
  const envoyes = fil
    .flatMap((m) => (m.role === "recherche" ? [] : [m]))
    .filter((m) => m.texte.trim() !== "" && !(m.role === "assistant" && m.etat === "echec" && m.texte.trim() === ""))
    .slice(-MESSAGES_MAX);
  // Spec 45 : seule la pièce jointe du dernier message repart (le serveur refuse les autres).
  return envoyes.map((m, i) => {
    const base = { role: m.role, texte: m.texte.trim().slice(0, TEXTE_MAX) };
    if (i === envoyes.length - 1 && m.role === "personne" && m.piece_jointe) {
      const { nom: _nom, ...piece } = m.piece_jointe;
      return { ...base, piece_jointe: piece };
    }
    return base;
  });
}

// ——— Lecture du flux `text/event-stream` (spec 39 §7) ———

export type EvenementDiscussion =
  | { type: "texte"; texte: string }
  | { type: "recherche"; recherche: PropositionRecherche }
  | { type: "fin" }
  | { type: "erreur" };

/**
 * Découpe un tampon reçu en événements complets ; `reste` est le début d'un événement pas encore fini. Un bloc mal
 * formé est ignoré. Fonction pure (testée sous Node).
 */
export function lireEvenements(tampon: string): { evenements: EvenementDiscussion[]; reste: string } {
  const normalise = tampon.replace(/\r\n/g, "\n");
  const blocs = normalise.split("\n\n");
  const reste = blocs.pop() ?? "";
  const evenements: EvenementDiscussion[] = [];
  for (const bloc of blocs) {
    let nom = "message";
    const donnees: string[] = [];
    for (const ligne of bloc.split("\n")) {
      if (ligne.startsWith("event:")) nom = ligne.slice(6).trim();
      else if (ligne.startsWith("data:")) donnees.push(ligne.slice(5).replace(/^ /, ""));
    }
    if (nom === "recherche") {
      try {
        const lu = schemaPropositionRecherche.safeParse(JSON.parse(donnees.join("\n")));
        if (lu.success) evenements.push({ type: "recherche", recherche: lu.data });
      } catch {
        // Bloc illisible : ignoré.
      }
    } else if (nom === "fin") evenements.push({ type: "fin" });
    else if (nom === "erreur") evenements.push({ type: "erreur" });
    else if (nom === "texte") {
      try {
        const lu: unknown = JSON.parse(donnees.join("\n"));
        if (lu && typeof lu === "object" && typeof (lu as { texte?: unknown }).texte === "string") {
          evenements.push({ type: "texte", texte: (lu as { texte: string }).texte });
        }
      } catch {
        // Bloc illisible : ignoré.
      }
    }
  }
  return { evenements, reste };
}

/** Issue d'un envoi à l'Assistant. */
export type IssueDiscussion =
  | { etat: "complete" }
  | { etat: "arretee" }
  | { etat: "indisponible" }
  | { etat: "coupee" }
  | { etat: "injoignable" }
  | { etat: "cle_refusee" }
  | { etat: "trop_de_demandes"; minutes: number };

export const MESSAGES_DISCUSSION = {
  sousTitre: "Je vous aide à préparer votre voyage. Je n'invente aucun horaire.",
  champ: "Écrivez votre message",
  indisponible: "Je ne suis pas disponible pour l'instant. La recherche marche toujours depuis l'Accueil.",
  pasDeReseau: "Pas de réseau. Votre message n'est pas parti.",
  coupee: "Pas de réseau : la réponse s'est arrêtée là.",
  trop: (minutes: number) => `Trop de demandes. Réessayez dans ${minutes} min.`,
  nouvelle: "Nouvelle discussion",
} as const;

/** Puces de départ, discussion vide (spec 39 §2.6) ; la dernière seulement avec une recherche en cours. */
export function pucesDepart(avecRecherche: boolean): string[] {
  const p = ["Que faire si je rate une correspondance ?", "Comment réserver un transport à la demande ?"];
  return avecRecherche ? [...p, "Explique-moi mon trajet"] : p;
}

/** Message d'échec d'une réponse, montré dans la bulle de l'Assistant (spec 39 §2.10). */
export function messageIssue(issue: IssueDiscussion, texteRecu: boolean): { erreur: string; reessayer: boolean } | null {
  switch (issue.etat) {
    case "complete":
    case "arretee":
    case "cle_refusee":
      return null;
    case "indisponible":
      return { erreur: MESSAGES_DISCUSSION.indisponible, reessayer: false };
    case "trop_de_demandes":
      return { erreur: MESSAGES_DISCUSSION.trop(issue.minutes), reessayer: true };
    case "injoignable":
      return { erreur: texteRecu ? MESSAGES_DISCUSSION.coupee : MESSAGES_DISCUSSION.pasDeReseau, reessayer: true };
    case "coupee":
      return { erreur: texteRecu ? MESSAGES_DISCUSSION.coupee : MESSAGES_DISCUSSION.pasDeReseau, reessayer: true };
  }
}
