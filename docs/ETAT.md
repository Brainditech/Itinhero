# ÉTAT — Itinhero

> Mis à jour **dans le même commit** que chaque case cochée de [PLAN.md](../PLAN.md).
> Ordre de lecture pour reprendre le travail : ce fichier → `PLAN.md` → `docs/architecture.md`.

## Où on en est

- **Phase en cours** : 0 — Socle, et phase 1 avancée par D34 ; branche `phase-1/formulaire-repli` (spec 02).
- **Dernière case cochée** : Phase 0 · « Development build » (2026-11-03, spec 03).
- **Prochaine action** : Brainditech reconstruit l'app (`npx expo run:android --device`, nouveau module natif : sélecteur de date) et vérifie les critères 1 à 4 de la spec 02 (lien vers le formulaire, ressemblance avec la maquette, sélecteurs de date et d'heure, marge masquée avec « Partir à ») ; bandeau par `adb shell am start -a android.intent.action.VIEW -d "itinhero://formulaire?raison=indisponible"`. Puis PR.

## État par phase

| Phase | État | Début | Temps écoulé |
|---|---|---|---|
| Prérequis — Maquettes | terminé | 2026-11-02 | 1 jour (terminé le 2026-11-02) |
| 0 — Socle | en cours | 2026-11-02 | 0 jour |
| 1 — Accueil | en cours (avancé par D34) | 2026-11-02 | 0 jour |
| 2 — Confirmation du lieu | à faire | — | — |
| 3 — Résultat | à faire | — | — |
| 4 — Détail | à faire | — | — |
| 5 — Mes trajets | à faire | — | — |
| 6 — Réglages | à faire | — | — |
| 6 bis — Assistant | à faire | — | — |
| 7 — Temps réel et alertes | à faire | — | — |
| 8 — Ingestion nocturne | à faire | — | — |
| 9 — Surveillance et sécurisation | à faire | — | — |
| 10 — Déploiement VPS | à faire | — | — |
| 11 — Terminé v1 | à faire | — | — |

## Journal

Une ligne par avancée, avec sa preuve (commit, test, capture).

| Date | Avancée | Preuve |
|---|---|---|
| 2026-11-02 | Interview de cadrage terminée, plan approuvé par Brainditech | `docs/decisions/0001-cadrage-v1.md`, `PLAN.md`, `docs/architecture.md` (non commités ; premier commit à faire par Brainditech) |
| 2026-11-02 | Dépôt GitHub privé créé par Brainditech, premier commit poussé sur `main` (D27) | commit `78e34ad` |
| 2026-11-02 | `design/prompt.md` rédigé, en attente de relecture par Brainditech (case non cochée) | `design/prompt.md` (non commité) |
| 2026-11-02 | `design/prompt.md` validé par Brainditech (Prompt 1 écrans, Prompt 2 design system) ; case « Prompt d'image rédigé » cochée | `design/prompt.md`, 2026-11-02 (non commité) |
| 2026-11-02 | Maquettes validées par Brainditech, générées une par une (D32) : 9 écrans (Accueil, formulaire de repli, Confirmation du lieu, Résultat, Détail, Mes trajets, Réglages, Notifications, Assistant) et l'image du design system ; jetons écrits ; D30 acceptée, D31 (Assistant) proposée, D32 acceptée ; cases « Planche », « Design system » et « Écrans agrandis » cochées. Défauts connus listés dans `design/design-system.md` | `design/*/0N-*.png`, `design/design-system/design-system.png`, `design/design-system.md` (non commités) |
| 2026-11-02 | Logo validé par Brainditech : « I » dessiné comme une frise, monochrome (blanc sur indigo pour l'icône, indigo sur blanc pour le logo + nom) ; case « Logo » cochée, prérequis Maquettes terminés | `design/logo/logo.png` (non commité) |
| 2026-11-02 | D31 (Assistant) acceptée et intégrée : phase 6 bis, route `POST /v1/assistant`, `data/conseils.json` | `PLAN.md`, `docs/architecture.md`, `docs/decisions/0001-cadrage-v1.md` (non commités) |
| 2026-11-02 | Phase 0 ouverte : branche `phase-0/outillage`, spec 00 proposée (découpage de la phase en 7 PR, outillage) | `docs/specs/00-outillage.md` (non commité) |
| 2026-11-02 | Spec 00 approuvée par Brainditech | `docs/specs/00-outillage.md` |
| 2026-11-02 | Refus de `.env` testé : `Read .env` ⇒ « File is in a directory that is denied by your permission settings. » ; `Read .env.local` (inexistant) ⇒ même refus ; `cat .env.local` ⇒ « Permission to use Bash … has been denied. » ; `.env.example` reste lisible | session Claude Code du 2026-11-02, `.claude/settings.json` |
| 2026-11-02 | Cases « Skills officielles », « AGENTS.md complété », « `.claude/settings.json` » et « vitest » cochées : 7 skills officielles épinglées, `CLAUDE.md`, vitest 5.1.0 avec 5 tests de `verdict()` verts ; `npx expo lint` et `npx tsc --noEmit` verts | `.claude/skills/SOURCES.md`, `src/domaine/verdict.test.ts` (non commités) |
| 2026-11-02 | App lancée telle que créée par Brainditech (Expo Go, téléphone) ; case cochée | `docs/preuves/2026-11-02-phase0-app-telle-que-creee-expo-go.jpg` |
| 2026-11-02 | PR #2 (spec 00, outillage) fusionnée par Brainditech | commit `3353963` |
| 2026-11-02 | R8 en partie tranché : dépôt privé sur compte gratuit, pas de protection de branche ; Brainditech choisit de rester gratuit et privé (D33). Spec 01 — CI proposée | `docs/decisions/0001-cadrage-v1.md` (D33), `docs/specs/01-ci.md` (non commités) |
| 2026-11-02 | D34 : CI reportée, Accueil en dur avancé. NativeWind 4.2.7 (Tailwind 3.4.19) installé avec les jetons de `design/design-system.md` (`src/theme/jetons.js`), police Inter, barre d'onglets flottante (4 onglets), écran Accueil en valeurs en dur, 3 onglets d'attente. `npx expo export --platform android` réussi (R12 : compatible SDK 58 au build, à confirmer sur le téléphone) ; lint, types, tests verts | `src/app/(onglets)/`, `src/composants/` (non commités) |
| 2026-11-02 | Accueil vu sur le téléphone de Brainditech (Expo Go), comparé à la maquette ; cases « NativeWind » (phase 0) et « Écran en valeurs en dur » (phase 1) cochées. Correction : marge interne Android du champ retirée | `docs/preuves/2026-11-02-phase1-accueil-cote-a-cote.jpg` |
| 2026-11-02 | PR #3 (`phase-1/accueil`) fusionnée par Brainditech. Spec 02 — formulaire de repli proposée, branche `phase-1/formulaire-repli` | commit `e8112a1`, `docs/specs/02-formulaire-repli.md` (non commité) |
| 2026-11-02 | Capture de Brainditech : l'Accueil ne ressemble pas à la maquette. D35 acceptée et appliquée : fond de carte inventé par script (sha256 `86812f69…` stable sur 3 exécutions), composant `FondCarte` (voile 0,7), puces en 14 sp ; pas de point de position. Lint, types, tests verts ; `npx expo export --platform android` réussi | `docs/preuves/Screenshot_20261102_230618_Expo Go.jpg` (avant), `scripts/generer-fond-carte.py`, `src/composants/FondCarte.tsx` (non commités) |
| 2026-11-02 | Essai de `design/background/background.png` (carte sombre fournie par Brainditech) : grise et floue sous le voile, retirée. Brainditech choisit une vraie carte MapLibre en fond : D36 et spec 03 proposées, branche `phase-1/fond-carte` | `docs/preuves/Screenshot_20261102_232048_Expo Go.jpg`, `docs/specs/03-fond-carte-maplibre.md` (non commités) |
| 2026-11-02 | Spec 03 approuvée par Brainditech et appliquée : `expo-dev-client` 58.0.18, `@maplibre/maplibre-react-native` 11.5.1 (épinglé, plugin dans `app.json`), carte Positron qu'on déplace et zoome derrière l'Accueil, voile 0,3, attribution maison au-dessus du voile (l'attribution native serait sous le voile). Lint, types, tests verts ; `expo-doctor` 1.21.5 : 20/20 ; `npx expo export --platform android` réussi. R12 (MapLibre) et case « Development build » en attente du build de Brainditech | `src/composants/FondCarte.tsx`, `src/app/(onglets)/index.tsx` (non commités) |
| 2026-11-03 | D37 : attribution de la carte de fond repliable en ⓘ (premier geste ou 5 s), texte « © OpenMapTiles © OpenStreetMap » ; spec 03 (point 7, critère 4) et design system mis à jour | `docs/decisions/0001-cadrage-v1.md`, `src/composants/FondCarte.tsx` (non commités) |
| 2026-11-03 | Premier development build sur le téléphone de Brainditech : carte affichée, attribution repliée en ⓘ ; lien « Remplir un formulaire à la place » dans la carte de saisie, en 16 sp. Barre d'onglets absente une fois, revenue au rechargement (issue 0002, non reproduite) | capture de Brainditech du 2026-11-03 (non versionnée), `docs/issues/0002-barre-onglets-absente-sur-la-carte.md` |
| 2026-11-03 | Case phase 0 « Development build » cochée. `expo-doctor` rouge (7 paquets en retard d'un correctif) corrigé par `npx expo install --fix` : expo 58.0.23, expo-router 58.0.30, expo-linking 58.0.16, expo-splash-screen 58.0.13, expo-constants 58.0.15, @expo/ui 58.0.27, react-native-safe-area-context 5.11.1 ; `expo-doctor` 20/20, lint, types et tests (5) verts | `docs/preuves/2026-11-03-spec03-accueil-carte-attribution-repliee.png`, `package.json` |
| 2026-11-03 | Spec 03 constatée sur le téléphone de Brainditech : attribution dépliée puis repliée en ⓘ, glisser, pincer, pas de rotation, clavier fermé au toucher (« tout est ok ») ; en mode avion (build release), Accueil sans erreur avec la carte en cache (critère 5 reformulé avec l'accord de Brainditech). Issue 0003 (build : `app.fingerprint` en double) close. Lien « Remplir un formulaire à la place » en 14 sp, choix de Brainditech | `docs/preuves/2026-11-03-spec03-telephone-*.jpg`, `docs/preuves/2026-11-03-spec03-release-mode-avion-*.jpg`, `docs/issues/0003-*.md` |
| 2026-11-02 | Accueil lancé dans Expo Go : plantage attendu (« TurboModuleRegistry.getEnforcing(...): 'MLRNCameraModule' could not be found ») ; pas un bug du code, MapLibre exige le development build. Correction : MapLibre chargé seulement hors Expo Go, carte inventée sinon. Lint, types verts | `docs/preuves/Screenshot_20261102_234256_Expo Go.jpg`, `src/composants/FondCarte.tsx` (non commités) |
| 2026-11-03 | PR #4 (spec 03, carte de fond) fusionnée par Brainditech. D38 : captures de preuve retirées du dépôt, `docs/preuves/` ignoré par git ; la preuve s'écrit dans PLAN et ETAT | commit `c5f4dcc`, `docs/decisions/0001-cadrage-v1.md` (D38) |
| 2026-11-03 | Spec 02 (formulaire de repli) mise à jour puis approuvée par Brainditech (« vas-y, implémente »), marge masquée avec « Partir à ». Appliquée : pile de l'onglet Chercher (`(chercher)/`), écran `formulaire`, `Champ`, `SelecteurDeuxChoix`, `BandeauInfo`, `src/domaine/demande.ts` (schéma Zod, `validerFormulaire`, `formaterDate`) ; `@react-native-community/datetimepicker` 9.2.1 et zod 4.6.7. 25 tests verts, lint, types, expo-doctor 20/20, bundle Android exporté. Case non cochée : captures de Brainditech attendues | `src/domaine/demande.test.ts`, branche `phase-1/formulaire-repli` |

## Trous ouverts

Le détail et la phase où chacun se tranche sont dans `PLAN.md` §9.

- R1 : mémoire de MOTIS (taille du VPS).
- R2 : distance réelle Saint-Florentin-Ville → gare (≤ 45 min ?).
- R3 : couverture des cars K941 par le GTFS-RT SNCF.
- R4 : lieu de rendez-vous à Joigny dans OSM.
- R5 : tarifs publiés (Mobigo, TER).
- R6 : numéros de taxi publics.
- R7 : notifications (FCM, `projectId` EAS, Android 13+).
- R8 : quotas et conditions (Actions, protection de branche d'un dépôt privé gratuit, Sentry, OpenFreeMap, Inngest, Expo Push).
- R9 : juridique, à vérifier (ODbL, OSM, FCM).
- R10 : nom de domaine et HTTPS du VPS.
- R11 : dates relatives et fuseau.
- R12 : compatibilité SDK 58 de MapLibre RN (NativeWind : vérifié le 2026-11-02 sur le téléphone).
- R13 : sauvegarde de la clé de signature.
