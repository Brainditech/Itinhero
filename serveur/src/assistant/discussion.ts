import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Contexte } from "../comprendre/comprendre.js";
import type { Jetons, ModeleClaude } from "../comprendre/cout.js";

/**
 * `POST /v1/assistant/discussion` (spec 39, D117) : l'Assistant discute en texte libre, en flux. Le serveur ne garde
 * rien (invariant 6) et retire de son texte toute heure, tout prix, tout numéro et toute coordonnée (filtre.ts).
 */

export const MESSAGES_MAX = 20;
export const TEXTE_MAX = 1000;
export const JETONS_REPONSE_MAX = 800;

/** Deux nombres à décimales séparés par une virgule : des coordonnées, refusées à l'entrée (invariant 2). */
const COORDONNEES = /-?\d{1,3}\.\d{2,}\s*[,;]\s*-?\d{1,3}\.\d{2,}/;
const sansCoordonnees = (s: string) => !COORDONNEES.test(s);

/**
 * Spec 45 (D126) : une pièce jointe (photo ou PDF : convocation, billet, plan), en base64, lue par Claude pour cette
 * réponse seulement ; ni gardée ni journalisée (invariants 6 et 10). 1,5 Mo d'image, 2 Mo de PDF au plus.
 */
export const IMAGE_MAX_OCTETS = 1_500_000;
export const PDF_MAX_OCTETS = 2_000_000;
const base64 = (octets: number) =>
  z
    .string()
    .max(Math.ceil((octets * 4) / 3) + 4)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "base64");
const schemaPieceJointe = z.discriminatedUnion("type", [
  z.object({ type: z.literal("image"), media_type: z.enum(["image/jpeg", "image/png", "image/webp"]), donnees: base64(IMAGE_MAX_OCTETS) }).strict(),
  z.object({ type: z.literal("pdf"), media_type: z.literal("application/pdf"), donnees: base64(PDF_MAX_OCTETS) }).strict(),
]);
export type PieceJointe = z.infer<typeof schemaPieceJointe>;

const schemaMessage = z
  .object({
    role: z.enum(["personne", "assistant"]),
    texte: z.string().trim().min(1).max(TEXTE_MAX).refine(sansCoordonnees, "coordonnées"),
    piece_jointe: schemaPieceJointe.optional(),
  })
  .strict()
  .refine((m) => m.role === "personne" || m.piece_jointe === undefined, "pièce jointe de l'Assistant");

const ALERTES = ["nuit_dehors", "taxi_a_reserver", "transport_a_reserver", "marche_longue", "sans_reservation"] as const;

/** Une possibilité de la liste, résumée par l'app : ni horaire, ni arrêt, ni coordonnée, ni prix (spec 39 §3). */
const schemaPossibilite = z
  .object({
    modes: z.array(z.string().regex(/^[a-z_]{2,30}$/)).min(1).max(15),
    correspondances: z.number().int().min(0).max(15),
    marche_minutes: z.number().int().min(0).max(600),
    alertes: z.array(z.enum(ALERTES)).max(ALERTES.length),
  })
  .strict();

const texteLieu = z.string().trim().min(1).max(200).refine(sansCoordonnees, "coordonnées");

/** Résumé de la recherche en cours (spec 39 §3) : lieux en texte (« Domicile », « Ma position » ou un nom). */
export const schemaRechercheResumee = z
  .object({
    depart: texteLieu,
    arrivee: texteLieu,
    date: z.iso.date(),
    heure: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    sens: z.enum(["arriver_avant", "partir_a"]),
    marge: z.number().int().min(0).max(120),
    possibilites: z.array(schemaPossibilite).max(10),
  })
  .strict();
export type RechercheResumee = z.infer<typeof schemaRechercheResumee>;

export const schemaRequeteDiscussion = z
  .object({
    messages: z
      .array(schemaMessage)
      .min(1)
      .max(MESSAGES_MAX)
      .refine((m) => m.at(-1)?.role === "personne", "le dernier message est celui de la personne")
      // Une seule pièce jointe par envoi : celle du dernier message (le coût reste borné).
      .refine((m) => m.slice(0, -1).every((x) => x.piece_jointe === undefined), "pièce jointe sur un ancien message"),
    recherche: schemaRechercheResumee.optional(),
  })
  .strict();
export type RequeteDiscussion = z.infer<typeof schemaRequeteDiscussion>;
export type MessageDiscussion = RequeteDiscussion["messages"][number];

/**
 * Consignes fixes de l'Assistant (spec 39 §3). Les trois conseils de la spec 37 (correspondance ratée, transport à
 * la demande, nuit dehors) y entrent comme connaissances.
 */
export const CONSIGNES = `Tu es l'Assistant d'Itinhero, une application qui calcule les trajets en transports en commun en France (train, car, bus, métro, transport à la demande, taxi) et accompagne une personne qui débute, de porte à porte.

Ta façon de parler :
- Français simple, phrases courtes, vouvoiement. Pas de jargon.
- Texte brut : l'app n'affiche pas le Markdown. Jamais d'astérisques, de dièses, de titres ni de tableaux. Des listes courtes avec « - » seulement si elles aident.
- Réponses brèves : quelques phrases, sauf si la personne demande plus de détails.
- Si tu ne sais pas, dis « je ne sais pas » plutôt que d'inventer.

Ce que tu ne fais jamais :
- Tu n'écris jamais d'horaire, d'heure de passage, de prix, de numéro de téléphone, de coordonnées, de nom d'arrêt ou de numéro de ligne que tu inventerais. Tu n'as pas accès aux horaires : l'app les affiche dans le trajet. Tu renvoies vers l'app (« l'horaire est dans votre trajet, onglet Trajet »).
- Tu n'écris aucune heure, même celle du rendez-vous que tu reçois dans le résumé : dis « avant votre rendez-vous », « à l'heure choisie ». Une durée (« 20 minutes de marge ») est permise.
- Tu ne promets pas qu'un transport passera : les horaires peuvent changer.
- Tu n'inventes pas ce que l'app sait faire : tiens-t'en à ce qui est décrit ici. L'app n'a pas encore les prix : elle affiche « Prix non publié ». Pour un prix ou un billet, renvoie vers le transporteur, son site ou le guichet.

Ce que tu fais toujours :
- Quand quelque chose peut mal tourner (correspondance ratée, car qui ne passe pas, transport à la demande non réservé, nuit dehors, longue marche), tu proposes un recours concret.
- Tu renvoies vers ce que l'app sait faire : l'onglet Trajet (la liste des trajets trouvés), « Voir les étapes » dans un trajet, « Recalculer depuis ici » pendant le trajet (cherche le prochain passage depuis là où l'on est), l'onglet Accueil pour une nouvelle recherche (autre jour, autre heure, autre lieu), l'onglet Mes trajets pour les trajets enregistrés.

Ce que tu sais :
- Correspondance ratée : ne pas rester sans rien faire. Ouvrir le trajet dans l'onglet Trajet et toucher « Recalculer depuis ici » : l'app cherche le prochain passage depuis là où l'on est. Si rien ne passe, demander au conducteur ou au guichet de la gare. Pour être plus tranquille, choisir un trajet avec plus de temps entre deux véhicules, ou augmenter la marge.
- Transport à la demande ou taxi « réservation obligatoire » : il ne passe que si on l'a réservé, souvent la veille. Dans le trajet, « Voir les étapes » donne le transporteur, et le numéro quand l'app le connaît. Réserver avant de partir.
- Nuit dehors : un trajet marqué « Nuit dehors » fait attendre la nuit dans une gare ou à un arrêt. Essayer de partir plus tôt ou un autre jour (nouvelle recherche depuis l'Accueil), ou prévoir un hébergement près du lieu d'attente ou d'arrivée.
- Marche longue : un trajet marqué « marche longue » a plus de 15 minutes à pied d'un coup. La marge est le temps d'avance voulu avant un rendez-vous ; on la règle à la recherche.

Chercher un trajet (spec 45) :
- Quand la personne veut aller quelque part à un moment précis (« je dois être à Joigny jeudi à 10 h », une convocation en photo), appelle l'outil proposer_recherche avec le départ, l'arrivée, le jour, l'heure et le sens. L'app fait la recherche avec le moteur et montre les trajets en cartes sous ta réponse : tu n'écris pas les horaires toi-même.
- Départ : « domicile » si la personne part de chez elle ou ne dit rien, « position » si elle dit « d'ici », sinon le lieu tel qu'elle le dit. Arrivée : le lieu tel qu'il est écrit (adresse, nom de lieu, ville).
- S'il manque le jour ou l'heure, demande-les au lieu d'appeler l'outil. N'appelle l'outil qu'une fois par réponse.

Pièce jointe : la personne peut joindre une photo ou un PDF (convocation, billet, courrier). Lis-le pour l'aider (lieu, jour, heure du rendez-vous) ; ne recopie ni numéro de téléphone, ni numéro de dossier, ni adresse personnelle dans ta réponse.

Ce que tu reçois : la discussion et, si la personne a une recherche en cours, son résumé (lieux, jour, heure demandée, sens, marge, et pour chaque trajet trouvé : modes, correspondances, minutes de marche, alertes). Tu t'appuies dessus pour expliquer le trajet, sans inventer ce qui n'y est pas.`;

const MODES: Record<string, string> = {
  marche: "marche",
  train: "train",
  train_banlieue: "train de banlieue",
  car: "car",
  bus: "bus",
  metro: "métro",
  tram: "tram",
  transport_a_la_demande: "transport à la demande",
  bateau: "bateau",
  taxi: "taxi",
};
const ALERTES_DITES: Record<(typeof ALERTES)[number], string> = {
  nuit_dehors: "nuit dehors",
  taxi_a_reserver: "taxi à réserver",
  transport_a_reserver: "transport à la demande à réserver",
  marche_longue: "marche longue",
  sans_reservation: "sans réservation",
};

/** Contexte donné à Claude : date et heure de Paris (serveur), et le résumé de la recherche en cours. */
export function contexteDiscussion(c: Contexte, r: RechercheResumee | undefined): string {
  const lignes = [`Aujourd'hui : ${c.jourSemaine} ${c.aujourdhui}, il est ${c.heure} (heure de Paris).`];
  if (!r) {
    lignes.push("Aucune recherche en cours.");
    return lignes.join("\n");
  }
  const sens = r.sens === "arriver_avant" ? `arriver avant ${r.heure} (rendez-vous), marge ${r.marge} min` : `partir à ${r.heure}`;
  lignes.push(`Recherche en cours : de ${r.depart} à ${r.arrivee}, le ${r.date}, ${sens}.`);
  if (r.possibilites.length === 0) lignes.push("Aucun trajet trouvé.");
  r.possibilites.forEach((p, i) => {
    const modes = p.modes.map((m) => MODES[m] ?? m).join(" puis ");
    const alertes = p.alertes.length > 0 ? ` ; ${p.alertes.map((a) => ALERTES_DITES[a]).join(", ")}` : "";
    lignes.push(
      `Trajet ${i + 1} : ${modes} ; ${p.correspondances} correspondance${p.correspondances > 1 ? "s" : ""} ; ${p.marche_minutes} min de marche${alertes}.`,
    );
  });
  return lignes.join("\n");
}

type BlocContenu =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp"; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

const blocPiece = (p: PieceJointe): BlocContenu =>
  p.type === "image"
    ? { type: "image", source: { type: "base64", media_type: p.media_type, data: p.donnees } }
    : { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.donnees } };

/**
 * Messages pour l'API : rôles traduits, messages consécutifs d'un même rôle réunis, premier message de la personne ;
 * la pièce jointe (spec 45) passe avant le texte de son message.
 */
export function messagesClaude(messages: MessageDiscussion[]): { role: "user" | "assistant"; content: BlocContenu[] }[] {
  const r: { role: "user" | "assistant"; content: BlocContenu[] }[] = [];
  for (const m of messages) {
    const role = m.role === "personne" ? "user" : "assistant";
    const blocs: BlocContenu[] = [...(m.piece_jointe ? [blocPiece(m.piece_jointe)] : []), { type: "text", text: m.texte }];
    const dernier = r.at(-1);
    if (dernier && dernier.role === role) dernier.content.push(...blocs);
    else if (r.length > 0 || role === "user") r.push({ role, content: blocs });
  }
  return r;
}

/** Spec 45 (D126) : recherche proposée par Claude ; l'app la lance elle-même (lieux par `GET /v1/lieux`, puis le moteur). */
export const schemaPropositionRecherche = z
  .object({
    depart: z.string().trim().min(1).max(200).refine(sansCoordonnees, "coordonnées"),
    arrivee: z.string().trim().min(1).max(200).refine(sansCoordonnees, "coordonnées"),
    date: z.iso.date(),
    heure: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    sens: z.enum(["arriver_avant", "partir_a"]),
    marge: z.number().int().min(0).max(120).optional(),
  })
  .strict();
export type PropositionRecherche = z.infer<typeof schemaPropositionRecherche>;

export const OUTIL_RECHERCHE = {
  name: "proposer_recherche",
  description:
    "Propose une recherche de trajet que l'app va lancer avec le moteur d'itinéraires ; les trajets trouvés s'affichent en cartes sous ta réponse.",
  input_schema: {
    type: "object" as const,
    properties: {
      depart: { type: "string", description: "« domicile », « position », ou le lieu de départ tel que la personne le dit." },
      arrivee: { type: "string", description: "Le lieu d'arrivée tel qu'il est écrit (adresse, lieu, ville)." },
      date: { type: "string", description: "Jour, AAAA-MM-JJ, à partir d'aujourd'hui." },
      heure: { type: "string", description: "Heure, HH:MM (24 h)." },
      sens: { type: "string", enum: ["arriver_avant", "partir_a"], description: "arriver_avant pour un rendez-vous, partir_a pour un départ." },
      marge: { type: "integer", description: "Minutes d'avance voulues avant le rendez-vous, si la personne le dit." },
    },
    required: ["depart", "arrivee", "date", "heure", "sens"],
  },
};

/** Fin d'un appel : jetons consommés et refus éventuel de Claude. */
export type FinDiscussion = { jetons: Jetons; refus: boolean; recherches?: unknown[] };

/**
 * Appel à Claude en flux, injecté (les tests n'appellent jamais l'API). `surTexte` reçoit chaque morceau brut ;
 * `signal` coupe l'appel quand l'app ferme la connexion. Rejette en cas de panne ; rend les jetons lus même si coupé.
 */
export type AppelDiscussion = (
  entree: RequeteDiscussion,
  contexte: Contexte,
  surTexte: (morceau: string) => void,
  signal: AbortSignal,
) => Promise<FinDiscussion>;

/**
 * Appel réel : `client.messages.stream` du SDK installé (1.3.0, `lib/MessageStream.d.ts` : événement `text`,
 * `finalMessage()`, `abort()`, `currentMessage`). Effort « low » comme les autres appels ; `max_tokens` borne le coût.
 */
export function appelDiscussion(cle: string, modele: ModeleClaude): AppelDiscussion {
  const client = new Anthropic({ apiKey: cle, maxRetries: 1, timeout: 30_000 });
  return async (entree, contexte, surTexte, signal) => {
    const flux = client.messages.stream(
      {
        model: modele,
        max_tokens: JETONS_REPONSE_MAX,
        system: [
          { type: "text", text: CONSIGNES },
          { type: "text", text: contexteDiscussion(contexte, entree.recherche) },
        ],
        messages: messagesClaude(entree.messages),
        tools: [OUTIL_RECHERCHE],
        tool_choice: { type: "auto" },
        output_config: { effort: "low" },
      },
      { signal },
    );
    flux.on("text", (morceau) => surTexte(morceau));
    try {
      const m = await flux.finalMessage();
      // Spec 45 : l'outil n'est pas exécuté ici ; sa demande part à l'app, qui fait la recherche elle-même.
      const recherches = m.content.flatMap((b) => (b.type === "tool_use" && b.name === OUTIL_RECHERCHE.name ? [b.input] : []));
      return { jetons: m.usage, refus: m.stop_reason === "refusal", recherches };
    } catch (e) {
      // Coupé par l'app : les jetons déjà lus et écrits comptent quand même au plafond.
      const partiel = flux.currentMessage?.usage;
      if (signal.aborted && partiel) return { jetons: partiel, refus: false };
      throw e;
    }
  };
}
