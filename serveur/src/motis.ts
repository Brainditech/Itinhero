import { construireUrlPlan, lireMotis, type DemandeRecherche, type Point } from "./itineraires/motis-plan.js";
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
};

export function moteurMotis(motisUrl: string): Moteur {
  return {
    plan: (d) => lireMotis(construireUrlPlan(motisUrl, d), 30_000),
    geocoder: (t, p) => lireMotis(construireUrlGeocode(motisUrl, t, p), 5_000),
  };
}
