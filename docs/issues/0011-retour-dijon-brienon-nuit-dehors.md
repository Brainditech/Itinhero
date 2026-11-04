# Issue 0011 — Retour tribunal de Dijon → Brienon : une nuit dehors affichée « Possible », alors qu'un retour le soir existe

- **Date** : 2026-11-04
- **État** : constat et comparaison faits ; **à approuver par Brainditech**. Les deux causes relèvent de cases de `PLAN.md` encore ouvertes : ce sont deux fonctionnalités à spécifier (specs 15 et 16), pas une régression.

## 1. Reproduction

Téléphone de Brainditech, development build de la spec 13 (`app/depart-arrivee`), MOTIS national du PC. Formulaire : Départ « tribunal administratif dijon » (confirmé : Tribunal administratif, Dijon, 21000), Arrivée Domicile (Brienon), jeudi 05/11/2026, **partir à 17:00**. C'est le retour du critère 4 de la spec 13, obtenu par ⇅.

Résultat affiché (captures `adb` du 2026-11-04 vers 22:25, hors dépôt, D38) :

- verdict **« Possible »** en vert, « Départ 20:11 », « Arrivée prévue à 06:32 » ;
- **une seule possibilité**, 10 h 21 : marche 20 min → TER P5 n° 891360 Dijon 20:36 → Laroche-Migennes 22:22 → marche 1 min jusqu'à l'arrêt Laroche-Migennes → **« Attente 471 min »** → bus K941 06:14 → Brienon-sur-Armançon Mairie 06:27 → marche 5 min → Domicile 06:32 ;
- le bus K941 est attribué à « Trains Express Régionaux ».

Comparaison : SNCF Connect (navigateur, 2026-11-04 vers 22:30), jeudi 05/11, départ après 17:00, du centre de Dijon (rue Villebois-Mareuil, à quelques minutes du tribunal) à la mairie de Brienon :

| Départ → arrivée | Durée | Trajet |
|---|---|---|
| 17:03 → 19:05 | 2 h 02 | marche 11 min, bus B13, **TER 17762 Dijon 17:35 → Saint-Florentin - Vergigny 18:49**, puis **voiture 11 min** jusqu'à Brienon |
| 17:55 → 20:03 | 2 h 08 | bus L9, marche, train, voiture |
| 19:08 → 21:05 | 1 h 57 | bus L9, marche, train, voiture |

SNCF Connect signale aussi un mouvement social national le 5 novembre (sans effet sur ce constat).

### Comparaison avec Google Maps (2026-11-04 vers 23:10, navigateur)

- **Dijon (tribunal administratif) → mairie de Brienon, jeudi 05/11, partir à 17:00** : aucun retour le soir même non plus. Google propose **01:01 (vendredi) → 06:27** (tram T1, **FlixBus de nuit**, TER, car TER), puis 02:53 → 06:27 (Pleine Lune, FlixBus, TER, TER), puis des trajets du vendredi à partir de 08:02.
- **Joigny (France Travail) → mairie de Brienon, jeudi 12/11, partir à 17:00** : Google propose **23:17 (jeudi) → 06:27 (vendredi)**, 7 h 10, puis des trajets du vendredi. Itinhero donne 23:12 → 06:32 : même voie, même nuit.
- **Même trajet sur SNCF Connect** (navigateur, 2026-11-04 vers 23:15, recherche porte à porte « Route de Chamvres, Joigny » → « Mairie de Brienon-sur-Armançon », jeudi 12/11, départ 17:00) : « Les horaires qui suivent sont ceux du 13 novembre 2026 », une seule proposition, **vendredi 14:23 → 15:31** (marche 22 min, TER 17775 Joigny 14:50 → Laroche 14:57, car Fluo 43287 Laroche 15:13 → Brienon Mairie 15:26). Même résultat en partant à 22:00. Ni retour le soir même, ni voiture ici, ni le trajet de nuit de Google et d'Itinhero (arrivée vendredi 06:27/06:32) : SNCF Connect semble écarter les trajets avec une longue attente de nuit.
- Conséquence : sur ces deux retours, Google aussi impose une nuit ; seul SNCF Connect finit **en voiture** le soir même, et seulement pour Dijon (pour Joigny, il renvoie au vendredi après-midi). Le défaut A (verdict « Possible » sans dire la nuit) reste entier ; Google, lui, écrit au moins « (vendredi) ».
- **Question ouverte (hypothèse, à vérifier pendant la spec 15)** : le trajet de Google par FlixBus part plus tard (01:01) et arrive plus tôt (06:27) que celui d'Itinhero (20:11 → 06:32), donc il le domine. Le GTFS FlixBus est chargé (`r11681`, « flixbus-horaires-theoriques-du-reseau-europeen-1 »). Pourquoi MOTIS ne le trouve-t-il pas ? Pistes, une à la fois : la course FlixBus de nuit absente du jeu ou du calendrier pour le 05/11, l'arrêt FlixBus de Dijon non relié au tram, la fenêtre de recherche de `motis-plan.ts`.

## 2. Ce qui est juste

- Le trajet d'Itinhero existe : en transports publics seuls, le soir, il n'y a plus de car vers Brienon après l'arrivée à Laroche-Migennes ou à Saint-Florentin ; SNCF Connect lui-même finit **en voiture**.
- Le départ affiché à 20:11 au lieu de 17:00 n'est pas une erreur du moteur : les trains plus tôt arrivent aussi au même bus de 06:14, et MOTIS garde le départ le plus tardif pour une même arrivée. (Hypothèse cohérente avec le fonctionnement de MOTIS ; à vérifier dans la réponse brute pendant la spec 15.)

## 3. Défauts, une cause à la fois

| # | Défaut | Cause |
|---|---|---|
| A | **Une nuit dehors (7 h 51 à un arrêt de bus) est marquée « Possible » en vert**, sans un mot sur le changement de jour. | Case ouverte `PLAN.md` phase 3 : « Verdict et marge, **sans changement de jour silencieux** ». Le verdict actuel ne regarde que l'arrivée par rapport à l'heure demandée. |
| B | « Attente 471 min » | `attenteApres` (issue 0010 E) écrit toujours en minutes. Au-delà d'une heure, un débutant doit lire « 7 h 51 ». |
| C | **Le retour du soir par taxi n'est pas proposé** (Saint-Florentin ou Laroche-Migennes → Brienon, une dizaine de minutes de route). | Case ouverte `PLAN.md` phase 3 : « **Taxi comme étape au début et à la fin** (D48) ». Aujourd'hui, seuls la marche (`maxPreTransitTime`, `maxPostTransitTime`) et les transports publics sont demandés à MOTIS (`motis-plan.ts`). |
| D | Bus K941 attribué à « Trains Express Régionaux » | Probablement l'`agency_name` du GTFS SNCF qui porte aussi les cars TER. À vérifier dans le GTFS avant toute retouche ; mineur. |

## 4. Corrections proposées (à approuver)

- **A + B → spec 15 « Verdict sans changement de jour silencieux »** : une possibilité qui arrive le lendemain, ou qui contient une attente de nuit (par exemple plus de 3 h, ou entre 22:00 et 05:00), n'est jamais « Possible » en vert. Elle dit « Arrivée demain 06:32 » et « Nuit sur place à Laroche-Migennes (7 h 51) ». Les attentes de plus d'une heure s'écrivent « 7 h 51 ». Seuils et libellés à trancher dans la spec (nouvelle décision).
- **C → spec 16 « Taxi comme étape au début et à la fin » (D48)** : quand le dernier ou le premier bout en transport public manque ou impose une nuit, le serveur propose une possibilité avec un taxi pour ce bout. La durée vient du routage voiture de MOTIS (« durée de route estimée, hors attente »), le prix est « non publié », et le numéro n'apparaît qu'avec une fiche validée ou une page publique (invariant 16, D49). Avant d'écrire la spec : lire la doc de MOTIS v2.11.4 sur les modes `CAR` avant et après les transports publics (`preTransitModes`, `postTransitModes`), et vérifier que l'OSM chargé permet le routage voiture.
- **D** : constat dans le GTFS, puis correction de libellé seulement si la source le permet.

## 5. Tests de régression prévus

- Domaine (vitest) : une possibilité avec une attente de 471 min entre 22:23 et 06:14 ⇒ verdict qui n'est pas « Possible », texte « Nuit sur place » ; une attente de 471 min s'écrit « 7 h 51 ».
- Serveur : la demande Dijon → Brienon du jeudi 05/11 à 17:00 ⇒ au moins une possibilité qui arrive le soir même avec un taxi en dernière étape (test national, MOTIS du PC).
