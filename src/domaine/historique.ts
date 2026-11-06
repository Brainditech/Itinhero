import { z } from "zod";

import { schemaPropositionRecherche, type MessageFil } from "./discussion";

// Historique de l'Assistant (spec 48, D129) : les discussions gardées dans la base du téléphone, jamais sur le serveur.

export const HISTORIQUE_MAX = 30;
export const TITRE_MAX = 60;

const schemaMessageGarde = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("personne"),
    texte: z.string(),
    piece: z.object({ type: z.enum(["image", "pdf"]), nom: z.string() }).optional(),
  }),
  z.object({ role: z.literal("assistant"), texte: z.string(), arretee: z.boolean().optional() }),
  z.object({ role: z.literal("recherche"), proposition: schemaPropositionRecherche }),
]);
export type MessageGarde = z.infer<typeof schemaMessageGarde>;

const schemaDiscussionGardee = z.object({
  id: z.string().min(1),
  titre: z.string(),
  mise_a_jour: z.iso.datetime({ offset: true }),
  messages: z.array(schemaMessageGarde).min(1),
});
export type DiscussionGardee = z.infer<typeof schemaDiscussionGardee>;

/** Ce qui se garde d'un fil : jamais le contenu d'une pièce jointe, jamais une réponse en cours, en échec ou vide. */
export function messagesAGarder(fil: readonly MessageFil[]): MessageGarde[] {
  return fil.flatMap((m): MessageGarde[] => {
    if (m.role === "recherche") return [{ role: "recherche", proposition: m.proposition }];
    if (m.role === "personne") {
      const piece = m.piece_jointe ? { piece: { type: m.piece_jointe.type, nom: m.piece_jointe.nom } } : {};
      return [{ role: "personne", texte: m.texte, ...piece }];
    }
    if ((m.etat !== "complete" && m.etat !== "arretee") || m.texte.trim() === "") return [];
    return [{ role: "assistant", texte: m.texte, ...(m.etat === "arretee" ? { arretee: true } : {}) }];
  });
}

/** Titre : le premier message de la personne, sur une ligne, coupé à 60 caractères. */
export function titreDiscussion(messages: readonly MessageGarde[]): string {
  const premier = messages.find((m) => m.role === "personne");
  const ligne = (premier?.role === "personne" ? premier.texte : "Discussion").replace(/\s+/g, " ").trim();
  return ligne.length > TITRE_MAX ? `${ligne.slice(0, TITRE_MAX - 1).trimEnd()}…` : ligne;
}

/** La discussion à enregistrer, ou null s'il n'y a encore rien à garder (aucune question de la personne). */
export function discussionAGarder(id: string, fil: readonly MessageFil[], maintenant: Date): DiscussionGardee | null {
  const messages = messagesAGarder(fil);
  if (!messages.some((m) => m.role === "personne")) return null;
  return { id, titre: titreDiscussion(messages), mise_a_jour: maintenant.toISOString(), messages };
}

/** Relit une ligne de la base ; illisible ⇒ null (jamais une erreur). */
export function lireDiscussion(contenu: string): DiscussionGardee | null {
  try {
    const r = schemaDiscussionGardee.safeParse(JSON.parse(contenu));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** Le fil à l'écran d'une discussion rouverte ; les numéros commencent à `premierId`. */
export function filDeDiscussion(d: DiscussionGardee, premierId: number): MessageFil[] {
  return d.messages.map((m, i): MessageFil => {
    const id = premierId + i;
    if (m.role === "recherche") return { id, role: "recherche", proposition: m.proposition };
    if (m.role === "assistant") return { id, role: "assistant", texte: m.texte, etat: m.arretee ? "arretee" : "complete" };
    if (!m.piece) return { id, role: "personne", texte: m.texte };
    // Le contenu n'est pas gardé : `donnees` vide, la pièce ne repart jamais (`messagesAEnvoyer`).
    const piece =
      m.piece.type === "pdf"
        ? { type: "pdf" as const, media_type: "application/pdf" as const, donnees: "", nom: m.piece.nom }
        : { type: "image" as const, media_type: "image/jpeg" as const, donnees: "", nom: m.piece.nom };
    return { id, role: "personne", texte: m.texte, piece_jointe: piece };
  });
}

const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « ven. 6 nov., 20:45 », heure de Paris. */
export function dateDiscussion(iso: string): string {
  const format = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(format.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  const jour = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day))).getUTCDay();
  return `${JOURS[jour]} ${Number(p.day)} ${MOIS[Number(p.month) - 1]}, ${p.hour}:${p.minute}`;
}
