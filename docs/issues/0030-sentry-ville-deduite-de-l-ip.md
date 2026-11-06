# Issue 0030 — Sentry déduit la ville de l'adresse IP

- **Date** : 2026-11-07
- **État** : **corrigée** le 2026-11-07 (analyse approuvée par Brainditech : « je prends ta recommandation », A et B) ; constat serveur fait, constat app avec l'erreur volontaire de l'app.
- **Branche** : `etapes/sentry-dsn`. Spec : 50 (D131). Invariant : 10 (rien de personnel dans Sentry).

## 1. Reproduction

1. DSN du projet `itinhero-serveur` dans `.env`, API nationale recréée.
2. Dans le conteneur de l'API, une erreur envoyée par `initSentry()` puis `Sentry.captureException(...)`.
3. Sentry, événement reçu (ITINHERO-SERVEUR-1, puis ITINHERO-SERVEUR-2 après le réglage) : JSON de l'événement ⇒ `"user":{"geo":{"country_code":"FR","city":"Argenteuil","subdivision":"Île-de-France","region":"France"}}`, sans `ip_address`.

Le nettoyage marche par ailleurs : lieu cité ⇒ `«…»`, coordonnées ⇒ `[coord]`, requête d'URL retirée, `extra` retiré. Aucune variable locale dans les frames (`includeLocalVariables` absent ; `local-variables-async.js` ne capture rien sans lui).

## 2. Hypothèse (une seule, vérifiée)

La ville est calculée par Sentry à la réception, à partir de l'adresse IP de la connexion, et le réglage d'organisation « Prevent Storing of IP Addresses » (activé avec l'accord de Brainditech le 2026-11-07) n'y change rien.

Vérifiée :

- Constat : 2e événement envoyé après l'activation du réglage ⇒ `ip_address` absent, `user.geo` toujours présent.
- Doc Sentry, « Server-Side Data Scrubbing » (lue le 2026-11-07) : l'information géographique est tirée de l'IP, « even if the setting to stop storing IP addresses is turned on » ; pour la retirer, une règle d'Advanced Data Scrubbing `[Remove] [Anything] from [$user.geo.**]`.
- Doc Sentry Node, « Data Collected » : avec `ip_address: null` dans `Sentry.setUser()`, l'IP n'est pas déduite. Doc React Native : l'IP est déduite par Sentry à la réception, sauf si `setUser({ ip_address: … })` la fixe.

## 3. Cause racine

`beforeSend` supprime `user` côté SDK, mais la ville est ajoutée **après**, par Sentry, à la réception. Côté serveur, c'est la ville du PC ou du VPS. Côté app, ce serait la ville approximative du téléphone, donc une donnée personnelle (invariant 10).

## 4. Correction (approuvée le 2026-11-07)

- **A, dans Sentry (recommandée, immédiate)** : règle d'Advanced Data Scrubbing de l'organisation `[Remove] [Anything] from [$user.geo.**]`. Elle couvre l'app et le serveur, sans build. C'est un réglage du compte : Claude le pose dans Chrome avec l'accord de Brainditech.
- **B, dans le code (défense en plus)** : l'utilisateur envoyé ne dit pas d'où vient l'erreur.

Appliqué :

- A : règle posée le 2026-11-07 dans l'organisation (Settings > Security & Privacy > Advanced Data Scrubbing).
- B : essai avant d'écrire (2026-11-07, deux événements envoyés depuis le conteneur) : `user: { ip_address: null }` ⇒ ville **encore** déduite (puis retirée par A) ; `user: { ip_address: "0.0.0.0" }` ⇒ **aucune** ville déduite, l'IP fictive effacée par « Prevent Storing of IP Addresses ». Donc `nettoyerEvenement` (app `src/domaine/sentry-nettoyage.ts` et serveur `serveur/src/sentry/nettoyage.ts`) remplace `user` par `{ ip_address: IP_FICTIVE }` (`"0.0.0.0"`) au lieu de le supprimer.

## 5. Test de régression

- A : nouvel événement envoyé ⇒ JSON sans `user.geo`.
- B : `sentry-nettoyage.test.ts` (app) et `nettoyage.test.ts` (serveur), « issue 0030 » : l'utilisateur sort égal à `{ ip_address: "0.0.0.0" }`, sans `{{auto}}`.

## 6. Constat

2026-11-07 :

- A seule : événement `054f5f06…` ⇒ `user.geo` à `null`, `_meta` « rem organization:0 ».
- A et B, image de l'API reconstruite, erreur envoyée par `initSentry()` : événement `a1e43b51…` ⇒ `user` = `{ ip_address: null, sentry_user: "ip:[ip]" }`, **aucun champ `geo`**.
- Lint, types, tests : app 444, serveur 472, verts. Le test `envoi.test.ts` (faux Sentry local) a échoué une fois au premier lancement puis passé 6 fois : délai, sans lien avec l'IP.
- App : à constater avec l'erreur volontaire de l'app (Metro relancé avec le DSN).
