# Spec 04 — Serveur squelette et MOTIS sur les horaires figés

> Rédigée le 2026-11-03. État : **approuvée par Brainditech le 2026-11-03 (« vas-y »), appliquée ; critères 1 à 7 constatés le 2026-11-03.**
> Branche : `phase-0/serveur-motis`. Une seule PR (D34, point 4 : ce qui se vérifie ensemble).
> Décisions liées : D1, D3, D16, D34, A4, A13, A14 ; nouvelles décisions D39 à D41 (§3), acceptées, et D42 (marche de 50 min, §11). Risques : R1, R2 (tranché).

## 1. But

Un `docker compose up` sur le PC de Brainditech démarre MOTIS v2.11.4 chargé avec les horaires figés (SNCF + Mobigo 89) et un extrait OSM du couloir Brienon–Saint-Florentin–Joigny, plus une API Itinhero squelette dont `GET /health` dit si MOTIS répond et quels jeux d'horaires sont chargés. MOTIS doit répondre à une vraie recherche Brienon → Joigny le 12/11/2026. C'est le premier pas du chemin B : sans lui, aucune vraie recherche n'est possible.

### Découpage du chemin B (une spec et une PR chacune)

| Spec | Branche | Cases de PLAN.md (phase 0) |
|---|---|---|
| **04 — Serveur et MOTIS** (cette spec) | `phase-0/serveur-motis` | `docker compose` (MOTIS, API squelette, `/health`) · vérification des variables d'environnement (partie serveur) · `fixtures/manifest.json` et extrait OSM figé · mesure de la mémoire de MOTIS (R1) |
| 05 — Oracle et test Joigny | `phase-0/joigny` | Oracle GTFS · test Joigny et ses cas limites (R2) |
| 06 — CI | `phase-0/ci` | CI GitHub Actions (lint, types, tests, build) · job qui lance MOTIS et le test Joigny (D34 : la CI revient avec le test Joigny) |

La spec 01 (CI, reportée par D34) sera remplacée par la 06. La partie « app » de la vérification des variables d'environnement reste ouverte : elle se fera avec la première variable `EXPO_PUBLIC_API_URL` lue par l'app (phase 1, branchement réel).

## 2. Ce qui est déjà constaté (2026-11-03)

| Constat | Source |
|---|---|
| Image officielle `ghcr.io/motis-project/motis:2.11.4` publiée (étiquettes 2.11.0 à 2.11.4) | registre ghcr.io, liste des étiquettes |
| L'image tourne sous l'utilisateur `motis` (pas root), port 8080, volume `/data`, commande `/motis server /data` | `Dockerfile` du tag v2.11.4 |
| `motis import -c config.yml -d data` prépare les données ; `motis server` n'a ensuite besoin que du dossier `data` | `exe/main.cc` et `exe/flags.h` du tag v2.11.4 |
| Options utiles : `osr_footpath`, `geocoding`, `street_routing`, `timetable.max_footpath_length` (15 par défaut), `timetable.first_day` (`TODAY` par défaut), `timetable.num_days`, `timetable.datasets.<tag>.path` ; le tag du jeu préfixe les `stop_id` et `trip_id` (`<tag>_<id>`, donc pas de `_` dans le tag) | `docs/setup.md` du tag v2.11.4 |
| `GET /api/v1/health` : 200 quand les flux temps réel ont fait un premier cycle (aucun flux configuré ici) | `openapi.yaml` du tag v2.11.4 |
| GTFS SNCF : `feed_version` 2026-10-18, du 2026-10-18 au 2027-03-31. Mobigo 89 : pas de `feed_info.txt`, fichiers du 2026-09-21 | `feed_info.txt` et listage de `fixtures/_rapatrie-2026-10-19/*.zip` |
| Extrait Geofabrik Bourgogne du jour : `bourgogne-261102.osm.pbf`, 200 754 012 octets, publié le 2026-11-03 07:00 GMT (nom daté stable) | en-têtes HTTP de `download.geofabrik.de/europe/france/bourgogne-latest.osm.pbf` |
| Sur le PC : Docker 29.9.2, Compose v5.6.1, Node v22.14.0. **Docker Desktop n'est pas démarré** | `docker --version`, `docker info` |

## 3. Décisions proposées

- **D39 — Framework HTTP (tranche A4) : Fastify**, version constatée à l'installation, doc de cette version lue avant de coder. Tests sans réseau par `app.inject()`.
  - Raison : mûr, typé, validation Zod par un fournisseur de types, Inngest le sert directement (phase 7).
  - Écartés : Hono (plus léger, mais moins d'usage côté Node pur), Express (pas de typage ni de validation intégrés).
- **D40 — Le serveur vit dans `serveur/`**, avec son propre `package.json`, `package-lock.json`, `tsconfig.json` et sa configuration vitest. La racine (l'app Expo) l'ignore : `tsconfig.json`, ESLint et vitest de la racine l'excluent.
  - Raison : les dépendances serveur n'entrent ni dans le bundle de l'app, ni dans `expo-doctor`, ni dans l'APK (invariant 1).
  - Écartés : un seul `package.json` pour l'app et le serveur ; un monorepo à espaces de travail npm (trop de cérémonie pour un seul serveur).
- **D41 — Extrait OSM du couloir** : `bourgogne-261102.osm.pbf` (Geofabrik) découpé une seule fois par `osmium extract` au rectangle lon 3,35 → 3,80, lat 47,92 → 48,05 (Joigny, Laroche-Migennes, Brienon, Saint-Florentin et sa gare). Le résultat, quelques Mo, est versionné dans `fixtures/osm/` avec son sha256 ; le fichier Bourgogne (200 Mo) n'est pas versionné, seuls son nom, sa date et son sha256 vont dans le manifeste. osmium tourne dans une image construite par nous (`outils/osmium/Dockerfile`, Debian épinglée, `osmium-tool` du dépôt Debian, version constatée).
  - Raison : D16 (OSM figé), test reproductible, dépôt léger.
  - Écartés : Bourgogne entière dans le dépôt (200 Mo) ; téléchargement à chaque CI (D16 l'écarte) ; image osmium tierce non officielle.
- **`MOTIS_URL`** est écrite dans `docker-compose.yml` (`http://motis:8080`), pas dans `.env` : ce n'est pas un secret et elle découle du compose lui-même. Le tableau des variables de PLAN.md §3 est corrigé en ce sens. L'API vérifie quand même sa présence et son format au démarrage.

## 4. Configuration de MOTIS (`motis/config.yml`)

```yaml
server:
  port: 8080
osm: /entrees/osm/couloir-yonne-2026-11-02.osm.pbf
timetable:
  first_day: 2026-10-19        # jamais TODAY : les fixtures sont figées
  num_days: 120                # environ 4 mois : couvre le 11/11, le 12/11 et le 15/11
  max_footpath_length: 50      # D3 révisée par D42 (voir §11)
  datasets:
    sncf:
      path: /entrees/gtfs/sncf.zip
    mobigo:
      path: /entrees/gtfs/mobigo89.zip
street_routing: true           # marche et voiture
osr_footpath: true
geocoding: true
```

Les valeurs exactes de `first_day` et `num_days` sont vérifiées contre les deux calendriers au moment de coder ; si MOTIS refuse une clé, la doc du tag fait foi et l'écart est consigné.

## 5. Fichiers touchés

| Fichier | Changement |
|---|---|
| `docker-compose.yml` (nouveau) | Services `motis-import` (une fois : `motis import`, puis s'arrête), `motis` (`motis server`, démarre après un import réussi, healthcheck sur `/api/v1/health`, port publié sur `127.0.0.1:8080` seulement), `api` (Node 22, utilisateur `node`, healthcheck sur `/health`, port 3000). Images épinglées, jamais `latest`. Volume `motis-data`. Les fixtures sont montées en lecture seule. |
| `motis/config.yml` (nouveau) | §4. |
| `outils/osmium/Dockerfile` (nouveau) | Image osmium pour le découpage (D41). |
| `scripts/extraire-osm.sh` (nouveau) | Découpage reproductible, écrit la sortie et son sha256. Lancé une fois. |
| `fixtures/osm/couloir-yonne-2026-11-02.osm.pbf` (nouveau) | Extrait figé. |
| `fixtures/manifest.json` (nouveau) | Par fichier : chemin, URL source, date, `feed_version` (si présent), sha256, taille. Validé par un schéma Zod. |
| `serveur/package.json`, `serveur/package-lock.json`, `serveur/tsconfig.json`, `serveur/vitest.config.ts`, `serveur/Dockerfile` (nouveaux) | D40. Dépendances : fastify, zod (versions constatées). |
| `serveur/src/env.ts` (+ test) | Schéma Zod de l'environnement. Phase 0 : `MOTIS_URL` seulement (règle 6 : chaque variable entre dans la phase qui l'utilise). Absente ou mal formée ⇒ message qui nomme la variable, **sans sa valeur**, et sortie en code 1. |
| `serveur/src/manifest.ts` (+ test) | Lecture et validation du manifeste ; vérification des sha256. |
| `serveur/src/app.ts`, `serveur/src/index.ts` | Application Fastify et démarrage. |
| `serveur/src/routes/health.ts` (+ test) | `GET /health`. |
| `tsconfig.json`, `eslint.config.js` (racine) | Exclusion de `serveur/` (D40). |
| `.gitignore` | Données MOTIS locales, fichier Bourgogne téléchargé. |
| `docs/decisions/0001-cadrage-v1.md` | D39, D40, D41 une fois approuvées. |
| `docs/decisions/0002-memoire-motis.md` (nouveau) | Mesure R1 : valeur, méthode, date. |
| `PLAN.md`, `docs/ETAT.md` | Cases cochées avec leur preuve ; `MOTIS_URL` corrigée au §3 ; découpage du §1. |
| `README.md` | Commandes : démarrer, arrêter, réimporter. |

Aucun fichier de `src/` ni de `android/` n'est touché.

## 6. `GET /health`

Sans clé d'appareil (invariant 8). Réponse :

```json
{
  "api": "ok",
  "motis": "ok",
  "horaires": [
    { "jeu": "sncf", "feed_version": "2026-10-18", "sha256": "6892f10e…" },
    { "jeu": "mobigo", "feed_version": null, "date_fichiers": "2026-09-21", "sha256": "201780da…" }
  ]
}
```

- 200 si MOTIS répond à `/api/v1/health` en moins de 2 s ; sinon 503 avec `"motis": "injoignable"`, le reste inchangé.
- `horaires` vient de `fixtures/manifest.json` (le jeu monté), jamais d'une valeur écrite dans le code.
- Aucune donnée de trajet, aucun chemin de fichier du PC.

## 7. Source de chaque valeur

Aucun écran n'est modifié. Les valeurs de `/health` viennent de MOTIS (joignable ou non) et de `fixtures/manifest.json` (lui-même tiré des fichiers par sha256 et `feed_info.txt`).

## 8. Sécurité

- MOTIS n'est publié que sur `127.0.0.1` : le téléphone ne peut pas l'appeler (invariant 2). Seule l'API sera exposée.
- Aucun secret dans cette PR. `.env` n'est ni lu ni écrit par Claude ; le compose de phase 0 n'en a pas besoin.
- Conteneurs `motis` et `api` sans root, avec healthcheck (invariant 17, en avance sur la phase 9). Le conteneur d'import tourne lui aussi sous `motis`.
- Le message d'erreur d'une variable mal formée ne recopie jamais sa valeur.
- Aucune fixture n'est retéléchargée pour « réparer » un sha256 (invariant 14) : un sha256 faux fait échouer le test.

## 9. Critères d'acceptation

1. `docker compose up -d` sur un volume vide importe puis démarre MOTIS ; `docker compose ps` montre `motis` et `api` en `healthy`, avec des images étiquetées (aucune `latest`).
2. `curl http://localhost:3000/health` ⇒ 200, `motis: "ok"`, les deux jeux avec leur `feed_version` (ou date des fichiers) et leur sha256.
3. MOTIS arrêté (`docker compose stop motis`) ⇒ `/health` répond 503 avec `motis: "injoignable"`, et l'API ne plante pas.
4. Une recherche manuelle `GET /api/v6/plan` de Brienon-sur-Armançon vers Joigny, arrivée avant 09:50 le 2026-11-12, renvoie au moins une possibilité. Copie de la réponse résumée (heures, lignes) dans la PR. Ce n'est pas encore le test Joigny (spec 05) : seulement la preuve que les horaires et l'OSM sont chargés.
5. `docker stats` : mémoire de MOTIS au repos après import et pendant la recherche du critère 4, consignée dans `docs/decisions/0002-memoire-motis.md` avec la méthode et la date (R1).
6. Tests vitest du serveur verts (logique ⇒ test, règle 7) :
   - `MOTIS_URL` absente ⇒ échec explicite qui nomme la variable ; mal formée ⇒ idem, sans la valeur dans le message ;
   - manifeste : chaque sha256 recalculé égale celui du manifeste ; un octet changé ⇒ échec ; manifeste hors schéma ⇒ échec ;
   - `/health` avec MOTIS simulé qui répond ⇒ 200 ; qui ne répond pas ou dépasse 2 s ⇒ 503, corps conforme.
7. Racine : `npx expo lint`, `npx tsc --noEmit`, `npm test` toujours verts ; `serveur/` : `npx tsc --noEmit` et `npm test` verts.

## 10. Étapes de vérification

1. **Brainditech** : démarre Docker Desktop (il est arrêté), puis me le dit.
2. **Claude** : construit l'image osmium, télécharge `bourgogne-261102.osm.pbf`, découpe l'extrait, écrit le manifeste ; `docker compose up -d`, puis les critères 1 à 5 (le compose n'est pas l'app : je peux le lancer moi-même ; dis-moi si tu préfères le faire).
3. **Claude** : tests et vérifications du critère 7.
4. **Brainditech** : relit la PR et la fusionne.

## 11. Constats à l'application (2026-11-03)

- **R2 tranché, D42** : MOTIS calcule 3 431 m et 47,8 min de marche de Saint-Florentin-Ville à la gare de Saint-Florentin-Vergigny. Avec `max_footpath_length: 45`, la correspondance n'est pas créée et le critère 4 échoue : la première arrivée à Joigny le 12/11 est à 10:25. Brainditech a choisi 50 min.
- **Critère 4** (heures de Paris) : car K941 Brienon Mairie 06:27 → Saint-Florentin-Ville 06:37, marche de 3 431 m jusqu'à 07:25, train K7 08:50 → Joigny 09:09, marche jusqu'à 09:23. MOTIS trouve aussi une voie plus tôt par le P5 de 07:37 et le P31 de Laroche-Migennes (Joigny 08:11).
- **À reprendre dans la spec 05 et en phase 3** :
  - MOTIS rend les heures en UTC (`…Z`) : la conversion Europe/Paris se fait côté serveur Itinhero.
  - `useRoutedTransfers=true` est obligatoire, sinon MOTIS ignore les marches calculées sur OSM (et donc la voie de Saint-Florentin).
  - Avec `arriveBy=true`, MOTIS a renvoyé des possibilités des jours précédents (10/11 pour une demande du 12/11). Les recherches de la spec 05 se font au départ, avec une fenêtre explicite, jusqu'à ce que ce comportement soit compris (doc de `/api/v6/plan`).
- Mesures R1 : `docs/decisions/0002-memoire-motis.md`.
- API et MOTIS sont publiés sur `127.0.0.1` seulement : le téléphone ne joint pas encore l'API. L'ouverture au réseau local viendra avec la clé d'appareil (phase 1).
