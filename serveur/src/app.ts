import Fastify, { LogController, type FastifyInstance, type FastifyRequest } from "fastify";
import { controlerAcces, type Acces } from "./acces/acces.js";
import type { Manifest } from "./manifest.js";
import type { Moteur, SondeMotis } from "./motis.js";
import { routeCourse } from "./routes/course.js";
import { routeEtatCourses } from "./routes/etat-courses.js";
import { routeHealth } from "./routes/health.js";
import { routeItineraires } from "./routes/itineraires.js";
import { routeLieux } from "./routes/lieux.js";
import { routeMarche } from "./routes/marche.js";
import { routeComprendre, type Claude } from "./routes/comprendre.js";
import { routeDiscussion } from "./routes/discussion.js";
import { routeAbonnements } from "./routes/abonnements.js";
import type { Abonnements } from "./abonnements/abonnements.js";
import { poserEntetesSecurite } from "./securite.js";
import type { AdresseInverse, GeocodeurIgn } from "./lieux/ign-geocode.js";
import type { IndexHoraires } from "./itineraires/horaires-gtfs.js";
import type { IndexLieux } from "./lieux/categories.js";

export type Dependances = {
  manifest: Manifest;
  sonde: SondeMotis;
  moteur: Moteur;
  acces: Acces;
  /** Géocodeur de l'IGN (D60) ; absent ⇒ MOTIS seul. */
  geocodeurIgn?: GeocodeurIgn;
  /** Lieux d'OSM pour la recherche par catégorie (D61) ; absent ⇒ pas de recherche par catégorie. */
  lieux?: IndexLieux;
  /** Réservations et fins de validité des GTFS (D69) ; absent ⇒ inconnues. */
  horaires?: IndexHoraires;
  /** Adresse du point d'arrivée par l'IGN (issue 0010, C) ; absent ⇒ pas d'adresse. */
  adresseIgn?: AdresseInverse;
  /** Claude pour `/v1/comprendre` (spec 28) et `/v1/assistant/discussion` (spec 39) ; absent ⇒ 503, l'app passe au formulaire. */
  claude?: Claude;
  /** Table `abonnements_alerte` (spec 29) ; absente ⇒ 503 sur `/v1/abonnements`. */
  abonnements?: Abonnements;
  /** Horloge (les tests la fixent). */
  horloge?: () => Date;
  /** Flux du journal (les tests y capturent les lignes pour la chaîne canari). */
  fluxJournal?: { write(ligne: string): void };
};

/**
 * Application Fastify (D39). Rien de personnel dans les journaux (invariant 10) :
 * - journal des requêtes coupé ;
 * - une requête n'est décrite que par sa méthode et le MOTIF de sa route (`/v1/lieux`),
 *   jamais par son URL (`?q=` porte un lieu), ses en-têtes (la clé) ni son corps (des coordonnées) ;
 * - une erreur n'est journalisée que par son nom et son code.
 */
export function construireApp({
  manifest,
  sonde,
  moteur,
  acces,
  geocodeurIgn,
  lieux,
  horaires,
  adresseIgn,
  claude,
  abonnements,
  horloge,
  fluxJournal,
}: Dependances): FastifyInstance {
  const app = Fastify({
    logger: {
      level: "info",
      ...(fluxJournal ? { stream: fluxJournal } : {}),
      // Le message d'une erreur n'est pas écrit : celui d'un JSON illisible cite le corps reçu.
      serializers: {
        req: (r: FastifyRequest) => ({ method: r.method, route: r.routeOptions?.url ?? null }),
        err: (e: Error & { code?: string; statusCode?: number }) => ({
          type: e.name,
          code: e.code ?? null,
          statusCode: e.statusCode ?? null,
        }),
      } as never,
    },
    logController: new LogController({ disableRequestLogging: true }),
  });

  app.setErrorHandler((erreur: Error & { statusCode?: number; code?: string }, requete, reponse) => {
    const code = erreur.statusCode && erreur.statusCode >= 400 ? erreur.statusCode : 500;
    requete.log.error({ err: erreur }, "erreur de requête");
    if (code === 413) return reponse.code(413).send({ erreur: "corps_trop_grand" });
    if (code < 500) return reponse.code(code).send({ erreur: "requete_invalide", champs: [] });
    return reponse.code(500).send({ erreur: "erreur_interne" });
  });

  poserEntetesSecurite(app);
  routeHealth(app, manifest, sonde);
  app.register(
    async (v1) => {
      controlerAcces(v1, acces);
      routeLieux(v1, moteur, geocodeurIgn, lieux);
      routeItineraires(v1, moteur, manifest, { horaires, adresse: adresseIgn });
      routeCourse(v1, moteur);
      routeEtatCourses(v1, moteur);
      routeMarche(v1, moteur, manifest);
      routeComprendre(v1, claude);
      routeDiscussion(v1, claude, horloge);
      routeAbonnements(v1, abonnements, horloge);
    },
    { prefix: "/v1" },
  );
  return app;
}
