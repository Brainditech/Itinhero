# Volet C — API tierces (VTC, covoiturage, taxis)

> Agent : kodivine-chercheur · relevé le 2026-10-19.

## Épreuve de l'amont

Le brief promet d'assembler « TOUS les modes » dont Uber, BlaBlaCar Daily et le taxi local. Le
mensonge serait de croire que chacun s'appelle par une API ouverte. Constat : Uber réserve la
commande programmatique (scope `request`) à une revue d'accès, BlaBlaCar Daily distribue son
inventaire par jeton partenaire sur demande, et le taxi local de Brienon n'a **aucune** surface
numérique ouverte trouvée. Pour un utilisateur unique au départ, la seule intégration certaine sans
accord commercial est le **lien profond** (deep link) — ouvrir l'app tierce pré-remplie — pas la
réservation pilotée.

## C1. Uber

- L'intégration « Ride Requests » se fait soit par deep links (« Development Effort Low ») soit par l'API REST (« Development Effort High ») (source: https://developer.uber.com/docs/riders/ride-requests/introduction, vérifié le 2026-10-19).
- Le scope `request` (commander une course) est un **scope privilégié** : « By default, privileged scopes are limited to your development team » ; la production exige une demande de Full Access revue par Uber, et une politique de confidentialité publique (source: https://developer.uber.com/docs/riders/guides/scopes, vérifié le 2026-10-19).
- En « Limited Access », le scope `request` fonctionne avec le compte du développeur et les comptes développeurs déclarés — ce qui couvre un **utilisateur unique** qui serait aussi le développeur (source: même page, vérifié le 2026-10-19).
- Les deep links (universels, standards, ou `m.uber.com`) peuvent pré-remplir prise en charge, destination et produit via l'action `setPickup`, mais ne renvoient ni prix ni temps d'attente, qui exigent l'API (source: https://developer.uber.com/docs/deep-linking, vérifié le 2026-10-19).
- ⬜ NON RÉSOLU — l'API Ride Requests accepte-t-elle encore de nouvelles applications en 2026 (Full Access) ? Aucune page ne le confirme ni ne l'infirme. Où chercher : tableau de bord développeur Uber après création d'app.
- ⬜ NON RÉSOLU — existe-t-il des chauffeurs Uber actifs autour de Brienon / Migennes ? La page Auxerre ne cite pas Brienon (source: https://www.uber.com/global/fr/r/cities/auxerre-bfc-fr, vérifié le 2026-10-19). Constat par estimation dans l'app Uber, adresse Brienon.

## C2. BlaBlaCar (longue distance)

- ⬜ NON RÉSOLU — existence et ouverture d'une API publique BlaBlaCar en 2026. `dev.blablacar.com` renvoie 404 le 2026-10-19 ; seuls des annuaires tiers et des clients PyPI non officiels décrivent une API v3 (source: https://public-api.org/api/1268/blablacar, vérifié le 2026-10-19). Où chercher : équipe partenariats BlaBlaCar.

## C3. BlaBlaCar Daily (covoiturage courte distance)

- BlaBlaCar Daily publie une « API Partner » de recherche de trajets disponibles : `GET /2/third_party/public/search` (détail des trajets) et `/1/...` (dépréciée), interrogée par coordonnées de départ et d'arrivée et plage horaire (±1 h par défaut) (source: https://api-doc.blablacardaily.com/docs/BlaBlaCarDaily_Partner-API.pdf, document du 05/05/2026, lu le 2026-10-19).
- Accès : « protégé par un jeton propre à chaque partenaire », demandes via le formulaire https://blablacardaily.com/contact (source: même document, lu le 2026-10-19).
- Quotas : 3 600 requêtes par minute par point d'entrée (source: même document, lu le 2026-10-19).
- Limites métier : trajet refusé (HTTP 422) au-delà de **80 km** ; inventaire constitué **au plus une semaine à l'avance** (source: même document, lu le 2026-10-19).
- Chaque résultat contient un deep link (`web_url`) ouvrant l'app BlaBlaCar Daily avec la recherche (source: même document, lu le 2026-10-19).
- Modèle économique : BlaBlaCar Daily opère pour des entreprises et des collectivités qui subventionnent les trajets (source: https://jobs.accel.com/companies/blablacar/jobs/57636909-account-manager-blablacar-daily-b2g, vérifié le 2026-10-19).
- ⬜ NON RÉSOLU — BlaBlaCar Daily a-t-il de l'inventaire autour de Brienon ? Aucun partenariat Yonne trouvé. Où chercher : recherche dans l'app BlaBlaCar Daily, trajet Brienon → Laroche-Migennes un jour ouvré à 8 h.
- ⬜ NON RÉSOLU — un particulier sans structure peut-il obtenir un jeton partenaire ? Le document ne le dit pas.

## C4. Taxis : G7 et le.taxi

- G7 s'intègre à des plateformes tierces de voyage d'affaires (KDS, Notilus, CWT) via « G7 Booking » ; aucun portail développeur public trouvé (source: https://www.voyages-d-affaires.com/g7-booking-cwt-france-roule-taxis-g7, vérifié le 2026-10-19).
- ⬜ NON RÉSOLU — G7 opère-t-il dans l'Yonne ? Non vérifié. Où chercher : simulation de course sur g7.fr depuis Brienon.
- le.taxi est un registre public de disponibilité des taxis en temps réel porté par l'État (DINUM) ; la fiche data.gouv citée par les moteurs de recherche (https://www.data.gouv.fr/dataservices/le-taxi) renvoie 404 le 2026-10-19 (source: tentative WebFetch du 2026-10-19).
- Le seul jeu de données le.taxi trouvé (« Stations de taxi en France ») ne contient aucune station en Bourgogne-Franche-Comté (source: https://www.data.gouv.fr/datasets/stations-de-taxi-en-france, CSV téléchargé le 2026-10-19 ; détail volet B §B5).
- ⬜ NON RÉSOLU — conditions d'accès d'une application cliente (côté passager) à l'API le.taxi, et présence de taxis de l'Yonne connectés. Où chercher : documentation technique le.taxi (api.taxi / le.taxi), contact indiqué par le livret chauffeur.

## C5. Registre public des taxis / VTC

- Le Code des transports prévoit que certaines données du registre des exploitants VTC sont publiques (numéro d'inscription, SIREN/SIRET, forme juridique, nom de l'exploitant, code postal), et que le ministère publie la liste des exploitants inscrits — lecture tirée d'un extrait diffusé par une préfecture, non vérifiée sur Légifrance (source: https://www.pyrenees-atlantiques.gouv.fr/index.php/contenu/telechargement/47420/351802/file/Extrait%20code%20des%20transports%20VTC.pdf, vérifié le 2026-10-19).
- Sur data.gouv.fr, la recherche « vtc » renvoie 70 jeux, dont aucun registre d'exploitants parmi les premiers résultats ; « taxi » renvoie 87 jeux, surtout des emplacements de stations urbaines (source: https://www.data.gouv.fr/api/1/datasets/?q=vtc et https://www.data.gouv.fr/api/1/datasets/?q=taxi, vérifié le 2026-10-19).
- ⬜ NON RÉSOLU — existe-t-il un fichier ou une API ouverte du registre VTC ou des autorisations de stationnement taxi (ADS) de l'Yonne ? Où chercher : registre-vtc.developpement-durable.gouv.fr, préfecture de l'Yonne (arrêtés ADS par commune).

## C6. Moteurs d'itinéraire hébergés (API)

- API SNCF (Navitia) : gratuite jusqu'à 150 000 requêtes/mois, 5 000/jour — détail volet B §B7 (source: https://numerique.sncf.com/startup/api/, récupéré le 2026-10-19).
- Navitia expose `ridesharing` et `taxi` comme modes de premier et dernier tronçon, et un niveau « on demand transportation » où le voyageur doit appeler l'agence (source: https://doc.navitia.io/, vérifié le 2026-10-19).
- Transitous (instance MOTIS mondiale, `api.transitous.org`) : réservé aux projets **open source, non commerciaux**, légers ; « commercial use is not allowed » ; `User-Agent` avec contact obligatoire ; contact préalable exigé avant d'utiliser le routage dans une app (source: https://transitous.org/api/, vérifié le 2026-10-19).
