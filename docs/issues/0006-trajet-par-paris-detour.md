# Issue 0006 — Un trajet qui change de gare à Paris fait un détour absurde

- **Date** : 2026-11-03
- **État** : analyse approuvée, correction choisie par Brainditech le 2026-11-04 : **A et B** (D45, D46). Elle s'applique en phase 2 bis de PLAN.md, avec le test de régression du §6 ; l'issue se ferme quand ce test est vert.
- **Numéro** : 0005 est réservé à l'issue des erreurs de tuiles MapLibre en développement, annoncée et pas encore écrite.

## 1. Reproduction

MOTIS de la spec 04 (`docker compose up -d`, horaires figés du 18/10), recherche au départ (D44 proposée) le jeudi 12/11/2026, de 00:00 à 23:59, `useRoutedTransfers=false`, d'arrêt à arrêt :

```
GET /api/v6/plan?fromPlace=sncf_StopArea:OCE87683268   (Laroche-Migennes)
                &toPlace=sncf_StopArea:OCE87448001     (Flers)
                &time=2026-11-11T23:00:00Z&arriveBy=false&searchWindow=86340
```

Meilleures réponses : départ 05:57, arrivée 16:16 (10 h 19, par Dijon, Lyon Part-Dieu, Massy, Montparnasse) ; départ 08:02, arrivée 19:44 ; départ 11:05, arrivée 22:17. Avec `useRoutedTransfers=true` : 05:03 → 19:44 (14 h 41, par Paris Bercy, Nevers, Tours, Surdon).

Attendu (trajet qu'un voyageur fait réellement) : TER jusqu'à Paris Bercy, métro jusqu'à Montparnasse, train jusqu'à Flers, environ 5 h.

## 2. Hypothèse (une seule)

Les données chargées ne permettent pas de passer de Paris Bercy (ou Gare de Lyon) à Paris Montparnasse :
- pas de métro ni de RER : seuls les GTFS SNCF et Mobigo 89 sont chargés ;
- pas de marche possible : l'extrait OSM ne couvre que le couloir de l'Yonne (D41), et à vol d'oiseau Bercy–Montparnasse fait environ 4,6 km, au-delà des 50 min de D42 ;
- `transfers.txt` SNCF est vide (81 octets, constat de 0001).

MOTIS contourne donc Paris par des trains qui ne demandent aucun changement de gare.

## 3. Vérification de l'hypothèse (2026-11-03)

Les deux moitiés, recherchées séparément le 12/11, sont justes et directes :

| Moitié | Réponse de MOTIS |
|---|---|
| Laroche-Migennes → Paris Bercy | 05:03 → 06:35, 06:04 → 07:35, 07:03 → 08:38, 08:03 → 09:33… (TER directs) |
| Paris Montparnasse → Flers | 07:14 → 10:01, 10:54 → 13:10, 13:53 → 16:16… (K4 directs) |

Avec 45 min environ de métro entre les deux gares, un voyageur part à 05:03 et arrive à Flers à 10:01. MOTIS ne le trouve pas : seul le lien Bercy → Montparnasse manque.

## 4. Cause racine

Il manque aux données de MOTIS le réseau urbain de Paris (métro, RER) et la carte des rues de Paris. Ce n'est pas un défaut de MOTIS ni de sa configuration. Le plan l'avait prévu en mettant « France entière » et « trajet dans Paris » hors v1 (PLAN.md §8). Mais rien n'empêche aujourd'hui d'afficher ce détour comme s'il était bon.

## 5. Corrections possibles (à choisir par Brainditech)

| Option | Ce que ça fait | Coût |
|---|---|---|
| **A. Ajouter l'Île-de-France** | GTFS d'Île-de-France Mobilités (métro, RER, Transilien, bus ; données ouvertes) et extrait OSM Île-de-France dans MOTIS. Le trajet Laroche → Flers devient juste. | Révise le hors v1 (décision écrite). Plus de mémoire et un VPS plus gros (R1 à remesurer) ; taille des fichiers à constater. Nouvelle spec. |
| **B. Refuser hors périmètre** | L'API répond « trajet hors de la zone couverte (Yonne) » quand le départ ou l'arrivée est hors de la zone des données (A13). | Petit. Ne rend pas le trajet juste, mais n'affiche jamais un détour faux. |
| C. Correspondances écrites à la main entre gares parisiennes | — | **Écartée** : temps inventés, sans source (principe de `architecture.md`). |

A et B ne s'excluent pas : B protège de toute façon les trajets hors des données, même avec A.

**Choix de Brainditech (2026-11-04)** : A étendue à toute la France (D46), et B pour ce qui reste hors des données chargées (étranger, réseau sans données).

## 6. Test de régression (après la correction choisie)

- A : test d'intégration Laroche-Migennes → Flers le 12/11, arrivée au plus tard à celle que donne l'oracle pour la chaîne TER + K4, avec une étape métro ou RER.
- B : test (unitaire et d'intégration) : départ ou arrivée hors zone ⇒ réponse « hors périmètre », aucune possibilité affichée.

## 7. Autre constat, à analyser à part

Avec `useRoutedTransfers=true`, aucune possibilité n'utilise de TGV, alors qu'il y en a sans cette option. Hors de l'extrait OSM, les correspondances semblent limitées. Ce n'est pas la cause de cette issue (le lien qui manque reste Bercy → Montparnasse). À étudier séparément si l'option A est choisie.
