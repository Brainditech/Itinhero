import * as Sentry from "@sentry/node";

import { nettoyerEvenement, nettoyerMiette } from "./nettoyage.js";

/**
 * Spec 50 (D131) : Sentry démarre seulement si `SENTRY_DSN_SERVEUR` est fourni.
 * Rien de personnel ne part (invariant 10) : `dataCollection` tout à faux
 * (la doc de @sentry/node 11 dit que requêtes d'URL et corps partent par défaut), nettoyage avant envoi, aucune trace.
 * Rend true si Sentry a démarré.
 */
export function initSentry(env: NodeJS.ProcessEnv = process.env): boolean {
  const dsn = env.SENTRY_DSN_SERVEUR?.trim();
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: env.SENTRY_ENVIRONNEMENT?.trim() || "dev",
    // @sentry/node 11 n'a plus `sendDefaultPii` : `dataCollection` le remplace (types installés).
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
    },
    beforeSend: (evenement) => nettoyerEvenement(evenement),
    beforeBreadcrumb: (miette) => nettoyerMiette(miette),
  });
  return true;
}

export { Sentry };
