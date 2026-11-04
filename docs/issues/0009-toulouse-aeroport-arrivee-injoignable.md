# Issue 0009 — Toulouse Capitole → aéroport : « impossible »

- **Date** : 2026-11-04
- **État** : constaté en rejouant la série de comparaison (issue 0008), **non analysé jusqu'au bout, non corrigé**. Analyse à approuver par Brainditech avant toute correction.

## 1. Reproduction

MOTIS national du PC, `node dist/comparaison/comparer.js src/comparaison/scenarios.json toulouse-capitole-aeroport` (dans `serveur/`, après `npm run build`). Vendredi 20/11/2026, partir à 06:00, « Place du Capitole » → « Aéroport de Toulouse-Blagnac » (`/v1/lieux`, premier candidat : 43.63074, 1.36681).

- Itinhero le 2026-11-04 après-midi : verdict « impossible », 0 possibilité, en 0,1 s.
- Spec 09, §11.2 (même jour de comparaison, le matin) : 06:04 → 06:51 ; Google Maps : 06:02 → 06:50.

## 2. Constats, une hypothèse à la fois

1. **La règle D62 (issue 0008) en est la cause** : fausse. MOTIS interrogé en direct avec les paramètres d'avant D62 (`maxPreTransitTime=1800`) rend aussi 0 possibilité.
2. **Les horaires de Toulouse manquent** : fausse. Le jeu Tisséo (`r81678`) est chargé ; le métro part de Capitole ; Capitole → arrêt « Aéroport » (`r81678_stop_point:SP_1753`) rend 06:14 → 06:39 par la navette AERO.
3. **Le point d'arrivée n'est relié à aucun chemin piéton** : vraisemblable. Depuis l'arrêt « Aéroport », aucun trajet à pied vers 43.63074, 1.36681, ni vers deux autres points de l'aérogare (43.6290, 1.3640 et 43.6300, 1.3700), même avec une limite de 60 min. L'enceinte de l'aéroport est sans doute dessinée dans OSM avec des voies non praticables à pied pour osr.
4. **Le point rendu par `/v1/lieux` a changé depuis la comparaison du matin** : non vérifié (le géocodeur de l'IGN, D60, est un service extérieur).

## 3. Suite proposée (à approuver)

Vérifier l'hypothèse 4, puis, si l'hypothèse 3 tient, choisir entre : rattacher un lieu « aéroport » à son arrêt de transport le plus proche quand MOTIS ne trouve aucun chemin à pied vers lui, ou corriger la carte OSM.
