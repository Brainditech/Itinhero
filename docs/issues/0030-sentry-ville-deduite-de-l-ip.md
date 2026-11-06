# Issue 0030 — Sentry déduit la ville de l'adresse IP

- **Date** : 2026-11-07
- **État** : analyse à approuver par Brainditech ; correction non commencée.
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

## 4. Correction proposée (à approuver)

- **A, dans Sentry (recommandée, immédiate)** : règle d'Advanced Data Scrubbing de l'organisation `[Remove] [Anything] from [$user.geo.**]`. Elle couvre l'app et le serveur, sans build. C'est un réglage du compte : Claude le pose dans Chrome avec l'accord de Brainditech.
- **B, dans le code (défense en plus)** : au démarrage de Sentry, `Sentry.setUser({ ip_address: null })` côté serveur ; côté app, l'équivalent permis par le SDK React Native installé, vérifié dans ses types avant d'écrire. Test : `initSentry` pose l'utilisateur sans IP.

## 5. Test de régression

- A : nouvel événement envoyé ⇒ JSON sans `user.geo`.
- B : test vitest de l'initialisation (serveur et app).

## 6. Constat

À faire après la correction.
