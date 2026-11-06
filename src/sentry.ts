import * as Sentry from "@sentry/react-native";

import { nettoyerEvenement, nettoyerMiette } from "@/domaine/sentry-nettoyage";

/**
 * Spec 50 (D131) : Sentry démarre seulement si `EXPO_PUBLIC_SENTRY_DSN` est fourni au build.
 * Rien de personnel ne part (invariant 10) : nettoyage avant envoi, replay à l'erreur seulement, tout masqué.
 * Expo n'inline la variable qu'écrite en toutes lettres.
 */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const sentryActif = !!DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? "dev" : "prod",
    sendDefaultPii: false,
    beforeSend: (evenement) => nettoyerEvenement(evenement),
    beforeBreadcrumb: (miette) => nettoyerMiette(miette),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1,
    integrations: [
      Sentry.mobileReplayIntegration({
        maskAllText: true,
        maskAllImages: true,
        maskAllVectors: true,
        // La carte montre où l'on est : masquée aussi par sa classe native, en plus de <Sentry.Mask>.
        maskedViewClasses: ["org.maplibre.android.maps.MapView"],
      }),
    ],
  });
}

export { Sentry };
