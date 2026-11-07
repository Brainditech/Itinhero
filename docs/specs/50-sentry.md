# Spec 50 — Sentry dans l'app et sur le serveur, sans donnée de trajet

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (D119, étape 15 « Sentry » ; demande du 2026-11-06 : « implémente les specs une fois que les tests sont ok sur adb »). Règle : D131. Remplace la spec 07, jamais versionnée. **Appliquée** le 2026-11-06 (critères 1 à 3) ; critère 4 constaté le 2026-11-06 (§6) ; critère 5 constaté le 2026-11-07 avec les DSN (ITINHERO-SERVEUR-1 à 3, ITINHERO-APP-1 et son replay masqué ; ville déduite de l'IP corrigée par l'issue 0030, D132).
- **Branche** : `phase-0/sentry`.
- **Case de PLAN.md** : Phase 0 · « Sentry installé dans l'app et sur le serveur, sans donnée de trajet » (preuve : configuration, plus test du nettoyage `beforeSend`). Prépare sans les cocher : Phase 9 · « Erreur volontaire vue dans Sentry », « Replay Sentry masqué » ; Phase 8 · « événement Sentry » de l'ingestion (spec 44). Ces trois-là demandent les DSN de Brainditech.
- **Invariants** : 10 (rien de personnel dans les journaux ni Sentry, replay jamais démasqué), 17 (dev et prod ne partagent pas d'environnement Sentry), 2 (aucun secret dans l'app : le DSN n'est pas un secret).

## 1. But

D19 : voir les plantages de l'app et du serveur, les pannes de MOTIS et les échecs d'ingestion, **sans jamais** envoyer le texte d'une demande, un lieu, des coordonnées ni le domicile.

## 2. Versions et documentation lues

- App : `@sentry/react-native` **8.28.0**, choisie par `npx expo install` (version alignée sur le SDK 58).
- Serveur : `@sentry/node` **11.11.0** (Node 22.14 accepté : `>=22.12.0 <23.0.0`).
- Lues le 2026-11-06 : guide Expo « Using Sentry », guides Sentry « Expo », « Session Replay » (React Native), « Fastify » ; puis, pour ce que ces pages ne disent pas, le code installé : `plugin/build/withSentry.js` et `sentry.gradle.kts` (option `disableAutoUpload`), `replay/mobilereplay.d.ts` (masquage), `core/build/types/types/datacollection.d.ts` (`dataCollection`).

## 3. Ce qui change (D131)

### 3.1 Sans DSN, rien ne part

Sentry ne démarre que si son DSN est fourni : `EXPO_PUBLIC_SENTRY_DSN` (app, lu au build) et `SENTRY_DSN_SERVEUR` (serveur). Vide ⇒ aucun envoi, aucun avertissement bloquant. Environnement : `SENTRY_ENVIRONNEMENT` (`dev` sur le PC, `prod` sur le VPS) pour le serveur ; `__DEV__` ⇒ `dev`, sinon `prod` pour l'app.

### 3.2 Nettoyage avant envoi (le cœur de la spec)

Une fonction pure par côté, testée : `nettoyerEvenement` (`beforeSend`) et `nettoyerMiette` (`beforeBreadcrumb`).

1. `user`, `request.data`, `request.cookies`, `request.headers`, `request.query_string`, `extra` sont retirés. L'URL de `request` est réduite à son chemin, sans requête (`/v1/itineraires`).
2. Dans tout texte gardé (message, valeur d'exception, message de miette) : tout passage entre guillemets (« … » ou "…") est masqué, car nos messages y citent le texte saisi ; toute requête d'URL (`?…`) est retirée ; tout nombre décimal à 4 chiffres ou plus après la virgule devient `[coord]` (une coordonnée GPS) ; toute adresse électronique devient `[courriel]`.
3. Miettes : celles de la console (`console`) sont **supprimées** (elles peuvent contenir une phrase ou un lieu) ; celles du réseau (`http`, `fetch`, `xhr`) ne gardent que méthode, code de réponse et chemin sans requête ; celles de navigation ne gardent que le nom de l'écran sans paramètres.
4. Les contextes techniques (appareil, système, version de l'app) sont gardés.

### 3.3 App

- `src/sentry.ts` : `Sentry.init` avec `sendDefaultPii: false`, `beforeSend`, `beforeBreadcrumb`, aucune trace de performance (`tracesSampleRate` absent), replay **seulement à l'erreur** (`replaysSessionSampleRate: 0`, `replaysOnErrorSampleRate: 1`) avec `mobileReplayIntegration({ maskAllText: true, maskAllImages: true, maskAllVectors: true, maskedViewClasses: ["org.maplibre.android.maps.MapView"] })`.
- Les trois cartes (Accueil, Étape, Guidage) sont des `MLRNMapView`, sous-classe de `org.maplibre.android.maps.MapView` : `maskedViewClasses` masque une classe **et ses sous-classes** (type installé), donc un replay ne montre jamais où l'on est. `<Sentry.Mask>` n'est pas utilisé : il faudrait envelopper trois écrans, et sans le build à jour il ne masque rien et affiche un avertissement.
- `src/app/_layout.tsx` : `Sentry.wrap(RootLayout)`.
- `app.json` : plugin `["@sentry/react-native", { "disableAutoUpload": true }]`. Le build local ne dépend d'aucun compte ni jeton Sentry ; l'envoi des source maps (organisation, projet, `SENTRY_AUTH_TOKEN`, `getSentryExpoConfig` dans `metro.config.js`) viendra avec la version finale (phase 10), quand le compte existera.
- Le module natif s'ajoute : **le development build est à refaire** (il l'est déjà pour les specs 30, 42 et 45).

### 3.4 Serveur

- `serveur/src/sentry/init.ts` : `initSentry()` avec `dataCollection` tout à faux (`@sentry/node` 11 n'a plus `sendDefaultPii`, que `dataCollection` remplace) (`userInfo`, `cookies`, `httpHeaders`, `urlQueryParams`, `httpBodies: []`, `genAI` entrées et sorties, `graphQL`), `beforeSend`, `beforeBreadcrumb`, aucune trace.
- `serveur/src/instrument.ts`, chargé avant tout par `node --import ./dist/instrument.js dist/index.js` (script `start` et `CMD` du Dockerfile) ; `docker-compose.yml` passe `SENTRY_DSN_SERVEUR` et `SENTRY_ENVIRONNEMENT` à l'API (vides par défaut).
- Erreurs envoyées : toute réponse 500 du gestionnaire d'erreurs ; « moteur indisponible » (MOTIS injoignable, 503) ; l'ingestion de nuit qui garde un ancien jeu, en écarte un ou s'arrête sur une erreur (un message par nuit, avec les étiquettes des jeux et la raison, jamais un lieu de personne).

## 4. Critères d'acceptation

1. `src/domaine/sentry-nettoyage.test.ts` et `serveur/src/sentry/nettoyage.test.ts` : un événement chargé (phrase « rendez-vous gare de Joigny », coordonnées `47.9918, 3.6170`, URL `?q=Joigny&lat=…`, en-tête `authorization`, utilisateur, miette console) ressort sans aucun de ces éléments ; la pile, le type d'erreur et le chemin restent.
2. Sans DSN : `initSentry()` ne démarre pas Sentry (test) ; l'app et le serveur démarrent comme avant (tests existants verts).
3. `npx expo lint`, `npx tsc --noEmit`, `npm test` (app et serveur) verts ; CI verte.
4. Après le development build : l'app démarre comme avant sur le téléphone (constat par adb).
5. **Avec les DSN de Brainditech (plus tard)** : erreur volontaire vue dans Sentry côté app et serveur, puis retirée ; replay masqué ; aucun lieu dans les événements reçus (cases de la phase 9).

## 5. Options écartées

- **Sentry seulement sur le serveur** (D19 l'écartait déjà) : les plantages de l'app resteraient invisibles.
- **Replay de toutes les sessions** : inutile pour corriger un plantage, et plus de risque d'image sensible ; le replay à l'erreur suffit.
- **Traces de performance** : elles portent des URL et des durées par trajet ; hors besoin v1.
- **Envoi des source maps dès maintenant** : il faut le compte, l'organisation et un jeton ; sans eux, le build échouerait. `disableAutoUpload` jusqu'à la phase 10.
- **Compter sur `sendDefaultPii: false` seul** : la doc de `@sentry/node` 11 dit que les requêtes d'URL et les corps partent par défaut ; d'où `dataCollection` et le nettoyage maison.

## 6. Constats

- 2026-11-06, par adb, development build refait avec le module natif : l'app démarre comme avant (Accueil, carte), toute la passe des specs se fait sans plantage (critère 4, `docs/screenshots/passe/00-demarrage.png`).
- Corrigé pendant l'essai : sans DSN, `Sentry.wrap` enveloppait quand même l'app et Metro avertissait « App Start Span could not be finished. `Sentry.wrap` was called before `Sentry.init` » (bandeau LogBox en développement). `src/app/_layout.tsx` n'enveloppe plus que si Sentry est actif ; après rechargement, l'avertissement ne revient plus.
