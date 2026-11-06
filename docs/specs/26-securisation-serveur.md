# Spec 26 — Sécurisation du serveur (phase 9, ce qui se prouve par le code)

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (« implement tous les specs … jusqu'à voir toutes les phases implémentées », 2026-11-06), comme les specs 19 et 22. Règle : D104. **Appliquée** sur `phase-9/securisation`.
- **Branche** : `phase-9/securisation`.
- **Cases de PLAN.md** (phase 9) : « Route `/health` », « Journaux serveur sans donnée personnelle », « Chaque entrée validée par un schéma Zod », « En-têtes HTTP de sécurité », « Secrets lus seulement dans l'environnement, refus de démarrer sans eux », « Conteneurs sans utilisateur root, avec healthcheck ».
- **Hors de cette spec** : la limite et le plafond des routes qui appellent Claude (il n'y en a pas encore : la case se coche avec `POST /v1/comprendre`), Sentry, dev et prod séparés (phase 10, VPS).
- **Invariants** : 8, 9, 10, 11, 17.

## 1. But

La phase 9 demande des preuves de sécurité. Une partie existe déjà, éparpillée dans les tests de chaque route ; il manque les en-têtes HTTP de sécurité et un test transverse qui oblige toute route future à refuser une entrée invalide et à garder les journaux propres.

## 2. Doc lue

- Fastify 5 (version installée 5.12.8) : hooks `onSend` et `onRoute`, héritage des hooks par les plugins enfants (https://fastify.dev/docs/v5.x/Reference/Hooks/, lu le 2026-11-06).
- OWASP HTTP Headers Cheat Sheet (en-têtes recommandés pour une API JSON), lu le 2026-11-06.

## 3. Décision D104

1. Sept en-têtes fixes sur toute réponse, y compris les erreurs (400, 401, 404, 413, 429, 5xx), posés par un hook `onSend` à la racine (`serveur/src/securite.ts`) :
   - `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` ;
   - `X-Content-Type-Options: nosniff` ;
   - `X-Frame-Options: DENY` ;
   - `Referrer-Policy: no-referrer` ;
   - `Cross-Origin-Resource-Policy: same-origin` ;
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (ignoré en HTTP, utile sur le VPS) ;
   - `Cache-Control: no-store` (une réponse porte des horaires du moment ou des lieux) ;
   - et jamais `X-Powered-By`.
2. Un test transverse (`serveur/src/securite.test.ts`) relève les routes déclarées (hook `onRoute`) : une route sans entrée invalide dans sa table fait échouer le test.
3. Le test canari couvre toutes les routes de `/v1` (lieu, coordonnées, identifiant de course, clé, corps illisible, requête sans clé).

## 4. Options écartées

- `@fastify/helmet` : une dépendance de plus à suivre pour sept en-têtes fixes, et ses réglages par défaut visent des pages HTML.
- CORS : l'app Android n'en a pas besoin ; aucune origine navigateur n'est servie, donc aucun en-tête `Access-Control-*`.

## 5. Critères d'acceptation

1. Les sept en-têtes sont présents, et `X-Powered-By` absent, sur `/health` (200), une 400, une 401, une 404, une 413, une 429 et une 503 (test).
2. Chaque route déclarée a son entrée invalide ⇒ 400 `requete_invalide`, sans recopier la valeur ; une route sans cas fait échouer le test (test).
3. Aucun journal ne contient de lieu, de coordonnées, d'identifiant de course, la clé ni un corps illisible, sur toutes les routes de `/v1` (test canari).
4. `GET /health` : 200 quand MOTIS répond, 503 sinon, sans clé (test existant `serveur/src/routes/health.test.ts`).
5. Le serveur refuse de démarrer sans secret ou avec un secret mal formé, sans recopier sa valeur (test existant `serveur/src/env.test.ts`).
6. `docker inspect` des conteneurs `api` et `motis` : utilisateur non root et healthcheck.

## 6. Vérification

- `cd serveur && npm test` et `npm run typecheck`.
- `docker inspect itinhero-national-api-1 itinhero-national-motis-1 --format '{{.Name}} User={{.Config.User}} HC={{json .Config.Healthcheck.Test}}'`.

## 7. Constats

- 2026-11-06 : `npm test` (serveur) vert, 26 fichiers, `securite.test.ts` 7 tests.
- 2026-11-06, `docker inspect` sur le PC : `/itinhero-national-api-1 User=node HC=["CMD","node","-e","fetch('http://127.0.0.1:3000/health')…"] Image=itinhero-api:0.1.0` ; `/itinhero-national-motis-1 User=motis HC=["CMD","wget","-q","-O","/dev/null","http://127.0.0.1:8080/api/v1/health"] Image=ghcr.io/motis-project/motis:2.11.4`. `motis-import` est un conteneur ponctuel (`restart: "no"`), sans service à surveiller.
