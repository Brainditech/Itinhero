# ÉTAT — Itinhero

> Mis à jour **dans le même commit** que chaque case cochée de [PLAN.md](../PLAN.md).
> Ordre de lecture pour reprendre le travail : ce fichier → `PLAN.md` → `docs/architecture.md`.

## Où on en est

- **Phase en cours** : 0 — Socle, et Accueil en valeurs en dur avancé (D34), branche `phase-1/accueil`.
- **Dernière case cochée** : Phase 1 · « Écran en valeurs en dur » (côte à côte, 2026-11-02) ; phase 0 · « NativeWind ».
- **Prochaine action** : Brainditech fusionne la PR `phase-1/accueil`. Ensuite : formulaire de repli (`design/accueil/02-formulaire-repli.png`) en valeurs en dur, puis le serveur et MOTIS pour brancher l'Accueil.

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
