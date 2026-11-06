import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Jetons, ModeleClaude } from "./cout.js";

/**
 * `POST /v1/comprendre` (spec 28, D106) : une phrase ⇒ les champs du formulaire, par Claude.
 * Invariant 3 : Claude ne rend que des champs de requête (le texte du lieu tel que dit, une date, une heure,
 * un sens, une marge). Aucun horaire de trajet, arrêt, prix ni numéro. La date du jour et le fuseau sont
 * fournis par le serveur : Claude ne devine jamais « aujourd'hui ».
 */

/** Forme demandée à Claude (sortie structurée) : chaque champ est présent, null quand la phrase ne le dit pas. */
export const schemaSortieClaude = z.object({
  lieu_texte: z.string().nullable(),
  depart_texte: z.string().nullable(),
  date: z.string().nullable(),
  heure: z.string().nullable(),
  sens: z.enum(["arriver", "partir"]).nullable(),
  marge: z.number().int().nullable(),
  fin_rdv: z.string().nullable(),
  lieu_zone: z.string().nullable(),
  depart_zone: z.string().nullable(),
});

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const texteLieu = z.string().trim().min(2).max(200).nullable();
/** Région, département (nom ou numéro) ou pays dit pour préciser un lieu (spec 35, D113). */
const texteZone = z.string().trim().min(2).max(60).nullable();

/** Contrôle du serveur sur ce que Claude a rendu (invariant 9) : hors de ces bornes, la sortie entière est refusée. */
export const schemaComprehension = z
  .object({
    lieu_texte: texteLieu,
    depart_texte: texteLieu,
    date: z.iso.date().nullable(),
    heure: z.string().regex(HEURE).nullable(),
    sens: z.enum(["arriver", "partir"]).nullable(),
    marge: z.number().int().min(0).max(120).nullable(),
    fin_rdv: z.string().regex(HEURE).nullable(),
    lieu_zone: texteZone,
    depart_zone: texteZone,
  })
  .strict();

export type Comprehension = z.infer<typeof schemaComprehension>;

/** Ce que le serveur dit à Claude du moment présent (heure de Paris). */
export type Contexte = { aujourdhui: string; jourSemaine: string; heure: string };

export type ReponseClaude = { sortie: unknown; jetons: Jetons; refus: boolean };

/** Appel à Claude, injecté (les tests n'appellent jamais l'API). */
export type AppelClaude = (phrase: string, contexte: Contexte) => Promise<ReponseClaude>;

/** Invite fixe (aucune donnée variable : elle peut se mettre en cache). */
export const INVITE_SYSTEME = `Tu lis une phrase en français où une personne dit où elle doit aller et quand. Tu rends seulement les champs demandés, sans rien inventer.

- lieu_texte : le lieu où elle doit être, recopié tel qu'elle le dit (nom, adresse, commerce, ville), sans « à », « chez », « RDV », « rendez-vous », et sans la région, l'ancienne région, le département ou le pays qu'elle ajoute pour le préciser (ceux-là vont dans lieu_zone). null s'il n'est pas dit.
- lieu_zone : cette précision, telle qu'elle la dit (« je veux aller à Flers basse normandie » ⇒ lieu_texte « Flers », lieu_zone « basse normandie » ; « Saint-Denis 93 » ⇒ « Saint-Denis » et « 93 »). null si elle n'en dit pas. Tu n'en ajoutes jamais une toi-même.
- depart_texte : le lieu d'où elle part, seulement s'il est dit (« depuis », « en partant de »), avec la même règle. null sinon (« de chez moi », « de la maison » ⇒ null).
- depart_zone : la précision du lieu de départ, comme lieu_zone. null sinon.
- date : AAAA-MM-JJ, calculée à partir d'aujourd'hui donné plus bas. « jeudi » = le prochain jeudi à venir (aujourd'hui si on est jeudi et que l'heure n'est pas passée). « demain », « après-demain », « le 12 » (le prochain 12). null si aucun jour n'est dit.
- heure : HH:MM sur 24 h (« 10h » ⇒ 10:00, « 14h30 » ⇒ 14:30, « midi » ⇒ 12:00). null si aucune heure n'est dite.
- sens : « arriver » si l'heure est celle du rendez-vous ou d'arrivée (« RDV à 10h », « être à », « avant »), « partir » si c'est une heure de départ (« partir à », « départ à »). null si aucune heure n'est dite.
- marge : minutes d'avance voulues si elles sont dites (« 20 min d'avance », « un quart d'heure avant » ⇒ 15). null sinon.
- fin_rdv : HH:MM de fin du rendez-vous si elle est dite (« jusqu'à 11h30 », « je finis à 16h ») ; c'est l'heure à partir de laquelle on cherchera le retour. null sinon.

Tu ne donnes jamais d'horaire de transport, d'arrêt, de ligne, de prix, de numéro de téléphone ni de conseil.`;

/**
 * La phrase dit-elle un jour ? (spec 35, D113 ; invariant 9 : le serveur contrôle Claude.) Constaté le 2026-11-06 :
 * « je veux partir à flers » a donné un trajet daté du lundi 28/12. Sans jour dans la phrase, la date de Claude est
 * ignorée et le formulaire prend aujourd'hui (spec 28).
 */
const JOURS_DITS: readonly RegExp[] = [
  /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/,
  /\b(apres-?demain|demain|aujourd'?hui|lendemain|ce soir|ce matin|ce midi|cet apres-?midi|cette nuit|prochaine?|semaine)\b/,
  /\b(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\b/,
  // « le 20 à 11h », « le 1er » ; pas « le 12 rue de la gare ».
  /\ble (1er|[1-9]|[12]\d|3[01])\b(?! ?(rue|avenue|av|bd|boulevard|place|route|chemin|allee|impasse|quai))/,
  /\b\d{1,2}\/\d{1,2}\b/,
];

export function phraseDitUnJour(phrase: string): boolean {
  const simple = phrase
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’]/g, "'");
  return JOURS_DITS.some((motif) => motif.test(simple));
}

export function messageUtilisateur(phrase: string, c: Contexte): string {
  return `Aujourd'hui : ${c.jourSemaine} ${c.aujourdhui}, il est ${c.heure} (heure de Paris).\n\nPhrase : ${phrase}`;
}

/**
 * Appel réel : sortie structurée validée par Zod (doc de la skill officielle `claude-api`, SDK TypeScript 1.3.0,
 * `messages.parse` + `zodOutputFormat`). Effort « low » : une extraction courte ; `max_tokens` borne le coût d'un appel.
 */
export function appelClaude(cle: string, modele: ModeleClaude): AppelClaude {
  const client = new Anthropic({ apiKey: cle, maxRetries: 1, timeout: 20_000 });
  return async (phrase, contexte) => {
    const r = await client.messages.parse({
      model: modele,
      max_tokens: 2048,
      system: INVITE_SYSTEME,
      messages: [{ role: "user", content: messageUtilisateur(phrase, contexte) }],
      output_config: { effort: "low", format: zodOutputFormat(schemaSortieClaude) },
    });
    return { sortie: r.parsed_output, jetons: r.usage, refus: r.stop_reason === "refusal" };
  };
}
