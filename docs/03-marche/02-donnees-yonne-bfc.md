# Volet B — Données ouvertes disponibles pour l'Yonne / la Bourgogne-Franche-Comté

> Agent : kodivine-chercheur · relevé le 2026-10-19 · méthode : catalogue de l'API
> `transport.data.gouv.fr/api/datasets` filtré sur BFC / Yonne / taxi / covoiturage, puis
> **lecture directe des fichiers GTFS** téléchargés le 2026-10-19 (pas de déduction depuis les
> fiches). Les fichiers bruts ne sont pas versionnés dans le projet ; ils se re-téléchargent aux
> URL citées.

## Épreuve de l'amont

Le brief dit : « les apps donnent le train depuis Migennes mais personne ne dit comment rejoindre
Migennes ». Si c'était subtilement faux, le mensonge serait ici : **la donnée du premier
kilomètre existe et est publiée**. Un car TER (ligne K941 Troyes – Laroche-Migennes) dessert
l'arrêt « Brienon-sur-Armançon Mairie » dans le GTFS national SNCF, et la ligne Mobigo 856 relie
Brienon à Migennes dans le GTFS régional (constats ci-dessous). Le vrai trou n'est donc pas
*l'information* mais **l'offre aux heures utiles** et sa **direction** : le matin, aucun car TER
ne va de Brienon vers Laroche-Migennes (premier départ 13:25 en semaine) et un seul bus à la demande
y va (mardi et jeudi, 09:25, sur réservation) ; en revanche le car TER de **06:27 part vers Troyes**
(lun–ven), d'où l'on atteint Paris Est à 09:16, et passe par Saint-Florentin, d'où l'on atteint
Joigny à 09:09 au prix d'environ 2,8 km à pied (§B1, §B6). « Rejoindre Migennes » n'est donc pas
le seul chemin du matin. Deuxième mensonge possible : « RDV » ne veut pas dire
Paris — le rendez-vous réel de Brainditech est à **Joigny** (voir §B6).

## B1. TER / SNCF (dont cars TER) — GTFS et temps réel

- Le jeu « Réseau SNCF TGV, Intercités et TER » publie un GTFS, deux flux GTFS-RT (trip updates, service alerts), deux flux SIRI Lite et un NeTEx, sous licence ODbL (source: https://transport.data.gouv.fr/datasets/horaires-sncf, vérifié le 2026-10-19).
- Le GTFS SNCF relevé porte `feed_version` 2026-10-18 et couvre du 2026-10-18 au 2027-03-31 (source: https://www.data.gouv.fr/api/1/datasets/r/9ae758ec-cd7a-40cd-a890-bb3963224942, fichier feed_info.txt, téléchargé le 2026-10-19).
- Ce GTFS contient l'arrêt `StopPoint:OCECar TER-87117994` « Brienon-sur-Armançon Mairie » (47.992025, 3.617066), desservi uniquement par la ligne de car TER K941 « Troyes – Laroche Migennes » (source: même fichier, stops.txt + routes.txt, téléchargé le 2026-10-19).
- Il n'existe aucun arrêt ferroviaire (`Train TER`) à Brienon dans ce GTFS ; la gare ferroviaire la plus proche est « Laroche - Migennes » (87683268), à 8,47 km à vol d'oiseau de l'arrêt Brienon Mairie (calcul haversine sur les coordonnées de stops.txt) (source: même fichier, téléchargé le 2026-10-19).
- Horaires K941 au départ de Brienon **vers Laroche-Migennes**, lundi–vendredi : **13:25 → 13:38** et **18:35 → 18:48** ; samedi : **14:37 → 14:50** ; aucun départ le matin dans cette direction (source: même fichier, stop_times.txt + calendar_dates.txt, téléchargé le 2026-10-19).
- Horaires K941 au départ de Brienon **vers Troyes** (courses venues de Laroche-Migennes), lundi–vendredi : **06:27** (06:28 ou 06:38 selon la période) → 06:37 Saint-Florentin-Ville → **07:37 Troyes Gare Routière**, et 15:26 → 16:36 ; samedi 17:26 → 18:36 ; montée autorisée à Brienon (`pickup_type=0`) (source: même fichier, trip `…:87683268:87139501:12:737:20261211`, service 000015 actif les 20261020 et 20261112, téléchargé le 2026-10-19).
- La gare routière de Troyes est à 0,15 km de la gare ferroviaire de Troyes (87118000) (source: même fichier, stops.txt, calcul haversine, téléchargé le 2026-10-19).
- Le mardi 2026-10-20, trains Troyes → Paris Est : 07:43 → **09:16**, 08:16 → 09:46, 09:44 → 11:16 ; mêmes arrivées le 2026-11-12 (départs 07:45, 08:18, 09:46) (source: même fichier, calcul pour les dates 20261020 et 20261112, téléchargé le 2026-10-19).
- Deux grilles coexistent dans le fichier : l'une active à partir du 2026-10-19, l'autre à partir du 2026-12-14 (changement de service annuel), avec des horaires identiques à une minute près (source: même fichier, calendar_dates.txt, téléchargé le 2026-10-19).
- Le mardi 2026-10-20, 15 trains relient Laroche-Migennes à Paris (Bercy ou Gare de Lyon) ; entre 09:03 et 14:02, aucun départ (source: même fichier, calcul sur stop_times.txt pour la date 20261020, téléchargé le 2026-10-19).
- Le GTFS-RT SNCF est servi via `proxy.transport.data.gouv.fr` (trip updates et alerts) ; sa couverture effective des cars TER K941 n'a pas été testée (source: https://transport.data.gouv.fr/datasets/horaires-sncf, vérifié le 2026-10-19).
- ⬜ NON RÉSOLU — le flux GTFS-RT SNCF publie-t-il les retards et suppressions des **cars** TER (K941) ou seulement des trains ? À vérifier en décodant `https://proxy.transport.data.gouv.fr/resource/sncf-gtfs-rt-trip-updates` et en y cherchant les `trip_id` du K941.

## B2. Mobigo (cars régionaux, Yonne = réseau 89)

- Le jeu « Réseau interurbain Mobigo » de la Région BFC publie **uniquement du GTFS** (8 fichiers : un par département + lignes régulières régionales), sous Licence Ouverte v2, sans aucune ressource GTFS-RT (source: https://transport.data.gouv.fr/datasets/reseau-de-transport-interurbain-mobigo-en-bourgogne-franche-comte, vérifié le 2026-10-19).
- Le fichier « Données du Réseau Mobigo dans l'Yonne - 89 » a été mis à jour le 2026-09-21 (source: https://www.data.gouv.fr/api/1/datasets/r/5c995d2c-8e79-4e40-b4a6-c0583c647201, téléchargé le 2026-10-19).
- Ce GTFS 89 contient 22 lignes, 181 arrêts, 99 courses ; agence « MOBIGO 89 », URL `MOBIGO2.cityway.fr` (source: même fichier, routes.txt / stops.txt / trips.txt / agency.txt, téléchargé le 2026-10-19).
- 16 des 22 lignes portent `route_type 715` (807, 813, 851 à 864), valeur de la table étendue désignant un service à la demande ; les 6 autres (801 à 806) portent `route_type 3` (bus) (source: même fichier, routes.txt, téléchargé le 2026-10-19).
- **Incohérence signalée** : l'app Transit étiquette « TAD » 13 lignes (851–856, 858–864) et non 807, 813, 857, que le GTFS classe pourtant en 715 (source: https://transitapp.com/en/region/auxerre/mobigo-89-yonne, vérifié le 2026-10-19 ; et routes.txt ci-dessus).
- Le GTFS ne nomme pas la commune dans la plupart des arrêts (ex. « MAIRIE », « ABRI PLACE LAVOIR ») : l'arrêt de Brienon s'identifie par ses coordonnées (`600326`, 47.991799, 3.616984), à 0,03 km de l'arrêt car TER (source: même fichier, stops.txt, téléchargé le 2026-10-19).
- L'arrêt Brienon `600326` est desservi par la ligne **803** (Saint-Florentin – Auxerre) et la ligne **856** (Arces – Migennes) (source: même fichier, stop_times.txt + trips.txt, téléchargé le 2026-10-19).
- Ligne 856 Brienon → Migennes : une course, **09:25 → 09:45** (arrêt « MARCHE COUVERT », à 0,19 km de la gare Laroche-Migennes), **mardi et jeudi uniquement** ; retour Migennes 11:30 → Brienon 11:50 (source: même fichier, calendar.txt + calendar_dates.txt, téléchargé le 2026-10-19).
- Ligne 803 Brienon → Auxerre : une course 08:25 → 09:40, du lundi au samedi ; retours Auxerre → Brienon 12:50 → 13:55 (lundi–vendredi) et 16:10 → 17:04 (samedi) (source: même fichier, téléchargé le 2026-10-19).
- Toutes les courses passant par Brienon (803 et 856) portent `pickup_type=2` à chaque arrêt, c'est-à-dire « téléphoner à l'agence pour réserver la prise en charge » selon la spécification GTFS (source: même fichier, stop_times.txt, téléchargé le 2026-10-19).
- ⬜ NON RÉSOLU — délai de réservation du TAD Mobigo (veille ? deux heures avant ?) et canal (téléphone, app, web). Le GTFS 89 ne contient pas `booking_rules.txt`. Où chercher : règlement TAD sur viamobigo.fr, ou numéro 03 80 11 29 29 cité par la presse régionale.
- ⬜ NON RÉSOLU — la ligne 803 est-elle réellement « sur réservation » alors qu'elle est typée bus régulier (`route_type 3`) ? Le `pickup_type=2` peut être un artefact d'export Cityway. Où chercher : fiche horaire 803 sur viamobigo.fr.

## B3. Transport à la demande (TAD) dans l'Yonne

- Le catalogue transport.data.gouv.fr ne contient **aucun jeu GTFS-Flex** pour l'Yonne ou la BFC ; les jeux TAD en GTFS-Flex recensés concernent d'autres régions (ex. Aléop Pays de la Loire) (source: https://transport.data.gouv.fr/api/datasets, filtré le 2026-10-19).
- Sur data.gouv.fr, la recherche « transport a la demande » renvoie 19 jeux, aucun pour l'Yonne ou la BFC (source: https://www.data.gouv.fr/api/1/datasets/?q=transport+a+la+demande, vérifié le 2026-10-19).
- Le TAD de l'Yonne n'existe donc en données ouvertes que sous forme de **lignes virtuelles à horaires fixes** dans le GTFS Mobigo 89 (route_type 715, pickup_type=2) — pas sous forme zonale (source: GTFS Mobigo 89 ci-dessus, téléchargé le 2026-10-19).
- Le réseau urbain d'Auxerre (Léo) publie un GTFS et trois flux GTFS-RT, dont un signalé indisponible le 2026-10-18 (source: https://transport.data.gouv.fr/datasets/reseau-de-transports-en-commun-de-la-communaute-dagglomeration-de-lauxerrois, vérifié le 2026-10-19).
- ⬜ NON RÉSOLU — le TAD « Flexibus » d'Auxerre (cité par Transbus) a-t-il une donnée ouverte ? Recherche « flexibus auxerre » sur data.gouv.fr : 0 résultat le 2026-10-19 (source: https://www.data.gouv.fr/api/1/datasets/?q=flexibus+auxerre). Où chercher : l'AOM Communauté de l'Auxerrois.

## B4. Lieux de covoiturage

- La Région BFC publie un CSV « Lieux de covoiturage », dernière mise à jour 2024-10-25 (près de deux ans au 2026-10-19), Licence Ouverte v2 (source: https://transport.data.gouv.fr/datasets/aires-de-covoiturage-de-bourgogne-franche-comte, vérifié le 2026-10-19).
- La Base nationale consolidée des lieux de covoiturage (BNLC) compte 14 271 lieux, ODbL, fichier `bnlc.csv` mis à jour le 2026-09-17 (source: https://transport.data.gouv.fr/datasets/base-nationale-des-lieux-de-covoiturage, vérifié le 2026-10-19).
- Dans un rayon de 12 km autour de Brienon, la BNLC liste 3 lieux : Esnon (3,9 km, aire, maj 2020-10-27), Hauterive « Les Cornets » (7,0 km, parking 2 places, maj 2022-03-25), Saint-Florentin (8,9 km, aire, maj 2020-10-27) ; **aucun à Brienon même** (source: https://transport.data.gouv.fr/resources/81372/download, téléchargé et parsé le 2026-10-19).
- Une aire de covoiturage n'est pas une offre de trajet : l'offre (conducteurs, horaires) relève des plateformes (voir volet C, BlaBlaCar Daily) (source: schéma des colonnes de bnlc.csv — aucun champ d'horaire de trajet, téléchargé le 2026-10-19).

## B5. Taxis et VTC

- Le jeu « Stations de taxi en France » (producteur le.taxi) compte 914 stations dans 16 départements ; **aucune** en Côte-d'Or, Nièvre, Saône-et-Loire ou Yonne ; dernière mise à jour 2024-02-07 ; licence « notspecified » (source: https://www.data.gouv.fr/datasets/stations-de-taxi-en-france, CSV téléchargé le 2026-10-19).
- Le catalogue transport.data.gouv.fr (802 jeux) ne contient aucun jeu de type taxi ou VTC (types présents : public-transit, vehicles-sharing, carpooling-areas, bike-data, road-data, charging-stations, pedestrian-path, informations, carpooling-lines) (source: https://transport.data.gouv.fr/api/datasets, vérifié le 2026-10-19).
- ⬜ NON RÉSOLU — liste des taxis conventionnés ou artisans de Brienon / Migennes avec téléphone. Aucune donnée ouverte trouvée ; la page « intermodalités » de la gare de Laroche-Migennes est derrière DataDome (contenu non récupéré le 2026-10-19 via `fetch:url`). Où chercher : https://www.garesetconnexions.sncf/fr/gares-services/laroche-migennes/intermodalites à ouvrir dans un navigateur, ou annuaire de la mairie de Brienon.
- Registre public taxis / VTC : voir volet C, §C5.

## B6. Deux scénarios réels passés sur la donnée (constat, pas conception)

- **Scénario Joigny** — rendez-vous réel de Brainditech : lieu de rendez-vous à Joigny, jeudi 2026-11-12 à 10:00 (source: <coffre personnel>).
- Ce jeudi-là, la course Mobigo 856 circule (aucune exception au 20261112 dans calendar_dates.txt) : Brienon 09:25 → Migennes 09:45, sur réservation (source: GTFS Mobigo 89, https://www.data.gouv.fr/api/1/datasets/r/5c995d2c-8e79-4e40-b4a6-c0583c647201, téléchargé le 2026-10-19).
- Par cette voie Mobigo, le premier train suivant Laroche-Migennes → Joigny part à 10:04 et arrive à **10:12**, après l'heure du rendez-vous ; le train précédent (09:10 → 09:18) part avant l'arrivée du bus (source: GTFS SNCF, calcul pour la date 20261112, https://www.data.gouv.fr/api/1/datasets/r/9ae758ec-cd7a-40cd-a890-bb3963224942, téléchargé le 2026-10-19).
- Voie Mobigo 803 : Brienon 08:25 → « SAINT FLORENTIN-VERGIGNY 3 RUE DE LA GARE » 08:50, arrêt à 0,39 km de la gare Saint-Florentin-Vergigny, d'où le train pour Joigny part à 08:50 : **correspondance nulle**, inexploitable (source: GTFS Mobigo 89 https://www.data.gouv.fr/api/1/datasets/r/5c995d2c-8e79-4e40-b4a6-c0583c647201 et GTFS SNCF https://www.data.gouv.fr/api/1/datasets/r/9ae758ec-cd7a-40cd-a890-bb3963224942, calcul pour la date 20261112, téléchargés le 2026-10-19).
- **Voie qui tient** : car TER 06:27 Brienon → 06:37 Saint-Florentin-Ville, puis environ **2,8 km à pied** (distance à vol d'oiseau, l'itinéraire réel est plus long) jusqu'à la gare Saint-Florentin-Vergigny, puis train **08:50 → 09:09 Joigny** ; le train de 06:50 n'est pas atteignable à pied en 13 minutes (source: GTFS SNCF https://www.data.gouv.fr/api/1/datasets/r/9ae758ec-cd7a-40cd-a890-bb3963224942, calcul pour la date 20261112 et distances haversine sur stops.txt, téléchargé le 2026-10-19).
- Conclusion de constat corrigée : **le RDV de 10:00 à Joigny du 12/11 est atteignable en transport public**, à condition d'une marche d'environ 2,8 km et d'un départ à 06:27 ; sans cette marche, seul un mode routier (taxi, VTC, covoiturage, proche) le permet (source: les deux GTFS ci-dessus, téléchargés le 2026-10-19).
- ⬜ NON RÉSOLU — distance et temps à pied entre la gare de Joigny et l'agence (« 19 route de Chamvres 89300 JOIGNY », lieu de le rendez-vous) ; la marge de 51 minutes après 09:09 n'est pas vérifiée. Où chercher : calcul piéton sur OSM entre la gare de Joigny et cette adresse.
- **Scénario Paris** (douleur du brief), mardi 2026-10-20 : le premier enchaînement public est le car TER **06:27** Brienon → 07:37 Troyes Gare Routière, puis 0,15 km à pied et le train 07:43 → **09:16 Paris Est** (ou 08:16 → 09:46) ; par Laroche-Migennes, le premier enchaînement serait le car 13:25 puis le train 14:02 → 15:29 Paris Bercy (source: GTFS SNCF https://www.data.gouv.fr/api/1/datasets/r/9ae758ec-cd7a-40cd-a890-bb3963224942, calcul pour la date 20261020, téléchargé le 2026-10-19).
- Ces enchaînements par Troyes concordent avec les constats d'écran du documentaliste (Transit : arrivée 09:16 ; Google : 09:46) (source: D:\Mes Logiciels\02-Mobile-Desktop\MobiliteIA\docs\04-dissection\07-constats-scenarios.md).
- Préférence d'entretien constatée le 2026-10-17 : visioconférence « Accepté », agence « Refusé » — à rapprocher de le rendez-vous en agence du 12/11 (source: <coffre personnel>).

## B7. API SNCF et PRIM (conditions d'accès)

- API SNCF : offre « Pour les développeurs » **gratuite, 150 000 requêtes/mois (5 000 requêtes/jour)**, jeton passé en identifiant HTTP Basic, moteur Navitia (playground.navitia.io) ; offre entreprise « sur mesure » (source: https://numerique.sncf.com/startup/api/, récupéré via fetch:url le 2026-10-19).
- La fiche data.gouv « API théorique et temps réel » (SNCF) ne précise ni périmètre cars TER, ni quotas, ni licence (« License Not Specified »), mise à jour 2023-04-17 (source: https://www.data.gouv.fr/datasets/api-theorique-et-temps-reel/informations, vérifié le 2026-10-19).
- ⬜ NON RÉSOLU — le contenu des « Conditions d'utilisation de l'API SNCF » (lien présent sur la page, non ouvert). Où chercher : lien « Lire les conditions d'utilisation de l'API » sur https://numerique.sncf.com/startup/api/.
- PRIM IDFM, « Calculateur Île-de-France Mobilités – Accès générique (v2) » : compte obligatoire ; quotas **10 req/s et 20 000 req/jour** pour les jetons créés avant le 13/03/2024, **5 req/s et 1 000 req/jour** pour les jetons créés entre le 13/03 et septembre 2024 ; licence des données « Licence Mobilité » ; CGU de juillet 2022 ; page mise à jour le 21/10/2025 (source: https://prim.iledefrance-mobilites.fr/fr/apis/idfm-navitia-general-v2, récupéré via fetch:url le 2026-10-19).
- ⬜ NON RÉSOLU — quota d'un jeton PRIM créé **après** septembre 2024 (le tableau ne le dit pas). Où chercher : page « Ma consommation API » après création de compte, ou contact-prim@iledefrance-mobilites.fr.

## Correction du 2026-10-19 (règle C2, contestation du documentaliste)

- Erreur : la première version de §B1 et §B6 ne lisait les courses K941 que dans leur rôle d'**arrivée** à Brienon (« Laroche-Migennes → Brienon 06:27 ») et n'a cherché les enchaînements matinaux que **vers Laroche-Migennes** ; elle a conclu à tort « premier enchaînement Paris : 13:25 → 15:29 » et « Joigny 12/11 10:00 inatteignable » (source: première version de ce fichier, 2026-10-19).
- Vérification indépendante : les 13 courses du GTFS SNCF desservant l'arrêt Brienon Mairie (seul arrêt SNCF de Brienon) ont été relues dans les deux sens avec leurs `pickup_type` ; la course de 06:27 accepte la montée et continue vers Troyes ; les trains Troyes → Paris Est et Saint-Florentin-Vergigny → Joigny ont été recalculés pour le 20/10 et le 12/11 (source: https://www.data.gouv.fr/api/1/datasets/r/9ae758ec-cd7a-40cd-a890-bb3963224942, téléchargé le 2026-10-19).
- Verdict : le documentaliste a raison sur Paris (09:16 par Troyes) ; la conclusion Joigny est renversée (atteignable avec environ 2,8 km de marche) (source: §B1 et §B6 corrigés ci-dessus).
