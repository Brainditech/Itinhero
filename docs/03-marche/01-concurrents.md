# Volet A — Concurrents et produits de référence

> Agent : kodivine-chercheur · relevé le 2026-10-19. Aucune app n'a été installée ni testée à
> l'écran pendant ce relevé : tout ce qui demande un **constat d'écran** (ex. « que répond SNCF
> Connect à Brienon → Paris ? ») est déclaré `⬜ NON RÉSOLU` et revient au documentaliste.

## Épreuve de l'amont

Si le brief était subtilement faux, le mensonge le plus probable serait **« personne ne couvre
le premier kilomètre rural »**. Or l'app régionale Mobigo Bourgogne-Franche-Comté déclare calculer
des itinéraires incluant transport à la demande, covoiturage et autopartage (§A9), et le car TER
qui dessert Brienon figure dans le GTFS national SNCF (volet B, §B1). Le gap n'est donc pas
« aucune donnée » mais, au mieux, **« aucune app ne dit honnêtement qu'il n'y a pas d'offre
publique aux heures utiles et ne bascule alors vers taxi / covoiturage avec l'heure de réservation
à respecter »** — et cela reste à prouver par constat d'écran. Le second mensonge serait
« guidage photo en sous-sol sans réseau » présenté comme acquis : Google Maps Live View exige
d'être dehors (§A2), et l'API ARCore Geospatial exige internet (volet E).

## A1. SNCF Connect

- Depuis 2025, réservation de VTC ou taxi via un partenariat Uber, pour le trajet « entre la gare et la destination finale », sans quitter l'app (source: https://www.journaldugeek.com/2025/03/18/sncf-connect-veut-remplacer-google-maps-avec-ces-3-nouvelles-fonctionnalites/, vérifié le 2026-10-19).
- La même mise à jour ajoute un guidage piéton intégré à partir d'adresses précises et une remise Avis de 10 % (15 % avec carte SNCF) (source: même article, vérifié le 2026-10-19).
- Au lancement (2022), l'offre annoncée regroupait train, covoiturage, vélo, trottinette, transport urbain, taxi et VTC — annonce de lancement, pas un constat de l'app actuelle (source: https://www.linfodurable.fr/sncf-un-site-et-une-appli-uniques-pour-les-trajets-du-quotidien-debut-2022-29644, vérifié le 2026-10-19).
- ⬜ NON RÉSOLU — SNCF Connect propose-t-il le car TER K941 depuis « Brienon-sur-Armançon » pour aller à Paris, et que propose-t-il pour un départ le matin ? Constat d'écran à faire (documentaliste).
- ⬜ NON RÉSOLU — mode hors ligne (billets consultables hors ligne ? itinéraire ?) et guidage visuel / réalité augmentée : aucune source trouvée.

## A2. Google Maps

- Hors connexion, « les itinéraires en transports en commun, à vélo ou à pied ne sont pas disponibles » ; seul le guidage routier fonctionne dans une zone téléchargée (source: https://support.google.com/maps/answer/6291838?hl=fr, vérifié le 2026-10-19).
- Live View (« Lens dans Maps ») exige un appareil compatible ARCore/ARKit, une zone bien couverte par Street View, d'être **à l'extérieur** dans une zone bien éclairée, et n'est disponible que dans certains pays (source: https://support.google.com/maps/answer/9332056?hl=fr, vérifié le 2026-10-19).
- Indoor Live View a été annoncé le 30/03/2021 pour des centres commerciaux de 7 villes américaines, puis « dans les mois à venir » pour des aéroports, centres commerciaux et gares de Tokyo et Zurich ; aucune ville française citée (source: https://blog.google/products/maps/redefining-what-map-can-be-new-information-and-ai/, vérifié le 2026-10-19).
- ⬜ NON RÉSOLU — Google Maps intègre-t-il les horaires Mobigo 89 et le car TER K941 à Brienon ? Constat d'écran à faire.
- ⬜ NON RÉSOLU — Indoor Live View est-il disponible dans une gare française en 2026 ? La page d'aide actuelle ne mentionne aucun usage intérieur (source ci-dessus) ; aucune annonce postérieure trouvée.

## A3. Citymapper

- Les régions françaises couvertes sont Bordeaux, Lille, Lyon, Marseille, Nantes, Paris, Strasbourg et Toulouse ; aucune région couvrant l'Yonne ou la Bourgogne (source: https://citymapper.com/cities, HTML récupéré via fetch:url le 2026-10-19, champ `region_id`).

## A4. Moovit

- Moovit permet d'enregistrer des lignes favorites en Wi-Fi pour les consulter sans signal, et de voir des lieux et cartes enregistrés hors connexion (source: https://moovit.com/blog/beyond-the-signal-a-tourists-guide-to-reliable-public-transport-navigation-in-2026/, article du 29/04/2026, vérifié le 2026-10-19).
- ⬜ NON RÉSOLU — Moovit couvre-t-il Mobigo 89 / Brienon ? Aucune page Moovit pour l'Yonne trouvée par recherche le 2026-10-19 ; à constater dans l'app (recherche « Mobigo » ou « Brienon »).

## A5. Transit

- Transit liste « Mobigo 89 - Yonne » avec 22 lignes de bus et 181 arrêts, dont 13 lignes étiquetées « TAD » (851–856, 858–864) ; la page ne mentionne pas de temps réel (source: https://transitapp.com/en/region/auxerre/mobigo-89-yonne, vérifié le 2026-10-19).
- Ces chiffres (22 lignes, 181 arrêts) coïncident avec le GTFS Mobigo 89 du 2026-09-21 : Transit consomme vraisemblablement ce même fichier (source: volet B §B2 ; https://www.data.gouv.fr/api/1/datasets/r/5c995d2c-8e79-4e40-b4a6-c0583c647201, téléchargé le 2026-10-19).
- ⬜ NON RÉSOLU — Transit gère-t-il la réservation TAD (rappel du délai) ou affiche-t-il la course 856 comme un bus normal ? Constat d'écran à faire.

## A6. Mappy

- Le comparateur multimodal de Mappy intègre voiture, transports en commun, marche, vélo, trottinette, scooter partagé, VTC, autocar longue distance, train et covoiturage, comparés sur durée, prix et empreinte carbone — sources du blog Mappy datant de 2016 à 2019 (source: https://blog.mappy.com/mappy-le-comparateur-de-tous-vos-deplacements/, vérifié le 2026-10-19).
- Mappy a intégré les taxis G7 à son comparateur (source: https://blog.mappy.com/mappy-integre-les-autolib-et-les-taxis-g7-a-son-comparateur-de-deplacement/, vérifié le 2026-10-19).
- ⬜ NON RÉSOLU — liste actuelle (2026) des modes et partenaires Mappy ; couverture Brienon. Constat d'écran à faire.

## A7. Bonjour RATP

- L'app couvre bus, métro, RER, tramway, Transilien, Noctilien, et les vélos / trottinettes Vélib', Lime, Voi et Dott — périmètre francilien (source: https://www.bonjour-ratp.fr/en/actualites/articles/BonjourRATP/, vérifié le 2026-10-19).
- En juin 2021, l'app a ajouté la réservation de VTC via la plateforme Marcel ; maintien en 2026 non confirmé (source: https://www.voyages-d-affaires.com/en/bonjour-appli-ratp-20210611.html, vérifié le 2026-10-19).

## A8. Île-de-France Mobilités (app IDFM et Covoit IDFM)

- Covoit IDFM permet de publier ou chercher des trajets de covoiturage jusqu'à 5 minutes avant le départ, avec prise en charge d'un taxi ou VTC en cas d'annulation du retour (source: https://www.iledefrance.fr/toutes-les-actualites/covoit-idfm-lapplication-qui-simplifie-le-covoiturage-en-ile-de-france, vérifié le 2026-10-19).
- Périmètre : réseaux franciliens ; utile au produit seulement pour la **partie parisienne** d'un trajet Brienon → Paris (source: https://prim.iledefrance-mobilites.fr/fr/apis/idfm-navitia-general-v2, « réseaux de transport Franciliens », vérifié le 2026-10-19).

## A9. App Mobigo Bourgogne-Franche-Comté (le concurrent le plus proche)

- Développeur « Eclat BFC », fournisseur « REGION BOURGOGNE-FRANCHE-COMTE », copyright Cityway (source: https://apps.apple.com/fr/app/mobigo-bourgogne-franche-comt%C3%A9/id1127428347, vérifié le 2026-10-19).
- Itinéraires annoncés en train, bus, tram, vélo, covoiturage, autopartage, **transport à la demande** et à pied ; état du service en temps réel ; achat de M-ticket et de titres TER ; une app séparée « Covoiturage Mobigo » existe (source: même fiche, vérifié le 2026-10-19).
- Version 5.8.83 datée du « 25 juin » (année non affichée), note 4,1/5 sur 962 avis ; aucun mode hors ligne mentionné (source: même fiche, vérifié le 2026-10-19).
- ⬜ NON RÉSOLU — l'app Mobigo (ou viamobigo.fr) propose-t-elle Brienon → Joigny pour le jeudi 12/11 à 10:00 et que répond-elle quand l'offre publique échoue (volet B §B6) ? Constat d'écran à faire.
- ⬜ NON RÉSOLU — l'app Mobigo intègre-t-elle les taxis de l'Yonne ? Rien dans la fiche store.

## A10. Matrice de synthèse (chaque case renvoie aux puces sourcées ci-dessus)

| Produit | Modes au-delà du TC | 1er km rural (taxi/TAD/covoit.) | Hors ligne | Guidage visuel / AR | Yonne |
|---|---|---|---|---|---|
| SNCF Connect | VTC/taxi Uber, location (A1) | Uber gare→destination ; origine ⬜ | ⬜ | ⬜ | données présentes, affichage ⬜ |
| Google Maps | ⬜ | ⬜ | ❌ pour TC (A2) | Live View dehors seulement (A2) | ⬜ |
| Citymapper | — | — | — | — | ❌ (A3) |
| Moovit | ⬜ | ⬜ | partiel : lignes et cartes enregistrées (A4) | ⬜ | ⬜ |
| Transit | ⬜ | TAD affiché (A5) | ⬜ | ⬜ | ✅ Mobigo 89 (A5) |
| Mappy | VTC, covoit., taxi G7 (2016-2019, A6) | ⬜ | ⬜ | ⬜ | ⬜ |
| Bonjour RATP / IDFM | vélos, trottinettes, VTC 2021 (A7-A8) | — | ⬜ | ⬜ | ❌ hors périmètre |
| Mobigo BFC | covoit., autopartage, TAD (A9) | TAD + covoit. déclarés (A9) | non mentionné (A9) | ⬜ | ✅ (A9) |

(source: puces A1 à A9 de ce fichier, toutes vérifiées le 2026-10-19)

## A11. Le gap, borné à ce qui a été vérifié

- Parmi les 8 produits examinés, **aucun** ne documente un guidage par photo ou vision **hors ligne**, ni en intérieur en France (source: puces A1 à A9, vérifiées le 2026-10-19).
- Parmi les 8 produits, seul SNCF Connect documente une réservation taxi/VTC intégrée, et sa formulation vise le trajet gare → destination, pas domicile rural → gare (source: A1, https://www.journaldugeek.com/2025/03/18/sncf-connect-veut-remplacer-google-maps-avec-ces-3-nouvelles-fonctionnalites/, vérifié le 2026-10-19).
- Le gap « premier kilomètre » est donc **probable mais non prouvé** : la preuve exige un constat d'écran du scénario Brienon → Joigny du 12/11 10:00 dans SNCF Connect, Google Maps, Mobigo et Transit. ⬜ NON RÉSOLU — à confier au documentaliste.

## A12. Prix

- Les apps examinées sont gratuites au téléchargement ; ⬜ NON RÉSOLU — aucun prix de course n'a été relevé (taxi Brienon → Laroche-Migennes, Uber Auxerre : la page Uber Auxerre cite des « prix moyens UberX » sans que le montant ait été capturé). Où chercher : https://www.uber.com/global/fr/r/cities/auxerre-bfc-fr et devis d'un taxi de Brienon.
- Uber est commandable à Auxerre 24 h/24 avec réservation jusqu'à 90 jours à l'avance (Uber Reserve) ; Brienon n'est pas cité sur la page (source: https://www.uber.com/global/fr/r/cities/auxerre-bfc-fr, vérifié le 2026-10-19).
