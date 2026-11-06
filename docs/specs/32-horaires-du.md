# Spec 32 — « Horaires du JJ/MM » et bandeau au-delà de 7 jours

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (« implement tous les specs … jusqu'à voir toutes les phases implémentées », 2026-11-06). Règle : D110. **Appliquée** sur `phase-8/horaires-du`.
- **Branche** : `phase-8/horaires-du`.
- **Case de PLAN.md** : phase 8, « « Horaires du JJ/MM » et bandeau au-delà de 7 jours ».
- **Invariants** : 4 (la date vient de la source de chaque étape, donc du manifeste), 12 (horaire prévu : on dit de quand il date), 13 (rien de silencieux).

## 1. But

Le Résultat dit déjà jusqu'à quand les horaires sont valables (issue 0010, H), mais pas de quand ils datent. Pour un trajet lointain, un jeu GTFS peut être remplacé d'ici là (phase 8) : la personne doit le savoir et revérifier.

## 2. Doc lue

Aucune bibliothèque nouvelle. `fixtures/manifest.json` et `donnees/manifest.json` : `date_fichiers` (date des fichiers du jeu) et `date_telechargement`.

## 3. Décision D110

1. **Serveur** : la source d'une étape GTFS porte `date_horaires` = `date_fichiers` du jeu dans le manifeste, sinon sa `date_telechargement` ; null si ce n'est pas une date.
2. **App** : sous le Résultat, « Horaires du 21/09/2026, valables jusqu'au 31/08/2027 » (la date la plus ancienne parmi les jeux des possibilités montrées, aller et retour ; seulement les morceaux connus). Un serveur plus ancien sans `date_horaires` ⇒ la ligne d'avant.
3. **Bandeau** quand le jour demandé est à **plus de 7 jours** d'aujourd'hui : « Trajet dans plus de 7 jours. Horaires du 21/09/2026 : ils peuvent changer d'ici là. Revérifiez la veille. »

## 4. Options écartées

- `feed_version` comme date : ce n'est pas toujours une date (texte libre du producteur).
- Une date par étape à l'écran : trop de bruit ; la plus ancienne suffit à prévenir.

## 5. Critères d'acceptation

1. Serveur : la source GTFS porte `date_horaires` tirée du manifeste (`serveur/src/routes/itineraires.test.ts`).
2. App : date la plus ancienne ; ligne avec les morceaux connus (`src/domaine/horaires.test.ts`).
3. App : à 7 jours rien, à 8 jours le bandeau (test).
4. **Téléphone** : une recherche à J+10 ⇒ bandeau et ligne « Horaires du … » (capture adb).

## 6. Constats

- 2026-11-06 : critères 1 à 3 verts (`npm test`, `cd serveur && npm test`). Critère 4 : à constater par adb (l'API doit être reconstruite : `docker compose … up -d --build api`).
