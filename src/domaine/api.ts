import { z } from "zod";

// Client des routes de l'API Itinhero (spec 09 §4.4, §4.5 ; spec 10 §4.1).
// `fetch` est injecté : aucun réseau dans les tests. Chaque réponse est validée par Zod (invariant 9) :
// une réponse non conforme n'est jamais affichée à moitié.

export type Point = { lat: number; lon: number };

// ——— Schémas des réponses ———

const schemaPoint = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });

export const schemaCandidat = schemaPoint.extend({
  nom: z.string().min(1),
  type: z.enum(["adresse", "lieu", "arret"]),
  commune: z.string().nullish(),
  code_postal: z.string().nullish(),
  distance_metres: z.number().nonnegative().nullish(),
});
export type Candidat = z.infer<typeof schemaCandidat>;

const schemaReponseLieux = z.object({ candidats: z.array(schemaCandidat) });

const HEURE = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const schemaSource = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("gtfs"),
    jeu: z.string().min(1),
    version: z.string().min(1),
    trip_id: z.string().min(1),
    date_service: z.string().min(1),
    // Dernier jour couvert par le jeu (issue 0010, H) ; null si le serveur ne le sait pas.
    fin_validite: z.iso.date().nullable(),
  }),
  z.object({ type: z.literal("osm"), jeu: z.string().min(1), version: z.string().min(1) }),
]);

const schemaLieuEtape = schemaPoint.extend({
  nom: z.string(),
  // Nature du lieu (issue 0010, F) : « arrêt Mairie », « gare de Saint-Florentin - Vergigny ».
  type: z.enum(["arret", "gare", "station", "depart", "arrivee"]),
  arret: z.string().nullable(),
});
export type LieuEtape = z.infer<typeof schemaLieuEtape>;

// Consigne de marche (spec 11, D71) : manœuvre calculée par le serveur sur le tracé de MOTIS.
export const schemaConsigne = schemaPoint.extend({
  manoeuvre: z.enum([
    "depart",
    "tout_droit",
    "legerement_gauche",
    "gauche",
    "demi_tour",
    "legerement_droite",
    "droite",
    "escalier",
    "ascenseur",
    "arrivee",
  ]),
  rue: z.string().nullable(),
  distance_metres: z.number().nonnegative(),
  cap: z.enum(["nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest"]).optional(),
  cote_arrivee: z.enum(["gauche", "droite", "devant"]).optional(),
  niveau: z.enum(["monter", "descendre"]).optional(),
});
export type Consigne = z.infer<typeof schemaConsigne>;
export type Manoeuvre = Consigne["manoeuvre"];

export const schemaEtape = z.object({
  mode: z.string().min(1),
  mode_motis: z.string(),
  ligne: z.string().nullable(),
  direction: z.string().nullable(),
  // Numéro de la course quand le GTFS le donne à la place de la direction (« 17769 »).
  numero: z.string().nullable(),
  // « appel » : passage sur réservation d'après le GTFS (D69) ; null : rien de tel dans le GTFS.
  reservation: z.literal("appel").nullable(),
  exploitant: z.string().nullable(),
  de: schemaLieuEtape,
  a: schemaLieuEtape,
  depart: HEURE,
  arrivee: HEURE,
  duree_minutes: z.number().int().nonnegative(),
  distance_metres: z.number().nonnegative().nullable(),
  etat: z.literal("prevu"),
  // Invariant 4 : aucune étape sans source. Son absence rend toute la réponse non conforme.
  source: schemaSource,
  // Spec 11 : tracé encodé (précision 6) et consignes de marche. Absents d'un serveur plus ancien ⇒ null.
  trace: z.string().nullable().default(null),
  consignes: z.array(schemaConsigne).nullable().default(null),
  // Spec 12 : instants de l'étape et arrêts desservis (guidage). Absents d'un serveur plus ancien ⇒ null.
  depart_utc: z.string().nullable().default(null),
  arrivee_utc: z.string().nullable().default(null),
  arrets: z.array(schemaPoint.extend({ nom: z.string(), passage: HEURE.nullable() })).nullable().default(null),
});
export type Etape = z.infer<typeof schemaEtape>;

export const schemaPossibilite = z.object({
  depart: HEURE,
  arrivee: HEURE,
  depart_utc: z.string(),
  arrivee_utc: z.string(),
  duree_minutes: z.number().int().nonnegative(),
  correspondances: z.number().int().nonnegative(),
  // Arrivée à l'arrêt avant la première montée (D68) ; null pour un trajet à pied.
  montee: z.object({ arriver_a: HEURE, vehicule: HEURE, marge_minutes: z.number().int().nonnegative() }).nullable(),
  etapes: z.array(schemaEtape).min(1),
});
export type Possibilite = z.infer<typeof schemaPossibilite>;

export const schemaReponseItineraires = z
  .object({
    verdict: z.enum(["possible", "impossible"]),
    demande: z.object({
      date: z.string(),
      heure: HEURE,
      sens: z.enum(["arriver", "partir"]),
      marge: z.number().int().nullable(),
      limite: HEURE.nullable(),
    }),
    // Lieu d'arrivée : le nom envoyé par l'app et l'adresse postale trouvée par l'IGN (issue 0010, C).
    arrivee: z.object({ nom: z.string().nullable(), adresse: z.string().nullable() }),
    possibilites: z.array(schemaPossibilite),
  })
  // « Possible » sans aucune possibilité montrée serait un verdict appuyé sur rien (spec 09 §4.5).
  .refine((r) => r.verdict === "impossible" || r.possibilites.length > 0);
export type ReponseItineraires = z.infer<typeof schemaReponseItineraires>;

export type RequeteItineraires = {
  depart: Point;
  arrivee: Point;
  date: string;
  heure: string;
  sens: "arriver" | "partir";
  marge: number;
  /** Noms du départ et de l'arrivée, affichés à la place de « Départ » et « Arrivée » (issue 0010, C). */
  noms?: { depart?: string; arrivee?: string };
};

// ——— Résultat d'un appel ———

export type ResultatApi<T> =
  | { etat: "ok"; donnees: T }
  | { etat: "cle_refusee" }
  | { etat: "trop_de_demandes"; minutes: number }
  | { etat: "injoignable" }
  | { etat: "erreur_serveur" };

export type Echec = Exclude<ResultatApi<unknown>, { etat: "ok" }>;

export const DELAI_MS = 20_000;

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** `Retry-After` en secondes ⇒ minutes entières, au moins 1. */
export function minutesAttente(retryAfter: string | null): number {
  const s = retryAfter === null ? NaN : Number(retryAfter);
  return Number.isFinite(s) && s > 0 ? Math.ceil(s / 60) : 1;
}

/** Coordonnées au format attendu par `proche` (5 décimales, environ 1 m). */
export function formaterPoint(p: Point): string {
  return `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
}

export function clientApi({
  urlApi,
  cle,
  fetch,
  delaiMs = DELAI_MS,
}: {
  urlApi: string;
  cle: string;
  fetch: Fetch;
  delaiMs?: number;
}) {
  async function appeler<T>(chemin: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<ResultatApi<T>> {
    const controle = new AbortController();
    const minuterie = setTimeout(() => controle.abort(), delaiMs);
    let reponse: Response;
    try {
      reponse = await fetch(`${urlApi}${chemin}`, {
        ...init,
        signal: controle.signal,
        headers: { ...(init.headers as Record<string, string> | undefined), authorization: `Bearer ${cle}` },
      });
    } catch {
      clearTimeout(minuterie);
      return { etat: "injoignable" };
    }
    try {
      if (reponse.status === 401) return { etat: "cle_refusee" };
      if (reponse.status === 429) return { etat: "trop_de_demandes", minutes: minutesAttente(reponse.headers.get("retry-after")) };
      if (!reponse.ok) return { etat: "erreur_serveur" };
      let corps: unknown;
      try {
        corps = await reponse.json();
      } catch {
        // Délai dépassé pendant la lecture du corps : c'est le serveur qui ne répond pas.
        return controle.signal.aborted ? { etat: "injoignable" } : { etat: "erreur_serveur" };
      }
      const lu = schema.safeParse(corps);
      return lu.success ? { etat: "ok", donnees: lu.data } : { etat: "erreur_serveur" };
    } finally {
      clearTimeout(minuterie);
    }
  }

  return {
    lieux(q: string, proche?: Point): Promise<ResultatApi<Candidat[]>> {
      const params = new URLSearchParams({ q });
      if (proche) params.set("proche", formaterPoint(proche));
      return appeler(`/v1/lieux?${params.toString()}`, schemaReponseLieux.transform((r) => r.candidats));
    },
    itineraires(requete: RequeteItineraires): Promise<ResultatApi<ReponseItineraires>> {
      return appeler("/v1/itineraires", schemaReponseItineraires, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requete),
      });
    },
  };
}

export type ClientApi = ReturnType<typeof clientApi>;

/** Message d'un échec, sur chaque écran qui appelle l'API (spec 10, §4.2). Le 401 renvoie à l'écran de la clé. */
export function messageEchec(echec: Exclude<Echec, { etat: "cle_refusee" }>): string {
  switch (echec.etat) {
    case "injoignable":
      return "Le serveur ne répond pas.";
    case "trop_de_demandes":
      return `Trop de recherches. Réessayez dans ${echec.minutes} min.`;
    case "erreur_serveur":
      return "La recherche a échoué.";
  }
}
