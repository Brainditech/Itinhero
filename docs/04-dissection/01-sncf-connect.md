# Dissection — SNCF Connect

> kodivine-documentaliste · relevé le 2026-10-19 · captures dans `captures/` (index : `captures/SOURCES.md`).
> Fiche App Store FR id343889987 : version 20261008.1.0 du 2026-10-13, note 4,59/5 sur 1 892 432 notes
> (source: https://itunes.apple.com/lookup?id=343889987&country=fr, relevé le 2026-10-19).
> Règle de la demande : on imite **les structures et les gestes**, jamais l'identité (logo, nom, couleurs,
> thème sombre bleu-noir/cyan de la marque).

**Limite de ce dossier** : l'application n'a pas été installée. Le site sncf-connect.com a renvoyé
« Accès temporairement restreint » (anti-robot) à une capture sans contournement, le 2026-10-19 ;
aucun contournement n'a été tenté. Tout ce qui suit vient des captures officielles du store et de
deux captures de presse de 2025.

## Modèle mental

L'utilisateur croit manipuler **un voyage à acheter** : une origine, une destination, une date, puis
une offre (horaire + prix) qu'on met au panier. Le trajet du quotidien est un second objet, rangé
sous « Utile au quotidien » (captures `sncf-connect-accueil-recherche-2026-10-19.jpg`,
`sncf-connect-resultats-train-prix-2026-10-19.jpg`).

## Organisation spatiale (écran par écran)

| Écran | Ce qui est où | Ce qui est masqué | Capture |
|---|---|---|---|
| Accueil / recherche | En haut un champ unique « Où souhaitez-vous aller ? » avec micro ; dessous une grille de 8 raccourcis (Trains, Titres urbains et régionaux, Horaires en gare, Info trafic, Cartes de réduction, Location de voiture, Hôtels, + de services) ; puis « Utile au quotidien » (horaires et trajet à enregistrer) ; barre d'onglets Voyager / Billets / Offres / Compte | heure, date, sens départ/arrivée : non visibles avant d'avoir choisi une destination | `sncf-connect-accueil-recherche-2026-10-19.jpg` |
| Accueil avec trajet enregistré (tablette) | carte « Vos itinéraires fréquents » avec le **prochain départ** déjà calculé (heure, ligne, durée) | — | `sncf-connect-trajets-enregistres-tablette-2026-10-19.jpg` |
| Résultats train | bloc Départ / Arrivée avec bouton d'inversion ; date-heure + « Ajouter retour » ; filtres (Trajets directs, Trajets via) ; onglets **Train / Bus ou covoit.** ; bandeau de 5 jours avec le prix minimal de chaque jour ; cartes : heure départ / gare, heure arrivée / gare, prix « dès », durée, « Direct » ou « 1 correspondance », marque du train | détail des correspondances | `sncf-connect-resultats-train-prix-2026-10-19.jpg` |
| Résultats itinéraire urbain | colonne de gauche heures départ/arrivée empilées ; à droite pastilles de lignes (métro, RER, tram) enchaînées par « › » et durée ; filtre « Mode de transport », « Éviter une ligne » | prix | `sncf-connect-resultats-itineraire-urbain-2026-10-19.jpg` |
| Détail d'un trajet (frise) | ⬜ NON CAPTURÉE — aucune capture officielle du détail d'un itinéraire multimodal | | |
| Guidage piéton (depuis mars 2025) | carte en haut avec tracé ; en bas « Durée 5 min · 370 m » puis liste d'instructions (« Marchez vers l'est. Continuez sur 12 m. ») | — | `sncf-connect-guidage-pieton-2026-10-19.jpg` |
| Guidage en cours de trajet (train/bus) | ⬜ NON CAPTURÉE | | |
| Départs à un arrêt | titre = gare (Paris Montparnasse) ; onglets par mode (Train, Métro, Bus) ; mention « Ces horaires sont prévisionnels et peuvent changer en cas de perturbation » ; par ligne et direction, 4 prochains horaires en pastilles | temps réel par départ : rien n'indique quel horaire est réel | `sncf-connect-horaires-arret-2026-10-19.jpg` |
| Perturbations | onglets Île-de-France / Par région / Grandes lignes ; « Plans des réseaux », « Calendrier des travaux » ; grille de pastilles de lignes, chacune avec un badge d'état ; liste RER avec message | — | `sncf-connect-info-trafic-2026-10-19.jpg` |
| Taxi / VTC (Uber, depuis 2025) | **dans l'onglet Billets**, tuile « Taxi et VTC » → « Réservez une nouvelle course en taxi ou VTC » → liste d'offres Uber (prix, « Attente : 1 min », places) avec la mention « Les prix affichés peuvent changer selon le trafic et la météo » ; carte de lieu de rendez-vous (« Le chauffeur vous attendra ici ») | le taxi n'apparaît **pas** dans la frise d'un itinéraire sur ces captures | `sncf-connect-taxi-vtc-billets-2026-10-19.jpg`, `sncf-connect-vtc-offres-rdv-2026-10-19.jpg` |
| Hors ligne | ⬜ NON CAPTURÉE — aucune source | | |

## Geste principal

Chercher un trajet : taper dans « Où souhaitez-vous aller ? » (1), choisir la suggestion (2), puis
résultats ; date/heure se modifient sur l'écran de résultats (« 11 févr., 06:00 »). **Nombre de taps
réel jusqu'à « je sais quoi prendre » : ⬜ NON RÉSOLU** — l'app n'a pas été manipulée. Avis du
2026-10-06 (1★, v20261001.0.0) : « les champs sont préremplis par défaut pour “maintenant” et c'est
hyper galère » ; avis du 2026-10-17 (1★, v20261008.1.0) : « 14 étapes pour réserver un billet »
(source: https://itunes.apple.com/fr/rss/customerreviews/page=1/id=343889987/sortby=mostrecent/json, relevé le 2026-10-19).

## Ce qui la rend utilisable

- **Un seul champ d'entrée, avec dictée** : la destination d'abord, le reste ensuite (`sncf-connect-accueil-recherche-2026-10-19.jpg`).
- **Le trajet fréquent porte déjà son prochain départ** sur l'accueil : zéro saisie pour le trajet répété (`sncf-connect-trajets-enregistres-tablette-2026-10-19.jpg`).
- **Carte de résultat à deux lignes horaires empilées** (départ en haut, arrivée en bas, gare à côté) : l'heure d'arrivée se lit sans calcul (`sncf-connect-resultats-train-prix-2026-10-19.jpg`).
- **Bandeau des jours voisins** : changer de jour en un tap quand le jour choisi est mauvais (même capture).
- **Avertissement explicite que les horaires d'arrêt sont prévisionnels** (`sncf-connect-horaires-arret-2026-10-19.jpg`).

## Ce qui la rend pénible (avis datés)

Source de tous les avis : flux RSS App Store FR
https://itunes.apple.com/fr/rss/customerreviews/page=1/id=343889987/sortby=mostrecent/json, relevé le 2026-10-19.

- 2026-10-18, 1★ : la voie de départ n'apparaît pas, « même 3 min avant ».
- 2026-10-17, 1★ : « prend un temps fou pour trouver un train » ; « pas possible de suivre un train en route ».
- 2026-10-15, 1★ : recherche Paris Gare de Lyon → Lyon Part-Dieu qui propose un départ de Marne-la-Vallée (gare non demandée).
- 2026-10-12, 2★ : impossible de filtrer « uniquement des TER ».
- 2026-10-10, 1★ : retard affiché inférieur à la réalité ; le train en retard disparaît du tableau des départs.
- 2026-10-05, 2★ : notifications de retard pour un trajet non réservé.
- 2026-10-03, 2★ : « une WebView qui lag », surchauffe et batterie.

## Ce qu'on emprunte / ce qu'on refuse

| Décision | Élément | Raison |
|---|---|---|
| **Emprunte** | Champ unique « Où souhaitez-vous aller ? » + micro | la saisie naturelle (« demain 10h RDV à Joigny ») est le cœur du produit (00-synthese du chercheur, ligne « Compréhension ») |
| **Emprunte** | Trajet enregistré qui affiche son prochain départ sur l'accueil | le trajet Brienon → gare se répète ; zéro saisie |
| **Emprunte** | Carte de résultat : heure de départ au-dessus de l'heure d'arrivée, durée, nombre de correspondances | lecture de l'heure d'arrivée sans calcul, critique pour un RDV |
| **Emprunte** | Bandeau des jours voisins | quand le jour J est impossible, voir les jours d'avant en un tap |
| **Refuse** | Taxi / VTC rangé dans l'onglet Billets, hors de l'itinéraire | à Brienon le premier km routier est l'alternative directe à la seule voie publique du 12/11 (car 06:27 + 2,8 km à pied + train, qu'aucun calculateur ne trouve, voir `07-constats-scenarios.md`) ; il doit être un segment de la frise, comparable à cette voie |
| **Refuse** | Identité visuelle (thème sombre cyan, logo, typographie de marque, nom) | décision produit : structures et gestes seulement |
| **Refuse** | Valeur par défaut « maintenant » sans demander l'heure d'arrivée | avis du 2026-10-06 ; le cas d'usage est un RDV à heure fixe |
| **Refuse** | Horaires d'arrêt sans distinction réel / théorique | le GTFS Mobigo n'a pas de temps réel (volet B du chercheur) : l'état de chaque horaire doit être visible |

## Trous

- ⬜ NON CAPTURÉE — détail d'un itinéraire (frise), guidage en cours de trajet train/bus, hors ligne.
- ⬜ NON RÉSOLU — affichage réel de SNCF Connect pour Brienon → Joigny (12/11, arrivée 10:00) et Brienon → Paris : site bloqué par l'anti-robot le 2026-10-19, app non installée. Voir `07-constats-scenarios.md`.
- ⬜ NON RÉSOLU — l'offre Taxi/VTC Uber est-elle proposée au départ de Brienon-sur-Armançon ?
