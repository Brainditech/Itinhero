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
