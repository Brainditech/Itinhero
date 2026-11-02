# Spec 00 — Outillage du dépôt (phase 0)

> Rédigée le 2026-11-02. État : **approuvée par Brainditech le 2026-11-02, appliquée.**
> Branche : `phase-0/outillage`. Une seule PR.

## 1. Découpage proposé de la phase 0

La phase 0 compte 15 cases. Une PR par fonctionnalité (règle 1), dans cet ordre :

| Spec | Branche | Cases de PLAN.md couvertes |
|---|---|---|
| **00 — Outillage** (cette spec) | `phase-0/outillage` | App lancée telle que créée · Skills officielles · AGENTS.md complété · `.claude/settings.json` · vitest |
| 01 — CI | `phase-0/ci` | CI GitHub Actions + protection de `main` (R8) |
| 02 — Development build et NativeWind | `phase-0/dev-build-nativewind` | Development build · NativeWind avec les jetons (R12) · icône 1024 px tirée du logo |
| 03 — Serveur squelette et MOTIS | `phase-0/serveur-motis` | `docker compose` (MOTIS v2.11.4, API squelette, `/health`) · vérification des variables d'environnement (app et serveur) · choix du framework HTTP (A4) |
| 04 — Sentry | `phase-0/sentry` | Sentry app et serveur, test du nettoyage `beforeSend` |
| 05 — Fixtures | `phase-0/fixtures` | `fixtures/manifest.json` + extrait OSM figé + script sha256 en CI · mesure mémoire MOTIS (R1) |
| 06 — Oracle et test Joigny | `phase-0/joigny` | Oracle GTFS · test Joigny et cas limites (R2) · job CI MOTIS |

La CI passe en deuxième : toutes les PR suivantes sont alors bloquées si elle est rouge. Chaque spec suivante est écrite et approuvée avant d'ouvrir sa branche.

## 2. But

Poser les règles de travail dans le dépôt avant la moindre ligne de code de l'app : Claude ne peut pas lire `.env`, ne pousse pas sans demander, connaît la pile et l'ordre de lecture, et un premier test tourne avec `npm test`.

## 3. Décisions

- **Gestionnaire de paquets** : npm (`package-lock.json` présent, pas de `bun.lock`). Commandes en `npx`.
- **vitest** : version constatée à l'installation (dernière publiée le 2026-11-02 : 5.1.0, à confirmer contre la doc de la version installée). Il ne teste que du TypeScript pur sous Node (A5) : pas de rendu React Native dans vitest. Les fichiers de test sont `*.test.ts` à côté du code testé.
- **Emplacement du code pur** : `src/domaine/` pour la logique sans React Native (testable sous Node). Le premier test y porte sur une fonction réelle et utile plus tard, pas sur un `1 + 1` : `verdict(arrivee, rendezVous, margeMin)` du PLAN (« arrivée ≤ heure du rendez-vous − marge », D17).
  - Alternative écartée : un test factice, qui prouve que vitest tourne mais ne sert à rien ensuite.
- **`CLAUDE.md`** : une seule ligne `@AGENTS.md`. Tout le contenu vit dans `AGENTS.md`.
- **Skills** : seules les skills publiées par l'éditeur du service (Expo, Sentry, Inngest, Anthropic, MapLibre…) sont admises. Pour chaque service, la source est constatée le jour de l'installation ; s'il n'y en a pas, on l'écrit (« aucune skill officielle constatée le … »). Une skill n'est ajoutée que pour un service de la pile (PLAN §2). Celle d'Expo est déjà active par le plugin `expo@claude-plugins-official` : elle est listée, pas recopiée.

## 4. Fichiers touchés

| Fichier | Changement |
|---|---|
| `AGENTS.md` | Ajout en tête : pile et conventions (PLAN §2), ordre de lecture `docs/ETAT.md` → `PLAN.md` → `docs/architecture.md`, « ne lance jamais l'app toi-même, je la fais tourner dans un autre terminal », règles de branche/PR/spec, rappel des invariants 1 à 20 par lien. Le bloc Expo existant est conservé. Correction : « Run lint and typecheck » devient « lint, types et tests ». |
| `CLAUDE.md` (nouveau) | `@AGENTS.md` |
| `.claude/settings.json` | `permissions.deny` : lecture et écriture de `.env` et `.env.*` (sauf `.env.example`, qui reste lisible) ; `permissions.ask` : `git push` ; `permissions.allow` : `npx expo lint`, `npx tsc --noEmit`, `npm test`. Le plugin Expo reste activé. Format vérifié contre la doc officielle de Claude Code avant d'écrire. |
| `.claude/skills/` | Skills officielles retenues, chacune avec sa source dans le message de commit. |
| `package.json` | `vitest` en devDependency ; scripts `test` (`vitest run`) et `typecheck` (`tsc --noEmit`). |
| `vitest.config.ts` (nouveau) | Environnement `node`, inclusion `src/**/*.test.ts`. |
| `src/domaine/verdict.ts`, `src/domaine/verdict.test.ts` (nouveaux) | Première fonction pure et ses tests. |
| `docs/ETAT.md`, `PLAN.md` | Cases cochées avec leur preuve, dans le même commit. |
| `docs/preuves/` | Capture de l'app telle que créée (fournie par Brainditech). |

Aucun fichier de `src/app/`, `android/` ou `ios/` n'est touché.

## 5. Source de chaque valeur affichée

Aucun écran n'est modifié. `verdict()` ne fait que comparer des valeurs qu'on lui passe ; elle n'en invente aucune.

## 6. Sécurité

- Le refus de lire `.env*` est la protection de l'invariant 19. Il est **testé** : Claude tente de lire `.env`, la demande est refusée, le refus est consigné dans ETAT.
- `git push` passe par une demande : aucune poussée sans accord de Brainditech.
- Aucune skill tierce non officielle (une skill peut exécuter des commandes).
- Aucun secret ajouté. `.env.example` reste la seule référence des variables.

## 7. Critères d'acceptation

1. Brainditech a lancé l'app telle que créée (`npx expo start`) et la capture datée est dans `docs/preuves/`.
2. `CLAUDE.md` importe `AGENTS.md` ; `AGENTS.md` contient la pile, l'ordre de lecture et la consigne « ne lance jamais l'app ».
3. Une lecture de `.env` par Claude est refusée par les permissions (et non par la bonne volonté de Claude).
4. `git push` déclenche une demande.
5. `npm test` est vert, avec au moins ces cas de `verdict()` (logique ⇒ test, règle 7) :
   - arrivée 09:50, rendez-vous 10:00, marge 10 ⇒ possible (égalité comprise) ;
   - arrivée 09:51, rendez-vous 10:00, marge 10 ⇒ impossible ;
   - marge 0 ⇒ possible jusqu'à 10:00 incluse ;
   - marge négative ou non entière ⇒ erreur explicite.
6. `npx expo lint` et `npx tsc --noEmit` sont verts.
7. Chaque skill de `.claude/skills/` a sa source (URL de l'éditeur, date) dans le commit ; les services sans skill officielle sont listés comme tels.

## 8. Étapes de vérification

1. Brainditech : `npx expo start`, ouvre l'app sur le téléphone ou l'émulateur, dépose la capture.
2. Claude : `npm test`, `npx tsc --noEmit`, `npx expo lint`.
3. Claude tente `Read .env` dans une nouvelle session (pour que les permissions soient rechargées) ; le refus est copié dans ETAT.
4. Claude tente `git push` ; la demande apparaît, Brainditech refuse ou accepte.
5. Relecture de la PR par l'outil de revue, chaque remarque vérifiée contre le code.

## 9. Écarts constatés à l'application (2026-11-02)

- `vitest.config.ts` est devenu `vitest.config.mts` : Vite 8 avertit qu'un fichier ESM chargé comme CommonJS ne sera plus pris en charge (le `package.json` n'est pas `"type": "module"`). `tsconfig.json` inclut désormais `**/*.mts` pour que ce fichier soit vérifié par `tsc`.
- `npx expo lint` a installé ESLint au premier lancement (`eslint` ^9.0.0, `eslint-config-expo` ~58.0.4) et créé `eslint.config.js` (configuration Expo par défaut).
- Sources des skills : dans `.claude/skills/SOURCES.md` en plus du message de commit, pour qu'une mise à jour sache d'où recopier. Chaque skill porte la licence de sa source.
- Le refus de `.env*` ne peut pas exclure `.env.example` par une règle `allow` (le refus l'emporte toujours, doc des permissions de Claude Code lue le 2026-11-02) : les variantes refusées sont listées une à une (`.env`, `.env.local`, `.env.*.local`, `.env.dev`, `.env.development`, `.env.prod`, `.env.production`, `.env.test`), en lecture et en écriture.
- Limite connue, écrite dans la doc officielle : ces règles couvrent les outils de fichiers et les commandes shell qui nomment le fichier (`cat .env`), pas un script Node ou Python qui ouvrirait le fichier lui-même. Seul le bac à sable (sandbox) de Claude Code bloquerait cela ; non activé en v1.

