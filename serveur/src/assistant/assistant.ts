import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { phraseDitUnJour, type Contexte, type ReponseClaude } from "../comprendre/comprendre.js";
import type { ModeleClaude } from "../comprendre/cout.js";
import conseilsJson from "./conseils.json" with { type: "json" };

/**
 * `POST /v1/assistant` (spec 37, D31, D115) : une demande en langage courant ⇒ une action sur la recherche en cours.
 * Invariant 3 : Claude ne rend que des réglages de recherche (jour, heure, sens, marge, lieux en texte, retour), un
 * tri ou l'identifiant d'un conseil validé ; jamais d'horaire de trajet, d'arrêt, de prix ni de numéro.
 */

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const texteLieu = z.string().trim().min(2).max(200);

/** Un bout de la recherche en cours, sans coordonnées (D31) : Domicile, Ma position, ou le lieu en texte. */
const schemaBoutReglage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("domicile") }).strict(),
  z.object({ type: z.literal("position") }).strict(),
  z.object({ type: z.literal("texte"), texte: texteLieu }).strict(),
]);

/** Réglages de la recherche en cours, envoyés par l'app avec la demande (D31). */
export const schemaReglages = z
  .object({
    depart: schemaBoutReglage,
    arrivee: schemaBoutReglage,
    date: z.iso.date(),
    heure: z.string().regex(HEURE),
    sens: z.enum(["arriver_avant", "partir_a"]),
    marge: z.number().int().min(0).max(120),
    retour: z.string().regex(HEURE).nullable(),
  })
  .strict();
export type Reglages = z.infer<typeof schemaReglages>;

export const schemaRequeteAssistant = z.object({ phrase: z.string().trim().min(3).max(300), reglages: schemaReglages }).strict();

export const TRIS = ["arrivee", "marche", "sans_reservation"] as const;

/** Forme demandée à Claude (sortie structurée) : chaque champ présent, null quand il ne change pas. */
export const schemaSortieAssistant = z.object({
  action: z.enum(["relancer", "trier", "conseil", "incompris"]),
  date: z.string().nullable(),
  heure: z.string().nullable(),
  sens: z.enum(["arriver", "partir"]).nullable(),
  marge: z.number().int().nullable(),
  depart: z.enum(["domicile", "position", "texte"]).nullable(),
  depart_texte: z.string().nullable(),
  arrivee_texte: z.string().nullable(),
  retour: z.string().nullable(),
  sans_retour: z.boolean().nullable(),
  tri: z.enum(TRIS).nullable(),
  conseil_id: z.string().nullable(),
});

/** Contrôle du serveur (invariant 9) : hors de ces bornes, la sortie entière est refusée. */
const schemaSortieControlee = z.object({
  action: z.enum(["relancer", "trier", "conseil", "incompris"]),
  date: z.iso.date().nullable(),
  heure: z.string().regex(HEURE).nullable(),
  sens: z.enum(["arriver", "partir"]).nullable(),
  marge: z.number().int().min(0).max(120).nullable(),
  depart: z.enum(["domicile", "position", "texte"]).nullable(),
  depart_texte: texteLieu.nullable(),
  arrivee_texte: texteLieu.nullable(),
  retour: z.string().regex(HEURE).nullable(),
  sans_retour: z.boolean().nullable(),
  tri: z.enum(TRIS).nullable(),
  conseil_id: z.string().max(60).nullable(),
});

export type BoutReglage = z.infer<typeof schemaBoutReglage>;
export type Changements = Partial<{
  date: string;
  heure: string;
  sens: Reglages["sens"];
  marge: number;
  depart: BoutReglage;
  arrivee: BoutReglage;
  retour: string | null;
}>;
export type Conseil = { id: string; titre: string; texte: string };
export type ReponseAssistant =
  | { action: "relancer"; changements: Changements }
  | { action: "trier"; tri: (typeof TRIS)[number] }
  | { action: "conseil"; conseil: Conseil }
  | { action: "incompris" };

const schemaGabarit = z.object({
  id: z.string().regex(/^[a-z_]{3,60}$/),
  situation: z.string().min(5),
  titre: z.string().min(3),
  texte: z.string().min(10),
  valide: z.boolean(),
});
export type Gabarit = z.infer<typeof schemaGabarit>;

/** Gabarits de `conseils.json`, contrôlés au chargement : un fichier mal formé arrête le serveur. */
export const GABARITS: Gabarit[] = z.object({ conseils: z.array(schemaGabarit) }).parse(conseilsJson).conseils;

/** Seuls les gabarits relus et validés par Brainditech sont proposés et rendus (D31). */
export const conseilsValides = (gabarits: Gabarit[]) => gabarits.filter((g) => g.valide);

/** Invite fixe pour une liste de conseils donnée (elle ne change qu'avec `conseils.json`). */
export function inviteAssistant(gabarits: Gabarit[]): string {
  const valides = conseilsValides(gabarits);
  const conseils =
    valides.length > 0
      ? valides.map((g) => `  - ${g.id} : ${g.situation}`).join("\n")
      : "  (aucun pour l'instant : n'utilise jamais l'action « conseil »)";
  return `Tu aides une personne qui débute dans les transports en commun. Elle a déjà fait une recherche de trajet ; tu reçois ses réglages actuels et sa demande en français. Tu rends une seule action, sans rien inventer.

Actions :
- « relancer » : elle veut changer un réglage de la recherche. Remplis seulement les champs qui changent, tous les autres à null.
  - date : AAAA-MM-JJ, calculée à partir d'aujourd'hui donné plus bas (« demain », « jeudi » = le prochain jeudi, « la veille » = le jour avant la date actuelle).
  - heure : HH:MM sur 24 h. « une heure plus tard » ou « plus tôt » : calculée à partir de l'heure actuelle des réglages.
  - sens : « arriver » si l'heure devient une heure de rendez-vous ou d'arrivée, « partir » si c'est une heure de départ. null s'il ne change pas.
  - marge : minutes d'avance voulues avant le rendez-vous (« 20 min d'avance » ⇒ 20 ; « plus de marge » ⇒ marge actuelle + 10).
  - depart : « domicile » (« de chez moi »), « position » (« d'ici », « d'où je suis ») ou « texte » avec depart_texte, le lieu recopié tel qu'elle le dit (« partir de la gare de Sens » ⇒ texte, « gare de Sens »).
  - arrivee_texte : le nouveau lieu où elle doit aller, recopié tel qu'elle le dit.
  - retour : HH:MM de fin du rendez-vous, à partir de laquelle on cherche le retour (« je finis à 16h »). sans_retour : true si elle ne veut plus de retour.
- « trier » : elle veut voir autrement les trajets déjà trouvés, sans rien changer : tri « marche » (moins de marche, moins à pied), « arrivee » (arriver le plus tôt), « sans_reservation » (sans réservation, sans taxi, sans transport à la demande).
- « conseil » : elle demande quoi faire dans une situation ; conseil_id parmi ceux-ci, seulement si la situation correspond :
${conseils}
- « incompris » : la demande ne correspond à rien de tout ça, ou elle demande un horaire, un prix, un numéro, un arrêt : tu ne les donnes jamais.

Ne remplis jamais un champ que la demande ne change pas. Tu ne donnes jamais d'horaire de transport, d'arrêt, de ligne, de prix ni de numéro de téléphone.`;
}

function libelleBout(b: BoutReglage): string {
  return b.type === "domicile" ? "Domicile" : b.type === "position" ? "Ma position" : b.texte;
}

export function messageAssistant(phrase: string, r: Reglages, c: Contexte): string {
  const sens = r.sens === "arriver_avant" ? `arriver avant ${r.heure} (rendez-vous), marge ${r.marge} min` : `partir à ${r.heure}`;
  return [
    `Aujourd'hui : ${c.jourSemaine} ${c.aujourdhui}, il est ${c.heure} (heure de Paris).`,
    `Réglages actuels : départ ${libelleBout(r.depart)} ; arrivée ${libelleBout(r.arrivee)} ; le ${r.date} ; ${sens} ; ${r.retour ? `fin du rendez-vous ${r.retour}` : "pas de retour"}.`,
    "",
    `Demande : ${phrase}`,
  ].join("\n");
}

/** Appel à Claude, injecté (les tests n'appellent jamais l'API). */
export type AppelAssistant = (phrase: string, reglages: Reglages, contexte: Contexte) => Promise<ReponseClaude>;

/** Appel réel : mêmes réglages que `/v1/comprendre` (sortie structurée, effort « low », `max_tokens` borné). */
export function appelAssistant(cle: string, modele: ModeleClaude, gabarits: Gabarit[] = GABARITS): AppelAssistant {
  const client = new Anthropic({ apiKey: cle, maxRetries: 1, timeout: 20_000 });
  const systeme = inviteAssistant(gabarits);
  return async (phrase, reglages, contexte) => {
    const r = await client.messages.parse({
      model: modele,
      max_tokens: 2048,
      system: systeme,
      messages: [{ role: "user", content: messageAssistant(phrase, reglages, contexte) }],
      output_config: { effort: "low", format: zodOutputFormat(schemaSortieAssistant) },
    });
    return { sortie: r.parsed_output, jetons: r.usage, refus: r.stop_reason === "refusal" };
  };
}

/**
 * Sortie de Claude ⇒ réponse rendue à l'app, ou null si elle est hors schéma (⇒ 503). Ne garde que ce qui change
 * vraiment ; `relancer` sans aucun changement, `trier` sans tri, conseil inconnu ou non validé ⇒ `incompris`.
 * Une date que la phrase ne dit pas est ignorée (D113).
 */
export function controlerSortie(sortie: unknown, phrase: string, r: Reglages, gabarits: Gabarit[] = GABARITS): ReponseAssistant | null {
  const lu = schemaSortieControlee.safeParse(sortie);
  if (!lu.success) return null;
  const s = lu.data;
  if (s.action === "trier") return s.tri ? { action: "trier", tri: s.tri } : { action: "incompris" };
  if (s.action === "conseil") {
    const g = conseilsValides(gabarits).find((x) => x.id === s.conseil_id);
    return g ? { action: "conseil", conseil: { id: g.id, titre: g.titre, texte: g.texte } } : { action: "incompris" };
  }
  if (s.action === "incompris") return { action: "incompris" };

  const c: Changements = {};
  if (s.date && s.date !== r.date && phraseDitUnJour(phrase)) c.date = s.date;
  if (s.heure && s.heure !== r.heure) c.heure = s.heure;
  const sens = s.sens === "arriver" ? "arriver_avant" : s.sens === "partir" ? "partir_a" : null;
  if (sens && sens !== r.sens) c.sens = sens;
  if (s.marge !== null && s.marge !== r.marge) c.marge = s.marge;
  const depart: BoutReglage | null =
    s.depart === "domicile" || s.depart === "position"
      ? { type: s.depart }
      : s.depart_texte
        ? { type: "texte", texte: s.depart_texte }
        : null;
  if (depart && libelleBout(depart) !== libelleBout(r.depart)) c.depart = depart;
  if (s.arrivee_texte && s.arrivee_texte !== libelleBout(r.arrivee)) c.arrivee = { type: "texte", texte: s.arrivee_texte };
  if (s.sans_retour && r.retour !== null) c.retour = null;
  else if (s.retour && s.retour !== r.retour) c.retour = s.retour;
  return Object.keys(c).length > 0 ? { action: "relancer", changements: c } : { action: "incompris" };
}
