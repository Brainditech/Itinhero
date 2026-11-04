# Spec 08 — Données de toute la France dans MOTIS, sur le PC (phase 2 bis, avancée)

> Rédigée le 2026-11-04. État : **appliquée sur la demande de Brainditech (« vas y charge tout on verra bien s'il gère ou pas après s'il ne gère pas on avisera »), à relire dans la PR. Critères 1 à 4 et 6 constatés le 2026-11-04, critère 5 en attente de la comparaison par Brainditech (§7).**
> Branche : `phase-2bis/donnees-nationales`. Une seule PR.
> Décisions liées : D41, D46, D54 (ici). Invariants : 14, 15, 17. Risques : R1, R15.

## 1. But

Faire tourner sur le PC de Brainditech un MOTIS chargé avec tout ce qui est publié pour la France : la carte OSM entière et tous les GTFS de transport public de transport.data.gouv.fr. Brainditech pourra ensuite essayer de vrais trajets partout en France (specs 09 et 10 : routes de l'API et app branchée) et les comparer à SNCF Connect ou Google Maps. Pendant l'import et les recherches, on mesure la mémoire (R1).

Cases de PLAN.md :
- phase 0 : « Mesure de la mémoire de MOTIS chargé avec les données de toute la France » ;
- phase 2 bis : « GTFS régionaux et urbains de transport.data.gouv.fr et OSM France entière » (sa preuve demande aussi le test Brienon-sur-Armançon → Wissous) et « GTFS d'Île-de-France Mobilités » (sa preuve demande le test Laroche-Migennes → Flers). Ces deux tests ne se cochent que s'ils passent ; sinon l'écart est consigné et la case reste ouverte.

## 2. D54 — Ordre revu : les données nationales et le premier trajet réel avant Sentry

Brainditech veut juger le moteur dans l'app, qui n'affiche jusqu'ici que des valeurs en dur. L'ordre devient :

1. spec 08 : données nationales sur le PC, avec la mesure mémoire (cette spec) ;
2. spec 09 : clé d'appareil et limite de débit, `GET /v1/lieux`, `POST /v1/itineraires` ;
3. spec 10 : l'app branchée (formulaire → Résultat réel) ;
4. ensuite la spec 07 (Sentry, déjà rédigée, en attente) et la suite du PLAN.

Écarté : finir la phase 0 avant tout (Sentry n'apporte rien au jugement du moteur).

## 3. Décisions

- **Tout ce qui est publié, sans tri à la main.** Liste lue sur `https://transport.data.gouv.fr/api/datasets` le jour du téléchargement : jeux de type `public-transit`, ressources au format `GTFS`, `is_available: true` et de type `main` (le producteur les présente comme principales). Les ressources `other`, `update` et `api` sont écartées (versions modifiées par des tiers, mises à jour partielles, temps réel). Constaté le 2026-11-04 : 500 jeux de transport public, 491 avec au moins un GTFS.
  - Les doublons (un réseau publié seul et dans un « référentiel complet », une version ancienne et une nouvelle) sont fusionnés par MOTIS : `merge_dupes_inter_src: true` et `merge_dupes_intra_src: true` (options de `config.h` du tag v2.11.4).
  - Écarté : choisir les jeux à la main (impossible à tenir pour 500 jeux, et c'est le tri qu'on veut mesurer).
- **Contrôle de chaque fichier avant import** : un zip qui ne s'ouvre pas, qui range ses fichiers dans un sous-dossier, ou à qui il manque `stops.txt`, `routes.txt`, `trips.txt`, `stop_times.txt` ou à la fois `calendar.txt` et `calendar_dates.txt`, est écarté et inscrit dans `donnees/rejets.json` avec sa raison. Un téléchargement en échec aussi. Si MOTIS refuse malgré tout un jeu à l'import, il est écarté à la main, avec sa raison, et l'import relancé (aucune option de MOTIS n'ignore les erreurs, constaté dans `config.h`).
- **Étiquette MOTIS** : `r<id de la ressource>` (ex. `r83970`), sans `_` (séparateur de MOTIS). La correspondance étiquette → jeu, producteur, URL, licence est dans le manifeste.
- **Fenêtre d'horaires** : `first_day: TODAY`, `num_days: 90`. Les données nationales servent à des trajets réels, pas à un test figé (les fixtures restent figées, invariant 15).
  - Écarté : 365 jours (mémoire inutile ; les GTFS publiés couvrent rarement plus de quelques mois).
- **OSM** : `france-261102.osm.pbf` de Geofabrik (cible de `france-latest`, 5 108 959 196 octets, modifié le 2026-11-03), vérifié par son md5 publié puis sha256 relevé.
- **Rien de tout ça dans git, ni en CI.** Les fichiers vont dans `donnees/` (ignoré par git). La CI garde le couloir figé et le test Joigny (invariants 14 et 15) : ses machines n'ont ni le disque ni la mémoire pour la France.
- **Un MOTIS national à part, sans toucher au stack des fixtures** : `docker-compose.national.yml` surcharge le compose existant (configuration et données lues dans `donnees/`, manifeste de l'API pris dans `donnees/manifest.json`), lancé sous le projet Docker `itinhero-national` : ses volumes sont distincts. Les deux stacks utilisent les mêmes ports, on n'en fait tourner qu'un à la fois.
- **Script de téléchargement en TypeScript dans le serveur** (`serveur/src/donnees/`), logique pure testée par vitest, lancé par `npm run donnees:nationales`. Il écrit `donnees/manifest.json` (même schéma que `fixtures/manifest.json`), `donnees/rejets.json` et `donnees/config.yml`.
- **Licences** : relevées par jeu dans le manifeste (constaté sur les 516 jeux chargés : 345 LOv2, 150 ODbL, 17 non précisées, 3 Licence Ouverte FR, 1 Mobility Licence). Usage sur le PC seulement ; la question de l'attribution dans l'app reste ouverte (R9) et se tranche avant la mise en production.

## 4. Mesure de la mémoire (R1)

`docker stats` du conteneur MOTIS relevé toutes les 10 s pendant l'import, au repos après démarrage, et pendant une série de recherches (Brienon → Joigny, Laroche-Migennes → Flers, Brienon → Wissous, Paris → Marseille). Résultats, méthode et date dans `docs/decisions/0002-memoire-motis.md`, avec la durée de l'import et la taille de `/data`.

## 5. Fichiers touchés

| Fichier | Changement |
|---|---|
| `.gitignore` | `/donnees/` |
| `serveur/src/donnees/selection.ts` + `.test.ts` | lecture Zod de la réponse de l'API, choix des ressources, étiquettes |
| `serveur/src/donnees/controle.ts` + `.test.ts` | contrôle d'un zip GTFS |
| `serveur/src/donnees/telecharger.ts` | téléchargement, sha256, manifeste, rejets, configuration MOTIS |
| `serveur/package.json` | script `donnees:nationales` |
| `docker-compose.national.yml` (nouveau) | surcharge du compose (§3) |
| `docs/decisions/0001-cadrage-v1.md` | D54 |
| `docs/decisions/0002-memoire-motis.md` | mesure France entière |
| `PLAN.md`, `docs/ETAT.md` | ordre des phases, cases et preuves |

## 6. Critères d'acceptation

1. Tests vitest verts : choix des ressources (main gardée, other/update/api écartées, indisponible écartée, format non GTFS écarté), étiquettes sans `_`, contrôle de zip (fichiers manquants, sous-dossier, zip illisible).
2. `donnees/manifest.json` passe le schéma de `serveur/src/manifest.ts` et liste chaque jeu chargé avec URL, date, taille, sha256 et licence ; `donnees/rejets.json` liste chaque jeu écarté avec sa raison.
3. Import MOTIS terminé, `/health` de l'API 200 avec le manifeste national.
4. Mémoire mesurée (import, repos, recherches) et consignée (§4).
5. Recherches d'essai faites et consignées dans ETAT, chacune avec ce que MOTIS répond : Laroche-Migennes → Flers le 12/11 (un passage par le métro ou le RER à Paris est attendu), Brienon-sur-Armançon → Wissous. Brainditech les compare à SNCF Connect.
6. Lint, types et tests de l'app et du serveur verts ; la CI inchangée et verte.

## 7. Constats (2026-11-04)

### Téléchargement et contrôle

526 ressources GTFS principales listées par l'API ce jour-là (contre 491 jeux la veille au soir : l'API compte les ressources, pas les jeux), 516 gardées (1 825 Mo), 10 écartées (`docs/preuves/2026-11-04-donnees-nationales/rejets.json`) :

| Raison | Jeux |
|---|---|
| `locations.geojson` commence par un BOM UTF-8 : MOTIS refuse **tout** l'import (« syntax error [boost.json:1] ») | TAD zonaux Pass Thelle Bus et Sablons Bus (Oise) |
| `agency_timezone` vide : MOTIS refuse tout l'import (« timezone not set ») ; le fuseau n'est pas deviné | Tignes, Val d'Isère |
| `routes.txt` avec un guillemet jamais refermé : MOTIS perd l'agence, « timezone not set » | Tiva urbain (Vire) |
| Fichiers rangés dans un sous-dossier | 2 jeux |
| Fichiers obligatoires manquants, zip illisible, HTTP 404 | 3 jeux |

Les trois premiers cas ont été trouvés un par un, chacun par un import qui échoue (environ 2 min chacun, MOTIS gardant les étapes déjà faites), puis ajoutés au contrôle avec leur test. Un seul jeu défectueux suffit à bloquer l'import de toute la France : pour l'ingestion nocturne (phase 8), le contrôle par jeu est indispensable.

Défaut de données relevé, sans effet bloquant : un jeu place l'arrêt « BRIENON SUR ARMANCON-MAIRIE » en 0,0 (géocodeur de MOTIS). À traiter dans la spec de `/v1/lieux` (écarter les coordonnées nulles).

### Recherches d'essai (MOTIS seul, `/api/v6/plan`, départ dès l'heure dite, heures de Paris)

| Trajet, 12/11/2026 | Meilleure réponse de MOTIS | Temps de réponse |
|---|---|---|
| Brienon Mairie → lieu de rendez-vous à Joigny, dès 05:00 | car K941 06:27 → Saint-Florentin, marche 48 min, train P5 07:37 → Laroche-Migennes, train P31 08:03 → Joigny, arrivée 08:26 ; aussi la voie du test Joigny (arrivée 09:24) | 0,2 s |
| Laroche-Migennes → Flers, dès 05:00 | TER 05:03 → Paris Bercy 06:35, métro 6 Bercy → Montparnasse 06:57-07:11, train K4 07:14 → Flers 10:01, arrivée 10:09 (au lieu du détour de 16:16 de l'issue 0006) | 1,5 s |
| Brienon Mairie → Wissous, dès 05:00 | car K941 06:27 → gare de Troyes 07:37, train 07:45 → Paris Est 09:16, marche → Gare du Nord, RER B 09:35 → Antony, bus 297 → Wissous, arrivée 10:18 | 1,1 s |
| Paris Gare de Lyon → Marseille Vieux-Port, dès 07:00 | train 07:38 → Marseille Saint-Charles 10:57, métro M1 → Vieux-Port, arrivée 11:04 | 1,0 s |

Remarques pour les specs 09 et 10 :
- MOTIS classe le TGV Paris → Marseille en `REGIONAL_RAIL` (ligne « 631B ») : le libellé affiché ne peut pas se fier au seul `mode`.
- Des étapes `ODM` (transport à la demande, ex. ligne 856 de Brienon) apparaissent : réservation obligatoire, à afficher comme telle.
- Le MOTIS national tourne sur le PC sous le projet Docker `itinhero-national` ; le stack des fixtures est arrêté (`docker compose stop`, données conservées).
