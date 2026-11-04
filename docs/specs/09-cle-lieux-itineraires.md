# Spec 09 — Clé d'appareil, `GET /v1/lieux` et `POST /v1/itineraires` contre le MOTIS national

> Rédigée le 2026-11-04. État : **appliquée sur la demande de Brainditech (« corrige tous les problèmes possibles […] compare avec ce qui se fait de mieux sur internet […] et loop »), à relire dans la PR.** Les comparaisons avec Google Maps ont fait réviser la spec en cours d'application : **le §11 prime sur les §3 à §8** (D57 remplacée par D58 ; D59, D60, D61 ajoutées).
> Branche : `api/cle-lieux-itineraires`. Une seule PR.
> Décisions liées : D7, D14, D17, D44, D54, A19 ; nouvelles décisions D55, D56, D58, D59, D60, D61 (D57 remplacée). Invariants : 2, 4, 6, 8, 9, 10, 11, 12, 13, 15. Issues : 0007 (§6, test de régression), 0008 (Châtelet, §11).

## 1. But

Donner à l'app (spec 10) les deux routes qu'il lui faut pour afficher un vrai trajet, protégées par la clé d'appareil :
- `GET /v1/lieux?q=` : texte d'un lieu → candidats du géocodeur MOTIS ;
- `POST /v1/itineraires` : départ, arrivée, jour, heure, sens, marge → verdict et possibilités, chaque étape avec sa `source`.

Les deux routes tournent contre le MOTIS national du PC (spec 08). Le test de régression de l'issue 0007 (Brienon → Dijon) passe par la route, jamais par une requête directe à MOTIS.

Cases de PLAN.md visées :
- phase 1 : « Clé d'appareil (secure-store, saisie unique) et limites de débit côté serveur » : **côté serveur seulement** ; la saisie sur le téléphone (secure-store) vient avec la spec 10, la case reste donc ouverte, « fait à moitié » ;
- phase 2 : « `GET /v1/lieux` (géocodeur MOTIS) » ;
- phase 3 : « `POST /v1/itineraires` : normalisation de la réponse MOTIS en segments sourcés » ;
- phase 0 : « Vérification des variables d'environnement au démarrage » : avance côté serveur (trois variables de plus), reste ouverte (côté app, spec 10).

## 2. Ce qui est déjà constaté (2026-11-04, MOTIS national du PC)

| Constat | Source |
|---|---|
| Géocodeur : `GET /api/v1/geocode?text=…&language=fr` rend 10 candidats (`type` `ADDRESS`, `PLACE` ou `STOP`, `name`, `lat`, `lon`, `zip`, `areas[]` dont la commune marquée `default: true`). Paramètres `numResults`, `type`, `place` (biais vers une coordonnée) disponibles | `openapi.yaml` du tag v2.11.4, lu le 2026-11-04 ; appel au MOTIS national |
| « 19 route de Chamvres Joigny » ⇒ 1er candidat « Route de Chamvres », Joigny, 89300, à environ 260 m du lieu de rendez-vous ; le numéro 19 n'est pas trouvé (R4) | idem |
| « tribunal judiciaire Dijon » ⇒ « Cité Judiciaire », Dijon, seulement en **3e** position (Albi et Auch avant) : la confirmation de la phase 2 est indispensable | idem |
| Recherche « partir à » 06:00 le 12/11, Brienon Mairie → Cité judiciaire de Dijon, fenêtre jusqu'à minuit, paramètres du serveur : 11 possibilités en 1,2 s, dont 06:26 → 09:46 (K941, marche, P5, bus 10) et 08:24 → 10:43 (803, marche, K7, tram T2) | `/api/v6/plan`, `useRoutedTransfers=true` |
| « partir à » 08:00 : 10 possibilités en 1,0 s, la première est 08:24 → 10:43 par le 803 | idem |
| MOTIS ajoute **une possibilité du 13/11** (06:26 → 09:46) à la réponse d'une recherche du 12/11 : le filtre du serveur doit l'écarter (invariant 13) | idem |
| `tripId` rendu : `<date de service AAAAMMJJ>_<HH:MM>_<jeu>_<trip_id>` (ex. `20261112_08:25_r84072_1014608-1-1`) ; arrêt : `<jeu>_<stop_id>` | idem, et spec 05 §11 |
| Une étape rend aussi `agencyName`, `headsign`, et un champ `source` qui contient **le chemin du fichier sur le PC** (`/donnees/gtfs/r84072.zip/stop_times.txt:192:201`) : il ne doit jamais sortir de l'API | idem |
| Modes rendus : `WALK`, `BUS` (le car SNCF K941 aussi), `ODM` (la 856 de Mobigo, `pickup_type=2`), `REGIONAL_RAIL`, `TRAM` ; liste complète dans l'enum `Mode` de `openapi.yaml` | idem |
| Manifeste national : 516 GTFS, **aucun `feed_version`** (seulement `date_fichiers`) ; l'OSM a `date_fichiers: null` | `donnees/manifest.json` |

## 3. Décisions proposées (révisées au §11)

- **D55 — Clé d'appareil : 32 octets aléatoires, empreinte sha256 côté serveur.**
  - La clé est générée par Brainditech avec `npm run cle:nouvelle` (dans `serveur/`) : 32 octets de `crypto.randomBytes`, écrits en base64url (43 caractères). Le script affiche la clé (à saisir sur le téléphone, spec 10) et son empreinte (sha256 en hexadécimal, 64 caractères). Claude ne lance pas ce script et ne voit jamais une clé réelle.
  - `CLES_APPAREILS` = liste des empreintes séparées par des virgules. Révoquer un téléphone = retirer son empreinte et redémarrer l'API.
  - L'app l'envoie dans `Authorization: Bearer <clé>`. Le serveur calcule le sha256 de la clé reçue et le compare à chaque empreinte avec `crypto.timingSafeEqual`.
  - Raison : une fuite du `.env` ne donne aucune clé utilisable ; une clé de 256 bits n'a pas besoin d'un hachage lent.
  - Écartés : la clé en clair dans `.env` (fuite du `.env` = clé utilisable) ; bcrypt ou argon2 (lent à chaque requête, dépendance native, inutile pour une clé aléatoire) ; un jeton signé (JWT : révocation plus compliquée, rien à y mettre).
- **D56 — Limites de débit en mémoire, par empreinte, sur toutes les routes `/v1/`.**
  - Deux compteurs par empreinte : par minute d'horloge (`LIMITE_REQ_MINUTE`) et par jour de Paris (`LIMITE_REQ_JOUR`). Au-delà, 429 avec `Retry-After` (secondes jusqu'à la minute suivante, ou jusqu'à minuit heure de Paris).
  - Seules les clés valides sont comptées (une clé inconnue est refusée en 401 avant, et n'occupe pas de mémoire).
  - Les compteurs repartent à zéro au redémarrage de l'API : acceptable avec un seul processus (PC, puis un VPS) et quelques téléphones (D13).
  - Écartés : `@fastify/rate-limit` (une seule fenêtre par enregistrement, clé par adresse IP par défaut ; deux fenêtres demandent deux enregistrements et autant de réglages à vérifier pour un gain nul) ; un compteur dans SQLite ou Redis (persistance inutile ; `abonnements_alerte` reste la seule table, invariant 6).
- **D57 — « Partir à H le jour J » : recherche de H à minuit du jour J, filtrée par l'API.** Pendant de D44 pour l'autre sens : l'API demande à MOTIS les départs de H à 24:00 (heure de Paris), `arriveBy=false`, `useRoutedTransfers=true`, puis garde seulement les possibilités qui **partent le jour J, à H ou après**. Aucune marge en « partir à » (le formulaire la masque, spec 02). Verdict « possible » s'il en reste au moins une, « impossible » sinon.
  - Raison : à la campagne, le trajet suivant peut être 4 h plus tard (13:24 après 09:24 ici) ; une possibilité d'un autre jour ne compte jamais (invariant 13, constat du 13/11 au §2).
  - Écartés : la fenêtre par défaut de MOTIS (2 h, trop courte à la campagne) ; une fenêtre qui déborde sur le lendemain (changement de jour silencieux).

## 4. Ce qui est construit

Tout est dans `serveur/` (D40), plus le compose et la CI. Aucun fichier de `src/` (app) n'est touché.

### 4.1 Environnement (`serveur/src/env.ts`)

Trois variables obligatoires de plus, vérifiées au démarrage (invariant 11) ; le message d'erreur nomme la variable, jamais sa valeur :
- `CLES_APPAREILS` : au moins une empreinte, chacune 64 caractères hexadécimaux minuscules, sans doublon ;
- `LIMITE_REQ_MINUTE`, `LIMITE_REQ_JOUR` : entiers ≥ 1, et la limite du jour ≥ celle de la minute.

`docker-compose.yml` passe ces trois variables à `api` depuis le `.env` de la racine (interpolation `${CLES_APPAREILS:?…}` : le compose refuse de démarrer si elle manque). **Brainditech** les remplit dans son `.env` (valeurs proposées : 30 par minute, 500 par jour). `.env.example` est déjà à jour pour les trois.

La CI (job `joigny`) démarre l'API : elle reçoit dans le workflow une empreinte jetable, calculée sur une clé de test écrite en clair dans le workflow. Ce n'est pas un secret : l'API de la CI n'écoute que sur `127.0.0.1` de la machine GitHub et ne vit que le temps du job. La CI vérifie en plus `GET /v1/lieux` sans clé ⇒ 401.

### 4.2 Clé et limites (`serveur/src/acces/`)

- `cle.ts` : `empreinte(cle)`, `cleValide(entete, empreintes)` (format `Bearer <43 caractères base64url>`, puis comparaison de D55). Script `cle-nouvelle.ts` (`npm run cle:nouvelle`).
- `limites.ts` : compteurs de D56, horloge injectée pour les tests.
- `acces.ts` : greffon Fastify enregistré sur le préfixe `/v1` (crochet `onRequest`) : 401 `{ "erreur": "cle_invalide" }` (même réponse pour une clé absente, mal formée ou inconnue), puis 429 `{ "erreur": "trop_de_requetes", "fenetre": "minute" | "jour" }`. `/health` reste hors du préfixe, sans clé.

### 4.3 Accès à MOTIS (`serveur/src/motis.ts`, `serveur/src/itineraires/motis-plan.ts`, `serveur/src/lieux/motis-geocode.ts`)

- L'application reçoit un **moteur** injecté (`{ plan(demande), geocoder(texte) }`) : la vraie version appelle MOTIS par `fetch`, les tests de route lui substituent des réponses enregistrées.
- `construireUrlPlan` prend le sens : « arriver » ⇒ D44 inchangée ; « partir » ⇒ D57.
- Le schéma Zod de la réponse de `/api/v6/plan` s'enrichit de `agencyName` et `headsign` (facultatifs). Le champ `source` de MOTIS n'est pas lu.
- Géocodeur : `/api/v1/geocode?text=<q>&language=fr&numResults=10`, réponse validée par Zod.
- Délais : 30 s pour une recherche, 5 s pour le géocodeur. MOTIS injoignable ou trop lent ⇒ 503 `{ "erreur": "moteur_indisponible" }` ; réponse hors schéma ⇒ 502 `{ "erreur": "reponse_moteur_illisible" }`. Aucun de ces messages ne contient l'URL appelée (elle porte le texte du lieu ou des coordonnées).

### 4.4 `GET /v1/lieux?q=` (`serveur/src/routes/lieux.ts`)

Entrée (Zod) : `q`, texte de 2 à 200 caractères après suppression des espaces aux bords. Sinon 400.

Sortie, dans l'ordre du géocodeur, sans reclassement :

```json
{
  "candidats": [
    { "nom": "Route de Chamvres", "type": "adresse", "commune": "Joigny", "code_postal": "89300", "lat": 47.9726632, "lon": 3.384304 }
  ]
}
```

- `type` : `ADDRESS` ⇒ `adresse`, `PLACE` ⇒ `lieu`, `STOP` ⇒ `arret`.
- `commune` : l'élément de `areas[]` marqué `default: true`, sinon absent. `code_postal` : `zip`, sinon absent.
- Aucun candidat ⇒ `{ "candidats": [] }` (200) : c'est à l'app de proposer de reformuler (phase 2).

### 4.5 `POST /v1/itineraires` (`serveur/src/routes/itineraires.ts`, `serveur/src/itineraires/normaliser.ts`)

Entrée (Zod, corps limité à 8 Kio, champ inconnu ⇒ 400) :

```json
{
  "depart":  { "lat": 47.9918, "lon": 3.6170 },
  "arrivee": { "lat": 47.3297, "lon": 5.0450 },
  "date": "2026-11-12",
  "heure": "08:00",
  "sens": "partir",
  "marge": 10
}
```

- `date` : date ISO réelle ; `heure` : `HH:MM` de 00:00 à 23:59, heure de Paris ; `sens` : `arriver` ou `partir` ;
- `marge` : entier de 0 à 120 minutes, 10 par défaut (D17), pris en compte seulement en « arriver » ; en « arriver », H − M doit rester ≥ 00:00, sinon 400 ;
- latitude de −90 à 90, longitude de −180 à 180.

Traitement : recherche D44 (« arriver ») ou D57 (« partir ») ⇒ filtre du jour (`verdict.ts`, étendu au sens « partir ») ⇒ normalisation ⇒ tri par heure de départ, puis d'arrivée.

Sortie :

```json
{
  "verdict": "possible",
  "demande": { "date": "2026-11-12", "heure": "08:00", "sens": "partir", "marge": null, "limite": null },
  "possibilites": [
    {
      "depart": "08:24", "arrivee": "10:43",
      "depart_utc": "2026-11-12T07:24:00Z", "arrivee_utc": "2026-11-12T09:43:00Z",
      "duree_minutes": 139, "correspondances": 2,
      "etapes": [
        {
          "mode": "bus", "mode_motis": "BUS", "ligne": "803", "direction": "…", "exploitant": "MOBIGO 89",
          "de": { "nom": "…", "arret": "600326", "lat": 47.99, "lon": 3.61 },
          "a":  { "nom": "…", "arret": "3103848", "lat": 47.98, "lon": 3.73 },
          "depart": "08:25", "arrivee": "08:50", "duree_minutes": 25, "distance_metres": null,
          "etat": "prevu",
          "source": { "type": "gtfs", "jeu": "r84072", "version": "2026-09-21", "trip_id": "1014608-1-1", "date_service": "2026-11-12" }
        }
      ]
    }
  ]
}
```

- `demande.limite` : H − M en « arriver » (ex. `"09:50"`), `null` en « partir ».
- `mode` : `WALK` ⇒ `marche` ; `BUS` ⇒ `bus` ; `COACH` ⇒ `car` ; `ODM`, `FLEX` ⇒ `transport_a_la_demande` ; `TRAM` ⇒ `tram` ; `SUBWAY`, `METRO` ⇒ `metro` ; `SUBURBAN` ⇒ `train_banlieue` ; `HIGHSPEED_RAIL`, `LONG_DISTANCE`, `NIGHT_RAIL`, `REGIONAL_RAIL`, `REGIONAL_FAST_RAIL`, `RAIL` ⇒ `train` ; `FERRY` ⇒ `bateau` ; tout autre ⇒ `autre`. `mode_motis` garde la valeur brute, pour que l'app (spec 10) ne perde rien.
- `source` d'une étape en transport (invariant 4, contrat du PLAN §4) : `jeu`, `trip_id` et `date_service` tirés du `tripId` de MOTIS (format du §2) ; `version` = `feed_version` du jeu dans le manifeste, sinon `date_fichiers`. `arret` est le `stop_id` sans le préfixe `<jeu>_`.
- `source` d'une marche : `{ "type": "osm", "jeu": "<jeu OSM du manifeste>", "version": <date_fichiers, sinon date_telechargement> }`.
- `etat` : toujours `prevu` (« horaire prévu, sans suivi en direct ») : aucun GTFS-RT n'est branché (invariant 12).
- **Une possibilité dont une étape n'a pas de source** (`tripId` illisible, jeu absent du manifeste, ou manifeste sans OSM) **est retirée** de la réponse, et le serveur journalise seulement leur nombre. Si toutes sont retirées, le verdict est « impossible » ; il ne s'appuie jamais sur une possibilité qu'on ne montre pas.
- Rien d'autre de la réponse de MOTIS ne sort : ni son `source` (chemins du PC), ni les identifiants internes, ni les tracés (la carte du Détail viendra en phase 4).

### 4.6 Journaux (invariant 10)

Le journal des requêtes est déjà coupé (D39). En plus : le sérialiseur `req` de Fastify n'écrit que la méthode et le **motif** de la route (`/v1/lieux`, jamais l'URL avec `?q=`), et le gestionnaire d'erreurs ne journalise ni le corps, ni l'URL, ni la clé. Testé avec une chaîne canari.

### 4.7 Test de régression Brienon → Dijon (issue 0007, §6)

`serveur/src/national/brienon-dijon.national.test.ts`, lancé par `npm run test:national` (config `vitest.national.config.ts`, qui ne prend que `*.national.test.ts`). `npm test` et `npm run test:joigny` l'excluent ; **jamais en CI** (D54).

- Il construit l'application avec le vrai moteur (`MOTIS_URL`, par défaut `http://127.0.0.1:8080`), le manifeste national (`donnees/manifest.json`) et une clé générée par le test, puis appelle `POST /v1/itineraires` par `inject()` : c'est la route qui est testée, avec ses paramètres, jamais MOTIS en direct.
- Avant tout, il vérifie que MOTIS répond et qu'il est bien le national (le manifeste compte plus de 100 jeux, et le géocodeur trouve Dijon) ; sinon il échoue avec un message explicite, jamais un test sauté (comme le test Joigny).
- Entrées : jeudi 12/11/2026, de la mairie de Brienon-sur-Armançon (47.9918, 3.6170) au tribunal judiciaire de Dijon (47.3297, 5.0450), coordonnées de l'issue 0007.
- Cas 1 : « partir » à 06:00 ⇒ verdict « possible », et au moins une possibilité qui arrive au plus tard à 09:50.
- Cas 2 : « partir » à 08:00 ⇒ une possibilité qui part à 08:24, prend une étape de ligne `803`, et arrive au plus tard à 10:45.
- Dans les deux cas : toutes les possibilités partent le 12/11, à l'heure demandée ou après (la possibilité du 13/11 du §2 est écartée), et chaque étape a sa `source`.
- Lieux : `GET /v1/lieux?q=route de Chamvres Joigny` ⇒ un candidat de la commune de Joigny à moins de 500 m du lieu de rendez-vous de la spec 05 ; `q=tribunal judiciaire Dijon` ⇒ un candidat à moins de 500 m de la Cité judiciaire.

**Exception assumée à l'invariant 15** : les seuils (09:50, 10:45, 08:24, ligne 803) ne sont pas tirés des fixtures. Ils viennent de l'issue 0007 (comparaison avec SNCF Connect et Google Maps, approuvée). L'invariant 15 vise le test de référence (Joigny, fixtures figées), qui ne change pas. Ce test-ci dépend du cliché national du 2026-11-04 : s'il échoue après un nouveau téléchargement des données, on ouvre une issue avant de toucher au test.

## 5. Fichiers touchés

| Fichier | Changement |
|---|---|
| `serveur/src/env.ts` (+ test) | `CLES_APPAREILS`, `LIMITE_REQ_MINUTE`, `LIMITE_REQ_JOUR`. |
| `serveur/src/acces/cle.ts`, `limites.ts`, `acces.ts`, `cle-nouvelle.ts` (+ tests) | D55, D56. |
| `serveur/src/app.ts`, `serveur/src/index.ts` | Moteur injecté, greffon d'accès sur `/v1`, routes, sérialiseur et gestionnaire d'erreurs. |
| `serveur/src/motis.ts` | Moteur (plan, géocodeur) à côté de la sonde. |
| `serveur/src/itineraires/motis-plan.ts`, `verdict.ts` (+ tests) | Sens « partir » (D57), champs `agencyName` et `headsign`. |
| `serveur/src/itineraires/normaliser.ts` (+ test) | Modes, sources, retrait d'une possibilité sans source. |
| `serveur/src/lieux/motis-geocode.ts` (+ test) | Géocodeur. |
| `serveur/src/routes/lieux.ts`, `itineraires.ts` (+ tests par `inject()`) | Routes. |
| `serveur/src/itineraires/__exemples__/plan-brienon-dijon-2026-11-12.json`, `serveur/src/lieux/__exemples__/geocode-chamvres.json` (nouveaux) | Réponses réelles du MOTIS national, réduites, **champ `source` de MOTIS retiré** (chemins du PC). Elles servent aux tests sans MOTIS, pas de valeurs attendues du test de régression. |
| `serveur/src/national/brienon-dijon.national.test.ts`, `serveur/vitest.national.config.ts` (nouveaux) | Test de régression (§4.7). |
| `serveur/vitest.config.ts` | Exclut `*.national.test.ts`. |
| `serveur/package.json` | Scripts `cle:nouvelle` et `test:national`. Aucune dépendance ajoutée. |
| `docker-compose.yml` | Les trois variables passées à `api`. |
| `.github/workflows/ci.yml` | Empreinte jetable pour le job `joigny`, vérification du 401. |
| `docs/decisions/0001-cadrage-v1.md` | D55, D56, D57 une fois approuvées. |
| `PLAN.md` | §3 : format de `CLES_APPAREILS` ; cases avec leur preuve (§1). |
| `docs/ETAT.md`, `README.md` | Avancée ; commandes `cle:nouvelle` et `test:national`. |

## 6. Source de chaque valeur

Aucun écran n'est modifié (spec 10). Dans les réponses de l'API :
- heures, lignes, exploitants, directions, noms et identifiants d'arrêt : MOTIS, issus des GTFS du manifeste (`source` de chaque étape) ;
- durée et distance de marche : routage piéton MOTIS sur l'OSM du manifeste ;
- candidats de lieu : géocodeur MOTIS (OSM, arrêts GTFS) ;
- verdict, limite H − M, tri, nombre de correspondances : calculs déterministes de l'API ;
- `etat` : constante `prevu` tant qu'aucun GTFS-RT n'est branché.

## 7. Sécurité

- Toutes les routes `/v1/` exigent une clé valide (invariant 8) ; `/health` reste ouverte et inchangée.
- Aucune clé, empreinte réelle ou limite dans git : `.env` est rempli par Brainditech (invariant 19). La seule empreinte versionnée est celle, jetable, de la CI.
- Chaque entrée est validée par Zod (invariant 9), la réponse de MOTIS aussi.
- Rien n'est stocké : ni texte de lieu, ni coordonnées, ni trajet (invariant 6). Les compteurs de débit ne contiennent que des empreintes et des nombres.
- Journaux : ni lieu, ni coordonnées, ni clé (§4.6). Les chemins du PC (`source` de MOTIS) ne sortent pas.
- MOTIS reste publié sur `127.0.0.1` seulement ; l'app ne passe que par l'API (invariant 2).
- À noter pour la phase 10 : `q` voyage dans l'URL ; le proxy HTTPS du VPS ne devra pas journaliser les URL.

## 8. Critères d'acceptation

1. **Environnement** (tests) : chacune des trois variables absente ou mal formée (empreinte de 63 caractères, majuscules, doublon, limite 0, limite du jour inférieure à celle de la minute) ⇒ refus de démarrer, message qui nomme la variable sans recopier sa valeur.
2. **Clé** (tests par `inject()`) : sans en-tête, `Bearer` vide, clé mal formée, clé inconnue ⇒ 401, même corps ; clé valide ⇒ la route répond ; `/health` sans clé ⇒ 200 ou 503 comme avant ; une empreinte retirée de la liste ⇒ 401.
3. **Limites** (tests, horloge injectée) : la (N+1)e requête de la minute ⇒ 429 `fenetre: "minute"` avec `Retry-After` ; la minute suivante ⇒ de nouveau 200 ; la limite du jour atteinte ⇒ 429 `fenetre: "jour"` jusqu'à minuit heure de Paris ; deux clés ont des compteurs séparés ; une clé inconnue n'est pas comptée.
4. **`GET /v1/lieux`** (tests, réponse enregistrée) : `q` absent, d'un caractère ou de plus de 200 ⇒ 400 ; la réponse enregistrée ⇒ candidats dans l'ordre, `type`, `commune` et `code_postal` corrects ; liste vide ⇒ 200 `[]` ; moteur injoignable ⇒ 503 ; réponse hors schéma ⇒ 502.
5. **`POST /v1/itineraires`, entrées** (tests) : date impossible (31/11), heure 24:00, sens inconnu, marge 121, champ en trop, latitude 91, « arriver » 00:05 avec 10 min de marge ⇒ 400 qui nomme les champs sans recopier les valeurs.
6. **`POST /v1/itineraires`, normalisation** (tests, réponse enregistrée) : chaque étape de chaque possibilité a une `source` (invariant 4) ; `jeu`, `trip_id`, `date_service` et `version` corrects ; marche ⇒ source OSM ; correspondance des modes du §4.5 ; une possibilité au `tripId` illisible ou au jeu inconnu ⇒ retirée, les autres gardées ; toutes retirées ⇒ « impossible » ; aucune trace du `source` de MOTIS (`/donnees/`) dans la réponse.
7. **Sens et jour** (tests) : « partir » 08:00 ⇒ l'URL envoyée à MOTIS part de 07:00Z avec une fenêtre jusqu'à minuit de Paris ; une possibilité du 13/11 ou partie avant 08:00 ⇒ écartée ; « arriver » ⇒ requête D44 inchangée (les tests de la spec 05 restent verts) ; résultat trié par départ.
8. **Journaux** (test canari) : une requête `GET /v1/lieux?q=CANARI-LIEU` et un `POST` avec des coordonnées canari, moteur en panne ⇒ ni `CANARI-LIEU`, ni les coordonnées, ni la clé dans les journaux capturés.
9. **Régression issue 0007** (`npm run test:national`, MOTIS national du PC) : les cas du §4.7 verts. Le test sait échouer : avec la limite de « partir » ramenée à 2 h ou le filtre du jour retiré, au moins un cas échoue (essayé, puis remis). MOTIS arrêté ⇒ échec explicite.
10. Si un cas du §4.7 échoue sur le MOTIS national, **je m'arrête** : constat dans `docs/issues/`, analyse soumise à Brainditech ; rien n'est ajusté pour faire passer le test.
11. **CI** : jobs `verifications` et `joigny` verts sur la PR, dont `GET /v1/lieux` sans clé ⇒ 401 dans le job `joigny`.
12. `serveur/` : `npm run typecheck`, `npm test`, `npm run test:joigny` (stack des fixtures) et `npm run test:national` (stack national) verts ; racine : `npx expo lint`, `npx tsc --noEmit`, `npm test` verts.

## 9. Ce qui n'est pas fait ici

- La saisie de la clé sur le téléphone, `EXPO_PUBLIC_API_URL`, l'app branchée (spec 10).
- Les tris de la phase 3 (moins cher, moins de marche, sans réservation), les prix, le retour (D47), le taxi (D48), le covoiturage (D50).
- Le refus « hors de la zone couverte » (phase 2 bis) : ici, un départ hors des données donne simplement « impossible ».
- La limite de la première et de la dernière marche (`maxPreTransitTime`, `maxPostTransitTime` laissés à 15 min, comme en spec 05).
- Le biais du géocodeur vers une position (`place`) : il faudrait envoyer la position du téléphone, à décider en phase 6 (« depuis ma position »).
- Le temps réel (`etat` reste `prevu`, phase 7).
- `POST /v1/comprendre` (Claude, phase 1).

## 10. Étapes de vérification

1. **Brainditech** : approuve la spec (ou la corrige), et les valeurs de limite (30 par minute, 500 par jour proposées).
2. **Claude** : relit la doc de Fastify 5.12.8 (crochets, `register` avec préfixe, sérialiseurs du journal, `bodyLimit`) et `openapi.yaml` v2.11.4 avant de coder ; écrit les modules et leurs tests ; enregistre les deux réponses d'exemple sur le MOTIS national.
3. **Brainditech** : lance `cd serveur && npm run cle:nouvelle`, met l'empreinte et les deux limites dans le `.env` de la racine, garde la clé pour la spec 10, puis reconstruit l'API du stack national (`docker compose -p itinhero-national -f docker-compose.yml -f docker-compose.national.yml up -d --build api`) : c'est le compose qui lit le `.env`, Claude n'y touche pas.
4. **Claude** : vérifie `GET /v1/lieux` sans clé ⇒ 401 sur l'API reconstruite ; lance `npm run test:national` (il construit l'application dans le test, sans le `.env`), puis les vérifications du critère 12 (le test Joigny demande d'arrêter le stack national et de lancer celui des fixtures, puis de revenir).
5. **Claude** : pousse la branche, ouvre la PR ; CI verte.
6. **Brainditech** : relit la PR et la fusionne.

## 11. Application et boucle de comparaison (2026-11-04)

Sur la demande de Brainditech, la spec a été appliquée puis confrontée à Google Maps sur 18 trajets variés (Paris, banlieue, Lyon, Marseille, Toulouse, Lille, Bordeaux, Nice, liaisons longues, campagne de l'Yonne, nuit, week-end, « partir à » et « arriver avant »), et à 21 recherches de lieux. Chaque écart a été corrigé puis rejoué. Outils (MOTIS national du PC, jamais en CI), dans `serveur/` après `npm run build` : `node dist/comparaison/comparer.js src/comparaison/scenarios.json` et `node dist/comparaison/lieux.js`.

### 11.1 Décisions prises pendant la boucle

- **D58** (remplace D57, révise D44) : `arriveBy=false` à H pour « partir », `arriveBy=true` à H − M pour « arriver » ; fenêtre d'une heure et `numItineraries=5` ; filtres de jour inchangés ; au plus 10 possibilités. Constat : la fenêtre jusqu'à minuit (D57) donnait 599 possibilités et **27 s** à Paris ; D44 montrait des métros de 00:01 pour « arriver avant 09:00 ». Après : 0,2 à 2,2 s partout ; test Joigny vert (4/4) sur les fixtures.
- **D59** : repli de sélection des GTFS ; 20 réseaux de plus (536 jeux), dont **Lyon TCL** (copie « modifiée » publiée en libre ; l'officielle exige un compte data.grandlyon), BlaBlaCar Bus, Le Havre LiA. MOTIS national réimporté (7,4 Gio au repos, contre 7,0).
- **D60** : géocodage par la Géoplateforme de l'IGN (BAN et BD TOPO) **et** MOTIS, classés ensemble (mots retrouvés, type attendu, note, importance BD TOPO, distance au point `proche`). L'IGN en panne ⇒ MOTIS seul.
- **D61** : recherche par catégorie (« restaurant chinois », « pharmacie », « pizzeria »…) dans les 481 483 lieux nommés d'OSM, autour du point `proche`.
- Paramètres de recherche ajoutés : marche aux deux bouts jusqu'à 30 min (`maxPreTransitTime`, `maxPostTransitTime` ; MOTIS : 15 min ; l'app avertit au-delà de 15, D3), trajets à pied (`direct`) lus.
- Affichage : possibilités rendues inutiles par une autre retirées (part plus tard, arrive au moins 10 min plus tôt, une correspondance de plus au plus), doublons retirés, noms de ligne absurdes (« INCONNU », vide, nom de relation) remplacés par `null`, car TER (`bus` exploité par la SNCF) ⇒ `car`, RER et Transilien (ligne d'une lettre) ⇒ `train_banlieue`, « START » et « END » ⇒ « Départ » et « Arrivée ». `GET /v1/lieux` accepte `proche=lat,lon` et rend `distance_metres`.
- Essayé puis **rejeté** : le paramètre expérimental `radius` de MOTIS (arrêts proches à vol d'oiseau). Il corrigeait Châtelet → Orly, mais rendait des trajets impossibles (Saint-Charles → Notre-Dame de la Garde en 13 min, en montée) et des verdicts « impossible » à tort (La Défense → Versailles, Lyon, Toulouse).

### 11.2 Trajets comparés à Google Maps (mêmes coordonnées, même jour, même heure)

| Trajet | Itinhero (après) | Google Maps | Bilan |
|---|---|---|---|
| Gare de Lyon → Tour Eiffel, sam. 14/11 10:00 | 10:02 → 10:37 (métro 1 + bus 42) ; bus 72 direct 10:00 → 10:43 | 10:00 → 10:34 ; 10:05 → 10:38 | à 3 min près |
| Châtelet → Pont de Rungis-Orly, ven. 13/11 07:00 | 07:02 → 07:36 (métros 7 et 14) | 07:01 → 07:29 (métro 14 direct) | **moins bon de 6 min** : issue 0008 (quais mal reliés dans OSM) |
| La Défense → château de Versailles, dim. 15/11 14:00 | 14:10 → 15:00 | 14:02 → 14:49 | moins bon : 5 min de marche jusqu'au quai du L de 14:04 (Google : 2 min) |
| Nation → Montparnasse, arriver avant 09:00 (marge 10) | dernier départ 08:20 → 08:49 (métro 6) | 08:22 → 08:49 | égal |
| Lyon Part-Dieu → Fourvière, mar. 10/11 09:00 | 09:00 → 09:32 (métros B et D, 12 min de montée à pied) ; avant D59 : 10:02 → 11:28 | 09:03 → 09:42 (funiculaire) | meilleur, mais notre marche ignore la pente (§11.4) |
| Marseille Saint-Charles → Notre-Dame de la Garde, mer. 18/11 15:00 | 15:09 → 15:31 (M1 + bus 49) | 15:10 → 15:33 | égal ou mieux |
| Auxerre → Paris Bercy, lun. 16/11 07:00 | 07:28 → 09:34 ; 08:22 → 10:28 | 07:29 → 09:34 ; 08:23 → 10:28 | identique |
| Tonnerre → hôpital de Sens, arriver avant 10:00 | 07:19 → 08:55 ; 06:31 → 07:52 | 07:19 → 08:54 ; 06:31 → 08:03 | égal ou mieux |
| Toulouse Capitole → aéroport, ven. 20/11 06:00 | 06:04 → 06:51 | 06:02 → 06:50 | égal |
| Bordeaux Saint-Jean → Arcachon, sam. 14/11 09:00 | 09:01 → 10:13 (TER de 09:03) | 09:59 → 11:14 | **mieux** : le TER de 09:03 circule le 14/11 d'après le GTFS SNCF (service `005430`), vérifié |
| Lille Flandres → Roubaix La Piscine, jeu. 12/11 17:30 | 17:30 → 18:01 | 17:31 → 18:01 | égal |
| Nantes → Strasbourg, ven. 13/11 07:00 | 07:03 → 12:11 | 07:00 → 12:10 | égal |
| Brienon → hôpital d'Auxerre, arriver avant 14:00 | 08:24 → 09:39 (803 + bus 05) | 08:25 → 09:42, avec des trajets **de la veille** mêlés | égal ; Google mélange les jours, pas nous (invariant 13) |
| Rennes → Mont-Saint-Michel, sam. 07/11 08:00 | 08:04 → 10:25 | aucun trajet en transports | **mieux** |
| Nice → Monaco, dim. 08/11 11:00 | 11:02 → 11:41 (ZOU ! de 11:03) | 11:20 → 11:58 | **mieux** : service ZOU ! des 7 et 8/11 (`SNC:13528`), vérifié dans le GTFS régional |
| Kremlin-Bicêtre → Versailles-Chantiers, sam. 14/11 23:30 | 23:36 → 00:20 (TER de 00:02 à Montparnasse) | 23:36 → 00:32 | **mieux** : TER `862451` du 15/11, vérifié dans le GTFS SNCF |

Les trois cas « mieux » du week-end et de la nuit ont été vérifiés dans les fichiers GTFS officiels (calendriers des courses), pour ne jamais afficher un train qui ne circule pas.

### 11.3 Lieux

| Recherche (point `proche`) | Avant (MOTIS seul) | Après (D60, D61) |
|---|---|---|
| Tour Eiffel (Paris) | arrêt du Pellerin (sans `proche`) | Tour Eiffel, Paris |
| Sacré-Cœur (Paris) | œuvre « Le Sacré-Cœur », 6e | Basilique du Sacré-Cœur |
| Place de la République (Paris) | Le Kremlin-Bicêtre | Place de la République, Paris |
| 10 rue de Rivoli (Paris) | 107 rue de Rivoli | 10 rue de Rivoli, Paris 4e |
| 19 route de Chamvres Joigny | la rue, à 260 m | le numéro 19, aux coordonnées du lieu de rendez-vous de la spec 05 |
| Gare d'Auxerre | Blason d'Auxerre | Gare d'Auxerre-Saint-Gervais |
| Aéroport d'Orly | gare RER du Pont de Rungis | Aéroport d'Orly |
| Cathédrale de Strasbourg | « Vue sur Cathédrale » | Cathédrale Notre-Dame |
| tribunal judiciaire Dijon | Albi, Auch, puis Dijon | Tribunal judiciaire de Dijon |
| Hôpital de Sens | Hôpital de Senlis | Hôpital, Sens |
| restaurant chinois (13e) | « Restaurant Chinois », Chevilly-Larue | Mala Mala à 50 m, Au Bourgeon d'Or à 60 m… |
| pharmacie, pizzeria, boulangerie, médecin (Yonne) | au hasard du nom | les plus proches, avec la distance |
| Mont-Saint-Michel (sans `proche`) | — | **toujours raté** : un sommet du même nom avant la commune (aucun indice de notoriété) |
| un médecin par son nom | — | **non couvert** : OSM ne recense que 13 089 médecins ; la source complète est l'Annuaire santé de l'ANS (§11.5) |

### 11.4 Limites connues

- Châtelet → Orly : 6 min de plus que Google (issue 0008).
- La marche ignore les pentes (pas de données d'altitude dans MOTIS) : optimiste sur les collines (Fourvière).
- Les commerces d'OSM ont rarement leur commune : l'app affiche la distance.
- Pas de temps réel (phase 7) : Google en a, pas nous.
- Lyon TCL vient d'une copie « modifiée » par un tiers ; l'officielle demande un compte data.grandlyon.

### 11.5 À décider par Brainditech

1. **Annuaire santé (médecins par leur nom)** : charger l'extraction en libre accès de l'ANS (professionnels de santé, adresse d'exercice), géocodée par l'IGN, sur le PC seulement. Données nominatives publiques : à valider avant tout chargement.
2. **Compte data.grandlyon** pour le GTFS officiel de Lyon (identifiants dans `.env`), ou garder la copie actuelle.
3. Limites de débit : 30 par minute et 500 par jour proposées.

### 11.6 Vérifications

- `serveur/` : `npm run typecheck` ; `npm test` : 123 tests verts ; `npm run test:national` (MOTIS national) : 4 verts ; `npm run test:joigny` sur les fixtures (MOTIS des fixtures lancé à part sur le port 8081, volume en lecture seule) : 4 verts. Racine : `npx expo lint`, `npx tsc --noEmit`, `npm test` (25) verts.
- Le test de régression sait échouer : sans le filtre du jour, les deux cas échouent (« part un autre jour »), essayé puis remis.
- Image de l'API construite et lancée avec une clé jetable contre le MOTIS national : `/health` 200, `/v1/lieux` sans clé 401, catégorie et itinéraires corrects, 294 Mio de mémoire avec l'index des lieux.
