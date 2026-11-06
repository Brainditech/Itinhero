import { z } from "zod";
import { lireEvenements, type IssueDiscussion, type MessageEnvoye, type RechercheResumee } from "./discussion";

// Client des routes de l'API Itinhero (spec 09 §4.4, §4.5 ; spec 10 §4.1).
// `fetch` est injecté : aucun réseau dans les tests. Chaque réponse est validée par Zod (invariant 9) :
// une réponse non conforme n'est jamais affichée à moitié.

export type Point = { lat: number; lon: number };

// ——— Schémas des réponses ———

const schemaPoint = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });

/** Transport le plus lourd qui dessert un arrêt ou une gare (D92), donné par `GET /v1/lieux`. */
export const TRANSPORTS = ["train", "metro", "tram", "car", "bus", "bateau"] as const;
export type Transport = (typeof TRANSPORTS)[number];
/** Facultatif ; une valeur inconnue (serveur plus récent) est oubliée, le candidat reste valable. */
export const schemaTransport = z.enum(TRANSPORTS).optional().catch(undefined);

export const schemaCandidat = schemaPoint.extend({
  nom: z.string().min(1),
  type: z.enum(["adresse", "lieu", "arret"]),
  commune: z.string().nullish(),
  code_postal: z.string().nullish(),
  distance_metres: z.number().nonnegative().nullish(),
  transport: schemaTransport,
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
    // Spec 32 (D110) : date des horaires du jeu ; absente d'un serveur plus ancien ⇒ null.
    date_horaires: z.iso.date().nullable().default(null),
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
  // Spec 17 (D87) : identifiant de la course, pour `GET /v1/course`. Absent d'un serveur plus ancien ⇒ null.
  course: z.string().nullable().default(null),
});
export type Etape = z.infer<typeof schemaEtape>;

// `GET /v1/course` (spec 17, D87) : tous les arrêts d'une course, dans l'ordre de passage.
const schemaArretCourse = schemaPoint.extend({ nom: z.string(), passage: HEURE.nullable() });
export type ArretCourse = z.infer<typeof schemaArretCourse>;
const schemaReponseCourse = z.object({ arrets: z.array(schemaArretCourse) });

// `POST /v1/marche` (spec 20, D96) : un nouveau chemin à pied, de même forme qu'une étape ; null sans chemin d'au plus 1 h.
const schemaReponseMarche = z.object({ marche: schemaEtape.nullable() });

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

/** Un sens du voyage : l'aller, ou le retour planifié (spec 19), de même forme. */
const schemaReponseSens = z
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
export type ReponseSens = z.infer<typeof schemaReponseSens>;

export const schemaReponseItineraires = schemaReponseSens.and(
  // Retour à partir de la fin du rendez-vous (spec 19, D94) ; null sans fin de rendez-vous.
  z.object({ retour: schemaReponseSens.nullish() }),
);
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
  /** Fin du rendez-vous, le même jour : le serveur cherche aussi le retour (spec 19). */
  fin_rdv?: string;
};

// ——— Phrase comprise (spec 28, D106) ———

const HEURE_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Champs rendus par `POST /v1/comprendre` : seulement ce que la phrase dit, null sinon (invariant 3). */
export const schemaComprehension = z.object({
  lieu_texte: z.string().min(2).max(200).nullable(),
  depart_texte: z.string().min(2).max(200).nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  heure: z.string().regex(HEURE_HHMM).nullable(),
  sens: z.enum(["arriver", "partir"]).nullable(),
  marge: z.number().int().min(0).max(120).nullable(),
  fin_rdv: z.string().regex(HEURE_HHMM).nullable(),
  /** Spec 35 (D113) : région ou département dit pour préciser le lieu ; absent d'un serveur plus ancien. */
  lieu_zone: z.string().min(2).max(60).nullable().optional(),
  depart_zone: z.string().min(2).max(60).nullable().optional(),
});
export type Comprehension = z.infer<typeof schemaComprehension>;
const schemaReponseComprendre = z.object({ comprehension: schemaComprehension });

// ——— État des courses d'un trajet enregistré (spec 33, D111) ———

export const schemaEtatCourse = z.discriminatedUnion("etat", [
  z.object({ course: z.string(), etat: z.literal("prevu") }),
  z.object({ course: z.string(), etat: z.literal("en_direct"), retard_minutes: z.number().int().nonnegative() }),
  z.object({ course: z.string(), etat: z.literal("retard"), retard_minutes: z.number().int().nonnegative() }),
  z.object({ course: z.string(), etat: z.literal("supprime") }),
  z.object({ course: z.string(), etat: z.literal("inconnu") }),
]);
export type EtatCourse = z.infer<typeof schemaEtatCourse>;
const schemaReponseEtatCourses = z.object({ etats: z.array(schemaEtatCourse) });

// ——— Résultat d'un appel ———

export type ResultatApi<T> =
  | { etat: "ok"; donnees: T }
  | { etat: "cle_refusee" }
  | { etat: "trop_de_demandes"; minutes: number }
  | { etat: "injoignable" }
  | { etat: "hors_zone"; points: PointHorsZone[] }
  | { etat: "erreur_serveur" };

/** Spec 27 (D105) : point de la demande hors de l'extrait OSM chargé (France métropolitaine et Corse). */
export type PointHorsZone = "depart" | "arrivee";

const schemaHorsZone = z
  .object({ erreur: z.literal("hors_zone"), points: z.array(z.enum(["depart", "arrivee"])).min(1) })
  .transform((r) => r.points);

export type Echec = Exclude<ResultatApi<unknown>, { etat: "ok" }>;

export const DELAI_MS = 20_000;

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/**
 * `fetch` dont la réponse lit son corps morceau par morceau (`body.getReader()`) : celui d'`expo/fetch` dans l'app
 * (SDK 58, `node_modules/expo/src/winter/fetch/FetchResponse.ts`), celui de Node dans les tests. Spec 39 §7.
 */
export type FetchFlux = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{ status: number; ok: boolean; headers: { get(nom: string): string | null }; body: ReadableStream<Uint8Array> | null }>;

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
  fetchFlux,
  delaiMs = DELAI_MS,
}: {
  urlApi: string;
  cle: string;
  fetch: Fetch;
  /** Pour la discussion de l'Assistant (spec 39) ; absent ⇒ l'Assistant est indisponible. */
  fetchFlux?: FetchFlux;
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
      if (reponse.status === 422) {
        const lu = schemaHorsZone.safeParse(await reponse.json().catch(() => null));
        return lu.success ? { etat: "hors_zone", points: lu.data } : { etat: "erreur_serveur" };
      }
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
    course(id: string): Promise<ResultatApi<ArretCourse[]>> {
      return appeler(`/v1/course?${new URLSearchParams({ id }).toString()}`, schemaReponseCourse.transform((r) => r.arrets));
    },
    itineraires(requete: RequeteItineraires): Promise<ResultatApi<ReponseItineraires>> {
      return appeler("/v1/itineraires", schemaReponseItineraires, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requete),
      });
    },
    /** État des courses d'un trajet enregistré (spec 33) : 20 au plus, identifiants `course` des étapes. */
    etatCourses(courses: string[]): Promise<ResultatApi<EtatCourse[]>> {
      return appeler("/v1/etat-courses", schemaReponseEtatCourses.transform((r) => r.etats), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courses }),
      });
    },
    /** Phrase de l'Accueil ⇒ champs compris par le serveur (spec 28). Tout échec ⇒ le formulaire de repli. */
    comprendre(phrase: string): Promise<ResultatApi<Comprehension>> {
      return appeler("/v1/comprendre", schemaReponseComprendre.transform((r) => r.comprehension), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phrase }),
      });
    },
    /**
     * Discussion de l'Assistant (spec 39, D117) : les messages et le résumé de la recherche en cours, sans
     * coordonnées. `surTexte` reçoit chaque morceau de la réponse dès qu'il arrive ; `signal` (« Arrêter ») coupe la
     * connexion. Délai : seulement jusqu'à l'arrivée des en-têtes, la réponse elle-même peut durer.
     */
    async discussion(
      corps: { messages: MessageEnvoye[]; recherche?: RechercheResumee },
      { signal, surTexte }: { signal: AbortSignal; surTexte: (texte: string) => void },
    ): Promise<IssueDiscussion> {
      if (!fetchFlux) return { etat: "indisponible" };
      const controle = new AbortController();
      const arreter = () => controle.abort();
      if (signal.aborted) return { etat: "arretee" };
      signal.addEventListener("abort", arreter);
      const minuterie = setTimeout(arreter, delaiMs);
      const issueCoupure = (): IssueDiscussion => (signal.aborted ? { etat: "arretee" } : { etat: "coupee" });
      try {
        let reponse;
        try {
          reponse = await fetchFlux(`${urlApi}/v1/assistant/discussion`, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${cle}` },
            body: JSON.stringify(corps),
            signal: controle.signal,
          });
        } catch {
          return signal.aborted ? { etat: "arretee" } : { etat: "injoignable" };
        } finally {
          clearTimeout(minuterie);
        }
        if (reponse.status === 401) return { etat: "cle_refusee" };
        if (reponse.status === 429) return { etat: "trop_de_demandes", minutes: minutesAttente(reponse.headers.get("retry-after")) };
        if (!reponse.ok || !reponse.body) return { etat: "indisponible" };
        const lecteur = reponse.body.getReader();
        const decodeur = new TextDecoder();
        let tampon = "";
        try {
          for (;;) {
            const { done, value } = await lecteur.read();
            if (done) return issueCoupure();
            tampon += decodeur.decode(value, { stream: true });
            const lu = lireEvenements(tampon);
            tampon = lu.reste;
            for (const e of lu.evenements) {
              if (e.type === "texte") surTexte(e.texte);
              else if (e.type === "fin") return { etat: "complete" };
              else return { etat: "indisponible" };
            }
          }
        } catch {
          return issueCoupure();
        } finally {
          lecteur.cancel().catch(() => {});
        }
      } finally {
        signal.removeEventListener("abort", arreter);
      }
    },
    /** Chemin à pied de `de` (la position) à `a` (la fin de la marche en cours), parti maintenant (spec 20). */
    marche(de: Point, a: Point): Promise<ResultatApi<Etape | null>> {
      return appeler("/v1/marche", schemaReponseMarche.transform((r) => r.marche), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ de: { lat: de.lat, lon: de.lon }, a: { lat: a.lat, lon: a.lon } }),
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
    case "hors_zone":
      return `${echec.points.length === 2 ? "Le départ et l'arrivée sont" : echec.points[0] === "depart" ? "Le départ est" : "L'arrivée est"} hors de la zone couverte : Itinhero ne connaît que la France métropolitaine et la Corse.`;
  }
}
