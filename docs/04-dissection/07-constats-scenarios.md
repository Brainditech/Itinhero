# Constats d'écran — les deux scénarios réels

> kodivine-documentaliste · relevé le 2026-10-19. Réponse aux trous ⬜ du volet A du chercheur
> (`docs/03-marche/01-concurrents.md` §A1, A2, A4, A5, A9, A11).
> Méthode : rendu web public capturé dans Chrome headless, sans compte, cookies refusés, **aucun
> contournement anti-robot**. Adresse d'arrivée = adresse publique du lieu de rendez-vous à Joigny
> telle que résolue par Google Maps (« 19 Rte de Chamvres, 89300 Joigny »). Aucune donnée personnelle.
> Toutes les captures citées sont indexées avec leur URL dans `captures/SOURCES.md`.

## (a) Brienon-sur-Armançon → Rendez-vous Joigny, jeudi 12/11/2026, arriver avant 10:00

| Produit | Ce que l'écran répond | Capture |
|---|---|---|
| **Google Maps** (web) | Demande « Arriver à 10:00 jeu. 12 nov. » → 1er résultat **« 08:23 (mercredi) – 11:30 »**, 3 h 7 : marche → bus **803** « À 08:25 de Mairie » (avec **« ⚠ Les usagers doivent appeler l'agence. »**) → Auxerre 09:40 → TER 10:31 → Joigny 11:15 → marche → 11:30 ; les autres propositions sont du mercredi et du **mardi** (18:33 → 19:15, 15:24 → 17:24, 13:23 → 14:24). Aucun trajet du jeudi n'est proposé avant 10:00, alors que la voie par Saint-Florentin existe (voir plus bas) ; l'écran ne dit pas qu'il a changé de jour. | `google-maps-web-brienon-joigny-arrivee-10h-2026-10-19.png`, `google-maps-web-brienon-joigny-detail-2026-10-19.png` |
| **Google Maps** (web), contre-épreuve | « Partir à 06:00 jeu. 12 nov. » → premier trajet **08:23 → 10:26** (803 + TER + TER) : arrivée après 10:00. La ligne 856 (09:25, sur réservation) n'apparaît dans aucun résultat. | `google-maps-web-brienon-joigny-jeudi-6h-2026-10-19.png` |
| **Transit** (planificateur web) | « Arrivée le 12 nov. à 10:00 » → aucun trajet en transport public seul proposé ; une seule section **COMBO TRIPS** : « Partez à 8:33 · 60 min » = **vélo 9,79 km** → TER Laroche-Migennes 9:10 → Joigny 9:18 → marche 1,09 km → 9:32 ; plus « Vélo 1h 12 min ». | `transit-web-brienon-joigny-arrivee-10h-2026-10-19.png`, `transit-web-brienon-joigny-detail-2026-10-19.png` |
| **Mobigo** (site viamobigo.fr) | « Jeudi 12 novembre 2026 – arriver à 10h00 » → onglet TC « 3h49 » : **« Résultats en 100 % marche » 6h10 – 10h00** ; covoiturage « - » ; vélo 1h19 ; voiture 41 min. Ni 856, ni taxi. | `mobigo-web-brienon-joigny-arrivee-10h-2026-10-19.png` |
| **SNCF Connect** | ⬜ NON RÉSOLU — sncf-connect.com a répondu « Accès temporairement restreint » (anti-robot) le 2026-10-19 ; app non installée ; aucun contournement tenté. | — |
| **Moovit** | ⬜ NON RÉSOLU — planificateur web en « Error code: 403 » le 2026-10-19 ; app non installée. | — |
| **Mobigo (app)** | ⬜ NON RÉSOLU — app non installée ; seul le site a été interrogé. | — |

**Ce que les écrans établissent ensemble** : aucun des trois calculateurs interrogés ne fournit un
trajet en transport public seul arrivant avant 10:00 ce jeudi, **alors que ce trajet existe** (voir
ci-dessous) ; et aucun ne dit qu'il n'a rien trouvé pour le jour demandé — Google change de jour en
parenthèse, Transit propose un vélo que personne n'a déclaré, Mobigo range 3 h 49 de marche sous
« transports en commun ». Aucun ne propose taxi ou TAD pour ce trajet. Le verdict est donc :
**atteignable en transport public, mais aucun des calculateurs examinés ne trouve la voie** — pour
Google Maps, Transit et le site Mobigo ; SNCF Connect et Moovit restent ⬜. *(Première version de ce
fichier, corrigée le 2026-10-19 : elle disait que les écrans « confirmaient » l'inatteignabilité du
volet B §B6 ; le chercheur a depuis renversé cette conclusion.)*

### La voie que les calculateurs ne trouvent pas (corrigée le 2026-10-19, règle C2)

Car TER **06:27 Brienon-sur-Armançon Mairie → 06:37 Saint-Florentin-Ville** (course
`…::87683268:87139501:12:737:20261211`, service `000015` actif le 20261112 ; montée `pickup_type=0` à
`StopPoint:OCECar TER-87117994`, descente `drop_off_type=0` à `StopPoint:OCECar TER-87683334`), puis
**environ 2,8 km à pied** jusqu'à la gare de Saint-Florentin-Vergigny (2,79 km à vol d'oiseau entre les
coordonnées des deux arrêts dans `stops.txt` ; distance à pied réelle non mesurée), puis **train
08:50 Saint-Florentin-Vergigny → 09:09 Joigny** (montée et descente autorisées, actif le 20261112),
puis environ 1,1 km à pied jusqu'à l'agence. Source : GTFS SNCF feed_version 2026-10-18,
https://www.data.gouv.fr/api/1/datasets/r/9ae758ec-cd7a-40cd-a890-bb3963224942, revérifié le
2026-10-19 ; correction du chercheur dans `docs/03-marche/02-donnees-yonne-bfc.md`, section « Correction
du 2026-10-19 ». Aucune capture d'écran ne montre cette voie : c'est précisément le constat.

## (b) Brienon-sur-Armançon → Paris (mardi 20/10/2026, départ à partir de 06:00 — date du scénario du chercheur)

| Produit | Ce que l'écran répond | Capture |
|---|---|---|
| **Google Maps** (web) | « Partir à 06:00 mar. 20 oct. » → 1er résultat **06:25 → 09:46** (3 h 21) : marche → **car TER « Brienon-sur-Armançon Mairie » 06:27 → Troyes Gare Routière 07:37** → TER 08:16 → **Paris Est 09:46** (avec « ⚠ Entretien ») ; puis 06:25 → 10:15 (TER + FlixBus), 08:23 → 14:13, **13:23 → 15:29** (le trajet du chercheur), 15:24 → 18:27. | `google-maps-web-brienon-paris-resultats-2026-10-19.png`, `google-maps-web-brienon-paris-detail-2026-10-19.png` |
| **Transit** (web) | « Départ le 20 oct. à 6:00 » → trois trajets « Partez à 6:25 » (3h09, 3h11, 8h04) ; détail du premier : car TER Brienon Mairie **6:27 → Troyes 7:37** → TER Fluo Grand-Est **7:43 → Paris Est 9:16** → métro → 9:34. COMBO : vélo 9,79 km → TER Laroche-Migennes 7:03 → Paris Bercy 8:38 → 8:55. | `transit-web-brienon-paris-resultats-2026-10-19.png`, `transit-web-brienon-paris-detail-2026-10-19.png`, `transit-web-brienon-paris-combo-velo-2026-10-19.png` |
| **Mobigo** (site) | Refus : « Le lieu sélectionné n'est pas géolocalisé ou il est hors du périmètre de l'application ». | `mobigo-web-brienon-paris-hors-perimetre-2026-10-19.png` |
| **SNCF Connect** | ⬜ NON RÉSOLU — même blocage anti-robot. | — |
| **Moovit** | ⬜ NON RÉSOLU — même 403. | — |

**Divergence entre Google et Transit à Troyes** : Google prend le TER de 08:16 (arrivée Paris Est 09:46),
Transit celui de 7:43 (arrivée 9:16) avec 6 minutes de correspondance après l'arrivée du car à 7:37.
Lequel est réaliste (correspondance de 6 min gare routière → gare) : ⬜ NON RÉSOLU.

### Recoupement dans la donnée (pas seulement à l'écran)

Le GTFS national SNCF (feed_version 2026-10-18, téléchargé le 2026-10-19 depuis
https://www.data.gouv.fr/api/1/datasets/r/9ae758ec-cd7a-40cd-a890-bb3963224942) contient le trip
`…::87683268:87139501:12:737:20261211` (service `000015`) : Laroche-Migennes 06:14 → **Brienon-sur-Armançon
Mairie 06:27** → Saint-Florentin-Ville 06:37 → … → Troyes Gare Routière 07:37 ; le service `000015` est
actif le **20261020** et le **20261112** (`calendar_dates.txt`, exception_type 1). Le départ matinal de
Brienon existe donc, **en direction de Troyes**.

## Conséquence pour l'amont

L'affirmation du chercheur « depuis Brienon, le premier départ public vers la gare de Laroche-Migennes
est 13:25 ; aucun départ le matin » est exacte **pour la direction Laroche-Migennes**, mais sa
conséquence « Scénario Paris : le premier enchaînement public possible est 13:25 → 15:29 Paris Bercy »
(`docs/03-marche/02-donnees-yonne-bfc.md` §B6, puce « Scénario Paris ») est **fausse** : un enchaînement 06:27 → Paris Est 09:16 à 09:46
existe par Troyes. Le même car de 06:27, avec descente à Saint-Florentin-Ville, renverse aussi la
conclusion Joigny (voir la section « La voie que les calculateurs ne trouvent pas »). Les deux points
ont été corrigés par le chercheur le 2026-10-19. Voir `00-synthese.md` § Épreuve de l'amont.
