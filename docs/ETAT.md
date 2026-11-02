# ÉTAT — Itinhero

> Mis à jour **dans le même commit** que chaque case cochée de [PLAN.md](../PLAN.md).
> Ordre de lecture pour reprendre le travail : ce fichier → `PLAN.md` → `docs/architecture.md`.

## Où on en est

- **Phase en cours** : Prérequis — Maquettes.
- **Dernière case cochée** : Prérequis — Maquettes · « Prompt d'image rédigé à partir de ce PLAN.md » (`design/prompt.md`, 2026-11-02).
- **Prochaine action** : Brainditech génère la planche des écrans avec le Prompt 1 et la range dans `design/planche-ecrans.png`.

## État par phase

| Phase | État | Début | Temps écoulé |
|---|---|---|---|
| Prérequis — Maquettes | en cours | 2026-11-02 | — |
| 0 — Socle | à faire | — | — |
| 1 — Accueil | à faire | — | — |
| 2 — Confirmation du lieu | à faire | — | — |
| 3 — Résultat | à faire | — | — |
| 4 — Détail | à faire | — | — |
| 5 — Mes trajets | à faire | — | — |
| 6 — Réglages | à faire | — | — |
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
- R12 : compatibilité SDK 58 de MapLibre RN et de NativeWind.
- R13 : sauvegarde de la clé de signature.
