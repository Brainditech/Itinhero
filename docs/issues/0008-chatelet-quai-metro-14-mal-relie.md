# Issue 0008 — Châtelet → Orly : le métro 14 direct n'est pas proposé

- **Date** : 2026-11-04
- **État** : cause racine trouvée (données OSM), **non corrigée**. Une correction essayée a été rejetée (§4). Analyse à approuver par Brainditech avant toute nouvelle correction.

## 1. Reproduction

MOTIS national du PC (spec 08, 536 jeux après D59), par la route `POST /v1/itineraires` (spec 09). Vendredi 13/11/2026, partir à 07:00, de la place du Châtelet (48.85835, 2.34849, coordonnées de la zone d'arrêt IDFM `IDFM:71264`) à la gare de Pont de Rungis-Aéroport d'Orly (48.74803, 2.37267).

- Itinhero : 07:02 → 07:36, marche 4 min, métro 7 jusqu'à Maison Blanche, métro 14 jusqu'à Thiais-Orly, marche 3 min (34 min).
- Google Maps (même jour, même heure, mêmes coordonnées) : 07:01 → 07:29, métro 14 direct (28 min).

## 2. Hypothèses vérifiées, une à la fois

1. **Le métro 14 ne dessert pas Châtelet dans nos données** : fausse. `/api/v1/stoptimes` à `IDFM:71264` rend 29 passages du 14 en une heure (quais `IDFM:21959` et `IDFM:463159`).
2. **Le 14 depuis Châtelet est plus lent que 7 + 14** : fausse. Depuis le quai `IDFM:21959`, MOTIS rend 06:02 → 06:27 (14 direct, 22 min, puis 3 min à pied) : 25 min, mieux que Google.
3. **La marche jusqu'au quai du 14 est longue** : vraie dans la recherche, fausse à vol d'oiseau. Trajet à pied direct (sans transport) jusqu'aux coordonnées GTFS du quai : 4,1 min, 292 m. Mais dans la recherche, avec la marche d'approche portée à 30 min (`maxPreTransitTime=1800`), MOTIS ne prend le 14 qu'avec une marche de plus de 20 min (06:01 → 06:49).

## 3. Cause racine

Dans la carte OSM, le quai profond du métro 14 à Châtelet est mal relié au reste du pôle (niveaux et couloirs souterrains) : MOTIS rattache l'arrêt GTFS à un point de la carte depuis lequel le chemin vers la rue est très long. Ce n'est pas un défaut de l'API ni des GTFS.

## 4. Correction essayée et rejetée

Paramètre expérimental `radius=300` de MOTIS v2.11.4 (tous les arrêts à moins de 300 m, marche estimée à vol d'oiseau). Châtelet → Orly devenait 07:00 → 07:25 (mieux que Google), mais sur la série de comparaison :
- Saint-Charles → Notre-Dame de la Garde en 13 min (2,4 km en montée : impossible) ;
- La Défense → Versailles, Lyon Part-Dieu → Fourvière, Toulouse Capitole → aéroport : verdict « impossible » à tort ;
- Tonnerre → Sens : 149 min au lieu de 81.

Rejeté : un verdict faux est pire qu'un trajet 6 minutes plus long.

## 5. Pistes (à approuver avant d'en suivre une)

- A. Corriger la carte OSM à Châtelet (contribution à OpenStreetMap), puis réimporter : corrige à la source, pour tout le monde.
- B. Signaler le cas au projet MOTIS (rattachement des quais souterrains), avec la reproduction du §1.
- C. Pour les grands pôles seulement, chercher aussi depuis chaque quai de la zone d'arrêt GTFS (`parent_station`) quand le départ est dans la zone, et garder le meilleur : plus de requêtes, à mesurer.

## 6. Test de régression (proposé)

Dans `serveur/src/national/` : Châtelet → Pont de Rungis le 13/11 à 07:00, au moins une possibilité de 30 min au plus. Aujourd'hui rouge ; à ajouter avec la correction retenue.
