# Spec 05 — Oracle GTFS et test Joigny

> Rédigée le 2026-11-03. État : **approuvée par Brainditech le 2026-11-04 (« oui vas y »), appliquée (§11).**
> Branche : `phase-0/joigny`. Une seule PR (D34, point 4).
> Mise à jour le 2026-11-04 après D45 à D51 : le test reste sur les fixtures figées du couloir (D16) ; l'OSM France entière (D46, qui remplace A13) relève de la phase 2 bis.
> Décisions liées : D2, D3, D16, D17, D42, D46, A14, A15 ; nouvelles décisions proposées D43 et D44 (§3). Invariants : 13, 14, 15. Risque : R2 (tranché, sert ici).

## 1. But

Prouver par un test automatique que MOTIS, chargé avec les horaires figés, retrouve la voie de référence du 12/11/2026 (car K941 → marche → train → marche, arrivée au lieu de rendez-vous à Joigny avant 10:00 moins la marge), et qu'il ne fabrique rien les jours où elle n'existe pas. Les valeurs attendues ne sont jamais écrites dans le test : elles sont tirées des fixtures par un **oracle**, un lecteur GTFS indépendant de MOTIS (invariant 15).

Cases de PLAN.md (phase 0) : « Oracle GTFS » et « Test Joigny ». Le job CI qui lance ce test vient avec la spec 06.

## 2. Ce qui est déjà constaté (2026-11-03)

Lu directement dans les fixtures (`fixtures/_rapatrie-2026-10-19/*.zip`, sha256 du manifeste) par un script Python jetable, pour écrire cette spec. Le test, lui, tirera ces valeurs par l'oracle.

| Constat | Source |
|---|---|
| Car K941 (SNCF, `route_type 3`) : Brienon-sur-Armançon Mairie 06:27 → Saint-Florentin-Ville 06:37, service `000015` | `stop_times.txt`, `trips.txt` SNCF ; arrêts `StopPoint:OCECar TER-87117994` → `StopPoint:OCECar TER-87683334` |
| Le service `000015` circule le 10/11, le 12/11 et le 13/11 ; **pas le 11/11** (férié) **ni le 15/11** (dimanche) | `calendar_dates.txt` SNCF (le GTFS SNCF n'a pas de `calendar.txt`) |
| Trains Saint-Florentin-Vergigny → Joigny le 12/11 : 06:50, **08:50 → 09:09** (K7), puis 14:52… ; le 11/11 et le 15/11, le premier est à 10:50 | `stop_times.txt`, `calendar_dates.txt` SNCF ; arrêts `StopPoint:OCETrain TER-87683318` → `StopPoint:OCETrain TER-87683243` |
| Mobigo 803 (`route_type 3`, `pickup_type=2`) : Brienon Mairie (`600326`) 08:25 → « SAINT FLORENTIN-VERGIGNY 3 RUE DE LA GARE » **08:50**, du lundi au samedi, **y compris le 11/11** : correspondance nulle avec le train de 08:50 | `stop_times.txt`, `calendar.txt`, `calendar_dates.txt` Mobigo |
| Aucun départ Mobigo de Brienon Mairie le 15/11 avant 10:00 | idem |
| Les deux GTFS sont en `Europe/Paris` (`agency_timezone`) | `agency.txt` |
| `stop_times.txt` SNCF : 82,8 Mo décompressé (national) ; Mobigo : 42 Ko | `unzip -l` |
| Destination : lieu de rendez-vous, 19 route de Chamvres, Joigny, lat 47.974911, lon 3.385793 (dans le rectangle de l'extrait OSM, D41) | coordonnées du constat viamobigo.fr du 2026-10-19 (`docs/04-dissection/captures/SOURCES.md`) |
| MOTIS (spec 04, §11) : heures rendues en UTC ; `useRoutedTransfers=true` obligatoire ; marche Saint-Florentin-Ville → gare de 47,8 min (3 431 m) ; voie retrouvée le 12/11 (Joigny 09:09, agence 09:23), et une voie plus tôt par P5 07:37 + P31 via Laroche-Migennes (Joigny 08:11) | `docs/specs/04-serveur-motis.md` §11 |

### Pourquoi « arriver avant » renvoyait des jours précédents

Doc de `/api/v6/plan` du tag v2.11.4 (`openapi.yaml`, lue le 2026-11-03) :
- `timetableView` vaut `true` par défaut : MOTIS cherche toutes les possibilités d'une **fenêtre** de temps ;
- `numItineraries` vaut 5 par défaut : c'est un **minimum** ; MOTIS élargit la fenêtre jusqu'à en trouver 5 ;
- avec `arriveBy=true`, la fenêtre porte sur l'arrivée et s'élargit vers le passé.

Hypothèse : le 12/11 n'offre que 2 ou 3 possibilités avant 09:50, MOTIS élargit donc la fenêtre jusqu'au 10/11 pour atteindre 5. Elle sera vérifiée une fois à l'application (§10, étape 3) ; la conception de §4 ne dépend pas d'elle.

## 3. Décisions proposées

- **D43 — Lecture des GTFS par l'oracle : `fflate` (décompression en flux) et `csv-parse` (CSV)**, versions constatées à l'installation (aujourd'hui 0.8.3 et 7.0.3), doc de ces versions lue avant de coder. `stop_times.txt` est lu en flux et filtré sur les arrêts du scénario : jamais 83 Mo en mémoire.
  - Raison : Node n'a pas de lecteur zip intégré ; les GTFS ont des champs entre guillemets, un BOM, des fins de ligne `\r\n` ; deux bibliothèques mûres, sans dépendance native.
  - Écartés : décompresser les zip dans `fixtures/` (données en double, sha256 à suivre deux fois) ; un parseur CSV maison (cas limites du format) ; `adm-zip` (charge tout le fichier en mémoire).
- **D44 — Recherche au départ, sur le jour demandé, filtrée par l'API** (met en œuvre A15). Pour « arriver avant H avec une marge M le jour J », l'API demande à MOTIS les départs du jour J de 00:00 jusqu'à H − M (heure de Paris), `arriveBy=false`, `useRoutedTransfers=true`, puis garde seulement les possibilités qui **partent le jour J** et **arrivent au plus tard à H − M**. Le verdict est « possible » s'il en reste au moins une, « impossible » sinon (invariant 13). `arriveBy=true` n'est pas utilisé.
  - Raison : une possibilité d'un autre jour ne peut jamais compter pour le jour demandé, quelle que soit la façon dont MOTIS élargit sa fenêtre.
  - Écartés : `arriveBy=true` avec `timetableView=true` (renvoie d'autres jours, constat de la spec 04) ; `arriveBy=true` avec `timetableView=false` (une seule possibilité, et le comportement quand le jour est vide n'est pas documenté) ; faire confiance au filtrage de MOTIS sans le revérifier.

## 4. Ce qui est construit

Tout est dans `serveur/` (D40). Aucun fichier de `src/` ni de `android/` n'est touché.

### Oracle (`serveur/src/oracle/`)

Lecteur GTFS indépendant de MOTIS. Il ne calcule aucun itinéraire et ne connaît pas OSM : il répond seulement à des questions sur les fichiers.
- `circule(jeu, service_id, date)` : `calendar.txt` (jours de la semaine, bornes) puis `calendar_dates.txt` (exception 1 ajoute, 2 retire) ; un jeu sans `calendar.txt` (SNCF) ne vit que par `calendar_dates.txt`.
- `courses(jeu, arretDepart, arretArrivee, date)` : les courses qui circulent ce jour-là et desservent les deux arrêts dans cet ordre, avec `trip_id`, `route_short_name`, `route_type`, heure de départ, heure d'arrivée et `pickup_type` au départ. Heures GTFS locales, y compris au-delà de 24:00 (jour de service).
- `arret(jeu, stop_id)` : nom et coordonnées tirés de `stops.txt`.
- Avant toute lecture, le sha256 de chaque fichier est vérifié contre `fixtures/manifest.json` (`verifierManifest`, spec 04) : l'oracle et MOTIS lisent les mêmes fichiers, sinon le test échoue (invariant 14).

### Recherche et verdict (`serveur/src/itineraires/`, `serveur/src/temps.ts`)

- `temps.ts` : conversion UTC ↔ heure de Paris par `Intl` (ICU complet dans Node 22), bornes UTC d'un jour de Paris.
- `motis-plan.ts` : construit la requête de D44, appelle `/api/v6/plan`, valide la réponse par un schéma Zod (sous-ensemble utile : `itineraries[].legs[]` avec `mode`, `from`, `to`, `startTime`, `endTime`, `tripId`, `routeShortName`, `duration`), convertit les heures en heure de Paris.
- `verdict.ts` : filtre de D44 (jour J, arrivée ≤ H − M) et verdict. C'est la logique que `POST /v1/itineraires` reprendra en phase 3 ; `src/domaine/verdict.ts` côté app (spec 00) restera tel quel jusque-là.

Paramètres MOTIS laissés à leur valeur par défaut et notés : `maxPreTransitTime` et `maxPostTransitTime` (15 min). La marche gare de Joigny → agence (14 min, spec 04) passe sous cette limite ; la limite de la première et de la dernière marche se tranchera en phase 3.

### Test Joigny (`serveur/src/joigny/`)

- `scenario.ts` : les **entrées** du scénario, validées par Zod, sans aucune valeur attendue :
  - origine : arrêt SNCF Brienon-sur-Armançon Mairie, coordonnées tirées de `stops.txt` par l'oracle ;
  - destination : l'agence (coordonnées du §2) ;
  - rendez-vous 10:00, marge 10 min (D17) ;
  - identifiants des arrêts de la voie de référence : Brienon Mairie et Saint-Florentin-Ville (car SNCF), Saint-Florentin-Vergigny et Joigny (train SNCF), Brienon Mairie et « Saint-Florentin-Vergigny 3 rue de la gare » (Mobigo).
- `joigny.integration.test.ts` : interroge le vrai MOTIS (`MOTIS_URL`, par défaut `http://127.0.0.1:8080`). MOTIS injoignable ⇒ échec explicite, jamais un test sauté.
- Le test d'intégration a sa propre commande, `npm run test:joigny` (config `vitest.joigny.config.ts`) ; `npm test` reste sans réseau ni Docker.

## 5. Fichiers touchés

| Fichier | Changement |
|---|---|
| `serveur/package.json`, `serveur/package-lock.json` | `fflate`, `csv-parse` (D43) ; script `test:joigny`. |
| `serveur/vitest.config.ts` | Exclut `*.integration.test.ts`. |
| `serveur/vitest.joigny.config.ts` (nouveau) | Inclut seulement le test Joigny, délai allongé. |
| `serveur/src/oracle/gtfs.ts`, `calendrier.ts`, `courses.ts` (+ tests) | Oracle. |
| `serveur/src/temps.ts` (+ test) | Fuseau. |
| `serveur/src/itineraires/motis-plan.ts`, `verdict.ts` (+ tests) | D44. |
| `serveur/src/itineraires/__exemples__/plan-2026-11-12.json` (nouveau) | Une réponse réelle de MOTIS enregistrée à l'application, réduite, pour tester le schéma et la conversion sans MOTIS. Ce n'est pas une valeur attendue du test Joigny. |
| `serveur/src/joigny/scenario.ts`, `joigny.integration.test.ts` (nouveaux) | Test Joigny. |
| `docs/decisions/0001-cadrage-v1.md` | D43, D44 une fois approuvées. |
| `PLAN.md`, `docs/ETAT.md` | Cases cochées avec leur preuve. |
| `README.md` | Commande `npm run test:joigny`. |

## 6. Source de chaque valeur

Aucun écran n'est modifié. Dans le test :
- heures, `trip_id`, lignes et jours de circulation attendus : l'oracle, depuis `fixtures/` (sha256 vérifié) ;
- marche : MOTIS sur l'extrait OSM figé, bornée par D42 (≤ 50 min) ;
- rendez-vous, marge, coordonnées de l'agence : entrées du scénario (§4), pas des valeurs attendues.

## 7. Sécurité

Aucun secret, aucune route ajoutée à l'API, aucun port ouvert en plus. Le test appelle MOTIS sur `127.0.0.1` depuis le PC. Les coordonnées de l'agence sont celles d'un lieu public, pas d'une personne.

## 8. Critères d'acceptation

1. **Oracle** (tests unitaires sans MOTIS, sur un mini-GTFS écrit par le test, plus quelques lectures des vraies fixtures) :
   - `calendar_dates` seul (SNCF) : exception 1 ⇒ circule, absence ⇒ ne circule pas ;
   - `calendar` + `calendar_dates` (Mobigo) : jour de semaine dans les bornes ⇒ circule ; exception 2 ⇒ ne circule pas ; exception 1 hors calendrier ⇒ circule ;
   - heure au-delà de 24:00 rendue sans erreur ; ordre des arrêts respecté (A puis B, jamais B puis A) ;
   - BOM et champs entre guillemets lus correctement ;
   - un sha256 faux ⇒ l'oracle refuse de lire.
2. **Fuseau et verdict** (tests unitaires) : 2026-11-12T05:27:00Z ⇒ 06:27 à Paris ; passage à l'heure d'été du 2027-03-28 correct ; une possibilité du 10/11 dans la réponse ⇒ ignorée pour une demande du 12/11 ; arrivée égale à H − M ⇒ gardée, une minute après ⇒ écartée ; liste vide ⇒ « impossible ».
3. **Schéma MOTIS** : la réponse enregistrée passe le schéma ; une réponse sans `itineraries` ou avec une heure illisible ⇒ rejet.
4. **Test Joigny, 12/11** : au moins une possibilité retenue (D44) dont les étapes sont, dans l'ordre, une marche facultative, un car, une marche, un train, une marche, avec :
   - car = la course que l'oracle donne pour K941 Brienon Mairie → Saint-Florentin-Ville ce jour-là (`trip_id` compris dans le `tripId` de MOTIS), heures identiques à l'oracle à la minute près ;
   - marche entre Saint-Florentin-Ville et Saint-Florentin-Vergigny, au plus 50 min (D42), et départ du train après la fin de la marche ;
   - train = une course que l'oracle donne de Saint-Florentin-Vergigny à Joigny ce jour-là, heures identiques ;
   - arrivée à l'agence ≤ 09:50, départ le 12/11 ; verdict « possible ».
5. **11/11 férié** : l'oracle constate que la course du car du 12/11 ne circule pas et qu'aucune course K941 ne part de Brienon Mairie avant le rendez-vous ; MOTIS ne renvoie aucune possibilité retenue ; verdict « impossible ».
6. **Dimanche 15/11** : mêmes constats de l'oracle, plus aucun départ Mobigo de Brienon Mairie ; verdict « impossible ».
7. **Correspondance 803 de 0 min exclue** (12/11) : l'oracle constate que l'arrivée de la 803 à Saint-Florentin-Vergigny égale le départ du train ; aucune possibilité de MOTIS n'enchaîne cette course de la 803 et ce train.
8. Si MOTIS trouve une possibilité le 11/11 ou le 15/11, ou ne trouve pas la voie du 12/11, **le test échoue et je m'arrête** : constat écrit dans `docs/issues/`, analyse soumise à Brainditech. Rien n'est ajusté pour faire passer le test.
9. `serveur/` : `npx tsc --noEmit`, `npm test` et `npm run test:joigny` verts ; racine : `npx expo lint`, `npx tsc --noEmit`, `npm test` verts.

## 9. Ce qui n'est pas fait ici

- Le job CI (spec 06), donc la case « Job CI qui lance MOTIS et le test Joigny ».
- La route `POST /v1/itineraires`, les segments sourcés et le libellé du verdict (phase 3).
- La limite de la première et de la dernière marche (phase 3).
- Les données nationales et le test Laroche-Migennes → Flers (phase 2 bis, issue 0006). L'oracle est écrit pour lire n'importe quel GTFS, donc il servira tel quel à ce test.

## 10. Étapes de vérification

1. **Brainditech** : approuve la spec (ou la corrige).
2. **Claude** : installe `fflate` et `csv-parse`, lit leur doc, écrit l'oracle, le fuseau et le verdict avec leurs tests.
3. **Claude** : `docker compose up -d` (MOTIS déjà importé, redémarrage rapide) ; enregistre une réponse de `/api/v6/plan` ; vérifie une fois l'hypothèse de §2 (`arriveBy=true` le 12/11) et consigne le résultat ici, au §11.
4. **Claude** : `npm run test:joigny`, puis les vérifications du critère 9.
5. **Brainditech** : relit la PR et la fusionne.

## 11. Constats à l'application (2026-11-04)

- `fflate` 0.8.3 et `csv-parse` 7.0.3 installés (`npm install --save-exact`), API lue dans les fichiers de types et la doc de ces versions (`Unzip` + `UnzipInflate` en flux ; analyseur `parse` en flux, `columns`, `bom`).
- Format des identifiants rendus par MOTIS : arrêt `<jeu>_<stop_id>` (ex. `sncf_StopPoint:OCECar TER-87117994`) ; course `<date>_<heure>_<jeu>_<trip_id>` (ex. `20261112_06:14_sncf_OCESN43281R1187_R:…:737:20261211`). Le test compare donc la fin du `tripId` à `<jeu>_<trip_id>` de l'oracle.
- **Hypothèse du §2 vérifiée** : `arriveBy=true`, `time=2026-11-12T08:50:00Z` ⇒ 5 possibilités, dont 2 seulement le 12/11 (arrivées 08:26 et 09:24) ; les 3 autres datent du 10/11 et du 11/11. Avec `numItineraries=1`, une seule possibilité, du 12/11. MOTIS élargit bien la fenêtre vers le passé pour atteindre `numItineraries`.
- Recherche D44 (`time` = minuit de Paris en UTC, `searchWindow` = secondes jusqu'à H − M) : MOTIS renvoie aussi des possibilités hors fenêtre (12/11 : arrivées 10:26, 14:24, 17:24 ; 11/11 : quatre possibilités du 12/11 ; 15/11 : cinq du 16/11). Le filtre de `verdict.ts` les écarte toutes : 2 retenues le 12/11, 0 le 11/11 et le 15/11.
- MOTIS rend une course Mobigo à `pickup_type=2` (856) en mode `ODM` (transport à la demande).
- Écarts au §4, mineurs : l'assemblage de l'oracle est dans `serveur/src/oracle/oracle.ts` (classe `Oracle`), les tests de l'oracle sont regroupés dans `oracle.test.ts` ; une fonction `departs(jeu, arret, date)` s'ajoute à `courses`, pour les critères 5 et 6 (« aucun départ avant le rendez-vous »). Elle compte tout passage où la montée est permise, terminus compris : le constat est plus strict, pas plus lâche.
- Le test Joigny n'utilise pas `beforeAll` : quand la préparation échoue, vitest y marque les tests « skipped ». Chaque test attend la préparation, donc MOTIS injoignable ⇒ 4 tests en échec (essayé avec `MOTIS_URL=http://127.0.0.1:9`).
- Le test sait échouer : avec `marcheMaxMinutes` à 45, le critère 4 échoue (« marche de 48 min (D42) »), essayé puis remis à 50.
- Durée : `npm test` du serveur 1 s (39 tests) ; `npm run test:joigny` 41 s, surtout la lecture répétée de `stop_times.txt` SNCF (83 Mo) par l'oracle.
- Critère 9 : serveur `npx tsc --noEmit`, `npm test` (39), `npm run test:joigny` (4) verts ; racine `npx expo lint`, `npx tsc --noEmit`, `npm test` (25) verts.
