# Spec 20 — Perdu pendant une marche : un nouveau chemin à pied, le reste du trajet ne change pas

- **Date** : 2026-11-05
- **État** : **à approuver** par Brainditech. Règle proposée : D96.
- **Branche** : `guidage/nouveau-chemin-a-pied`, empilée sur `guidage/ecart-loin-immediat` (PR #31, D95) ; rebasée sur `main` dès que la PR #31 est fusionnée.
- **Case de PLAN.md** : phase 4, « Perdu pendant une marche : nouveau chemin à pied jusqu'à la fin de la marche, le reste du trajet gardé quand le véhicule suivant reste à portée (D96, spec 20) ».
- **Invariants** : 2 (l'app ne parle qu'à l'API Itinhero), 4 (la nouvelle marche a sa source), 6 (rien n'est gardé sur le serveur), 8 (clé d'appareil), 9 (entrée validée par Zod), 10 (aucune coordonnée dans les journaux ni dans Sentry).

## 1. But

Brainditech (2026-11-05), après l'essai de « Recalculer depuis ici » : quand on se perd pendant une marche, refaire tout le trajet n'est pas forcément ce qu'il faut.

Aujourd'hui, « Recalculer depuis ici » relance une recherche complète depuis la position vers le rendez-vous (spec 12 §7, spec 19 pour un retour). Si la personne s'est trompée de rue à 300 m de la gare, il lui faut seulement **un nouveau chemin à pied jusqu'à la gare**, en gardant son train si elle peut encore l'avoir. La recherche complète peut proposer autre chose : un autre train, un taxi, ou laisser tomber le train parce que la marge de montée de D68 (5 min) n'est plus tenue alors qu'il reste 3 min de marche et 6 min avant le départ.

## 2. Doc lue

- MOTIS v2.11.4, `openapi.yaml` du tag `v2.11.4` (lu le 2026-11-05), `GET /api/v6/plan` :
  - `transitModes` : « If empty, no transit connections will be computed » ;
  - `directModes` : `WALK` par défaut, résultats dans la clé `direct` ;
  - `maxDirectTime` : 1800 s par défaut, plafonné par `street_routing_max_direct_seconds` de la configuration du serveur MOTIS (absent de `motis/config.yml` : valeur par défaut de MOTIS, à constater sur le MOTIS national, critère 3).
- Rien de neuf côté app : la position est lue comme pour « Recalculer depuis ici » (`lirePosition`, spec 10 et 12).

## 3. Décision D96 (proposée)

Pendant une **marche** guidée, quand l'écart au chemin est affiché (D75, D95), « Recalculer depuis ici » fait d'abord un **nouveau chemin à pied** depuis la position jusqu'à la **fin de cette marche** (l'arrêt, la gare, le point de prise en charge du taxi, ou l'arrivée). Ensuite :

1. **Le véhicule suivant reste à portée** : la personne arrive à pied au moins **2 min** avant son départ prévu (heure + nouvelle durée de marche). Le guidage reste ouvert, la marche en cours est remplacée par la nouvelle, **toutes les autres étapes restent les mêmes** (heures, véhicules, sources). La voix dit « Nouveau chemin », puis la première consigne.
2. **La marche finit le trajet** (dernière étape, rien à rater après elle) : toujours le nouveau chemin à pied, même en retard. Le statut dit le retard comme aujourd'hui.
3. **Le véhicule suivant n'est plus à portée**, ou **aucun chemin à pied** n'est trouvé en moins de 1 h (à 17 km, par exemple) : recherche complète, comme aujourd'hui. Pendant la recherche, le guidage écrit « Le train de 09:12 n'est plus à portée : nouvelle recherche… » (« Aucun chemin à pied : nouvelle recherche… » sans chemin), puis le Résultat montre la nouvelle réponse.

Hors marche (bus raté à l'arrêt, `rate`), rien ne change : recherche complète.

**Pourquoi 2 min** : D68 (5 min) sert à préparer un trajet avant de partir. Ici la personne est déjà en route et pressée ; 2 min laissent le temps de trouver le quai ou l'arrêt. En dessous, la recherche complète décide. La valeur est proposée et se règle avec l'essai sur le terrain.

**Écarté** :
- Toujours la recherche complète (aujourd'hui) : elle peut perdre un train encore jouable, ou proposer autre chose à un débutant qui avait compris son trajet.
- Deux boutons (« Nouveau chemin » et « Tout recalculer ») : un débutant ne sait pas lequel choisir ; l'app le sait mieux que lui.
- Passer par `POST /v1/itineraires` avec la fin de la marche comme arrivée : la réponse contient des transports, et la marge D68 ferait tomber un train serré.
- Calculer le chemin sur le téléphone : pas de graphe des rues dans l'app (la carte hors réseau, D76, n'est pas tranchée).
- Recalculer tout seul, sans appui : la position partirait au serveur sans que la personne le demande (spec 12 §7).

## 4. Ce qui est construit

### Serveur

- `POST /v1/marche` (clé d'appareil exigée, invariant 8). Corps validé par Zod : `{ de: { lat, lon }, a: { lat, lon } }`, latitudes et longitudes dans leurs bornes ; sinon 400.
- Appel MOTIS `GET /api/v6/plan` : `fromPlace` = `de`, `toPlace` = `a`, `time` = maintenant, `arriveBy=false`, `transitModes` vide, `directModes=WALK`, `maxDirectTime=3600`, `detailedLegs=true` ; mêmes réglages de marche que `/v1/itineraires`.
- Réponse : `{ marche: Etape | null }`. `Etape` a **la même forme** qu'une étape de `possibilites[].etapes[]` (mode marche, heures, durée, distance, `trace`, `consignes` de la spec 11, `source` OSM). `null` quand MOTIS ne rend aucun trajet direct. MOTIS en panne : 503, comme `/v1/itineraires`.
- Rien n'est gardé ; ni `de` ni `a` dans les journaux (invariants 6 et 10).

### App

- `src/domaine/api.ts` : schéma de la réponse de `/v1/marche` (réutilise le schéma d'étape).
- `src/domaine/nouveau-chemin.ts` (TypeScript pur, testé) :
  - `choisirApresEcart(parcours, k, marche, maintenant)` ⇒ `{ type: "marche" }` ou `{ type: "recherche", raison }`, selon les règles 1 à 3 de D96 ;
  - `remplacerMarche(parcours, k, marche)` ⇒ un nouveau `Parcours` où seule l'étape `k` change (tracé, consignes, heures), et l'état du guidage repart au début de l'étape `k` (abscisse 0, plus d'écart, annonces de l'étape `k` oubliées).
- `guidage.tsx` : `recalculer` appelle d'abord `/v1/marche` quand l'étape courante est une marche avec écart ; le parcours guidé devient un état modifiable (il était figé à l'ouverture), remplacé par `remplacerMarche` ; la carte montre le nouveau tracé. Sinon, ou après la règle 3, `rechercherDepuisIci` comme aujourd'hui.
- Sans réseau ou serveur en panne : les mêmes messages qu'aujourd'hui pour « Recalculer depuis ici » ; la flèche vers le chemin reste affichée.
- En simulation (`sim`, développement seulement), la position envoyée est la position simulée, pour l'essai par adb.
- Le Résultat et la recherche gardée ne changent pas : quitter le guidage puis le rouvrir repart du trajet d'origine (§7).

## 5. Critères d'acceptation

1. **Tests serveur** (`serveur/src/routes/marche.test.ts`) : corps mal formé ou hors bornes ⇒ 400 ; sans clé ⇒ 401 ; MOTIS reçoit `transitModes` vide, `directModes=WALK`, `maxDirectTime=3600`, `fromPlace` et `toPlace` ; un `direct` rendu ⇒ `marche` avec `trace`, `consignes` et `source` ; aucun `direct` ⇒ `marche: null` ; MOTIS en panne ⇒ 503 ; aucune coordonnée dans les journaux.
2. **Tests du domaine** (`src/domaine/nouveau-chemin.test.ts`), rouges avant le code :
   - train dans 10 min, nouvelle marche de 5 min ⇒ nouveau chemin ;
   - train dans 10 min, nouvelle marche de 9 min (arrivée 1 min avant) ⇒ recherche complète, raison « Le train de HH:MM n'est plus à portée » ;
   - dernière marche, en retard ⇒ nouveau chemin ;
   - pas de marche (`null`) ⇒ recherche complète, raison « Aucun chemin à pied » ;
   - `remplacerMarche` : l'étape `k` a le nouveau tracé et les nouvelles heures, toutes les autres étapes sont identiques ; l'état repart à l'étape `k`, abscisse 0, sans écart.
3. **MOTIS national** (`serveur/src/national/marche.national.test.ts`, `npm run test:national`) : d'un point à 300 m à côté d'une marche vers la gare de Joigny, une marche est trouvée, finit à la gare, avec ses consignes ; depuis Brienon (17 km), `marche: null` ou une marche de plus de 1 h refusée. La valeur réelle de `street_routing_max_direct_seconds` est notée ici.
4. **Téléphone** (adb, simulation) :
   - marche dans Joigny vers la gare, écart simulé de 300 m, train encore à portée ⇒ « Recalculer depuis ici » laisse le guidage ouvert, dit « Nouveau chemin », montre le nouveau tracé ; l'étape du train n'a pas changé ;
   - même marche, heure simulée trop tardive ⇒ « Le train de HH:MM n'est plus à portée : nouvelle recherche… » puis le Résultat ;
   - guidage ouvert depuis Brienon (17 km) ⇒ recherche complète, comme aujourd'hui.
   Captures dans `docs/screenshots/` (D93).
5. `npx expo lint`, `npx tsc --noEmit`, `npm test` (app) ; `npm run typecheck`, `npm test`, `npm run build` (serveur). **Verts.**

## 6. Constats

À remplir à l'application.

## 7. Ce qui n'est pas fait ici

- Garder la nouvelle marche dans le trajet enregistré (« Mes trajets », phase 5) : en quittant le guidage, on repart du trajet d'origine.
- Un nouveau chemin hors réseau (D76).
- Prévenir que le véhicule suivant est en retard ou supprimé (temps réel, phase 7) : « à portée » se juge sur l'horaire prévu.
- Un nouveau chemin pendant une étape en véhicule (descendu au mauvais arrêt) : recherche complète, comme aujourd'hui.
