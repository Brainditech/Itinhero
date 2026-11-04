# Issue 0008 — Châtelet → Orly : le métro 14 direct n'est pas proposé

- **Date** : 2026-11-04
- **État** : cause racine trouvée (calcul du coût de la marche dans MOTIS), **corrigée par D62** le 2026-11-04 sur la demande de Brainditech (« règle tout ») ; correction à valider à la relecture de la PR. Un reste de 13 stations relève de la carte OSM (§7).

## 1. Reproduction

MOTIS national du PC (spec 08, 536 jeux après D59), par la route `POST /v1/itineraires` (spec 09). Vendredi 13/11/2026, partir à 07:00, de la place du Châtelet (48.85835, 2.34849, coordonnées de la zone d'arrêt IDFM `IDFM:71264`) à la gare de Pont de Rungis-Aéroport d'Orly (48.74803, 2.37267).

- Itinhero : 07:02 → 07:36, marche 4 min, métro 7 jusqu'à Maison Blanche, métro 14 jusqu'à Thiais-Orly, marche 3 min (34 min).
- Google Maps (même jour, même heure, mêmes coordonnées) : 07:01 → 07:29, métro 14 direct (28 min).

## 2. Hypothèses vérifiées, une à la fois

1. **Le métro 14 ne dessert pas Châtelet dans nos données** : fausse. `/api/v1/stoptimes` à `IDFM:71264` rend 29 passages du 14 en une heure (quais `IDFM:21959` et `IDFM:463159`).
2. **Le 14 depuis Châtelet est plus lent que 7 + 14** : fausse. Depuis le quai `IDFM:21959`, MOTIS rend 06:02 → 06:27 (14 direct, 22 min, puis 3 min à pied) : 25 min, mieux que Google.
3. **La marche jusqu'au quai du 14 est longue** : fausse. La marche de 21 min que MOTIS proposait avec le 14 menait en fait à **Pyramides**, pas à Châtelet (`detailedLegs=true`). Les quais `21959`, `463159`, `22092` et `463158` (lignes 1 et 14, niveau OSM −3,5) n'étaient atteints à pied par aucune recherche.
4. **Les quais du niveau −3,5 sont coupés de la rue dans la carte** : fausse. Un trajet à pied direct jusqu'au quai (`directModes=WALK`, `toPlace=IDFM:21959`) rend 4 min… avec `maxDirectTime=2400`, mais rien avec `1800`.
5. **MOTIS borne la marche par un coût, pas par une durée** : **vraie**. Avec `maxPreTransitTime=2400` au lieu de 1800, la recherche prend le 14 direct depuis le quai profond : 07:01 → 07:36 (marche 4 min). Lu dans le code d'osr (commit `248b798` épinglé par MOTIS v2.11.4, `include/osr/routing/profiles/foot.h`, `way_cost`) : chaque tronçon d'un chemin non marqué piéton coûte 90 s de plus, chaque tronçon d'une rue au trottoir dessiné à part 45 s, et la limite `maxPreTransitTime` porte sur ce coût. Un couloir souterrain découpé en petits tronçons « coûte » ici entre 33 et 40 min pour 4 min de marche réelle.

## 3. Cause racine

La limite de 30 min de marche au départ et à l'arrivée (`maxPreTransitTime`, `maxPostTransitTime`) est appliquée par MOTIS au coût du chemin, pas à sa durée. Un arrêt proche mais desservi par des couloirs « coûteux » est déclaré hors de portée. Ce n'est ni un défaut de nos GTFS ni de l'API : c'est la façon dont osr pénalise certains chemins de la carte.

## 4. Corrections essayées et rejetées

- Paramètre expérimental `radius=300` (arrêts proches, marche à vol d'oiseau) : Châtelet corrigé, mais trajets impossibles (Saint-Charles → Notre-Dame de la Garde en 13 min, en montée), verdicts « impossible » à tort (La Défense, Lyon, Toulouse), Tonnerre → Sens en 149 min au lieu de 81. Un verdict faux est pire qu'un trajet plus long.
- Relever la limite de coût à 3600 pour toutes les recherches : sur 200 trajets tirés au hasard dans toute la France, aucun gain et **14 trajets perdus** (MOTIS préfère alors des solutions à longue marche, que nous écartons au-delà de 30 min réelles).
- Relancer la recherche depuis la station du quai et greffer la marche réelle : écrit puis retiré, inutile une fois la cause connue.

## 5. Correction retenue (D62)

`serveur/src/itineraires/marche-couteuse.ts`, branché dans `moteurMotis` :
1. la recherche ordinaire est toujours faite, telle quelle ;
2. en même temps, de chaque côté, MOTIS liste les arrêts atteints à pied avec la limite 1800, puis 3600 (`/api/v6/one-to-all`, `transitModes` vide, 0,15 à 0,4 s) ; un arrêt à 15 min de marche réelle ou moins qui n'apparaît qu'avec 3600 est « masqué par le coût » ;
3. s'il y en a, une seconde recherche est faite avec la limite 3600 de ce côté ; ses possibilités dont la marche réelle au départ ou à l'arrivée dépasse 30 min sont écartées, les autres s'ajoutent aux ordinaires et passent par le même tri, les mêmes filtres et les mêmes sources.

Si la détection ou la seconde recherche échoue, la recherche ordinaire est rendue telle quelle. Elle n'est jamais retirée : la règle ne peut qu'ajouter des possibilités.

## 6. Mesures

- Châtelet → Orly par la route du serveur : **07:01 → 07:36, métro 14 direct, 0 correspondance** (avant : 07:00 → 07:39, métros 7 et 14), 2,4 s.
- **Audit national** (`npm run audit:quais`, `serveur/src/audit/quais.ts`) : pour chacune des 13 776 stations desservies par autre chose que le bus, les quais desservis à moins de 300 m que la marche n'atteint pas. Limite 1800 : 32 quais dans 17 stations (dont Châtelet, Étoile, Gabriel Péri, Pont de Levallois). Limite 3600 : 17 quais dans 13 stations.
- **300 trajets tirés au hasard** (moitié depuis un arrêt de métro, RER ou tram, un sur cinq en longue distance, départ et arrivée à ±300 m d'un arrêt), règle contre recherche ordinaire : arrivée plus tôt 2 fois (14 min dans l'Essonne, 19 min à Marseille), égale 257 fois, plus tard 0, perdue 0, rien des deux côtés 41 ; aucune marche de plus de 30 min ; temps médian 336 ms des deux côtés, 95 % sous 3,3 s.
- La Défense → Versailles (5 min de marche jusqu'au quai contre 2 pour Google, spec 09 §11.2) n'est **pas** de cette famille : la marche de la recherche (8 min jusqu'à la gare, 520 m) est celle du trajet à pied direct. La gare RER/Transilien est un seul point au milieu de la dalle, à 400 m du point « La Défense », et osr marche à 1,2 m/s. L'audit compte 427 quais « lents » (marche plus de 2,5 fois le vol d'oiseau) dans 292 stations, identiques avec les deux limites : longs chemins de la carte, pas un défaut de coût.
- Série de comparaison avec Google Maps rejouée (18 trajets) : aucun trajet dégradé. Toulouse Capitole → aéroport rend « impossible » avec ou sans la règle : autre cause, issue 0009.

## 7. Reste : 13 stations coupées de la rue dans la carte

Avec la limite 3600, 17 quais restent injoignables à pied : Bourse, Tolbiac, Château Rouge, Jules Joffrin, Pigalle, Saint-Lazare, Saint-Denis – Porte de Paris, Saint-Germain-en-Laye, Saint-Ouen-l'Aumône (Île-de-France), Basso Cambo et Jean Jaurès (Toulouse), La Courrouze (Rennes). Exemple : à Bourse, un sens de la ligne 3 est atteint, l'autre non, et MOTIS compte 13 à 14 min de correspondance entre les deux quais (`/api/debug/transfers`) ; dans la carte, ce quai n'est relié à rien de praticable. Aucune donnée fiable ne permet de le corriger côté serveur sans inventer une durée.

Pistes (à approuver avant d'en suivre une) :
- A. Corriger ces stations dans OpenStreetMap (compte OSM, contribution publique), puis réimporter : corrige à la source, pour tout le monde. La liste exacte sort de l'audit.
- B. Signaler au projet MOTIS les deux constats : coût et durée confondus dans la limite de marche, et quais isolés, avec la reproduction du §1.

## 8. Tests de régression

- `serveur/src/itineraires/marche-couteuse.test.ts` (9 tests, sans réseau) : arrêts masqués, marches de plus de 30 min écartées, réponse ordinaire rendue telle quelle sans arrêt masqué ou en cas de panne, seconde recherche élargie d'un seul côté, URL de MOTIS.
- `serveur/src/national/chatelet-orly.national.test.ts` (MOTIS national, jamais en CI) : Châtelet → Pont de Rungis le 13/11 à 07:00, au moins une possibilité de 30 min au plus en métro 14 direct, marche d'approche de 6 min au plus. Rouge avant D62 (meilleure : 34 min, une correspondance), vert après.
