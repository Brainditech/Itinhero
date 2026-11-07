# Spec 52 — Développement et production séparés

- **Date** : 2026-11-07
- **État** : **approuvée par délégation** de Brainditech (D133). Règle : D136. **Appliquée** le 2026-11-07, critères 1 à 4 constatés (§5).
- **Branche** : `etapes/fin-implementations`.
- **Case de PLAN.md** : phase 9 · « Dev et prod séparés (`.env`, DSN, données) » (preuve : diff de configuration). Prépare la phase 10 (« Même `docker compose`, images étiquetées »).
- **Invariants** : 9 (secrets seulement dans l'environnement, jamais dans le dépôt), 10 (Sentry sans donnée de trajet), versions épinglées (AGENTS.md : jamais `latest`).

## 1. But

Aujourd'hui un seul jeu de fichiers sert au PC : `docker-compose.yml` (fixtures) et `docker-compose.national.yml` (toute la France). Rien ne dit ce qui change sur le VPS : environnement Sentry, étiquette de l'image, données, redémarrage. La phase 10 doit pouvoir déployer **le même compose** avec un seul fichier de plus, sans rien recopier du PC.

## 2. Ce qui change (D136)

1. **`docker-compose.prod.yml`**, posé par-dessus les deux fichiers du national (`-f docker-compose.yml -f docker-compose.national.yml -f docker-compose.prod.yml`) :
   - `api.image` : `itinhero-api:${ITINHERO_VERSION:?…}` ; le compose refuse de démarrer sans étiquette (jamais `latest`, jamais `0.1.0` du PC par défaut) ;
   - `api.environment.SENTRY_ENVIRONNEMENT: prod` écrit en dur (pas de repli sur `dev`) ; `SENTRY_DSN_SERVEUR` obligatoire (`:?`) ;
   - `restart: always` pour `motis` et `api` ;
   - journaux Docker bornés (`json-file`, 10 Mo × 3) pour ne pas remplir le disque du VPS ;
   - MOTIS et l'API restent publiés sur `127.0.0.1` seulement : le HTTPS passe par le proxy de la phase 10 (R10).
2. **Données** : le PC garde ses volumes (`itinhero_*` pour les fixtures, `itinhero-national_*` pour la France) ; le VPS a les siens, nommés par le projet `-p itinhero-prod`. Aucun volume ni fichier de données n'est copié du PC : l'ingestion nocturne (spec 44) les produit sur place.
3. **`.env`** : un fichier par machine, jamais copié de l'une à l'autre ni versionné. `.env.example` dit, pour chaque variable, sa valeur sur le PC et sur le VPS (`ITINHERO_VERSION` ajoutée ; `EXPO_PUBLIC_API_URL` : `http://localhost:3000` sur le PC, l'URL HTTPS du VPS pour l'APK de release).
4. **App** : l'environnement Sentry suit déjà le build (`__DEV__` ⇒ `dev`, release ⇒ `prod`, spec 50) ; même DSN, environnements séparés dans Sentry.
5. **Preuve** : `docker compose … config --no-interpolate` du PC (national) et de la prod, et leur diff, dans `docs/preuves/2026-11-07-fin/dev-prod/` (`--no-interpolate` : aucune valeur du `.env` n'est lue ni écrite, D-docs Compose v5.6.1).

## 3. Options écartées

- **Un seul compose avec des profils** : les profils choisissent des services, pas des valeurs ; il faudrait encore un fichier d'environnement par machine.
- **Image poussée dans un registre** : la phase 10 dira si l'image est construite sur le VPS ou poussée ; l'étiquette obligatoire vaut pour les deux.
- **`.env.prod` dans le dépôt** : interdit (invariant 9).

## 4. Critères d'acceptation

1. `docker compose -f docker-compose.yml -f docker-compose.national.yml -f docker-compose.prod.yml config --no-interpolate` réussit.
2. Le diff avec la configuration du PC montre : étiquette `${ITINHERO_VERSION:?…}`, `SENTRY_ENVIRONNEMENT: prod`, DSN obligatoire, `restart: always`, journaux bornés ; ports toujours sur `127.0.0.1`.
3. Sans `ITINHERO_VERSION`, `docker compose … config -q` échoue en nommant la variable (essai avec un fichier d'environnement factice, sans secret).
4. `.env.example` décrit chaque variable pour le PC et pour le VPS.
5. Lint, types et tests verts ; CI verte.

## 5. Constats (2026-11-07)

- Doc lue : Docker Compose v5.6.1 installé ; page « Variable interpolation » (`--env-file` remplace le `.env` du projet ; ordre : shell, `--env-file`, `.env`) et `docker compose config` (`--no-interpolate`, `-q`).
- Critères 1 et 2 : `docs/preuves/2026-11-07-fin/dev-prod/config-pc-national.yml`, `config-prod.yml`, `diff-pc-prod.diff`. Le diff a fait trouver un piège corrigé : sans `MOTIS_DONNEES`, la prod aurait pris le volume du PC (`itinhero-national_motis-data`) ; elle prend `itinhero-prod_motis-data`.
- Critère 3 : `etiquette-obligatoire.txt` (refus « required variable ITINHERO_VERSION is missing a value », code 1 ; avec l'étiquette, code 0), fichier d'environnement factice, aucun `.env` lu.
- `scripts/ingestion-nuit.sh` : le projet vient de `ITINHERO_PROJET` (environnement, puis `.env` de la machine), `itinhero-national` par défaut ; `itinhero-prod` ajoute `docker-compose.prod.yml` et prend ses volumes.
