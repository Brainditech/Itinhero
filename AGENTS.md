# Itinhero

Application Android (Expo) qui remplace les autres applications de déplacement : elle calcule les trajets dans toute la France (trains, métro, bus, cars, transport à la demande, taxi, covoiturage) et planifie tout le voyage d'un débutant, de porte à porte, aller et retour, consultable hors réseau (D45). Premier cas réel : l'Yonne. Serveur (Node, MOTIS) en `docker compose`.
Langue de travail : français (docs, specs, commits, interface).

## Ordre de lecture pour reprendre le travail

1. [docs/ETAT.md](docs/ETAT.md) : où on en est, prochaine action, demandes de Brainditech en attente.
2. [PLAN.md](PLAN.md) : phases, cases et leur preuve, variables d'environnement, routes.
3. [docs/architecture.md](docs/architecture.md) : flux, source de chaque valeur, **invariants 1 à 20** (les enfreindre bloque la fusion).
4. La spec en cours dans `docs/specs/`, et les décisions dans `docs/decisions/`.

## Règles absolues

- **Ne lance jamais l'app toi-même** (`npx expo start`, `npx expo run:android`…) : Brainditech la fait tourner dans un autre terminal. Demande-lui la capture ou le résultat.
- **Ne lis ni n'écris jamais `.env*`** (sauf `.env.example`). Les secrets sont remplis par Brainditech. `.claude/settings.json` le refuse.
- **Spec avant chaque fonctionnalité** (`docs/specs/NN-<fonctionnalité>.md`), approuvée par Brainditech, puis appliquée strictement.
- **Une fonctionnalité = une branche = une PR.** Aucun commit sur `main`. Aucune fusion avec la CI rouge ou une remarque majeure de revue ignorée ; chaque remarque est vérifiée contre le code, jamais « Apply suggestion ».
- **Une case de PLAN.md ne se coche qu'avec sa preuve**, et `docs/ETAT.md` est mis à jour dans le même commit.
- **Chaque demande de Brainditech s'écrit dès qu'elle est faite** dans `docs/ETAT.md`, section « Demandes de Brainditech en attente », et est commitée dans la foulée, même si on la traite plus tard. « Je l'écrirai après » est interdit : une conversation qui se termine perd tout ce qui n'est pas dans le dépôt.
- **Chaque décision s'écrit quand elle est prise** dans `docs/decisions/` (décision, raison, options écartées).
- **Doc officielle de la version installée** lue avant de brancher un service. Context7 aide à trouver la doc, il ne tranche pas.
- **Un bug va dans `docs/issues/`** : reproduction, une hypothèse à la fois, cause racine, test de régression ; analyse approuvée par Brainditech avant la correction.
- Les règles de ce fichier, les invariants et les specs approuvées priment sur les skills de `.claude/skills/` (sources dans `.claude/skills/SOURCES.md`).

## Pile et conventions

- **App** : Expo SDK 58, React Native 0.88, Expo Router (`src/app/`), Android d'abord. Style : NativeWind avec les jetons de `design/design-system.md` (D28, D30). Stockage local : expo-sqlite, expo-secure-store. Carte : MapLibre.
- **Serveur** : Node 22 LTS, TypeScript, Zod sur chaque entrée ; MOTIS v2.11.4 auto-hébergé ; Inngest auto-hébergé ; Claude par l'API Anthropic, clé côté serveur seulement.
- **Suivi d'erreurs** : Sentry (app et serveur), sans aucune donnée de trajet.
- **Tests** : vitest, TypeScript pur sous Node (`src/domaine/`, fichiers `*.test.ts` à côté du code). Toute logique d'un critère d'acceptation a son test.
- **Gestionnaire de paquets** : npm (`package-lock.json`). Ajout de dépendance : `npx expo install <paquet>`.
- **Distribution** : build local (`npx expo run:android --variant release`, D22). EAS Build n'est pas utilisé ; la section EAS plus bas ne s'applique pas sans décision écrite.
- **Versions épinglées** : jamais `latest` (images Docker, CLI). Chaque version est constatée à l'installation.

## Avant de déclarer une tâche terminée

```bash
npx expo lint        # lint
npx tsc --noEmit     # types
npm test             # tests (vitest run)
```

---

This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint, typecheck and tests (`npm test`) before declaring any task done. Never run `npx expo start` yourself: Brainditech runs the app.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
