# Spec 29 — Abonnements d'alerte : table, routes, purge à J+1

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (« implement tous les specs … jusqu'à voir toutes les phases implémentées », 2026-11-06). Règle : D107. **Appliquée** sur `phase-7/abonnements`.
- **Branche** : `phase-7/abonnements`.
- **Case de PLAN.md** : phase 7, « `abonnements_alerte`, routes, purge ».
- **Hors de cette spec** : le GTFS-RT, `suivi-retards`, l'envoi Expo Push (jeton d'accès, FCM), Inngest et l'abonnement depuis l'app : ils demandent des secrets et un build (phase 7, suite).
- **Invariants** : 6 (seule table persistante, purgée à J+1), 8, 9, 10, 17 (le conteneur reste en `node`).

## 1. But

Pour prévenir d'un retard ou d'une suppression (D21, D51), le serveur doit savoir quelles courses surveiller et quel téléphone prévenir, sans rien garder de personnel, et l'oublier dès que le voyage est passé.

## 2. Doc lue

- Node 22 `node:sqlite` (`DatabaseSync`, `prepare`, `run().changes`, tables `STRICT`), https://nodejs.org/docs/latest-v22.x/api/sqlite.html, lu le 2026-11-06. Module encore « expérimental » (avertissement au démarrage), sans option à passer depuis Node 22.13 ; constaté dans l'image `node:22.23.4-alpine3.24`.
- Expo, `expo-notifications` SDK 58 : forme du jeton Expo Push `ExponentPushToken[…]`.

## 3. Décision D107

1. **Table** `abonnements_alerte` (SQLite, `STRICT`) : `id` (128 bits aléatoires en hexadécimal), `trip_id`, `date_service`, `jeton_push`, `expiration`. Rien d'autre : ni lieu, ni coordonnées, ni demande, ni clé d'appareil.
2. **Expiration** : fin du lendemain du jour de service, heure de Paris (minuit de J+2). **Purge** au démarrage puis chaque heure (un minuteur du serveur, en attendant la tâche Inngest `purge-abonnements`).
3. **Fichier** : `ABONNEMENTS_SQLITE` (facultative), sur le volume `abonnements` monté en `/var/lib/itinhero`, dossier créé à l'utilisateur `node` dans l'image. Absente ⇒ table en mémoire, avec un avertissement.
4. **Routes** (clé d'appareil et limites de `/v1`) :
   - `POST /v1/abonnements` `{ trip_id, date_service, jeton_push }` : `trip_id` au format d'une course MOTIS (comme `/v1/course`), jour de service entre hier et J+60, jeton Expo Push. ⇒ 201 `{ id, expiration }`. Au-delà de 5 000 lignes ⇒ 503.
   - `DELETE /v1/abonnements/:id` ⇒ 204, qu'il ait existé ou non (on ne révèle rien).
5. Rien de ces requêtes ne va au journal.

## 4. Options écartées

- `better-sqlite3` : module natif à compiler dans l'image ; `node:sqlite` est déjà dans Node 22.
- Purge par Inngest dès maintenant : Inngest n'est pas encore installé ; le minuteur sera remplacé par la tâche.
- Un abonnement par voyage plutôt que par course : `suivi-retards` lit le temps réel course par course.

## 5. Critères d'acceptation

1. Colonnes exactement `id, trip_id, date_service, jeton_push, expiration` (`serveur/src/routes/abonnements.test.ts`).
2. Expiration à la fin de J+1 heure de Paris (heure d'été, d'hiver, jour du changement) ; purge à cet instant, pas avant (test).
3. POST ⇒ 201 avec un identifiant de 32 caractères hexadécimaux ; DELETE ⇒ 204 et la ligne disparaît ; DELETE inconnu ⇒ 204 (test).
4. Entrée invalide (course, jeton, date impossible, passée, trop lointaine, champ en plus) ⇒ 400, rien n'est gardé (test).
5. Identifiant mal formé ⇒ 400 ; sans clé ⇒ 401 ; table absente ⇒ 503 (test).
6. Ni la course ni le jeton dans les journaux (test canari).
7. Dans l'image : utilisateur `node`, `/var/lib/itinhero` à `node`, table créée sur le fichier (constat `docker run`).

## 6. Constats

- 2026-11-06 : critères 1 à 6 verts (`cd serveur && npm test`).
- 2026-11-06 : image construite (`docker build`), `id` ⇒ `uid=1000(node)`, `/var/lib/itinhero` à `node:node`, table créée sur `/var/lib/itinhero/abonnements.sqlite`, expiration `2026-11-13T23:00:00.000Z` pour le 12/11 ; `docker compose … config -q` valide.
