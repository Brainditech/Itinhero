# 0001 — Cadrage de la v1 d'Itinhero

- **Date** : 2026-11-02
- **Statut** : accepté par Brainditech (plan approuvé le 2026-11-02)
- **Contexte** : interview de cadrage en 6 lots, puis corrections de Brainditech. L'archive `docs/_archive-kodivine/` a été lue comme une source d'idées, pas comme une décision.

## Constats vérifiés avant les questions

| Constat | Source |
|---|---|
| expo ~58.0.22, react-native 0.88.1, react 19.3.0, expo-router ~58.0.29, TypeScript ~6.0.3 | `package.json`, lu le 2026-11-02 |
| Aucun fichier tarifaire (`fare_attributes`, `fare_rules`, `fare_products`) dans les deux GTFS figés | `unzip -l` de `fixtures/_rapatrie-2026-10-19/sncf.zip` et `mobigo89.zip`, le 2026-11-02 |
| `transfers.txt` SNCF de 81 octets : les correspondances à pied viendront d'OSM | même listage |
| sha256 `sncf.zip` = `6892f10eb62e48e2a6dc6fd0ea6e27cbadcc1163d44b34e64661dae6be701dce`, `mobigo89.zip` = `201780dac66a1663607d4c12f138d60c7e2b78ee7ae896eae06abbdc85d09db6`, identiques à l'archive | `sha256sum` le 2026-11-02 ; `docs/_archive-kodivine/ETAT.md` |
| MOTIS : dernière version v2.11.4 (2026-10-21) | https://api.github.com/repos/motis-project/motis/releases/latest, lu le 2026-11-02 |
| MOTIS : `max_footpath_length` vaut 15 min par défaut. Il existe des options `osr_footpath`, `geocoding`, `street_routing` et un GTFS-RT par jeu (`timetable.datasets.<tag>.rt[]`, `update_interval` de 60 s) | https://raw.githubusercontent.com/motis-project/motis/master/docs/setup.md, lu le 2026-11-02 |
| La course de 06:27 (service 000015) ne circule pas le 11/11 | `docs/_archive-kodivine/PLAN.md` |
| Aucun remote git, branche locale `master` | `git remote -v`, `git branch -a`, le 2026-11-02 |

## Journal des décisions

Une ligne par question.

| # | Décision | Raison | Options écartées |
|---|---|---|---|
| D1 | En développement, un seul `docker compose` sur le PC (MOTIS, API Node, Inngest auto-hébergé). Une phase « déploiement VPS » (même compose) vient avant « Terminé v1 ». Le VPS (taille, fournisseur, prix) n'est choisi qu'après la mesure de la mémoire de MOTIS chargé avec les fixtures | La v1 doit marcher PC éteint, et le dimensionnement doit reposer sur une mesure | EAS Hosting, Cloudflare Tunnel, Tailscale |
| D2 | Aucune date de livraison. Le 12/11/2026 n'est qu'un scénario de test | Choix de Brainditech | Moteur et test pour le 12/11, app minimale pour le 12/11 |
| D3 | `max_footpath_length=45`, seulement pour que le moteur trouve ces voies. Toute marche de plus de 15 min porte un avertissement visible, et l'app propose pour **cette** étape un taxi avec un numéro sourcé (sinon « aucun numéro connu »). Le tri « moins de marche » fait remonter les possibilités sans longue marche. Aucun réglage en v1 | Trouver la voie de Saint-Florentin sans la recommander par défaut | 60 min, réglage dans Réglages |
| D4 | Pour l'alerte de retard, le serveur ne reçoit que les trip_id GTFS, la date et un jeton push anonyme. Inngest lit le GTFS-RT, Expo Push notifie | Concilier « mes données restent sur mon téléphone » et « je suis prévenu d'un retard » (conflit signalé pendant l'interview) | Vérification à l'ouverture de l'app, pas d'alerte en v1 |
| D5 | Prix tirés de `data/tarifs.json` côté serveur : réseau, montant, URL officielle, date de lecture, réductions officielles (par exemple carte TRAIN Mobigo Solidaire −75 % sur les trains Mobigo). Dans Réglages, on coche ses cartes : le prix affiché est celui qu'on paiera, avec sa source. Sans fiche, « prix non publié ». Le taxi n'est jamais calculé | Les GTFS n'ont aucun tarif. La règle est « jamais estimé » | « Prix non publié » partout, taxi calculé sur le tarif préfectoral |
| D6 | Annuaire des taxis et du transport à la demande : Claude propose des candidats publics avec leur URL, Brainditech valide chaque fiche, et seules les fiches validées s'affichent | Un numéro périmé le jour J est inacceptable | Brainditech seul, Claude seul sans validation |
| D7 | Claude extrait seulement le texte du lieu, la date, l'heure, le sens et la marge. Le géocodeur intégré à MOTIS (OSM) renvoie les candidats. L'app demande une confirmation s'il y en a plusieurs | L'IA n'invente jamais de coordonnées, et aucun service n'est ajouté | MOTIS + Base Adresse Nationale, lieux enregistrés seulement |
| D8 | Dictée par le micro du clavier Android | Aucune dépendance ni permission | Bibliothèque de reconnaissance vocale avec bouton micro |
| D9 | Carte MapLibre dans l'écran Détail (arrêts, tracé de marche, « où attendre »), pack hors ligne de la zone du trajet à l'enregistrement, tuiles OpenFreeMap | Un débutant doit faire 2,8 km à pied, peut-être sans réseau | Pas de carte, carte partout avec pack Yonne |
| D10 | Consignes pour débutant et glossaire en gabarits fixes relus, remplis par les valeurs du moteur et des fiches. Claude n'écrit aucun texte d'étape | Aucune invention possible | Reformulation par Claude sous validateur |
| D11 | Départ du domicile par défaut, ou « depuis ma position » (GPS au premier plan, à la demande) | Usage réel hors domicile | Domicile seul |
| D12 | Rappels (veille, échéance de réservation, « partez dans N min ») par notifications locales | Fonctionnent hors ligne, rien ne part au serveur | Pas de rappel en v1 |
| D13 | Utilisateurs v1 : Brainditech et quelques proches, chacun avec l'APK et ses données sur son téléphone | Choix de Brainditech | Brainditech seul |
| D14 | Clé par appareil (expo-secure-store, empreintes listées côté serveur) et limites de débit par clé | API publique sans comptes : protéger les crédits Claude, pouvoir révoquer un appareil | Secret commun dans l'APK, limites seulement |
| D15 | Le modèle Claude le moins cher qui réussit le jeu de phrases, choisi par mesure. Plafond mensuel en euros dans `.env`. Au-delà, ou en cas de panne, formulaire de repli | Coût maîtrisé, la recherche marche sans IA | Pas de plafond avec alerte seulement |
| D16 | Dépôt GitHub privé avec Actions. Le test Joigny lance le vrai MOTIS sur les GTFS figés et un extrait OSM du couloir, figé dans `fixtures/` (sha256, date) | Test reproductible, fusion bloquée si la CI est rouge | OSM Geofabrik téléchargé à chaque CI, hook local |
| D17 | Marge de 10 min avant le rendez-vous par défaut, modifiable dans la phrase (« avec 20 min d'avance »), affichée dans le verdict | Arriver à la minute près n'est pas un succès | 0 min, 15 min fixe |
| D18 | Taxi de bout en bout parmi les possibilités : durée du routage voiture MOTIS (« durée de route estimée, hors attente »), « prix non publié », numéros validés, lien Uber pré-rempli | Montrer toutes les possibilités | Pas de taxi direct en v1 |
| D19 | Sentry sur l'app et le serveur : erreurs techniques, échecs d'ingestion et de MOTIS. Jamais de texte de demande, de lieu, de coordonnées ni de domicile (`sendDefaultPii` désactivé, nettoyage avant envoi, replay masqué) | Voir les plantages sans fuite | Serveur seulement |
| D20 | Ingestion nocturne : téléchargement, sha256, import MOTIS à part, contrôles (arrêt Brienon Mairie présent, couverture au-delà de J+30), bascule seulement si tout passe. Sinon on garde l'ancien jeu et une alerte Sentry part. L'app affiche « horaires du JJ/MM », avec un bandeau au-delà de 7 jours | Jamais d'horaires cassés en production | Ingestion hebdomadaire manuelle |
| D21 | Alerte si une course est supprimée, si un retard atteint 5 min, ou si une correspondance devient plus courte que la marche calculée | Utile sans bruit | Tout retard d'au moins 1 min, seulement trajet cassé |
| D22 | Distribution par build local (`npx expo run:android --variant release`), APK envoyé à la main. Projet Firebase (FCM) et compte Expo (Expo Push) conservés. Clé de signature release créée une seule fois, hors git (`*.jks` déjà ignoré), sauvegardée hors du PC : sa perte empêche toute mise à jour | Pas de quota EAS. Brainditech garde la main sur la signature | EAS Build « preview » |
| D23 | « Terminé v1 » : test Joigny vert en CI, parcours réel sur le téléphone, serveur sur VPS, alerte de retard reçue. Brainditech ajoute : binaire release signé, aucun secret dans l'APK, Sentry vérifié et propre (replay masqué), refus de `.env` testé, au moins une fiche tarifaire et une fiche taxi validées, VPS étiqueté avec retour arrière essayé | Définition vérifiable | — |
| D24 | Maquettes avant la phase 0, hors phases : prompt d'image écrit à partir de PLAN.md, planche des écrans, design system (couleurs, polices, composants), logo, puis chaque écran principal agrandi. Rangées et versionnées dans `design/`, validées par Brainditech. Inspiration : frise de Transit et accueil de SNCF Connect, avec notre propre identité, jamais leurs logos ni leurs couleurs | Construire contre une cible visuelle validée | Coder sans maquette |
| D25 | Ordre des phases : socle (dont MOTIS et le test Joigny), puis une phase par écran dans l'ordre où un nouvel utilisateur les vit (Accueil → Confirmation du lieu → Résultat → Détail → Mes trajets → Réglages). Chaque service est branché dans la phase de l'écran qui en a besoin. Ensuite : temps réel et alertes → ingestion nocturne → surveillance et sécurisation → déploiement VPS → Terminé v1 | Rien n'est installé avant d'être utile | Phases par couche technique |
| D26 | Chaque écran est d'abord construit avec des valeurs en dur et comparé à sa maquette, puis branché. Une fonctionnalité = une branche = une PR relue par l'outil de revue. Chaque remarque est vérifiée contre le code actuel, jamais « Apply suggestion » ni « Autofix ». Aucune fusion avec une remarque majeure ignorée ni une CI rouge | Séparer le visuel des données, qualité de la revue | — |
| D27 | Brainditech crée le dépôt lui-même juste après l'approbation du plan. Le tout premier commit (projet créé, recherches, `PLAN.md`, `docs/ETAT.md`, `docs/decisions/`, `docs/architecture.md`) se fait directement sur `main` : c'est le seul commit sans branche | Pas de branche possible sans dépôt | Branche `docs/cadrage-v1`, création du dépôt dans la phase 0 |
| D28 | Bibliothèque de style : NativeWind (Tailwind), avec les jetons tirés du design system de `design/`. Compatibilité SDK 58 / RN 0.88.1 à vérifier à l'installation | Choix de Brainditech, déjà pratiqué dans Tripagent (4.2.7, SDK 57) | StyleSheet + jetons TS, Unistyles |
| D29 | Sécurisation du serveur dans la phase 9 : `/health`, journaux sans donnée personnelle, Zod sur chaque entrée, en-têtes HTTP de sécurité, secrets lus seulement dans l'environnement (refus de démarrer sans eux), limite de débit et plafond sur toute route Claude, conteneurs sans root avec healthcheck, dev et prod séparés, erreur volontaire vue dans Sentry puis retirée, replay masqué | Une API publique doit refuser par défaut | — |
| D30 | **Proposée, en attente de validation des maquettes par Brainditech.** Identité visuelle : mode clair d'abord ; palette indigo #3730A3 avec une couleur par mode (train #1F5FA8, car #7B3FA0, transport à la demande #0E7472, marche #5B6170, taxi #2E2E38) et par état (à l'heure #15803D, retard #B45309, supprimé #B91C1C, horaire prévu sans suivi en direct #3F4654, prix non publié en contour pointillé) ; police Inter avec chiffres tabulaires. Détail et contrastes dans `design/prompt.md` | Lisibilité pour un débutant ; contraste AA mesuré le 2026-11-02 (texte ≥ 4,5:1) | Mode sombre d'abord ; couleurs reprises des concurrents (SNCF Connect, Transit, Mobigo) |

## Hypothèses (pas de réponse ferme, à confirmer ou corriger)

- **A1** : interface en français seulement.
- **A2** : accessibilité = texte agrandissable par le système, libellés TalkBack, contraste AA.
- **A3** : stockage local avec expo-sqlite.
- **A4** : serveur en Node 22 LTS, TypeScript et Zod. Le framework HTTP est choisi dans la spec de la phase 0.
- **A5** : tests avec vitest. Le domaine est en TypeScript pur, testable sous Node.
- **A6** : pas de guidage pas-à-pas en cours de trajet.
- **A7** : un trajet enregistré est un instantané complet, rafraîchi quand le réseau revient.
- **A8** : tuiles OpenFreeMap (conditions et attribution OSM à vérifier).
- **A9** : Uber par lien profond seulement (`setPickup`, sans prix ni attente).
- **A10** : Inngest auto-hébergé en production (licence SSPL du serveur et mode de stockage à vérifier).
- **A11** : HTTPS sur le VPS par un nom de domaine et un certificat automatique (Android refuse le HTTP en clair).
- **A12** : environnements dev (PC) et prod (VPS), séparés, sans préproduction.
- **A13** : OSM de production = extrait régional Geofabrik. Au-delà, le trajet s'arrête à la gare avec « suite hors périmètre ».
- **A14** : vitesse de marche par défaut de MOTIS.
- **A15** : fenêtre de recherche = jour demandé, jusqu'à l'heure du rendez-vous moins la marge.
- **A16** : jeu d'au moins 30 phrases, seuil de réussite 27/30 (repris de l'archive, E31).
- **A17** : le build local de release exige le SDK Android et un JDK sur le PC (en place pour Pécule, à revérifier). `android/` est régénéré par prebuild et ne se modifie jamais à la main : la signature passe par la configuration ou un plugin.
- **A18** : Brainditech lance le générateur d'images avec le prompt rédigé par Claude. Les images reviennent dans `design/`.
- **A19** : la clé d'appareil est générée par Brainditech et saisie une fois sur chaque téléphone (collage ou QR). Elle est stockée dans secure-store.
- **A20** : la table `abonnements_alerte` est dans un fichier SQLite sur un volume Docker.
- **A21** : les abonnements d'alerte sont purgés à J+1.

## Risques ouverts

Voir `PLAN.md` §9 (R1 à R13) : le risque et la phase où il se tranche.
