# Dissection — Google Maps (transports en commun)

> kodivine-documentaliste · relevé le 2026-10-19 · captures dans `captures/` (index : `captures/SOURCES.md`).
> Fiche App Store FR id585027354 : version 26.42.1 du 2026-10-18, note 4,58/5 sur 812 492 notes
> (source: https://itunes.apple.com/lookup?id=585027354&country=fr, relevé le 2026-10-19).
> Les captures du store montrent surtout la voiture et les lieux ; la partie « transports en commun »
> est documentée par une capture Google Play et par **nos captures du site web** google.com/maps sur
> les deux scénarios réels (sans compte, cookies refusés).

## Modèle mental

L'utilisateur croit manipuler **une carte où l'on trace un trait d'un point à un autre** ; le mode
(voiture, transports, marche, vélo) est un onglet au-dessus de la même liste, chaque onglet portant
sa durée (`google-maps-resultats-tc-2026-10-19.png`, `google-maps-web-brienon-joigny-arrivee-10h-2026-10-19.png`).

## Organisation spatiale (écran par écran)

| Écran | Ce qui est où | Ce qui est masqué | Capture |
|---|---|---|---|
| Recherche départ / arrivée / heure | deux champs empilés + inversion ; rangée d'onglets de modes avec la durée de chacun (« Recom., 26 min, 3h7, 4h17, 1h2 ») ; menu « Arriver à » / « Partir à », heure et date avec flèches ‹ › ; « Options » | préférences (modes, correspondances) dans « Options » | `google-maps-web-brienon-joigny-arrivee-10h-2026-10-19.png` |
| Liste de résultats (mobile) | « Partir maintenant », « Modes », « Filtres » ; cartes : durée en très gros à gauche, horaires « 9:41–10:05 », pastilles de lignes dans leur couleur reliées par « › », prix, fréquence en vert (« Toutes les 8 min depuis … ») | — | `google-maps-resultats-tc-2026-10-19.png` |
| Liste de résultats (web, cas réel) | horaires avec **le jour entre parenthèses** (« 08:23 (mercredi) – 11:30 ») ; pastilles 803 › TER › marche ; « À 08:25 de Mairie » ; triangle ⚠ quand un segment a un avertissement | le fait que le jour proposé n'est **pas** le jour demandé : seulement « (mercredi) » en texte courant | `google-maps-web-brienon-joigny-arrivee-10h-2026-10-19.png`, `google-maps-web-brienon-paris-resultats-2026-10-19.png` |
| Détail d'un trajet (frise) | en-tête « 08:23 (mercredi) – 11:30 (3 h 7 min) » ; frise verticale : colonne d'heures à gauche, trait pointillé = marche, trait plein **couleur de la ligne** = véhicule, nom de l'arrêt, « 803 Auxerre », « 1 h 15 min (9 arrêts) », **« ⚠ Les usagers doivent appeler l'agence. »** | arrêts intermédiaires repliés | `google-maps-web-brienon-joigny-detail-2026-10-19.png`, `google-maps-web-brienon-paris-detail-2026-10-19.png` |
| Guidage en cours de trajet | capture store : bandeau de manœuvre en haut + « Puis » (manœuvre suivante), durée / distance / heure d'arrivée en bas, bouton « Quitter » — **voiture** ; guidage transports en commun : ⬜ NON CAPTURÉE | | `google-maps-guidage-2026-10-19.jpg` |
| Départs à un arrêt | ⬜ NON CAPTURÉE | | |
| Perturbations | ⚠ sur la carte de résultat ; « ⚠ Entretien » sur le segment TER Troyes → Paris Est | contenu du message : un clic | `google-maps-web-brienon-paris-resultats-2026-10-19.png`, `google-maps-web-brienon-paris-detail-2026-10-19.png` |
| Hors ligne | « No signal? Use Google Maps offline » (téléchargement d'une zone) ; l'aide officielle précise que les itinéraires en transports en commun ne sont pas disponibles hors connexion (source: https://support.google.com/maps/answer/6291838?hl=fr, citée par le chercheur, volet A §A2) | | `google-maps-hors-ligne-2026-10-19.jpg` |

## Geste principal

« Comment arriver avant 10:00 jeudi ? » sur le web, constaté le 2026-10-19 : la date et le sens
« Arriver à » ont été passés **dans l'URL** pour la capture ; dans l'interface, la séquence visible
est : champ départ, champ arrivée, onglet transports, menu « Partir maintenant » → « Arriver à »,
heure, date (`google-maps-web-brienon-joigny-arrivee-10h-2026-10-19.png`). Décompte de taps dans
l'app mobile : ⬜ NON RÉSOLU (app non manipulée).

## Ce qui la rend utilisable

- **La durée de chaque mode est sur l'onglet du mode** : on compare voiture (26 min) et transports (3 h 7) sans ouvrir un seul résultat (`google-maps-web-brienon-joigny-arrivee-10h-2026-10-19.png`).
- **La durée du trajet est le plus gros chiffre de la carte** (`google-maps-resultats-tc-2026-10-19.png`).
- **La fréquence en vert** (« Toutes les 8 min ») dit si rater ce départ est grave (même capture).
- **L'avertissement est posé sur le segment concerné** (« Les usagers doivent appeler l'agence », « Entretien ») et remonte en ⚠ sur la carte de résultat (`google-maps-web-brienon-joigny-detail-2026-10-19.png`).
- **Frise de détail à colonne d'heures** : chaque changement a son heure à gauche, lisible en descendant (`google-maps-web-brienon-paris-detail-2026-10-19.png`).

## Ce qui la rend pénible

- **Constat propre, 2026-10-19** : demandé « Arriver à 10:00 jeu. 12 nov. », Google propose en premier « 08:23 (mercredi) – 11:30 », puis des trajets du **mardi** : la réponse change de jour sans le dire autrement qu'en parenthèse (`google-maps-web-brienon-joigny-arrivee-10h-2026-10-19.png`). Or une voie publique du jeudi existe (car 06:27 → Saint-Florentin-Ville, environ 2,8 km à pied, train 08:50 → 09:09 Joigny ; GTFS SNCF revérifié le 2026-10-19, voir `07-constats-scenarios.md`) : Google ne la trouve pas. Pour un RDV, c'est la pire réponse : plausible et fausse pour l'usage.
- **Constat propre** : la consigne de réservation (« Les usagers doivent appeler l'agence ») n'a ni numéro, ni délai, ni bouton (`google-maps-web-brienon-joigny-detail-2026-10-19.png`).
- Hors ligne : pas de transports en commun (aide officielle, citée ci-dessus).
- Avis App Store FR récents : aucun avis ≤ 3★ portant sur les transports parmi les 50 derniers (source: https://itunes.apple.com/fr/rss/customerreviews/page=1/id=585027354/sortby=mostrecent/json, relevé le 2026-10-19).

## Ce qu'on emprunte / ce qu'on refuse

| Décision | Élément | Raison |
|---|---|---|
| **Emprunte** | Onglets de modes portant chacun sa durée | la comparaison taxi direct (26 min de route) / transport public (3 h) est LA décision du trajet rural |
| **Emprunte** | Avertissement posé sur le segment + ⚠ remonté sur la carte de résultat | même mécanisme pour « réservation obligatoire » et « horaire théorique » |
| **Emprunte** | Colonne d'heures à gauche de la frise verticale | se combine avec la frise Transit (blocs couleur) : heure + segment |
| **Emprunte** | Fréquence affichée (« toutes les 8 min » / « 1 seul départ ce jour ») | en rural, « dernier départ » est l'information critique |
| **Refuse** | Glisser au jour précédent sans le dire (« (mercredi) » en parenthèse) | le cas d'usage est un RDV : l'écran doit **dire en titre** ce qu'il a trouvé pour le jour demandé (ou qu'il n'a rien trouvé), puis proposer (taxi, veille) |
| **Refuse** | Consigne « appeler l'agence » sans numéro ni délai | MobiliteIA doit afficher l'échéance de réservation et le numéro (règles saisies à la main, volet B du chercheur) |
| **Refuse** | Carte en plein écran comme point d'entrée | l'utilisateur cible veut une réponse, pas une carte |
| **Refuse** | Identité visuelle Google | structures et gestes seulement |

## Trous

- ⬜ NON CAPTURÉE — guidage transports en commun dans l'app, départs à un arrêt.
- ⬜ NON CAPTURÉE — Live View (guidage visuel AR) : aucune capture prise ; le chercheur documente qu'il exige d'être dehors (volet A §A2).
