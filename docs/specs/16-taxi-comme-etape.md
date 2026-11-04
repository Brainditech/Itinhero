# Spec 16 — Taxi comme étape au début et à la fin

- **Date** : 2026-11-05
- **État** : **approuvée par délégation** de Brainditech (« règle tout ça un par un… reloop jusqu'à ce que tout est parfait »), appliquée et constatée sur le téléphone (§6). Règles : D48, D80.
- **Branche** : `serveur/taxi-etape` (empilée sur `app/verdict-nuit`).
- **Issue d'origine** : 0011, défaut C.
- **Case de PLAN.md** : phase 3, « Taxi comme étape au début et à la fin (D48) ».
- **Invariants** : 3 (aucun numéro ni prix inventé), 4 (chaque étape a sa source : la carte OSM pour le taxi), 5 (prix « non publié »), 16 (aucun numéro sans fiche validée ou page publique).

## 1. But

Le soir, le dernier car vers Brienon est parti depuis longtemps : Itinhero proposait une nuit dehors (issue 0011). SNCF Connect, lui, finit le trajet **en voiture**. Itinhero propose maintenant un **taxi pour le dernier bout** (ou le premier), seulement quand il fait vraiment gagner du temps.

## 2. Doc lue

`openapi.yaml` du tag MOTIS **v2.11.4** (`/api/v6/plan`) :

- `preTransitModes` / `postTransitModes` : modes permis entre le départ et le premier arrêt / entre le dernier arrêt et l'arrivée ; `CAR` est un mode de rue (routage voiture sur l'OSM chargé, `street_routing: true`).
- `maxPreTransitTime` / `maxPostTransitTime` : durée la plus longue de ces bouts, en secondes, tous modes confondus.
- `directModes` (trajet sans transport en commun) reste `WALK` par défaut : jamais de taxi de bout en bout.

## 3. Constaté avant de choisir (2026-11-05, MOTIS national)

Gifi Joigny 2 → Brienon, jeudi 12/11, partir à 17:00 :

- voiture permise aux **deux** bouts : MOTIS encadre un bus d'une à quatre minutes par deux trajets en voiture de 15 à 24 min (« CAR 19 · BUS 05 (3 min) · CAR 20 »). C'est un taxi de bout en bout déguisé ;
- voiture permise **à la fin seulement, 15 min au plus** : marche 21 min, TER P25 Joigny 17:48 → Laroche-Migennes 17:55, taxi 12 min, arrivée **18:07** (au lieu du vendredi 06:32 sans taxi). C'est le trajet de SNCF Connect pour Dijon.

## 4. Décision D80

- Deux recherches de plus, en parallèle de la recherche normale : taxi **au début** seulement, taxi **à la fin** seulement ; **15 min de route au plus**. Leur échec ne fait jamais échouer la recherche.
- Elles sont normalisées à part : un trajet avec taxi ne retire jamais un trajet sans taxi comme « dominé ».
- Un trajet avec taxi n'est montré que :
  - s'il a au moins une étape en transport en commun ;
  - en « partir à » : s'il arrive au moins **30 min avant** le premier trajet sans taxi (ou s'il n'y en a aucun) ;
  - en « arriver avant » : s'il part au moins **30 min après** le dernier trajet sans taxi (ou s'il n'y en a aucun) ;
  - **deux au plus** (les arrivées les plus tôt, ou les départs les plus tard).
- Verdict (app) : d'abord un trajet sans nuit dehors et sans taxi, puis sans nuit dehors avec taxi, puis le premier. Avec un taxi, le détail ajoute « Avec un taxi à réserver (prix non publié). »
- Écarté : voiture permise aux deux bouts (taxi de bout en bout déguisé, §3) ; taxi toujours montré (il coûte cher ; il ne doit remplacer le car que s'il change vraiment l'heure) ; plus de 15 min de route (MOTIS irait chercher en voiture la gare la plus rapide, à 25 min ou plus).

## 5. Ce qui est construit

- Serveur :
  - `motis-plan.ts` : `DemandeRecherche.taxi = "debut" | "fin"` ⇒ `preTransitModes` ou `postTransitModes` = `WALK,CAR`, `max…TransitTime` = 900 ;
  - `normaliser.ts` : `CAR` ⇒ mode `taxi`, source OSM ; la première montée (D68) est le premier transport en commun, pas le taxi ; le taxi prend le type du lieu voisin (« gare de Laroche-Migennes ») ; `taxisUtiles` (D80) ;
  - `routes/itineraires.ts` : les trois recherches, puis le tri par départ.
- App :
  - `resultat.ts` : `libelleEtape` « Taxi 12 min », `phraseTaxi`, `avecTaxi`, verdict de D80 ;
  - `Trajet.tsx` : icône `local_taxi`, bloc noir (jeton `mode-taxi`) dans la frise, ligne d'étape « À réserver : prise en charge à 17:55. 12 min de route estimée, hors attente. Délai pour appeler non connu. », « Taxi 12 min : réservation obligatoire » sur la carte, pas de badge « Horaire prévu » pour un taxi.
- Heure de prise en charge (D48) : à la fin, l'arrivée du train ; au début, le départ du train − 5 min de marge (D68) − la durée de route.
- Aucun numéro de taxi n'est donné : il n'existe encore aucune fiche (invariant 16) ; c'est `POST /v1/numeros` (D49) qui les apportera.

## 6. Critères d'acceptation et constats

1. Tests serveur (`taxi.test.ts`, 7 tests) : paramètres MOTIS (un seul bout, 900 s, jamais `directModes`) ; `CAR` ⇒ taxi sourcé OSM, sans correspondance, depuis la « gare » ; taxi au début : prise en charge 06:58 pour un train à 07:15 et 12 min de route ; `taxisUtiles` en « partir » et en « arriver », jamais sans transport en commun, deux au plus. **Verts.**
2. Tests app (`resultat.test.ts`) : libellé, consigne sans numéro, verdict qui préfère le taxi du soir à une nuit dehors et un trajet sans taxi quand il existe. **Verts.**
3. **Sur le téléphone (2026-11-05, par Claude via `adb`, captures hors dépôt)** : Gifi Joigny 2 → Domicile, jeudi 12/11, partir à 17:00 ⇒ « Possible, Départ 17:22 … Arrivée prévue à 18:07. Avec un taxi à réserver (prix non publié). » ; possibilités 17:22 → 18:07 et 18:17 → 19:02 (marche, TER, taxi 12 min), puis le trajet de nuit 23:07 → vendredi 06:32 marqué « Nuit dehors ». Étape taxi : « Taxi 12 min · De gare de Laroche - Migennes à Domicile, arrivée 18:07 · À réserver : prise en charge à 17:55… ». **Rempli.**
4. Sur le téléphone : Domicile → Gifi Joigny, arriver avant 10:00 ⇒ toujours le car de 06:17 en verdict (pas de taxi en tête). **Rempli** : « Possible, Départ 06:17 » ; en seconde possibilité, 08:46 → 09:30 « Taxi 12 min · TER K7 · Marche 21 min » (départ 2 h 29 plus tard, sans la marche de 48 min).
5. Lint, `tsc` app et serveur, tests verts.

## 7. Ce qui n'est pas fait ici

- Les numéros de taxi (`POST /v1/numeros`, D49) et le délai pour appeler (fiches).
- Le retour Dijon → Brienon (issue 0011) à constater dans l'app : même mécanisme, à refaire au prochain passage.
