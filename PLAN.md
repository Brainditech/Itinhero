# PLAN — Itinhero v1

> Créé le 2026-11-02 à l'issue de l'interview de cadrage. Objectif élargi le 2026-11-04 (D45 à D51) : une seule application, toute la France, de porte à porte, aller et retour, tout dans la v1.
> Décisions : [docs/decisions/0001-cadrage-v1.md](docs/decisions/0001-cadrage-v1.md).
> Invariants : [docs/architecture.md](docs/architecture.md).
> Suivi : [docs/ETAT.md](docs/ETAT.md).
> Ordre de lecture pour reprendre le travail : `docs/ETAT.md` → `PLAN.md` → `docs/architecture.md`.

## 1. Règles du plan

1. **Une fonctionnalité = une branche = une PR.**
   - La PR est relue par l'outil de revue.
   - Chaque remarque est vérifiée contre le code actuel. Jamais « Apply suggestion » ni « Autofix ».
   - Aucune fusion avec une remarque majeure ignorée ni avec une CI rouge.
   - Seule exception : le tout premier commit, fait par Brainditech sur `main` (D27).
2. **Spec avant chaque fonctionnalité.**
   - Claude écrit `docs/specs/NN-<fonctionnalité>.md` : but, décisions, fichiers touchés, source de chaque valeur affichée, sécurité, critères d'acceptation, étapes de vérification.
   - Brainditech approuve. Claude relit la spec approuvée et l'applique strictement.
3. **Doc officielle de la version installée** lue avant de brancher chaque service. Context7 sert à trouver la doc, pas à trancher.
4. **Preuve définie avant de coder.** Chaque case a sa ligne « Preuve : ». Elle est définie avant de coder et produite avant de cocher.
   - Une case ne se coche qu'avec son commit ou son test daté.
   - À moitié faite, elle reste décochée avec ce qui manque.
   - `docs/ETAT.md` est mis à jour **dans le même commit** que chaque case cochée.
5. **Chaque écran** est d'abord construit avec des valeurs en dur et comparé à sa maquette de `design/`, puis seulement branché sur les vraies données.
6. **Chaque service est branché dans la phase de l'écran qui en a besoin**, pas avant.
7. **Chaque critère d'acceptation qui porte de la logique a son test automatisé.** La CI (lint, types, tests, build) tourne sur chaque PR et bloque la fusion si elle est rouge.
8. **Un bug va dans `docs/issues/`** : reproduction, une seule hypothèse à la fois, cause racine, test de régression. L'analyse est approuvée par Brainditech avant la correction.
9. **Chaque décision s'écrit au moment où elle est prise** dans `docs/decisions/` : décision, raison, options écartées.
10. **`.env`** : rempli par Brainditech, jamais par Claude. Claude ne le lit jamais.
11. **Claude ne lance jamais l'app** : Brainditech la fait tourner dans un autre terminal.

## 2. Pile et versions constatées (2026-11-02)

| Brique | Version | Constat |
|---|---|---|
| expo | ~58.0.22 | `package.json` |
| react-native | 0.88.1 | `package.json` |
| react | 19.3.0 | `package.json` |
| expo-router | ~58.0.29 | `package.json` |
| @expo/ui | ~58.0.26 | `package.json` |
| react-native-reanimated | 4.7.1 | `package.json` |
| typescript | ~6.0.3 | `package.json` |
| MOTIS | v2.11.4 (2026-10-21) | https://api.github.com/repos/motis-project/motis/releases/latest, lu le 2026-11-02 |
| GTFS SNCF | feed_version 2026-10-18, sha256 `6892f10eb62e48e2a6dc6fd0ea6e27cbadcc1163d44b34e64661dae6be701dce` | `fixtures/_rapatrie-2026-10-19/sncf.zip` |
| GTFS Mobigo 89 | fichiers du 2026-09-21, sha256 `201780dac66a1663607d4c12f138d60c7e2b78ee7ae896eae06abbdc85d09db6` | `fixtures/_rapatrie-2026-10-19/mobigo89.zip` |

**À constater à l'installation**, chacune dans sa phase, avec la doc de la version installée :
- NativeWind ;
- expo-dev-client ;
- vitest ;
- @sentry/react-native et SDK Sentry Node ;
- Inngest (SDK et serveur auto-hébergé) ;
- Zod ;
- @maplibre/maplibre-react-native ;
- expo-sqlite, expo-secure-store, expo-notifications, expo-location ;
- GTFS d'Île-de-France Mobilités, GTFS régionaux et urbains (transport.data.gouv.fr), OSM France entière (D46) ;
- accès au covoiturage (D50, R14).

**Choix de pile** :
- Android d'abord ;
- Expo Router ;
- MapLibre (cartes hors ligne) ;
- MOTIS auto-hébergé en Docker, chargé avec les données de toute la France (D46) ;
- Claude par l'API Anthropic, clé côté serveur uniquement ;
- Inngest auto-hébergé ;
- Sentry ;
- NativeWind ;
- Node 22 LTS, TypeScript et Zod côté serveur ;
- vitest ;
- distribution par build local.

## 3. Variables d'environnement

Chaque variable est vérifiée au démarrage (présence et format). Le serveur refuse de démarrer sans ses secrets.

| Variable | Rôle | Déclarée dans |
|---|---|---|
| `ANTHROPIC_API_KEY` | clé de l'API Claude | .env du PC, .env du VPS |
| `CLAUDE_MODEL` | modèle retenu par mesure (D15) | .env du PC, .env du VPS |
| `CLAUDE_PLAFOND_MENSUEL_EUR` | plafond mensuel de coût | .env du PC, .env du VPS |
| `CLES_APPAREILS` | empreintes des clés d'appareil autorisées | .env du PC, .env du VPS |
| `LIMITE_REQ_MINUTE`, `LIMITE_REQ_JOUR` | limites de débit par clé | .env du PC, .env du VPS |
| `MOTIS_URL` | adresse interne de MOTIS dans le compose (non secrète) | `docker-compose.yml` (spec 04 : elle découle du compose) |
| `GTFS_SNCF_URL`, `GTFS_MOBIGO_URL`, `GTFS_RT_SNCF_URL` | sources officielles des horaires | .env du PC, .env du VPS |
| `SENTRY_DSN_SERVEUR`, `SENTRY_ENVIRONNEMENT` | Sentry serveur, `dev` ou `prod` | .env du PC, .env du VPS |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Inngest | configuration du serveur Inngest et .env de l'API (PC, VPS) |
| `EXPO_ACCESS_TOKEN` | envoi Expo Push sécurisé | .env du PC, .env du VPS |
| `EXPO_PUBLIC_API_URL` | adresse de l'API (non secrète) | .env du PC (au build de l'app) |
| `EXPO_PUBLIC_SENTRY_DSN` | DSN Sentry de l'app (non secret) | .env du PC (au build de l'app) |
| `EXPO_PUBLIC_TUILES_URL` | style des tuiles OpenFreeMap | .env du PC (au build de l'app) |
| `SENTRY_AUTH_TOKEN` | envoi des source maps | .env du PC (au build de l'app) |
| Mots de passe du keystore release | signature de l'APK | `~/.gradle/gradle.properties` du PC, hors dépôt |
| Secrets GitHub Actions | aucun en v1 : la CI tourne sans Claude (appels simulés) et sans Sentry | à ajouter seulement si une spec approuvée l'exige |

Rien de secret ne porte le préfixe `EXPO_PUBLIC_`. La clé d'appareil n'est pas une variable : elle est saisie une fois sur chaque téléphone et stockée dans `expo-secure-store` (A19).

## 4. Modèle de données

**Téléphone** (expo-sqlite, A3) :
- `reglages` : domicile (libellé et coordonnées), cartes de réduction possédées ;
- `trajets_enregistres` : instantané complet des segments avec leurs `source`, date de service, date des horaires, dernier état temps réel connu ;
- `rappels_programmes` : identifiants des notifications locales et échéances ;
- clé d'appareil : `expo-secure-store`.

**Serveur, fichiers versionnés** (validés par schéma Zod) :
- `data/tarifs.json` : réseau, produit, montant, réductions officielles (par exemple carte TRAIN Mobigo Solidaire −75 %), canal de vente, URL officielle, date de lecture ;
- `data/fiches/` : taxis et transport à la demande, avec nom, téléphone, communes desservies, délai de réservation, URL source, date de constat, « validé par Brainditech le … ». Seules les fiches validées s'affichent.
- `data/conseils.json` : gabarits de conseils de l'Assistant (D31), chacun avec un identifiant, un texte relu à trous remplis par les valeurs du moteur et des fiches, et « validé par Brainditech le … ». Seuls les gabarits validés s'affichent.

**Serveur, seule table persistante** : `abonnements_alerte` (id, trip_id, date de service, jeton push, expiration).
- Elle est stockée dans un fichier SQLite sur un volume Docker (A20) et purgée à J+1 (A21).

**Contrat de segment** :

```
source = { type, jeu, feed_version, trip_id | stop_id | fiche_id, date_service }
+ etat (en direct | horaire prévu, sans suivi en direct | retard | supprimé)
+ echeance (réservation, si applicable)
```

## 5. Routes de l'API et tâches Inngest

**Routes**. Toutes sont validées par Zod. La clé d'appareil est obligatoire sauf pour `/health` et `/api/inngest` (signé).

| Route | Rôle | Phase |
|---|---|---|
| `GET /health` | état de l'API, de MOTIS et date du jeu GTFS actif | 0 (squelette), 9 |
| `POST /v1/comprendre` | phrase → `{lieu_texte, date, heure, sens, marge}` par Claude, sous limite et plafond | 1 |
| `POST /v1/assistant` | demande + réglages en cours (sans historique ni coordonnées) → `{action, parametres}` ou `{conseil_id, valeurs}` par Claude, sous limite et plafond (D31) | 6 bis |
| `GET /v1/lieux?q=` | candidats du géocodeur MOTIS | 2 |
| `POST /v1/itineraires` | origine, destination, date, heure, sens, marge → verdict + possibilités (segments sourcés, tous les tarifs applicables) | 3 |
| `POST /v1/itineraires` (suite) | heure de fin du rendez-vous facultative → retour lié (D47) ; taxi comme étape (D48) | 3 |
| `POST /v1/itineraires` (suite) | covoiturage quand aucun transport public n'arrive à l'heure (D50) | 6 ter |
| `POST /v1/numeros` | lieu et type → numéros des fiches validées, ou trouvés sur une page publique vérifiée par le serveur, « non vérifié » (D49) | 4 |
| `GET /v1/fiches` | tarifs et fiches validées (la réduction est appliquée côté client) | 3, 4 |
| `POST /v1/etat-courses` | trip_ids + date → état temps réel | 7 |
| `POST /v1/abonnements`, `DELETE /v1/abonnements/:id` | abonnement d'alerte minimal | 7 |
| `POST /api/inngest` | point d'entrée des fonctions Inngest | 7 |

**Tâches Inngest** :

| Tâche | Déclencheur | Rôle | Phase |
|---|---|---|---|
| `suivi-retards` | cron toutes les minutes tant qu'il y a des abonnements actifs | lit le temps réel MOTIS, applique les seuils de D21, envoie par Expo Push | 7 |
| `purge-abonnements` | cron quotidien | supprime les abonnements expirés | 7 |
| `replanification` | événement de `suivi-retards` | relance la recherche depuis le prochain arrêt prévu, envoie l'alternative (D51) | 7 |
| `ingestion-gtfs` | cron nocturne (Europe/Paris) | pour chaque jeu (D46) : téléchargement, sha256, import MOTIS à part, contrôles, bascule ou alerte Sentry | 8 |

## 6. Phases

### Prérequis — Maquettes (avant la phase 0)

Inspiration : la frise de Transit et l'accueil de SNCF Connect (`docs/04-dissection/`), avec notre propre identité. Jamais leurs logos ni leurs couleurs. Tout est rangé et versionné dans `design/`, et validé par Brainditech.

- [x] Prompt d'image rédigé à partir de ce PLAN.md.
  Preuve : `design/prompt.md`, daté.
  Fait : `design/prompt.md`, 2026-11-02, validé par Brainditech.
- [x] Planche de tous les écrans.
  Preuve : `design/planche-ecrans.png`, validation de Brainditech datée dans ETAT.
  Fait autrement (D32) : un écran par image au lieu d'une planche, les 9 écrans validés par Brainditech le 2026-11-02 (`design/<écran>/0N-*.png`).
- [x] Design system : couleurs, polices, composants (dont les blocs de la frise et les badges d'état).
  Preuve : `design/design-system.md` (jetons), plus image, validés.
  Fait : `design/design-system.md` et `design/design-system/design-system.png`, 2026-11-02, validés par Brainditech (défauts connus listés dans `design/design-system.md`).
- [x] Logo, notre propre identité.
  Preuve : `design/logo.*`, validé.
  Fait : `design/logo/logo.png`, 2026-11-02, validé par Brainditech (symbole monochrome ; fichier d'icône 1024 px à produire en phase 0).
- [x] Chaque écran principal agrandi : Accueil, Confirmation du lieu, Résultat, Détail, Mes trajets, Réglages.
  Preuve : `design/ecrans/NN-*.png`, validés.
  Fait (chemin changé par D32) : `design/accueil/01-accueil.png`, `02-formulaire-repli.png`, `design/confirmation-lieu/03-confirmation-lieu.png`, `design/resultat/04-resultat.png`, `design/detail/05-detail.png`, `design/mes-trajets/06-mes-trajets.png`, `design/reglages/07-reglages.png`, `design/notifications/08-notifications.png`, `design/assistant/09-assistant.png`, 2026-11-02, validés par Brainditech.

### Phase 0 — Socle

- [x] App lancée telle que créée.
  Preuve : capture sur émulateur ou téléphone, datée.
  Fait : `docs/preuves/2026-11-02-phase0-app-telle-que-creee-expo-go.jpg` (téléphone de Brainditech, Expo Go, 2026-11-02 21:34).
- [x] Development build (`expo-dev-client`, `npx expo run:android`).
  Preuve : capture de l'app en development build.
  Fait : `docs/preuves/2026-11-03-spec03-accueil-carte-attribution-repliee.png` (émulateur Android Studio « Medium Phone API 36.1 », 2026-11-03 12:04), spec 03.
- [x] Skills officielles des services dans `.claude/skills`.
  Preuve : liste et source de chaque skill dans le commit.
  Fait : `.claude/skills/SOURCES.md` (Sentry, Inngest, MapLibre, épinglées à leur commit ; Expo par plugin ; aucune skill officielle pour MOTIS, NativeWind, Zod, vitest), 2026-11-02, spec 00.
- [x] NativeWind installé et configuré avec les jetons du design system (compatibilité SDK 58 vérifiée, R12).
  Preuve : composant de démonstration stylé, plus capture.
  Fait : NativeWind 4.2.7 (Tailwind 3.4.19), jetons dans `src/theme/jetons.js`, écran d'Accueil stylé sur le téléphone de Brainditech (Expo Go) : `docs/preuves/2026-11-02-phase1-accueil-en-dur.jpg`, 2026-11-02. R12 levé pour NativeWind.
- [ ] Vérification des variables d'environnement au démarrage, côté app et côté serveur.
  Preuve : test vitest (variable absente ou mal formée ⇒ échec explicite).
  Fait à moitié (spec 04) : côté serveur, `serveur/src/env.test.ts` (5 tests : absente, mal formée sans recopier la valeur, protocole, port), 2026-11-03. Manque : côté app, avec la première variable `EXPO_PUBLIC_API_URL` lue par l'app (phase 1, branchement réel).
- [x] AGENTS.md complété :
  - pile et conventions ;
  - ordre de lecture `docs/ETAT.md` → `PLAN.md` → `docs/architecture.md` ;
  - « ne lance jamais l'app toi-même, je la fais tourner dans un autre terminal ».
  
  `CLAUDE.md` l'importe.
  Preuve : diff.
  Fait : diff de `AGENTS.md` et `CLAUDE.md` (`@AGENTS.md`), 2026-11-02, spec 00.
- [x] `.claude/settings.json` : refus de lire `.env*`, demande avant `git push`, autorisation de lint, types et tests.
  Preuve : demande de lecture de `.env` refusée, consignée dans ETAT.
  Fait : lecture de `.env` refusée par les permissions le 2026-11-02 (consigné dans ETAT). La demande avant `git push` se constatera à la première poussée.
- [x] vitest.
  Preuve : `npm test` vert avec un premier test.
  Fait : vitest 5.1.0, `npm test` vert le 2026-11-02 (5 tests de `src/domaine/verdict.test.ts`), spec 00.
- [ ] CI GitHub Actions (lint, types, tests, build) sur chaque PR et sur `main`. Pas de blocage technique de la fusion (D33) : on ne fusionne jamais en rouge.
  Preuve : une PR d'essai avec un test rouge volontaire, échec visible sur la PR (lien), jamais fusionnée ; puis la PR de la spec 06, verte.
  En cours (spec 06) : `.github/workflows/ci.yml`, job `verifications` ; vert en local le 2026-11-04. Manque : les deux exécutions sur GitHub.
- [ ] Sentry installé dans l'app et sur le serveur, sans donnée de trajet.
  Preuve : configuration, plus test du nettoyage `beforeSend`.
- [x] `docker compose` : MOTIS v2.11.4 épinglé, avec sa configuration et un serveur API squelette. Configuration MOTIS :
  - `max_footpath_length=50` (45 révisé par D42) ;
  - `osr_footpath` ;
  - routage à pied et en voiture ;
  - `geocoding`.
  
  Preuve : `docker compose up`, puis `/health` vert.
  Fait (spec 04, D39, D40) : le 2026-11-03 sur le PC de Brainditech, `docker compose up -d --build` sur un volume vide ⇒ `motis` (`ghcr.io/motis-project/motis:2.11.4`, utilisateur `motis`) et `api` (`itinhero-api:0.1.0`, utilisateur `node`) en `healthy` ; `curl localhost:3000/health` ⇒ 200, `motis: "ok"`, SNCF `feed_version` 2026-10-18 et Mobigo du 2026-09-21 avec leurs sha256 ; MOTIS arrêté ⇒ 503 `motis: "injoignable"`, API toujours `healthy`. Recherche MOTIS Brienon Mairie → Joigny du 12/11 : car K941 06:27, marche de 3 431 m, train K7 08:50 → Joigny 09:09 (heures de Paris). Tests `serveur/src/routes/health.test.ts`.
- [ ] `fixtures/manifest.json` (URL, date, feed_version, sha256 par fichier) et extrait OSM du couloir Brienon–Saint-Florentin–Joigny figé (sha256, date).
  Preuve : script de vérification des sha256, vert en CI.
  Fait à moitié (spec 04, D41) : `fixtures/manifest.json` (SNCF, Mobigo, extrait OSM `couloir-yonne-2026-11-02.osm.pbf` avec son origine Geofabrik), vérification des sha256 verte en local (`serveur/src/manifest.test.ts`), 2026-11-03. Manque : la même vérification verte en CI (spec 06).
- [x] Mesure de la mémoire de MOTIS chargé avec les fixtures (R1).
  Preuve : valeur, méthode et date dans `docs/decisions/`.
  Fait : `docs/decisions/0002-memoire-motis.md`, 2026-11-03 : 64 à 75 Mio au repos, 117 Mio au plus haut pendant les recherches, 60,8 Mo de données. À refaire avec l'OSM de production avant le choix du VPS.
- [ ] Mesure de la mémoire de MOTIS chargé avec les données de toute la France (D46, R1 rouvert).
  Preuve : valeur (au repos, pendant les recherches, pendant l'import), méthode et date dans `docs/decisions/0002-memoire-motis.md`.
- [x] Oracle GTFS : lecteur indépendant de MOTIS qui tire les valeurs attendues des fixtures.
  Preuve : tests unitaires sur stop_times et calendar_dates.
  Fait (spec 05, D43) : `serveur/src/oracle/`, 11 tests verts dans `serveur/src/oracle/oracle.test.ts` (calendar_dates seul, calendar + calendar_dates, ordre des arrêts, heure au-delà de 24:00, BOM et guillemets, sha256 faux refusé, lectures des vraies fixtures), 2026-11-04.
- [x] Test Joigny : voie car → marche → train → marche retrouvée le 12/11/2026, arrivée avant 10:00 moins la marge. Cas limites :
  - 11/11 férié (pas de car de 06:27) ;
  - dimanche 15/11 ;
  - correspondance 803 de 0 min exclue ;
  - rien ce jour-là ⇒ verdict « impossible ».
  
  Preuve : test vert, valeurs attendues tirées par l'oracle depuis `fixtures/`.
  Fait (spec 05, D44) : `cd serveur && npm run test:joigny`, 4 tests verts contre MOTIS v2.11.4 en `docker compose`, 2026-11-04. 12/11 : car K941 06:27 → marche 48 min → train K7 08:50 → Joigny 09:09 → agence 09:24, verdict « possible » ; 11/11 et 15/11 : « impossible » ; correspondance 803 → train de 0 min jamais proposée. Le test échoue si la marche est limitée à 45 min ou si MOTIS est injoignable (essayé). Manque : le même test vert en CI (case suivante, spec 06).
- [ ] Job CI qui lance MOTIS et le test Joigny.
  Preuve : exécution GitHub Actions verte, avec son lien.
  En cours (spec 06) : job `joigny` de `.github/workflows/ci.yml` ; scénario répété en local le 2026-11-04 (import 3 s, `healthy` en 12 s, 4 tests verts). Manque : l'exécution sur GitHub.

### Phase 1 — Accueil

- [x] Écran en valeurs en dur, comparé à `design/ecrans/01-*`.
  Preuve : capture côte à côte.
  Fait (avancé par D34) : `docs/preuves/2026-11-02-phase1-accueil-cote-a-cote.jpg`, 2026-11-02. Écarts connus : fond de carte voilé absent (image à produire), puces sur deux lignes (16 sp ne tient pas sur une ligne sur ce téléphone, retour à la ligne voulu par le design system). Corrigés par D35 (fond inventé, puces 14 sp, branche `phase-1/formulaire-repli`) ; nouvelle capture côte à côte, clavier ouvert, à fournir.
- [ ] Clé d'appareil (secure-store, saisie unique) et limites de débit côté serveur.
  Preuve : tests (sans clé ⇒ 401, au-delà des limites ⇒ 429).
- [ ] `POST /v1/comprendre` : Claude, sortie validée par Zod, date et fuseau Europe/Paris fournis par le serveur.
  Preuve : jeu d'au moins 30 phrases réussi à 27/30 au minimum, modèle retenu par mesure et consigné.
- [ ] Plafond mensuel et compteur de coût.
  Preuve : test (plafond atteint ⇒ formulaire de repli).
- [x] Formulaire de repli : lieu, date, heure, « arriver avant » / « partir à », marge.
  Preuve : test, plus capture.
  Fait : `src/domaine/demande.test.ts` (20 tests : validation, Europe/Paris, `formaterDate`, schéma Zod) ; captures du téléphone de Brainditech regardées le 2026-11-03 (hors dépôt, D38) : formulaire conforme à la maquette, bandeau, sélecteurs de date et d'heure, marge masquée avec « Partir à », erreur « Indiquez le lieu du rendez-vous. », « Chercher » au-dessus du clavier ; retour vers l'Accueil. Spec 02, issue 0004.
- [ ] Branchement réel.
  Preuve : capture d'une phrase dictée au clavier, comprise.

### Phase 2 — Confirmation du lieu

- [ ] Écran en valeurs en dur, comparé à sa maquette.
  Preuve : capture côte à côte.
- [ ] `GET /v1/lieux` (géocodeur MOTIS).
  Preuve : test « lieu de rendez-vous à Joigny », ou repli sur l'adresse saisie (R4).
- [ ] Confirmation demandée quand il y a plusieurs candidats.
  Preuve : test, plus capture.

### Phase 2 bis — Données nationales (D46)

- [ ] GTFS d'Île-de-France Mobilités et OSM Île-de-France dans MOTIS (versions, tailles, licences et sha256 constatés).
  Preuve : test d'intégration Laroche-Migennes → Flers le 12/11 avec une étape métro ou RER à Paris, arrivée au plus tard à celle de la chaîne TER + K4 tirée par l'oracle (environ 10:01, au lieu de 16:16 : issue 0006).
- [ ] GTFS régionaux et urbains de transport.data.gouv.fr et OSM France entière.
  Preuve : liste des jeux chargés (URL, date, sha256) dans le manifeste ; test Brienon-sur-Armançon → Wissous.
- [ ] Refus explicite hors des données chargées (étranger, réseau sans données).
  Preuve : test (départ ou arrivée hors données ⇒ « hors de la zone couverte », aucune possibilité affichée).
- [ ] Pack de carte hors ligne d'un voyage national (taille mesurée, R17).
  Preuve : carte de Flers affichée en mode avion.

### Phase 3 — Résultat

- [ ] Écran en valeurs en dur, comparé à sa maquette.
  Preuve : capture côte à côte.
- [ ] `POST /v1/itineraires` : normalisation de la réponse MOTIS en segments sourcés.
  Preuve : test (chaque segment a un `source`).
- [ ] Verdict et marge, sans changement de jour silencieux.
  Preuve : tests (Joigny « possible, départ 06:27 », 11/11, marge dite dans la phrase).
- [ ] Tris : arrivée la plus tôt, moins cher, moins de marche, sans réservation.
  Preuve : tests.
- [ ] Retour planifié à partir de l'heure de fin du rendez-vous (D47).
  Preuve : test Joigny aller et retour (fin du rendez-vous donnée ⇒ retour du même jour, ou « impossible » dit clairement).
- [ ] Taxi comme étape au début et à la fin (D48) : heure de prise en charge et heure limite pour appeler.
  Preuve : tests (heure de prise en charge = départ de l'étape suivante − durée de route − attente ; sans fiche ⇒ « délai non connu »).
- [ ] `data/tarifs.json` : schéma, collecte, validation par Brainditech, application des cartes côté client.
  Preuve : test (« prix non publié » sans fiche), au moins une fiche tarifaire validée.

### Phase 4 — Détail

- [ ] Écran en valeurs en dur, comparé à sa maquette.
  Preuve : capture côte à côte.
- [ ] Frise verticale et états d'horaire.
  Preuve : test de rendu, plus capture.
- [ ] Gabarits de consignes et glossaire à la première occurrence.
  Preuve : tests.
- [ ] Carte MapLibre : arrêts, tracé de marche, tuiles OpenFreeMap, attribution OSM.
  Preuve : capture.
- [ ] Annuaire `data/fiches/` validé. Avertissement ⚠ au-delà de 15 min de marche, avec un taxi pour cette étape.
  Preuve : tests (« aucun numéro connu »), au moins une fiche taxi validée.
- [ ] Lien Uber pré-rempli, et taxi de bout en bout (durée estimée, « prix non publié »).
  Preuve : test du lien, plus capture.
- [ ] Numéros trouvés hors des fiches, « non vérifié » (D49, `POST /v1/numeros`).
  Preuve : tests (numéro absent de la page ⇒ non affiché ; page injoignable ⇒ « aucun numéro connu » ; numéro affiché avec URL, date et « non vérifié » ; fiche validée ⇒ mention retirée), plus capture.

### Phase 5 — Mes trajets

- [ ] Écran en valeurs en dur, comparé à sa maquette.
  Preuve : capture côte à côte.
- [ ] Instantané expo-sqlite, ouvert en mode avion.
  Preuve : vidéo ou capture en mode avion.
- [ ] Pack de carte de la zone du trajet.
  Preuve : carte affichée en mode avion.
- [ ] Rappels locaux : veille, échéance de réservation, « partez dans N min ».
  Preuve : test de programmation, plus notification reçue.
- [ ] Plan de voyage complet enregistré : aller, retour, appels à passer (taxi, transport à la demande) avec leurs rappels (« appelez le taxi maintenant »).
  Preuve : test de l'instantané, plus capture en mode avion.

### Phase 6 — Réglages

- [ ] Écran en valeurs en dur, comparé à sa maquette.
  Preuve : capture côte à côte.
- [ ] Domicile.
  Preuve : test, plus capture.
- [ ] Cartes de réduction (stockées sur le téléphone, prix ajusté).
  Preuve : test (Solidaire −75 % sur un train Mobigo), aucune carte envoyée au serveur.
- [ ] « Depuis ma position » (autorisation au premier plan seulement).
  Preuve : capture de la demande d'autorisation, plus test.

### Phase 6 bis — Assistant (D31)

- [ ] Écran en valeurs en dur, comparé à `design/assistant/09-assistant.png`.
  Preuve : capture côte à côte.
- [ ] `POST /v1/assistant` : Claude transforme la demande en action (relancer avec de nouveaux réglages, trier, choisir un conseil), sortie validée par Zod. Aucune heure, aucun arrêt, aucun prix ni numéro dans la sortie de Claude.
  Preuve : tests (sortie hors schéma ⇒ rejet ; requête sans historique ni coordonnées).
- [ ] Jeu d'au moins 30 demandes (changer la marge, l'heure, le jour, le départ, « moins de marche », « si je rate le car »…).
  Preuve : réussi à 27/30 au minimum, modèle retenu par mesure et consigné.
- [ ] `data/conseils.json` : gabarits relus, validés par Brainditech, remplis par les valeurs du moteur et des fiches.
  Preuve : tests (gabarit non validé ⇒ non affiché ; valeur absente ⇒ « — »), au moins un gabarit validé.
- [ ] Confirmation avant toute modification : rien n'est relancé ni modifié sans « Relancer la recherche ».
  Preuve : test.
- [ ] Même clé d'appareil, mêmes limites de débit et même plafond de coût que `/v1/comprendre`. Au-delà, message et renvoi vers le formulaire.
  Preuve : tests (sans clé ⇒ 401, limites ⇒ 429, plafond ⇒ repli).
- [ ] Branchement réel.
  Preuve : capture de « Je voudrais 20 min d'avance au lieu de 10. » relancée et du nouveau résultat.

### Phase 6 ter — Covoiturage (D50)

- [ ] Source du covoiturage constatée (accès développeur BlaBlaCar ou lien profond, R14), décision écrite.
  Preuve : doc officielle lue et datée dans `docs/decisions/`.
- [ ] Covoiturage proposé quand aucun transport public n'arrive à l'heure, et en option sinon.
  Preuve : test (jour sans train ⇒ proposition de covoiturage), plus capture.

### Phase 7 — Temps réel et alertes

- [ ] GTFS-RT SNCF branché dans MOTIS, et couverture des cars K941 vérifiée (R3).
  Preuve : constat daté.
- [ ] `abonnements_alerte`, routes, purge.
  Preuve : tests (purge à J+1, aucun champ personnel).
- [ ] `suivi-retards` : seuils de D21, Expo Push et FCM.
  Preuve : flux GTFS-RT simulé ⇒ notification reçue, app fermée.
- [ ] Rafraîchissement d'un trajet enregistré (`/v1/etat-courses`).
  Preuve : test.
- [ ] Replanification (D51) : course supprimée ou correspondance cassée ⇒ alternative depuis le prochain arrêt prévu, envoyée par notification, rien remplacé sans accord.
  Preuve : suppression simulée dans un flux GTFS-RT de test ⇒ alternative reçue, app fermée.

### Phase 8 — Ingestion nocturne

- [ ] `ingestion-gtfs` pour chaque jeu (D46) : import à part, contrôles par jeu (arrêt Brienon Mairie présent, couverture au-delà de J+30), bascule ou alerte ; un jeu cassé n'empêche pas les autres.
  Preuve : tests (fichier cassé ⇒ ancien jeu conservé, plus événement Sentry).
- [ ] « Horaires du JJ/MM » et bandeau au-delà de 7 jours.
  Preuve : test, plus capture.

### Phase 9 — Surveillance et sécurisation

- [ ] Route `/health`.
  Preuve : test.
- [ ] Journaux serveur sans donnée personnelle.
  Preuve : test avec des chaînes canari.
- [ ] Chaque entrée validée par un schéma Zod.
  Preuve : test (entrée invalide ⇒ 400) sur chaque route.
- [ ] En-têtes HTTP de sécurité.
  Preuve : test des en-têtes.
- [ ] Secrets lus seulement dans l'environnement, refus de démarrer sans eux.
  Preuve : test.
- [ ] Limite de débit et plafond de coût sur toute route qui appelle Claude.
  Preuve : test.
- [ ] Conteneurs sans utilisateur root, avec healthcheck.
  Preuve : `docker inspect` (User, Healthcheck).
- [ ] Dev et prod séparés (`.env`, DSN, données).
  Preuve : diff de configuration.
- [ ] Erreur volontaire vue dans Sentry (app et serveur), puis retirée.
  Preuve : capture de l'événement, puis commit de retrait.
- [ ] Replay Sentry masqué, aucune donnée de trajet dans les événements reçus.
  Preuve : capture d'un replay masqué.

### Phase 10 — Déploiement VPS

- [ ] Choix du VPS argumenté à partir de la mesure de la phase 0 avec les données de toute la France.
  Preuve : décision dans `docs/decisions/`, avec le prix et sa source.
- [ ] Domaine et HTTPS (R10).
  Preuve : `/health` en HTTPS depuis le téléphone, PC éteint.
- [ ] Même `docker compose`, images étiquetées (jamais seulement `latest`).
  Preuve : `docker compose ps` avec les étiquettes.
- [ ] Retour à la version précédente essayé une fois.
  Preuve : journal daté.

### Phase 11 — Terminé v1

Build release et distribution (D22) :
- [ ] Clé de signature release créée une fois, hors git (`*.jks` ignoré), sauvegardée hors du PC (R13).
  Preuve : emplacement de la sauvegarde consigné (sans secret), `git check-ignore`.
- [ ] `npx expo run:android --variant release`, APK signé.
  Preuve : APK, plus empreinte du certificat.
- [ ] APK installé sur le téléphone de Brainditech et sur celui d'un proche.
  Preuve : capture.

Critères de fin : voir la section 7.

## 7. Terminé v1

La v1 n'est terminée que lorsque **toutes** ces cases sont cochées, chacune avec sa preuve :

- [ ] Test Joigny vert en CI (GTFS figés, cas limites compris).
- [ ] Parcours réel sur le **binaire de release signé** avec la clé de Brainditech (pas le development build) : phrase dictée, verdict, liste, frise, enregistrement, frise rouverte en mode avion. Capture ou vidéo datée.
- [ ] Serveur déployé sur le VPS, joignable PC éteint, avec ingestion nocturne et suivi des retards actifs.
- [ ] Alerte de retard simulée (flux GTFS-RT de test) reçue sur le téléphone, app fermée.
- [ ] Aucun secret dans l'APK (vérifié sur le fichier construit).
- [ ] Sentry :
  - erreur volontaire vue (app et serveur), puis le bouton retiré ;
  - aucune donnée de trajet dans les événements reçus ;
  - masquage du replay activé.
- [ ] `.claude/settings.json` : lecture de `.env` refusée, testée.
- [ ] Au moins une fiche tarifaire et une fiche taxi validées par Brainditech et affichées dans l'app avec leur source.
- [ ] Sur le VPS : la version déployée porte son étiquette (jamais seulement `latest`), et un retour à la version précédente a été essayé une fois.
- [ ] Trajet national juste : Laroche-Migennes → Flers par Paris (métro ou RER), comparé à SNCF Connect ou Google Maps (D46).
- [ ] Voyage planifié de porte à porte, aller et retour, avec taxi et heure d'appel, enregistré et rouvert en mode avion (D47, D48).
- [ ] Un numéro « non vérifié » affiché avec sa source (D49).
- [ ] Covoiturage proposé un jour sans train (D50).
- [ ] Alternative reçue après une suppression simulée (D51).

## 8. Hors v1

Révisé le 2026-11-04 par D45 : « France entière », « trajet dans Paris après la gare d'arrivée » et « covoiturage » sont entrés dans la v1.

- Paiement et réservation intégrés.
- iPhone.
- Grand public, publication sur un store, pages légales, comptes utilisateurs (l'app n'est pas publiée).
- Guidage photo (y compris en sous-sol sans réseau).
- Guidage pas-à-pas en cours de trajet.
- Réglage de la marche maximale.

## 9. Risques ouverts

| # | Risque | Où il se tranche |
|---|---|---|
| R1 | Mémoire de MOTIS inconnue avec les données de toute la France (OSM 4,8 Go, tous les GTFS, D46). Elle décide de la taille et du prix du VPS. Mesurée le 2026-11-03 sur le couloir seulement (117 Mio) | Phase 0 (mesure), phase 10 |
| R2 | ~~Distance réelle à pied Saint-Florentin-Ville → gare non mesurée~~ Tranché le 2026-11-03 : 3 431 m, 47,8 min (MOTIS) ; limite portée à 50 min (D42) | Phase 0 |
| R3 | Couverture des cars TER K941 par le GTFS-RT SNCF inconnue | Phase 7 |
| R4 | Le lieu de rendez-vous à Joigny peut manquer dans OSM ou y être mal nommée. Repli : saisie de l'adresse | Phase 2 |
| R5 | Tarifs TER/SNCF non ouverts, tarif Mobigo à vérifier : beaucoup de « prix non publié », donc un tri « moins cher » peu utile | Phase 3 |
| R6 | Peu ou pas de numéros de taxi publics, donc un annuaire possiblement vide | Phase 4 |
| R7 | Notifications : FCM, permission Android 13+, mise en veille. Expo Push exige un `projectId` EAS (compte Expo) même avec un build local | Phases 5 et 7 |
| R8 | Quotas et conditions à vérifier sur la doc officielle : minutes GitHub Actions (dépôt privé), **protection de branche sur un dépôt privé gratuit**, Sentry (dont le replay), OpenFreeMap, Inngest auto-hébergé, Expo Push | Phase concernée |
| R9 | Juridique, à vérifier : ODbL (attribution, base dérivée), attribution OSM, conditions de FCM | Phases 4 et 10 |
| R10 | HTTPS obligatoire sur Android : il faut un nom de domaine pour le VPS | Phase 10 |
| R11 | Dates relatives (« jeudi », heure d'été) : le serveur fournit à Claude la date et le fuseau Europe/Paris | Phase 1 |
| R12 | Compatibilité SDK 58 / RN 0.88.1 de MapLibre RN et de NativeWind (NativeWind constaté seulement en SDK 57 dans Tripagent) | Phases 0 et 4 |
| R13 | Perte de la clé de signature release : aucune mise à jour possible de l'APK installé | Phase 11 |
| R14 | Accès au covoiturage : accès développeur BlaBlaCar ouvert ou non, conditions ; à défaut, lien profond seulement | Phase 6 ter |
| R15 | Nombre et qualité des GTFS régionaux et urbains, rythme de mise à jour de chacun, jeux cassés | Phases 2 bis et 8 |
| R16 | Conditions d'utilisation des pages publiques où l'on lit les numéros (D49) | Phase 4 |
| R17 | Taille du pack de carte hors ligne pour un voyage national | Phases 2 bis et 5 |
