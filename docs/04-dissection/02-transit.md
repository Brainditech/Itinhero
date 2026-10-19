# Dissection — Transit

> kodivine-documentaliste · relevé le 2026-10-19 · captures dans `captures/` (index : `captures/SOURCES.md`).
> Fiche App Store FR id498151501 : version 6.3.5 du 2026-10-06, note 4,56/5 sur 102 810 notes
> (source: https://itunes.apple.com/lookup?id=498151501&country=fr, relevé le 2026-10-19).
> Trois sources : captures du store, images des pages d'aide officielles (help.transitapp.com,
> mises à jour entre le 2026-07-02 et le 2026-09-15), et **nos captures du planificateur web**
> https://transitapp.com/fr/trip sur les deux scénarios réels.

## Modèle mental

L'utilisateur croit manipuler **des lignes qui passent près de lui, et le temps qu'il lui reste
avant de partir**. L'accueil est une liste de lignes proches, chacune avec son nombre de minutes ;
un trajet est une **suite de segments colorés** (marche, ligne, vélo, VTC, transport à la demande)
posée sur une échelle de temps (`transit-accueil-departs-proches-2026-10-19.jpg`,
`transit-resultats-frise-horizontale-2026-10-19.png`).

## Organisation spatiale (écran par écran)

| Écran | Ce qui est où | Ce qui est masqué | Capture |
|---|---|---|---|
| Accueil = départs à proximité | carte en haut ; barre « On va où ? » posée sur la carte avec raccourci maison (« 32 min ») ; dessous, une ligne par bloc pleine largeur **dans la couleur de la ligne** : numéro énorme, direction, arrêt, minutes à droite avec icône temps réel | horaires complets (un tap) | `transit-accueil-departs-proches-2026-10-19.jpg` |
| Ligne / départs à un arrêt | numéro de ligne énorme ; tracé sur carte ; 3 cartes de départ côte à côte (1 / 7 / 16 min) ; icône d'ondes = temps réel, sinon libellé « PLANIFIÉ » ; bouton GO | horaire complet (« More departures ») | `transit-ligne-prochains-departs-2026-10-19.jpg`, `transit-temps-reel-vs-theorique-2026-10-19.png`, `transit-badge-planifie-2026-10-19.png` |
| Recherche départ / arrivée / heure | deux champs empilés (Lieu actuel / destination) avec inversion ; pastille « Départ maintenant » qui ouvre Départ à / Arrivée à, date, heure | l'heure : derrière la pastille | `transit-resultats-frise-horizontale-2026-10-19.png` ; sur le web : `transit-web-brienon-joigny-arrivee-10h-2026-10-19.png` |
| Liste de résultats | échelle d'heures commune en haut (09:30 · 09:45 · 10:00) ; chaque trajet = **frise horizontale** de pastilles de lignes placées à leur heure ; sous la frise « Départ dans 4 min » (en vert si temps réel) et durée ; section **COMBO TRIPS / TRANSIT+** (vélo + bus, VTC $6-7 + bus) ; section AUTRES OPTIONS (vélo seul) | — | `transit-resultats-frise-horizontale-2026-10-19.png`, `transit-combo-trips-resultats-2026-10-19.png` |
| Détail d'un trajet (frise) | carte d'en-tête « Partez à 8:33 / Arrivée à 9:32 / 60 min » + barre de progression segmentée ; puis **frise verticale** : segment non-TC (vélo 9,79 km), bloc plein de la couleur de la ligne (opérateur, direction, arrêt de montée + heure, « Encore N arrêts », arrêt de descente + heure), marche « 1,09 kilomètre », destination + heure | arrêts intermédiaires (repliés) | `transit-web-brienon-joigny-detail-2026-10-19.png`, `transit-web-brienon-paris-detail-2026-10-19.png` |
| Premier km non-TC dans la frise | segment « Ridehail in 3 min $6-7 » placé **avant** le bus dans la même frise, bouton « Request Ridehail » ; transport à la demande : segment « On-Demand Service $2.50 », bouton « Request On-Demand Service » qui **renvoie vers l'app de l'exploitant** | délai de réservation : absent | `transit-combo-vtc-dans-frise-2026-10-19.png`, `transit-tad-dans-resultats-2026-10-19.png`, `transit-tad-reserver-2026-10-19.png` |
| Guidage en cours de trajet (GO) | en haut « Arrivée à 09:54 » ; texte central énorme (« Descendez au prochain arrêt », « Descendez dans 4 arrêts ») ; barre de progression ; carte du prochain arrêt ; avant départ : « Go in 4 minutes », « Go in 2 minutes » ; sur écran verrouillé : « 2 more stops », minutes restantes | réglages GO dans un menu | `transit-go-guidage-descente-2026-10-19.png`, `transit-go-depart-2026-10-19.png`, `transit-go-depechez-vous-2026-10-19.png`, `transit-go-ecran-verrouille-2026-10-19.png`, `transit-go-minimise-2026-10-19.png`, `transit-go-affluence-2026-10-19.jpg` |
| Perturbations | triangle d'alerte à côté du numéro de ligne dans la liste ; étiquette « Significant delays » ; fiche d'alerte (texte, date de publication, source) ; abonnement aux alertes par plage horaire ; badges de départ « CANCELLED », « LIKELY CANCELLED », « SKIPS THIS STOP » | alertes de niveau « information » : seulement dans la fiche de ligne | `transit-perturbation-alerte-2026-10-19.jpg`, `transit-alerte-retards-ligne-2026-10-19.png`, `transit-alerte-detail-2026-10-19.png`, `transit-badge-annule-2026-10-19.png`, `transit-badge-probablement-annule-2026-10-19.png` |
| Hors ligne | bandeau jaune « Offline. No real-time data. » ; départs étiquetés « SCHEDULED » ; fiche horaire consultable | VTC, vélos partagés, alertes : indisponibles | `transit-hors-ligne-2026-10-19.png` |
| Guidage vélo | flèche énorme, « dans 480 mètres sur Rue Rachel Est », arrivée, liste d'instructions | — | `transit-guidage-velo-2026-10-19.jpg` |

Faits documentés par l'aide officielle (relevé le 2026-10-19) :
- « You can only start GO for trips that leave in the next 60 minutes. GO is not supported on multimodal trips. » (source: https://help.transitapp.com/article/549-how-to-use-go, mise à jour 2026-09-15).
- Hors ligne : planification limitée au transport public **théorique**, au vélo et à la marche ; GO démarre sur les horaires théoriques et prévient de descendre d'après le GPS ; VTC, vélos partagés et alertes indisponibles (source: https://help.transitapp.com/article/90-does-transit-work-offline, mise à jour 2026-07-02).
- Transport à la demande : « Request [On-Demand Service] » ouvre l'app de l'exploitant ; conseil de commander « un peu à l'avance » si le TAD suit un bus (source: https://help.transitapp.com/article/336-use-on-demand-services-with-transit, mise à jour 2026-07-02).
- États d'un départ : temps réel, théorique (grisé), saute l'arrêt, annulé, probablement annulé (source: https://help.transitapp.com/article/445-how-to-track-departures-on-your-transit-line, mise à jour 2026-08-31).

## Geste principal

Deux gestes, mesurés différemment :
- **« Quand passe mon bus ? »** : ouvrir l'app — **0 tap**, la liste des lignes proches avec minutes est l'accueil (`transit-accueil-departs-proches-2026-10-19.jpg`).
- **« Comment arriver avant 10:00 jeudi ? »** : sur le planificateur web, constaté le 2026-10-19 : saisir départ (1 + saisie), choisir (1), saisir arrivée (1 + saisie), choisir (1), ouvrir « Partez maintenant » (1), choisir « Arrivée à » (1), heure (1), calendrier (1), mois suivant (1), jour (1), enregistrer (1) = **11 interactions** avant le résultat. Dans l'app, l'aide décrit la même séquence (« tap Leave Now → Arrive by → set the time ») (source: https://help.transitapp.com/article/94-plan-a-trip-from-a-to-b, mise à jour 2026-07-02) ; décompte dans l'app : ⬜ non mesuré. Vers un lieu enregistré : 1 tap sur la pastille d'ETA de la barre de recherche (même source).

## Ce qui la rend utilisable

- **La couleur de la ligne est la surface entière**, pas une pastille : on reconnaît son bus dans une liste à distance de lecture (`transit-accueil-departs-proches-2026-10-19.jpg`).
- **Le temps restant, pas l'heure** : « 4 minutes », « Départ dans 4 min » ; l'heure n'apparaît qu'en second (mêmes captures).
- **Chaque horaire dit s'il est réel ou théorique** (ondes vs « PLANIFIÉ » / « SCHEDULED »), et l'annulation probable a son badge : on sait ce qu'on peut croire (`transit-temps-reel-vs-theorique-2026-10-19.png`, `transit-badge-probablement-annule-2026-10-19.png`).
- **Résultats alignés sur une échelle de temps commune** : on compare les trajets d'un coup d'œil (`transit-resultats-frise-horizontale-2026-10-19.png`).
- **Le segment non-TC (vélo, VTC, TAD) est un segment de la même frise**, avec son bouton d'action à sa place (`transit-combo-vtc-dans-frise-2026-10-19.png`, `transit-web-brienon-joigny-detail-2026-10-19.png`).
- **GO parle en actions** (« Descendez au prochain arrêt ») et vit sur l'écran verrouillé (`transit-go-guidage-descente-2026-10-19.png`, `transit-go-ecran-verrouille-2026-10-19.png`).
- **Hors ligne dégradé mais honnête** : bandeau explicite, horaires marqués théoriques (`transit-hors-ligne-2026-10-19.png`).

## Ce qui la rend pénible (avis datés)

Source : https://itunes.apple.com/fr/rss/customerreviews/page=1/id=498151501/sortby=mostrecent/json, relevé le 2026-10-19.

- 2026-10-17, 1★ : « Aujourd'hui, tout est faux » (horaires).
- 2026-10-11, 1★ : « soit le bus est parti depuis 10 min soit il vient dans 20 minutes ».
- 2026-10-04, 3★ : le point médian rend « certaines indications compliquées à comprendre et à lire ».
- 2026-09-25, 3★ : trains supprimés non actualisés en direct.
- 2026-09-24, 1★ : « Arrêtez chaque seconde de demander nos avis ».
- 2026-09-20, 2★ : « pas à temps réel ».
- Constat propre (2026-10-19) : pour Brienon → Joigny, Transit propose **9,79 km de vélo** un jeudi de novembre à 8:33 sans demander si l'utilisateur a un vélo (`transit-web-brienon-joigny-arrivee-10h-2026-10-19.png`) ; la ligne 856 « TAD » est affichée sans aucune mention de réservation (`transit-web-ligne-856-tad-2026-10-19.png`).

## Ce qu'on emprunte / ce qu'on refuse

| Décision | Élément | Raison |
|---|---|---|
| **Emprunte** | Frise verticale de détail : en-tête « Partez à / Arrivée à / durée » + segments empilés, bloc plein couleur de ligne, montée/descente avec heures, arrêts repliés | c'est l'objet que l'utilisateur doit suivre la veille et le jour J |
| **Emprunte** | Segment de premier km (VTC/TAD) DANS la frise, avec son bouton d'action | sur le trajet de référence Brienon → Joigny, la voie publique existe mais aucun calculateur ne la trouve (`07-constats-scenarios.md`) ; taxi / TAD / covoiturage en sont les alternatives et doivent être des segments comparables, pas un autre onglet |
| **Emprunte** | Résultats sur échelle de temps commune | comparer « taxi jusqu'à Migennes + train » et « taxi direct » d'un coup d'œil |
| **Emprunte** | État de chaque horaire : temps réel / théorique / annulé / probablement annulé | Mobigo n'a aucun temps réel (volet B §B2 du chercheur) : l'utilisateur doit savoir que l'horaire du car est théorique |
| **Emprunte** | Temps restant en gros (« Partez dans 12 min »), heure en second | geste du jour J |
| **Emprunte** | GO : consigne-action en gros + écran verrouillé + « Go in N minutes » | guidage pas-à-pas pour un public peu à l'aise |
| **Emprunte** | Hors ligne : bandeau + horaires marqués théoriques | zone rurale, couverture réseau incertaine |
| **Adapte** | Réservation TAD : Transit renvoie vers l'app de l'exploitant sans délai | MobiliteIA doit afficher **l'échéance** (« réserver avant … ») et le numéro, puisque le GTFS n'a pas de `booking_rules.txt` (volet B §B2-B3) |
| **Refuse** | « GO not supported on multimodal trips » et GO limité aux départs dans les 60 min | notre trajet type est multimodal (taxi + train) et se prépare la veille |
| **Refuse** | Proposer un mode (vélo 9,79 km) sans savoir si l'utilisateur en dispose | on demande les moyens disponibles une fois, on n'invente pas un vélo |
| **Refuse** | Gamification (classements, avatars, « Royale ») | hors du besoin ; bruit visuel (`transit-go-affluence-2026-10-19.jpg` montre déjà la sollicitation) |
| **Refuse** | Identité visuelle (vert Transit, mascottes, police) | structures et gestes seulement |
| **Refuse** | Écriture inclusive au point médian dans les consignes | avis du 2026-10-04 : gêne la lecture des consignes |

## Trous

- ⬜ NON RÉSOLU — décompte de taps dans l'app mobile (seul le web a été manipulé).
- ⬜ NON RÉSOLU — Transit connaît-il le délai de réservation de la 856 dans l'app ? La page web de ligne n'en dit rien (`transit-web-ligne-856-tad-2026-10-19.png`).
