# Issue 0020 — L'API plante sur les grosses réponses de MOTIS : « Le serveur ne répond pas »

- **Date** : 2026-11-05
- **État** : **corrigée** le 2026-11-05 (correction approuvée par Brainditech : « corrige ça de manière définitive », D89).
- **Branche** : `issue/0020-api-plante-grosses-reponses-motis`

## 1. Reproduction

- Sur le téléphone : Départ « Saint-Michel-sur-Orge (91240) », Arrivée « Basilique de Saint-Denis » (arrêt), jeudi 12/11, arriver avant 10:00, marge 10 min ⇒ « Le serveur ne répond pas. ». « Réessayer » le 2026-11-05 à 13:19:22 ⇒ le conteneur `itinhero-national-api-1` redémarre avant 13:19:27 (`RestartCount` 7 ⇒ 8).
- Le conteneur a redémarré 8 fois depuis le matin (sortie 1, pas de manque de mémoire : `OOMKilled=false`), dont 11:41:35, 11:41:41, 11:43:37, 11:43:48, 11:43:54, 11:53:20, 12:13:21 et 13:19. Le message du premier lancement de la journée (« serveur introuvable ») vient de la même cause, ou du tunnel `adb reverse` perdu.
- Journal du conteneur à chaque fois :

```
AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  assert(!this.paused)
    at Parser.finish (node:internal/deps/undici/undici:6229:9)
    at Socket.<anonymous> (node:internal/deps/undici/undici:6563:36)
    at endReadableNT (node:internal/streams/readable:1698:12)
Node.js v22.23.4
```

L'erreur sort de undici, le client HTTP de `fetch` dans Node, hors de toute promesse : rien ne peut l'attraper, le processus s'arrête, Docker le relance (`restart: unless-stopped`), et la requête en cours est perdue.

## 2. Hypothèses, une à la fois

1. **La sonde `/health` (écartée).** `sondeMotis` ([serveur/src/motis.ts](../../serveur/src/motis.ts)) ne lit jamais le corps de la réponse, et Docker appelle `/health` toutes les 10 s. Essai : 89 sondes en 3 min avec la même image `node:22.23.4-alpine3.24`, corps non lu ⇒ aucun plantage.
2. **Les grosses réponses de MOTIS, lues en parallèle (vérifiée).** Voir §3.

## 3. Cause racine (vérifiée)

- MOTIS v2.11.4 répond **sans `Content-Length` ni `Transfer-Encoding: chunked`** (en-têtes constatés par `curl -D -`, avec ou sans `Accept-Encoding: gzip`) : la fin du corps n'est signalée que par la fermeture de la connexion.
- Pour ce trajet, `/api/v6/plan` avec `detailedLegs=true` rend **1,7 Mo**, et **6,1 Mo** avec le taxi au début (D80). La route `/v1/itineraires` lance plusieurs de ces recherches en même temps (sans taxi, taxi au début, taxi à la fin, D81).
- Quand undici reçoit un gros corps plus vite qu'il n'est lu, il met sa lecture en pause ; si la fermeture de la connexion arrive pendant cette pause, `Parser.finish` échoue sur `assert(!this.paused)`. Les trajets de l'Yonne rendent des réponses plus petites, d'où un plantage surtout sur les trajets d'Île-de-France.
- **Reproduit sans l'API**, dans l'image du serveur, sur le réseau Docker de MOTIS : 3 appels `fetch` en parallèle aux trois recherches de ce trajet, `await reponse.json()` ⇒ même `AssertionError`, dès le premier tour.
- **Contre-essai** : les mêmes 3 appels lus par `http.get` (module `node:http`) ⇒ 5 tours sur 5 sans plantage (28, 57 et 25 itinéraires lus).

## 4. Correction (approuvée, D89)

Lire MOTIS par `node:http` au lieu de `fetch`, dans la seule fonction qui l'appelle : `lireMotis` ([serveur/src/itineraires/motis-plan.ts](../../serveur/src/itineraires/motis-plan.ts)), utilisée par la recherche, le géocodeur MOTIS et la course. Même contrat qu'aujourd'hui : délai (`delaiMs`), `ErreurMotis` sans l'URL complète (invariant 10), JSON validé ensuite par Zod (invariant 9). `sondeMotis` passe aussi par là (le corps est lu, puis jeté).

Les appels à l'IGN (`https://data.geopf.fr`) utilisent aussi `lireMotis` : ils passeraient par `node:https`, ce qui couvre le même risque si l'IGN répondait de la même façon.

Options écartées :
- `Accept-Encoding: gzip` : MOTIS compresse, mais termine toujours par la fermeture (constaté) ;
- une autre version d'undici en dépendance : ajout de paquet, et rien ne montre que le défaut y est corrigé ;
- un mandataire (nginx) devant MOTIS pour ajouter `Content-Length` : un conteneur de plus pour un défaut de client ;
- attraper l'erreur (`process.on("uncaughtException")`) : la requête resterait perdue, et le processus dans un état douteux.

## 5. Test de régression prévu

`serveur/src/itineraires/motis-http.test.ts` (nouveau) : un petit serveur `node:http` local qui répond comme MOTIS (sans `Content-Length` ni `chunked`, 5 Mo de JSON, connexion fermée à la fin), lu 3 fois en parallèle par `lireMotis`. Le test doit faire planter le processus de test sur le code actuel (`fetch`), et passer après. Plus le contre-essai du §3 rejoué par Claude, puis la recherche du §1 refaite sur le téléphone.

Écart avec ce plan, constaté en écrivant le test : **aucun faux serveur ne fait planter `fetch`**, même en rejouant les octets exacts enregistrés de MOTIS (en-têtes compris), dans un autre conteneur, avec ou sans délai, en parallèle ou non, ni avec un fil principal occupé pendant l'arrivée du corps. Un simple relais TCP en Node branché sur le vrai MOTIS, lui, plante dès le premier tour, et sur le même relais branché sur le faux serveur, rien. Le déclencheur tient donc au comportement TCP de MOTIS, pas aux octets. De plus, le Node de l'hôte (22.14.0, undici 6.21.1) ne plante pas même contre le vrai MOTIS : le défaut est celui d'undici 6.29.1 (Node 22.23.4, image du serveur et CI). Le test `motis-http.test.ts` fixe donc le contrat de `lireMotis` sur des réponses de la forme de MOTIS ; la preuve du plantage et de sa disparition est faite contre le vrai MOTIS (§6).

## 6. Correction et preuves

- `serveur/src/itineraires/motis-http.ts` (nouveau) : `lireHttp(url, delaiMs)` lit le corps entier par `node:http` ou `node:https` ; le délai couvre toute la lecture ; un corps interrompu (délai, connexion coupée avant la fin) est rejeté, jamais rendu tronqué.
- `lireMotis` (`motis-plan.ts`) et `sondeMotis` (`motis.ts`) passent par `lireHttp`. Mêmes messages d'`ErreurMotis`, sans la requête de l'URL (invariant 10). Les outils `audit/quais.ts` et `comparaison/consignes-marches.ts`, qui lisaient aussi MOTIS par `fetch`, passent par `lireMotis`. Il ne reste aucun `fetch` vers MOTIS ni l'IGN (`donnees/telecharger.ts` télécharge les jeux de données, pas MOTIS).
- Test `serveur/src/itineraires/motis-http.test.ts` (6 tests) : 3 corps de 5 Mo sans longueur, terminés par la fermeture, lus en parallèle 5 tours ; statut 500 ; JSON illisible ; serveur absent ; aucune réponse avant le délai ; corps commencé puis bloqué. Serveur : 209 tests verts, types verts.
- **Avant / après contre le vrai MOTIS** (image `node:22.23.4-alpine3.24`, réseau `itinhero-national_default`, les 3 recherches du trajet du §1 : sans taxi, taxi au début, taxi à la fin) : avec `fetch`, `AssertionError` dès le premier tour (une seule recherche avec taxi suffit) ; avec `lireMotis` compilé, 10 tours sur 10 (13, 22 et 13 itinéraires).
- **Dans le conteneur de l'API reconstruit** (`docker compose -p itinhero-national … up -d --build --no-deps api`) : `moteurMotis(…).plan` sur les 3 recherches, 5 tours ⇒ 16, 28 et 13 itinéraires à chaque tour, `RestartCount` 0.
- IGN par `node:https` : recherche « basilique saint-denis » (6 résultats) et adresse inverse (1 résultat) lues.
- **Sur le téléphone (2026-11-05, 14:07, par Claude via `adb`, capture hors dépôt, D38)** : Saint-Michel-sur-Orge (arrêt) → Basilique de Saint-Denis, jeudi 12/11 arriver avant 10:00 ⇒ Résultat « Possible », départ 07:49, 07:49 → 09:03 (RER C, métro 14, métro 13) et 07:49 → 09:10 (RER C, métro 13) ; `RestartCount` de l’API resté à 0, aucune erreur dans ses journaux.
