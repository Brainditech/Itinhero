# Spec 11 — Consignes de marche virage par virage et tracé du trajet

- **Date** : 2026-11-04
- **État** : **à approuver par Brainditech.**
- **Branche prévue** : `phase-4/consignes-de-marche`
- **Cases du PLAN** : phase 4 · « Gabarits de consignes et glossaire à la première occurrence » (consignes seulement, le glossaire reste à faire) ; phase 4 · « Carte MapLibre : arrêts, tracé de marche… » (tracé seulement).
- **Prérequis** : issue 0010 corrigée (noms de lieux, adresse d'arrivée, attente), car les consignes s'appuient dessus.

## 1. But

Pour chaque marche, l'app dit **par où passer**, comme Google Maps : « Prenez à droite rue Guillaume-Tell », « Continuez sur la rue du Docteur-Albert-Rémy », « Tournez à gauche avenue Maréchal-Foch », « Le tribunal administratif est sur votre droite ». Chaque consigne a sa flèche, sa distance, et un point sur la carte.

Demande de Brainditech (2026-11-04) : « des chevrons qui expliquent exactement où il faut aller ».

## 2. Ce qui est constaté (2026-11-04)

- MOTIS v2.11.4 rend pour chaque marche une liste `steps` quand `detailedLegs=true` : distance, nom de rue, tracé (`polyline`, encodage Google), niveaux. Itinhero demande aujourd'hui `detailedLegs=false`.
- **Le sens du virage n'est pas calculé par MOTIS** : sur la demande Brienon → Dijon (issue 0010), 436 consignes sur 437 disent `CONTINUE`. 247 sur 437 n'ont pas de nom de rue. Les morceaux sont très courts (2 à 166 m) : une même rue est coupée en plusieurs morceaux.
- Chaque étape rend aussi `legGeometry`, le tracé complet de l'étape, bus et trains compris.

## 3. Décisions proposées

- **D70 — Les virages sont calculés par le serveur d'Itinhero, à partir des tracés de MOTIS.** MOTIS reste la seule source du chemin (rues, distances, tracé). Le serveur ne fait que traduire le tracé en phrases. Aucune rue ni aucun chemin n'est inventé : une consigne sans nom de rue dit « le chemin » ou « la rue », jamais un nom deviné.
  - Options écartées : afficher les consignes de MOTIS telles quelles (« Continuez » 436 fois) ; un second moteur de guidage (OSRM, Valhalla) à héberger en plus pour la seule marche (une autre source du chemin, qui pourrait contredire MOTIS) ; Claude pour rédiger les consignes (interdit, invariant 3).
- **D71 — Calcul des consignes :**
  1. Les morceaux qui se suivent sur la même rue sont fusionnés, et un morceau de moins de 10 m est rattaché au suivant.
  2. Le cap est mesuré sur les 15 derniers mètres avant le point de virage et sur les 15 premiers mètres après.
  3. Écart de cap : moins de 25° ⇒ « continuez » (consigne gardée seulement si la rue change de nom) ; 25° à 60° ⇒ « légèrement à gauche/droite » ; 60° à 150° ⇒ « à gauche/droite » ; plus de 150° ⇒ « faites demi-tour ».
  4. `STAIRS` et `ELEVATOR` de MOTIS deviennent « prenez l'escalier » et « prenez l'ascenseur ». Un changement de niveau (`fromLevel` ≠ `toLevel`) dit « montez » ou « descendez ».
  5. La dernière consigne dit de quel côté est l'arrivée (« sur votre gauche/droite/devant vous »), d'après la position du point d'arrivée par rapport au dernier cap.
  6. La première consigne donne la direction de départ par le nom de la rue et un point cardinal (« Partez vers le nord-est sur la Grande Rue »).
  - Seuils tirés de l'usage courant des applications de guidage, à ajuster sur les 16 trajets de la boucle de comparaison (spec 09 §11).

## 4. Ce qui est construit

### 4.1 Serveur

- `motis-plan.ts` : `detailedLegs=true`. Le schéma Zod lit `steps` (distance, `streetName`, `relativeDirection`, `polyline`, `fromLevel`, `toLevel`) et `legGeometry`.
- `itineraires/consignes.ts` (nouveau, testé) : décodage des tracés, fusion, caps, consignes (D71).
- Chaque étape à pied reçoit `consignes: Consigne[]`. Chaque étape reçoit `trace` (tracé encodé, précision 6) :

```ts
type Consigne = {
  manoeuvre: "depart" | "tout_droit" | "legerement_gauche" | "gauche" | "demi_tour"
           | "legerement_droite" | "droite" | "escalier" | "ascenseur" | "arrivee";
  rue: string | null;            // nom OSM tel que rendu par MOTIS, sinon null
  distance_metres: number;       // jusqu'à la consigne suivante
  cote_arrivee?: "gauche" | "droite" | "devant";
  lat: number; lon: number;      // point de la manœuvre
};
```

- Taille : le tracé et les consignes s'ajoutent à la réponse. On mesure la taille de la réponse Brienon → Dijon avant et après (critère 6).

### 4.2 App

- `src/domaine/consignes.ts` (nouveau, testé) : phrase de chaque consigne (« Tournez à droite rue Guillaume-Tell », « Continuez sur 120 m »).
- Résultat, étape à pied : un lien « Voir le chemin (N consignes) » déplie la liste. Chaque ligne a une flèche (icônes dessinées en SVG dans `src/composants/`, sans bibliothèque d'icônes tierce, invariant 20) et la distance.
- Carte de l'écran (`FondCarte`) : tracé du trajet (marche en pointillés, véhicules en trait plein, couleurs du design system), numéros des arrêts comme la maquette `design/detail/05-detail.png`. Toucher une consigne centre la carte sur son point.

## 5. Fichiers touchés

`serveur/src/itineraires/motis-plan.ts`, `normaliser.ts`, `consignes.ts` (+ tests), `serveur/src/itineraires/__exemples__/` (réponse Brienon → Dijon enregistrée) ; `src/domaine/consignes.ts` (+ tests), `src/domaine/api.ts` (types), `src/composants/Trajet.tsx`, `src/composants/FondCarte.tsx`, `src/composants/Fleches.tsx` (nouveau) ; `PLAN.md`, `docs/ETAT.md`, `docs/decisions/0001-cadrage-v1.md` (D70, D71).

## 6. Source de chaque valeur affichée

| Valeur | Source |
|---|---|
| Nom de rue | `steps[].streetName` de MOTIS (OSM, jeu et version du manifeste) |
| Distance d'une consigne | somme des `steps[].distance` fusionnés |
| Sens du virage, côté de l'arrivée | calcul d'Itinhero sur `steps[].polyline` (D71), jamais inventé |
| Tracé sur la carte | `legGeometry` de MOTIS |

## 7. Sécurité

Les tracés sont des coordonnées : ils ne sont jamais écrits dans un journal ni envoyés à Sentry (invariant 10). Le serveur ne les garde pas (invariant 6).

## 8. Critères d'acceptation

1. Brienon → Dijon (réponse enregistrée) : la marche gare de Dijon → tribunal donne au plus 8 consignes, dont au moins un virage à gauche ou à droite et une arrivée « sur votre gauche/droite ». Aucune consigne ne répète la précédente.
2. La marche de 14 min à Saint-Florentin suit la route de la Gare, puis la D 43 et la N 77, dans cet ordre (noms tirés de MOTIS).
3. Un morceau sans nom ne produit jamais un nom de rue.
4. Les virages calculés concordent avec Google Maps sur 5 marches de la boucle de comparaison (même sens, même rue), écarts écrits dans §11.
5. Sur le téléphone : « Voir le chemin » déplie les consignes avec leurs flèches ; toucher une consigne centre la carte ; le tracé est visible.
6. Taille de la réponse Brienon → Dijon mesurée et écrite ; temps de réponse du serveur pas plus long de 20 %.

## 9. Ce qui n'est pas fait ici

Le guidage en direct qui suit la position (spec 12), la voix, les consignes hors réseau (phase 5, trajet enregistré), le glossaire.

## 10. Étapes de vérification

`npm test` (racine et `serveur/`), `npx expo lint`, `npx tsc --noEmit` ; `npm run test:national` ; puis Brainditech refait la recherche Brienon → Dijon sur le téléphone et compare les consignes à Google Maps.
