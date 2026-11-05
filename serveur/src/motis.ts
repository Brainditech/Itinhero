import { construireUrlCourse } from "./itineraires/motis-course.js";
import { construireUrlPlan, lireMotis, type DemandeRecherche, type Point } from "./itineraires/motis-plan.js";
import { planComplet, type AppelsMotis, type Cote } from "./itineraires/marche-couteuse.js";
import { construireUrlGeocode } from "./lieux/motis-geocode.js";
/** Accès à MOTIS (seul l'API Itinhero l'appelle, invariant 2). */
export type SondeMotis = () => Promise<boolean>;

/** Vrai si MOTIS répond 200 à `/api/v1/health` avant `delaiMs`. */
export function sondeMotis(motisUrl: string, delaiMs = 2000): SondeMotis {
  return async () => {
    try {
      const reponse = await fetch(new URL("/api/v1/health", motisUrl), {
        signal: AbortSignal.timeout(delaiMs),
      });
      return reponse.status === 200;
    } catch {
      return false;
    }
  };
}


/**
 * Moteur injecté dans l'application (spec 09) : la vraie version appelle MOTIS,
 * les tests de route lui substituent des réponses enregistrées. Rend le JSON brut,
 * validé ensuite par Zod dans la route (invariant 9).
 */
export type Moteur = {
  plan(demande: DemandeRecherche): Promise<unknown>;
  geocoder(texte: string, proche?: Point): Promise<unknown>;
  /** Tous les arrêts d'une course (spec 17) ; absent d'un moteur de test ⇒ 503. */
  course?(id: string): Promise<unknown>;
};

export function moteurMotis(motisUrl: string): Moteur {
  const appels = appelsMotis(motisUrl);
  return {
    // Recherche ordinaire, complétée si une marche courte est masquée par son coût (issue 0008, D62).
    plan: (d) => planComplet(appels, d),
    geocoder: (t, p) => lireMotis(construireUrlGeocode(motisUrl, t, p), 5_000),
    course: (id) => lireMotis(construireUrlCourse(motisUrl, id), 10_000),
  };
}

/** Appels de la règle des marches coûteuses ; paramètres de l'openapi.yaml du tag v2.11.4. */
export function appelsMotis(motisUrl: string): AppelsMotis {
  return {
    plan: (d) => lireMotis(construireUrlPlan(motisUrl, d), 30_000),
    aPied: (p, cote, instant, cout) => lireMotis(construireUrlAPied(motisUrl, p, cote, instant, cout), 5_000),
  };
}

/** `/api/v6/one-to-all` sans aucun transport : les arrêts atteints à pied, en minutes réelles. */
export function construireUrlAPied(motisUrl: string, p: Point, cote: Cote, instant: Date, cout: number): URL {
  const url = new URL("/api/v6/one-to-all", motisUrl);
  url.searchParams.set("one", `${p.lat},${p.lon}`);
  url.searchParams.set("time", instant.toISOString());
  url.searchParams.set("arriveBy", cote === "arrivee" ? "true" : "false");
  url.searchParams.set("transitModes", ""); // vide : aucun transport
  url.searchParams.set("maxTravelTime", String(Math.ceil(cout / 60))); // minutes
  url.searchParams.set(cote === "arrivee" ? "maxPostTransitTime" : "maxPreTransitTime", String(cout));
  return url;
}
