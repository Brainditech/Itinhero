import { z } from "zod";
import type { Bout, ChampsFormulaire } from "./demande";
import { jourCourt } from "./resultat";

// Assistant (spec 37, D31, D115) : la demande et les réglages de la recherche en cours partent à `POST /v1/assistant`,
// sans coordonnées ni historique ; la réponse est une action que la personne confirme avant toute relance.

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Un bout envoyé au serveur : Domicile, Ma position, ou le lieu en texte (jamais son point, D31). */
const schemaBoutReglage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("domicile") }),
  z.object({ type: z.literal("position") }),
  z.object({ type: z.literal("texte"), texte: z.string().min(2).max(200) }),
]);
export type BoutReglage = z.infer<typeof schemaBoutReglage>;

export type Reglages = {
  depart: BoutReglage;
  arrivee: BoutReglage;
  date: string;
  heure: string;
  sens: "arriver_avant" | "partir_a";
  marge: number;
  retour: string | null;
};

export const TRIS_ASSISTANT = ["arrivee", "marche", "sans_reservation"] as const;

const schemaChangements = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    heure: z.string().regex(HEURE),
    sens: z.enum(["arriver_avant", "partir_a"]),
    marge: z.number().int().min(0).max(120),
    depart: schemaBoutReglage,
    arrivee: schemaBoutReglage,
    retour: z.string().regex(HEURE).nullable(),
  })
  .partial();
export type Changements = z.infer<typeof schemaChangements>;

export const schemaReponseAssistant = z.object({
  reponse: z.discriminatedUnion("action", [
    z.object({ action: z.literal("relancer"), changements: schemaChangements }),
    z.object({ action: z.literal("trier"), tri: z.enum(TRIS_ASSISTANT) }),
    z.object({ action: z.literal("conseil"), conseil: z.object({ id: z.string(), titre: z.string(), texte: z.string() }) }),
    z.object({ action: z.literal("incompris") }),
  ]),
});
export type ReponseAssistant = z.infer<typeof schemaReponseAssistant>["reponse"];

/** Un champ du formulaire ⇒ ce que le serveur en reçoit : le nom du lieu, jamais ses coordonnées (D31). */
function boutReglage(b: Bout): BoutReglage {
  switch (b.type) {
    case "domicile":
    case "position":
      return { type: b.type };
    case "texte":
      return { type: "texte", texte: b.texte.trim() };
    case "lieu":
      return { type: "texte", texte: b.nom };
  }
}

/** Réglages envoyés avec la demande. Une marge illisible compte pour 0. */
export function reglagesDepuisChamps(c: ChampsFormulaire): Reglages {
  const marge = Number(c.marge);
  return {
    depart: boutReglage(c.depart),
    arrivee: boutReglage(c.arrivee),
    date: c.date,
    heure: c.heure,
    sens: c.sens,
    marge: Number.isInteger(marge) && marge >= 0 && marge <= 120 ? marge : 0,
    retour: c.retour,
  };
}

function boutDepuisReglage(b: BoutReglage): Bout {
  return b.type === "texte" ? { type: "texte", texte: b.texte } : { type: b.type };
}

/** Les changements de l'Assistant appliqués aux champs ; le reste ne bouge pas (les lieux trouvés gardent leur point). */
export function appliquerChangements(c: ChampsFormulaire, ch: Changements): ChampsFormulaire {
  return {
    ...c,
    ...(ch.date !== undefined ? { date: ch.date } : {}),
    ...(ch.heure !== undefined ? { heure: ch.heure } : {}),
    ...(ch.sens !== undefined ? { sens: ch.sens } : {}),
    ...(ch.marge !== undefined ? { marge: String(ch.marge) } : {}),
    ...(ch.depart !== undefined ? { depart: boutDepuisReglage(ch.depart) } : {}),
    ...(ch.arrivee !== undefined ? { arrivee: boutDepuisReglage(ch.arrivee) } : {}),
    ...(ch.retour !== undefined ? { retour: ch.retour } : {}),
  };
}

function nomBout(b: Bout): string {
  return b.type === "domicile" ? "Domicile" : b.type === "position" ? "Ma position" : b.type === "texte" ? b.texte : b.nom;
}

export type PuceReglage = { cle: "jour" | "heure" | "marge" | "depart" | "arrivee" | "retour"; libelle: string; change: boolean };

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Les puces des réglages proposés (maquette 09) : jour, sens et heure, marge (seulement « Arriver avant »), départ,
 * arrivée, retour. Celles que la demande change sont marquées (entourées à l'écran).
 */
export function pucesReglages(nouveaux: ChampsFormulaire, ch: Changements): PuceReglage[] {
  const puces: PuceReglage[] = [
    { cle: "jour", libelle: majuscule(jourCourt(nouveaux.date)), change: ch.date !== undefined },
    {
      cle: "heure",
      libelle: `${nouveaux.sens === "arriver_avant" ? "Arriver avant" : "Partir à"} ${nouveaux.heure}`,
      change: ch.heure !== undefined || ch.sens !== undefined,
    },
  ];
  if (nouveaux.sens === "arriver_avant") puces.push({ cle: "marge", libelle: `Marge ${nouveaux.marge} min`, change: ch.marge !== undefined });
  puces.push(
    { cle: "depart", libelle: `Depuis ${nomBout(nouveaux.depart)}`, change: ch.depart !== undefined },
    { cle: "arrivee", libelle: `Vers ${nomBout(nouveaux.arrivee)}`, change: ch.arrivee !== undefined },
  );
  if (nouveaux.retour !== null || ch.retour !== undefined) {
    puces.push({ cle: "retour", libelle: nouveaux.retour ? `Retour après ${nouveaux.retour}` : "Sans retour", change: ch.retour !== undefined });
  }
  return puces;
}

/** Valeurs d'un gabarit de conseil (D31) : `{nom}` ⇒ sa valeur, « — » quand elle manque. */
export function remplirConseil(texte: string, valeurs: Record<string, string | null | undefined>): string {
  return texte.replace(/\{([a-z_]+)\}/g, (_m, nom: string) => {
    const v = valeurs[nom];
    return v && v.trim() !== "" ? v : "—";
  });
}

export const LIBELLES_TRI_ASSISTANT: Record<(typeof TRIS_ASSISTANT)[number], string> = {
  arrivee: "arrivée la plus tôt",
  marche: "moins de marche",
  sans_reservation: "sans réservation",
};

export const MESSAGES_ASSISTANT = {
  sousTitre: "Je relance les recherches pour vous. Je n'invente aucun horaire.",
  aucuneRecherche: "Aucune recherche en cours. Faites d'abord une recherche depuis l'Accueil.",
  relancer: "D'accord. Je relance la recherche avec ces réglages :",
  trier: (tri: (typeof TRIS_ASSISTANT)[number]) => `Je range les trajets : ${LIBELLES_TRI_ASSISTANT[tri]}.`,
  incompris: "Je n'ai pas compris. Essayez par exemple « 20 min d'avance » ou « partir de la gare de Sens ».",
  indisponible: "L'assistant est indisponible pour l'instant. Utilisez « Modifier la recherche ».",
  enCours: "Je lis votre demande…",
} as const;

/** Puces qui préremplissent la demande (maquette 09). */
export const SUGGESTIONS_ASSISTANT = [
  { libelle: "Changer l'heure", texte: "Je dois arriver avant " },
  { libelle: "Moins de marche", texte: "Moins de marche" },
  { libelle: "Partir d'ailleurs", texte: "Je pars de " },
] as const;
