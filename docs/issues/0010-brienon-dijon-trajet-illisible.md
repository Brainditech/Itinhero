# Issue 0010 — Brienon → tribunal administratif de Dijon : le trajet est juste, mais un débutant ne peut pas le suivre

- **Date** : 2026-11-04
- **État** : analyse approuvée par Brainditech le 2026-11-04 (« règle tous les problèmes ») ; **A à F et H corrigés** sur `issue/0010-trajet-lisible-et-guidage`, à constater sur le téléphone. G est traité par les specs 11 et 12.

## 1. Reproduction

Téléphone de Brainditech, development build de la spec 10, MOTIS national du PC. Formulaire : « Tribunal administratif de Dijon », samedi 14/11/2026, arriver avant 15:35, marge 10 min, depuis le domicile.

Résultat affiché (captures `adb` du 2026-11-04 vers 20:10, hors dépôt, D38) :

- « Possible », départ 08:20, arrivée 10:38 ;
- marche 5 min → **bus 803 « vers Auxerre »** 08:25 → 08:50 « SAINT FLORENTIN-VERGIGNY 3 RUE DE LA GARE » → **marche 14 min « jusqu'à Saint-Florentin - Vergigny »** → **« Train K7 vers 17769 »** 09:10 → 10:24 → marche 2 min → tram T1 10:27 → 10:31 → marche 7 min **« jusqu'à Arrivée »** → 10:38 « Tribunal Administratif de Dijon » ;
- une seconde possibilité identique jusqu'à Dijon, puis 20 min à pied ;
- en bas : « Horaires du 21/09 ».

Comparaison : Google Maps, même jour, « arriver à 15:25 », depuis la mairie de Brienon (2026-11-04).

## 2. Ce qui est juste (vérifié, rien à corriger)

1. **Partir à 08:20 pour un rendez-vous à 15:35 est la seule solution le samedi.** Le GTFS Mobigo (`fixtures/_rapatrie-2026-10-19/mobigo89.zip`) n'a qu'un passage du 803 vers Auxerre à l'arrêt MAIRIE (`600326`) : 08:25 (`1014608-1-1`). Les passages de 13:55 et 17:04 vont vers Brienon. Google Maps ne propose aussi que 08:24, et la veille à 18:34.
2. **Les 14 min de marche à Saint-Florentin sont justes.** L'arrêt (47.97873, 3.72714) et la gare (47.98106, 3.73104) sont à environ 390 m à vol d'oiseau, mais le chemin fait un détour par la route de la Gare, la D 43 et la N 77. Google Maps compte « environ 13 min ».
3. **Les horaires sont à jour.** Le jeu Mobigo est valable du 21/09/2026 au 31/08/2027 (`calendar.txt`).

## 3. Défauts, une cause à la fois

Constatés sur le MOTIS national du PC (`/api/v6/plan`, `detailedLegs=true`, même demande, 2026-11-04) :

| # | Défaut | Cause racine (vérifiée) |
|---|---|---|
| A | « Train K7 **vers 17769** » | Le GTFS SNCF met le numéro du train dans `trip_headsign`. MOTIS le rend dans `headsign` (« 17769 ») et donne le vrai terminus dans `tripTo` (« Lyon Part Dieu »). `normaliser.ts` lit seulement `headsign`. |
| B | **Le 803 est sur réservation, et l'app ne le dit pas.** Google affiche « Les usagers doivent appeler l'agence ». | Dans le GTFS Mobigo, chaque passage du 803 à MAIRIE porte `pickup_type=2` (« appeler l'agence »). MOTIS v2.11.4 le perd : `pickupType` vaut « NORMAL » et `reservation` vaut « NONE » (son `PickupDropoffType` n'a que NORMAL et NOT_ALLOWED, openapi.yaml du tag). Le GTFS Mobigo ne donne aucun numéro (`agency_phone` vide). |
| C | **« jusqu'à Arrivée »**, et aucune adresse du lieu de rendez-vous | MOTIS nomme le point d'arrivée « END ». `nomLieu()` le traduit en « Arrivée ». Le nom choisi à la Confirmation n'est pas repris dans l'étape, et un lieu de l'IGN (« Tribunal Administratif ») n'a pas d'adresse postale. Google affiche « 22 Rue d'Assas, 21000 Dijon ». |
| D | **On sort de chez soi à 08:20 pour un bus à 08:25, sans aucune marge.** | MOTIS colle la marche au départ du véhicule. Aucune règle d'Itinhero n'ajoute de temps avant la première montée. Pour le seul bus de la journée, le rater, c'est rater le rendez-vous. |
| E | **De 08:50 à 09:10, il manque 6 min** (marche 14 min, puis train à 09:10). | L'écran donne l'heure de début de chaque étape, mais ni l'heure d'arrivée d'une marche ni l'attente qui suit. |
| F | **On ne sait pas si « Saint-Florentin - Vergigny » est une gare ou une rue** ; « SAINT FLORENTIN-VERGIGNY 3 RUE DE LA GARE », « MAIRIE » en capitales | Les noms bruts des GTFS sont affichés tels quels. Rien ne dit « arrêt » ni « gare ». |
| G | **Aucune consigne pour marcher** : on sait « 14 min », pas par où. | `detailedLegs=false` (`motis-plan.ts`) : ni tracé ni consignes ne sont demandés à MOTIS. Le PLAN les place en phase 4 (« gabarits de consignes », « tracé de marche »). |
| H | « Horaires du 21/09 » laisse croire à des horaires anciens | C'est la date de début de validité du jeu, affichée sans explication. |

### Constat qui change la façon de faire G

MOTIS v2.11.4 rend bien des consignes (`steps`), mais elles ne sont **pas utilisables telles quelles** : sur les 5 possibilités de cette demande, 436 consignes sur 437 disent « CONTINUE » (une seule « STAIRS »), et 247 n'ont pas de nom de rue. Le champ `relativeDirection` n'est pas calculé dans cette version (l'openapi marque aussi `exit`, `stayOn` et `area` « Not implemented! »). Chaque consigne porte en revanche son tracé (`polyline`) et son nom de rue quand OSM en a un.

Il faut donc **calculer nous-mêmes** les virages (« à gauche », « à droite », « légèrement à droite »…) à partir des tracés, et regrouper les morceaux d'une même rue. C'est la spec 11.

## 4. Corrections proposées (à approuver)

- **A** (serveur, `normaliser.ts`) : lire aussi `tripTo` et `tripShortName`. Si `headsign` n'est fait que de chiffres, c'est un numéro de train : la direction devient `tripTo.name` et le numéro est gardé à part (« TER 17769 vers Lyon Part-Dieu »). Test : la réponse MOTIS de cette demande, enregistrée dans `__exemples__`.
- **B** (serveur) : lire `pickup_type` et `drop_off_type` dans les GTFS chargés, par `trip_id` et arrêt (la source de l'étape les porte déjà, invariant 4). Si c'est `2` ou `3`, l'étape porte `reservation: "appel"` ; l'app affiche **« Réservation obligatoire : appelez Mobigo avant de partir »**. Sans fiche validée, **aucun numéro** n'est affiché (invariant 16) : la fiche Mobigo de `data/fiches/` (phase 4) est à valider par Brainditech. → **D69 proposée.**
- **C** (serveur + app) : l'app envoie le nom choisi à la Confirmation et le serveur le met sur la dernière étape à la place de « Arrivée ». Pour un lieu sans adresse, le serveur cherche l'adresse la plus proche par le géocodage inverse de l'IGN (constaté : « 11 Rue d'Assas 21000 Dijon » à 16 m ; la vraie adresse est le 22). Au-delà de 10 m, on affiche la rue sans numéro (« rue d'Assas, 21000 Dijon ») pour ne pas donner un faux numéro. Le serveur ne garde rien (invariant 6), et le journal ne contient ni le nom ni les coordonnées (invariant 10).
- **D** (serveur) : une **marge avant la première montée**. On cherche comme aujourd'hui, puis l'heure de départ de chez soi est avancée pour arriver à l'arrêt 5 min avant le véhicule. Proposition : **5 min**, et **10 min** pour un transport sur réservation ou le dernier départ de la journée. La marche est inchangée, l'écran dit « Arrivez à l'arrêt à 08:20, le bus passe à 08:25 ». → **D68 proposée** (valeurs à trancher).
- **E** (app, `Trajet.tsx`) : chaque marche dit son heure d'arrivée (« arrivée 09:04 »), et une ligne « Attente 6 min » s'ajoute dès qu'il y a plus de 2 min entre deux étapes.
- **F** (serveur) : un nom affichable par lieu. Capitales remises en minuscules (« Saint-Florentin-Vergigny, 3 rue de la Gare »), et un type de lieu : arrêt de bus ou de car, gare, station, adresse. L'app écrit « arrêt Mairie », « gare de Saint-Florentin - Vergigny ».
- **G** : spec 11 (consignes de marche) et spec 12 (guidage sur la carte).
- **H** (app) : « Horaires valables jusqu'au 31/08/2027 » (la fin de validité du jeu le plus court parmi les étapes).

## 5. Tests de régression prévus

- Serveur : réponse MOTIS enregistrée de cette demande ⇒ direction « Lyon Part Dieu » et numéro « 17769 » (A) ; étape du 803 avec `reservation: "appel"` d'après `fixtures/_rapatrie-2026-10-19/mobigo89.zip` (B) ; dernière étape nommée d'après la demande (C) ; départ à 08:20 ⇒ heure de sortie avancée selon D68 (D) ; noms remis en forme (F).
- App : texte de l'attente et de l'heure d'arrivée d'une marche (E) ; « horaires valables jusqu'au » (H).

## 6. Correction (2026-11-04)

| # | Fait | Où |
|---|---|---|
| A | `tripTo` lu ; un `headsign` fait de chiffres devient `numero`, la direction est le terminus. L'app écrit « TER K7 n° 17769 vers Lyon Part Dieu » (le nom du terminus est celui du GTFS, sans retouche). | `motis-plan.ts`, `normaliser.ts` (`directionEtNumero`), `src/domaine/resultat.ts` |
| B | `npm run donnees:horaires` lit les 536 GTFS nationaux en 12 min : 138 358 courses ont au moins un arrêt sur réservation, dont 67 courses Mobigo sur 99. L'étape porte `reservation: "appel"`, la carte et l'étape disent « Réservation obligatoire : appelez MOBIGO 89 avant de partir », sans numéro (D69, invariant 16). | `horaires-gtfs.ts`, `donnees/horaires.ts`, `HORAIRES_GTFS` |
| C | L'app envoie `noms` (« Domicile » ou « Ma position », et le lieu choisi). L'IGN (géocodage inverse) donne « 13 Rue d'Assas » à 15 m du tribunal : au-delà de 10 m, la réponse dit « Rue d'Assas, 21000 Dijon ». Une panne de l'IGN laisse l'adresse vide sans faire échouer la recherche. | `routes/itineraires.ts`, `lieux/ign-geocode.ts` (`lireAdresseInverse`) |
| D | D68 : 5 min à l'arrêt, 10 sur réservation. Samedi : sortie 08:14, « Arrivez à l'arrêt à 08:15, le bus passe à 08:25 ». Le cas « dernier départ de la journée » n'est pas fait (D68). | `normaliser.ts` (`avanceMontee`) |
| E | Chaque marche dit « arrivée 09:04 » ; une ligne « Attente 6 min » au-delà de 2 min. | `Trajet.tsx`, `resultat.ts` (`attenteApres`) |
| F | Capitales remises en forme (« Saint-Florentin-Vergigny, 3 rue de la Gare », sigles gardés) ; type de lieu (arrêt, gare, station) : « arrêt Mairie », « gare de Saint-Florentin - Vergigny ». | `noms.ts`, `resultat.ts` (`nomLieuEtape`) |
| H | « Horaires valables jusqu'au 31/12/2026 » : la fin de validité la plus proche des jeux utilisés (ici le tram de Dijon). | `horaires-gtfs.ts`, `resultat.ts` (`finHoraires`) |

Constaté sur l'API locale reliée au MOTIS national (réponse de 7,3 Ko en 1,2 s) : 08:14 → 10:38, marche jusqu'à l'arrêt Mairie (arrivée 08:15), bus 803 vers Auxerre sur réservation, marche jusqu'à la gare de Saint-Florentin - Vergigny (arrivée 09:04), attente 6 min, TER K7 n° 17769 vers Lyon Part Dieu, tram T1 vers Quetigny Centre, marche jusqu'au Tribunal administratif de Dijon, Rue d'Assas, 21000 Dijon.

Tests de régression : `serveur/src/itineraires/issue-0010.test.ts` (réponse MOTIS enregistrée `__exemples__/plan-brienon-dijon-2026-11-14-detaille.json`, GTFS Mobigo de `fixtures/`), `serveur/src/national/brienon-dijon.national.test.ts`, `src/domaine/resultat.test.ts`.

À faire par Brainditech : régénérer `donnees/horaires.json` après chaque `npm run donnees:nationales`, reconstruire l'API nationale (`docker compose -p itinhero-national -f docker-compose.yml -f docker-compose.national.yml up -d --build api`), refaire la recherche sur le téléphone.
