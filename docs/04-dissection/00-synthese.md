# Synthèse de la dissection — MobiliteIA

> kodivine-documentaliste · 2026-10-19 · artefact d'entrée de `kodivine-spec`.
> Entrée : `docs/03-marche/00-synthese.md` et `01-concurrents.md` (gate `sources` vert le 2026-10-19).
> Sorties : fiches `01-sncf-connect.md` à `06-moovit.md`, constats `07-constats-scenarios.md`,
> 60 captures dans `captures/` indexées avec URL et date dans `captures/SOURCES.md`.
> Demande du porteur du projet : « les mêmes interfaces que SNCF [Connect] et Transit pour les bus ». Décision
> proposée, **en attente de sa confirmation** : on imite les **structures et les gestes**, jamais
> l'identité visuelle (logo, nom, couleurs, thème, mascottes). Rien ici n'est une maquette ni une SPEC.

## Épreuve de l'amont

**L'affirmation du chercheur qui tient le moins bien, et qui est fausse :** « Scénario Paris, mardi
2026-10-20 : le premier enchaînement public possible est le car TER 13:25 Brienon → 13:38
Laroche-Migennes, puis le train 14:02 → 15:29 Paris Bercy » (`docs/03-marche/02-donnees-yonne-bfc.md`
§B6), adossée à « aucun départ le matin » (§B1) et reprise dans la synthèse du chercheur (« aucun départ
matinal vers la gare en semaine »).

- Le mensonge est un **biais de direction** : le chercheur n'a lu le car TER K941 que vers
  Laroche-Migennes. Dans l'autre sens, le même GTFS SNCF contient un départ **Brienon Mairie 06:27 →
  Troyes Gare Routière 07:37**, actif le 20/10 et le 12/11 (trip `…:12:737:20261211`, service `000015`,
  GTFS SNCF feed_version 2026-10-18, https://www.data.gouv.fr/api/1/datasets/r/9ae758ec-cd7a-40cd-a890-bb3963224942,
  téléchargé et vérifié le 2026-10-19).
- Deux écrans indépendants le montrent : Google Maps **06:25 → Paris Est 09:46** et Transit **6:27 → Troyes
  7:37 → Paris Est 9:16** (`google-maps-web-brienon-paris-detail-2026-10-19.png`,
  `transit-web-brienon-paris-detail-2026-10-19.png`).
- Conséquence : la douleur « Brienon → Paris » n'est pas « rien avant 13:25 » mais « un départ à 06:27
  par Troyes, unique, à ne pas rater » — ce qui change l'écran à concevoir (alerte de la veille, « dernier
  départ utile »), pas seulement un chiffre.
- Le même biais renverse aussi la conclusion Joigny (« inatteignable en transport public seul le 12/11
  avant 10:00 », §B6, première version). La première version de ce dossier la tenait pour confirmée par
  trois calculateurs : c'était une erreur, corrigée le 2026-10-19 (voir ci-dessous).
- Action : selon la règle C2, ce point est revenu au chercheur, qui a corrigé §B1 et §B6
  (`docs/03-marche/02-donnees-yonne-bfc.md`, section « Correction du 2026-10-19 »).

**Correction du 2026-10-19 (règle C2, demandée par le coordinateur).** Joigny jeudi 12/11 avant 10:00
est **atteignable en transport public, mais aucun des calculateurs examinés ne trouve la voie** :
car TER **06:27 Brienon Mairie → 06:37 Saint-Florentin-Ville** (même course `…:12:737:20261211`, montée
`pickup_type=0` à Brienon, descente `drop_off_type=0` à `StopPoint:OCECar TER-87683334`), puis environ
**2,8 km à pied** (2,79 km à vol d'oiseau entre les coordonnées des deux arrêts dans `stops.txt`) jusqu'à
la gare de Saint-Florentin-Vergigny, puis **train 08:50 → 09:09 Joigny**, actif le 20261112 ; reste
environ 1,1 km à pied jusqu'à l'agence (distance affichée par Google Maps et Transit depuis la gare,
`google-maps-web-brienon-joigny-detail-2026-10-19.png`, `transit-web-brienon-joigny-detail-2026-10-19.png`).
Source : GTFS SNCF feed_version 2026-10-18, https://www.data.gouv.fr/api/1/datasets/r/9ae758ec-cd7a-40cd-a890-bb3963224942,
revérifié le 2026-10-19 (stop_times, stops, calendar_dates). Les captures ne changent pas : elles
prouvent que ni Google Maps, ni Transit, ni le site Mobigo ne proposent cette voie.

## Ce que les écrans ont établi (5 constats)

1. **Personne ne trouve la voie qui existe** : pour arriver à Joigny avant 10:00 le 12/11, la voie
   publique car 06:27 → Saint-Florentin-Ville + 2,8 km à pied + train 08:50 → 09:09 existe, mais Google
   Maps glisse au mercredi/mardi en parenthèse, Transit propose 9,79 km de vélo, le site Mobigo range
   3 h 49 de marche sous « transports en commun » (`07-constats-scenarios.md`). Aucun ne dit non plus
   qu'il n'a rien trouvé pour le jour demandé.
2. **Personne ne propose taxi ni TAD sur ce trajet**, alors que Transit sait poser un segment VTC ou TAD
   dans une frise ailleurs (`transit-combo-vtc-dans-frise-2026-10-19.png`, `transit-tad-reserver-2026-10-19.png`).
3. **La réservation obligatoire n'a ni numéro ni échéance à l'écran** : Google écrit « Les usagers doivent
   appeler l'agence » sous la 803, Transit affiche la 856 « TAD » sans un mot de réservation
   (`google-maps-web-brienon-joigny-detail-2026-10-19.png`, `transit-web-ligne-856-tad-2026-10-19.png`).
4. **SNCF Connect range le taxi/VTC dans l'onglet Billets**, hors de l'itinéraire
   (`sncf-connect-taxi-vtc-billets-2026-10-19.jpg`, capture de presse 2025).
5. **Transit est le seul à rendre visible l'état de chaque horaire** (temps réel / théorique / annulé /
   probablement annulé) et à documenter un hors-ligne honnête (`transit-temps-reel-vs-theorique-2026-10-19.png`,
   `transit-hors-ligne-2026-10-19.png`) — or Mobigo n'a aucun temps réel (volet B §B2 du chercheur).

## Écran → meilleur pattern observé → chez qui → pourquoi il marche

| Écran | Meilleur pattern observé | Chez qui | Pourquoi il marche | Capture |
|---|---|---|---|---|
| Accueil / saisie | un seul champ « Où souhaitez-vous aller ? » + micro ; raccourcis « Utile au quotidien » | SNCF Connect | la destination d'abord, le reste après ; la dictée accepte une phrase | `sncf-connect-accueil-recherche-2026-10-19.jpg` |
| Trajet répété | le trajet enregistré affiche son prochain départ sur l'accueil ; pastille d'ETA vers « maison » dans la barre | SNCF Connect, Transit | zéro saisie pour ce qu'on refait | `sncf-connect-trajets-enregistres-tablette-2026-10-19.jpg`, `transit-accueil-departs-proches-2026-10-19.jpg` |
| Heure départ / arrivée | « Arriver à » + date + heure, avec flèches ‹ › jour/heure | Google Maps | changer d'un cran sans rouvrir un sélecteur | `google-maps-web-brienon-joigny-arrivee-10h-2026-10-19.png` |
| Comparaison des modes | onglets de modes portant chacun leur durée ; grille de modes avec prix + minutes | Google Maps, Citymapper | la décision taxi / TC se lit sans ouvrir de résultat | `google-maps-web-brienon-joigny-arrivee-10h-2026-10-19.png`, `citymapper-comparateur-modes-2026-10-19.jpg` |
| Liste de résultats | frises horizontales sur une échelle de temps commune, « Départ dans N min » | Transit | les trajets se comparent d'un coup d'œil | `transit-resultats-frise-horizontale-2026-10-19.png` |
| Carte de résultat (longue distance) | heure de départ au-dessus de l'heure d'arrivée, durée, nombre de correspondances, bandeau des jours voisins | SNCF Connect | l'heure d'arrivée se lit sans calcul ; changer de jour en un tap | `sncf-connect-resultats-train-prix-2026-10-19.jpg` |
| Détail du trajet = frise | en-tête « Partez à / Arrivée à / durée » ; frise verticale de blocs pleins couleur de ligne, montée/descente avec heures, arrêts repliés ; colonne d'heures à gauche | Transit (+ colonne d'heures Google) | on suit le trajet de haut en bas, chaque bascule a son heure | `transit-web-brienon-joigny-detail-2026-10-19.png`, `google-maps-web-brienon-paris-detail-2026-10-19.png` |
| Premier km non-TC | segment VTC / TAD **dans** la frise avec bouton d'action à sa place ; taxi avec « arrive dans ~9 min · 27 min · 23-30 € » | Transit, Moovit | le premier km est une étape du trajet, pas un autre produit | `transit-combo-vtc-dans-frise-2026-10-19.png`, `moovit-itineraires-avec-vtc-2026-10-19.jpg` |
| Avertissement sur une étape | ⚠ posé sur le segment, remonté sur la carte de résultat | Google Maps | on voit qu'un trajet a un piège avant de l'ouvrir | `google-maps-web-brienon-joigny-detail-2026-10-19.png` |
| Guidage en cours de trajet | consigne-action en gros (« Descendez au prochain arrêt »), arrivée en haut, barre de progression, écran verrouillé, « Go in N minutes » | Transit (+ alerte de descente Citymapper) | une seule chose à faire, lisible en marchant | `transit-go-guidage-descente-2026-10-19.png`, `transit-go-ecran-verrouille-2026-10-19.png`, `citymapper-alerte-descente-2026-10-19.jpg` |
| Indication de terrain | « Meilleure entrée », « Où monter ? – Avant » | Citymapper | consigne visuelle textuelle au point de bascule | `citymapper-detail-trajet-2026-10-19.jpg` |
| Départs à un arrêt | lignes en blocs couleur avec minutes ; 3 cartes de départ ; **premier / dernier passage** | Transit, Mobigo | le temps restant d'abord ; en rural, le dernier départ | `transit-ligne-prochains-departs-2026-10-19.jpg`, `mobigo-arret-prochains-passages-2026-10-19.jpg` |
| État d'un horaire | ondes = temps réel, « PLANIFIÉ » / « SCHEDULED », « CANCELLED », « LIKELY CANCELLED » | Transit | on sait ce qu'on peut croire | `transit-temps-reel-vs-theorique-2026-10-19.png`, `transit-badge-probablement-annule-2026-10-19.png` |
| Perturbations | triangle sur la ligne dans la liste, fiche d'alerte datée et sourcée, abonnement par plage horaire | Transit | l'alerte vient à l'utilisateur au bon moment | `transit-alerte-retards-ligne-2026-10-19.png`, `transit-alerte-detail-2026-10-19.png` |
| Hors ligne | bandeau « Offline. No real-time data. », horaires marqués théoriques | Transit | dégradé mais honnête | `transit-hors-ligne-2026-10-19.png` |
| Refus de calcul | message explicite « hors du périmètre » | Mobigo | dire ce qu'on ne sait pas faire | `mobigo-web-brienon-paris-hors-perimetre-2026-10-19.png` |

## Les écrans dont MobiliteIA a besoin

Liste d'écrans, pas une SPEC : chacun renvoie au pattern retenu ci-dessus ou déclare qu'aucun concurrent
ne l'a.

| # | Écran | Pattern d'appui | Existe chez un concurrent ? |
|---|---|---|---|
| E1 | Accueil : champ unique + dictée (« jeudi 10h RDV à Joigny »), trajets enregistrés avec prochain départ | SNCF Connect accueil + Transit ETA | oui (séparément) |
| E2 | **Rendez-vous à heure fixe** : objet « RDV » (lieu, jour, « arriver avant 10:00 », marge) distinct d'une recherche « Arriver à » | aucun : tous n'ont qu'un menu « Arriver à » | **non** |
| E3 | **Verdict d'atteignabilité** en titre, pour le jour demandé : « Atteignable en transport public : départ 06:27, dont 2,8 km à pied » ou « aucune voie publique ce jour-là », puis les alternatives (taxi, veille) | aucun : Google change de jour en parenthèse, Transit propose un vélo, Mobigo 3 h 49 de marche ; aucun ne trouve la voie du 12/11 | **non** |
| E4 | Comparaison des options : onglets / grille avec durée **et** coût (taxi direct, taxi → gare + train, TAD, covoiturage, veille) | Google onglets + Citymapper grille + Moovit ligne taxi | partiel |
| E5 | Liste de résultats sur échelle de temps commune | Transit | oui |
| E6 | **Frise du trajet incluant le premier km rural** (taxi / TAD / covoiturage) comme segment, avec son coût, son heure de prise en charge et son bouton (appeler, réserver) | Transit (VTC/TAD dans la frise) | partiel — jamais avec taxi local ni TAD Mobigo |
| E7 | **Échéance de réservation** sur le segment : « Réserver la 856 avant <échéance> au <numéro> » / « Appeler le taxi la veille » (échéance et numéro : donnée à saisir, absente du GTFS, volet B §B2-B3) | aucun : Google « appeler l'agence » sans numéro ni délai, Transit renvoie vers l'app de l'exploitant | **non** |
| E8 | Rappels et compte à rebours : la veille (réserver), le jour J (« Partez dans 12 min ») | Transit « Go in N minutes » + écran verrouillé | partiel — rien pour la veille |
| E9 | Guidage pas-à-pas **multimodal** (taxi puis train puis marche), consigne-action en gros | Transit GO (mais GO exclut le multimodal) + Citymapper | partiel |
| E10 | **Guidage photo** : une image du point de bascule (arrêt, entrée de gare, quai) avec consigne courte | Citymapper en texte seulement ; aucune capture d'un guidage visuel | **non** (⬜ NON CAPTURÉE pour Live View) |
| E11 | Départs à un arrêt avec premier / dernier passage et état réel / théorique | Transit + Mobigo | oui (séparément) |
| E12 | Perturbations : ⚠ sur le segment, alerte datée et sourcée | Google + Transit | oui |
| E13 | Hors ligne : bandeau + trajet préparé consultable + horaires théoriques | Transit | oui |

## Ce qu'on retient / ce qu'on écarte

**Retenu** (le détail et la raison de chaque ligne sont dans les fiches) :
- de **SNCF Connect** : champ unique + dictée, trajet enregistré avec prochain départ, carte de résultat
  départ/arrivée empilés, bandeau des jours voisins (`01-sncf-connect.md`) ;
- de **Transit** : frise verticale de segments couleur, segment non-TC dans la frise, résultats sur échelle
  commune, état de chaque horaire, GO en consignes-actions, écran verrouillé, hors-ligne honnête (`02-transit.md`) ;
- de **Google Maps** : durées sur les onglets de modes, ⚠ sur le segment, colonne d'heures (`03-google-maps.md`) ;
- de **Citymapper** : grille de modes prix + minutes, indications de terrain, alerte de descente (`04-citymapper.md`) ;
- de **Mobigo** : premier / dernier passage, refus explicite (`05-mobigo.md`) ;
- de **Moovit** : la ligne taxi « arrive dans ~N min · durée · fourchette de prix » (`06-moovit.md`).

**Écarté** :
- toute identité visuelle (logos, noms, couleurs de marque, thème sombre cyan de SNCF Connect, vert et
  mascottes de Transit, gamification) ;
- le taxi/VTC hors de l'itinéraire (SNCF Connect, onglet Billets) ;
- le changement de jour silencieux (Google) et la réponse irréaliste (Mobigo : 3 h 49 de marche ; Transit :
  vélo non déclaré) ;
- le guidage limité aux trajets mono-mode et aux départs dans les 60 min (Transit GO) ;
- les publicités et sollicitations d'avis (Moovit, Transit) ;
- la carte plein écran comme point d'entrée (Google).

## UI non capturées (⬜ — elles ne pèsent dans aucune décision)

- SNCF Connect : détail d'un itinéraire (frise), guidage en cours de trajet train/bus, hors ligne, écran réel des deux scénarios (site bloqué par anti-robot, app non installée).
- Google Maps : guidage transports en commun dans l'app, départs à un arrêt, Live View.
- Mobigo : app (détail, guidage, TAD, hors ligne) ; seul le site a été interrogé.
- Moovit : détail, perturbations, hors ligne, deux scénarios (web en 403).
- Citymapper : départs à un arrêt, perturbations, hors ligne (et aucune couverture de l'Yonne).
- Toute interface de **guidage photo** : aucune capturée.

## Le verdict

**MobiliteIA retient le modèle Transit — un trajet est une frise verticale de segments, chaque segment
porte son état (réel / théorique / à réserver) et son action, et le guidage parle en consignes — ouvert
par l'entrée de SNCF Connect (un champ, une dictée, le trajet enregistré).**

**La contrainte qui l'impose** : le trajet de référence du projet — rendez-vous à heure fixe depuis une
commune rurale (Brienon → Joigny, jeudi 12/11, avant 10:00) — est **atteignable en transport public,
mais aucun des calculateurs examinés ne trouve la voie** (car 06:27 → Saint-Florentin-Ville, environ
2,8 km à pied, train 08:50 → 09:09 ; GTFS SNCF revérifié le 2026-10-19, volet B §B6 corrigé ; aucun
résultat de ce type chez Google Maps, Transit ni le site Mobigo, `07-constats-scenarios.md`). La voie
qui marche est donc une **suite de segments hétérogènes** — car, marche longue entre deux arrêts, train,
marche — que l'écran doit montrer un par un avec leur heure, à côté des alternatives routières (taxi,
TAD avec échéance de réservation) traitées comme des segments du même trajet ; et l'horaire du car doit
être marqué théorique puisque Mobigo ne publie aucun temps réel et que le flux temps réel des cars TER
n'est pas vérifié (volet B §B1). Seul le modèle Transit loge ces exigences dans sa structure (frise de
segments marche / véhicule, `transit-web-brienon-joigny-detail-2026-10-19.png` ; segment VTC/TAD dans la
frise, `transit-combo-vtc-dans-frise-2026-10-19.png` ; badge d'état par horaire,
`transit-temps-reel-vs-theorique-2026-10-19.png`) ; le modèle SNCF Connect les sépare (taxi dans Billets,
horaires sans état), le modèle Google les noie (jour changé en parenthèse, « appeler l'agence » sans
échéance).

Note : la « contrainte principale » de `CONSTITUTION.md` est encore ⬜ ; celle nommée ici est tirée des
constats, à confirmer par le porteur du projet et `kodivine-spec`.
