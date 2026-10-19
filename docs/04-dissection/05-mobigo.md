# Dissection — Mobigo Bourgogne-Franche-Comté (app + viamobigo.fr)

> kodivine-documentaliste · relevé le 2026-10-19 · captures dans `captures/` (index : `captures/SOURCES.md`).
> Fiche App Store FR id1127428347 : version 5.8.83 du **2026-06-25** (l'année manquait au relevé du
> chercheur, volet A §A9 : elle est 2026 selon `currentVersionReleaseDate`), note 4,15/5 sur 962 notes
> (source: https://itunes.apple.com/lookup?id=1127428347&country=fr, relevé le 2026-10-19).
> Concurrent le plus proche selon le chercheur. **L'app n'a pas été installée** ; le calculateur du
> site viamobigo.fr a été interrogé sur les deux scénarios (captures « CONSTAT »). Que l'app et le site
> partagent le même moteur n'est pas vérifié.

## Modèle mental

L'utilisateur croit manipuler **un guichet régional** : chercher un itinéraire, puis acheter et
présenter un titre (6 des 9 captures du store parlent de titres, panier, paiement, contrôle). Le
trajet est un moyen d'arriver au titre (captures store, `mobigo-accueil-2026-10-19.jpg`).

## Organisation spatiale (écran par écran)

| Écran | Ce qui est où | Ce qui est masqué | Capture |
|---|---|---|---|
| Accueil | carte des arrêts ; panneau avec onglets Itinéraires / Horaires ; champ « D'où partez-vous ? » ; raccourcis de modes ; barre Accueil / Infos / Favoris / Ma conso / Compte | — | `mobigo-accueil-2026-10-19.jpg` |
| Résultats (train) | départ / arrivée ; « Partir maintenant – Modifier » ; lignes « 12h09 › 13h14 », durée, « TRAIN MOBIGO », prix 18,00 € | correspondances | `mobigo-itineraires-train-2026-10-19.png` |
| Résultats multimodaux | « Niveaux d'affluence » (3 pastilles) ; « En transports en commun » ; cartes : plage horaire, pastilles de lignes, opérateur, « Départ de : Gare SNCF Sévigné < 1 min » | — | `mobigo-itineraire-multimodal-2026-10-19.jpg` |
| Résultats web (cas réel) | onglets de modes avec durée : TC 3h49 · covoiturage « - » · vélo 1h19 · voiture 41min ; titre « Résultats en 100 % marche » ; carte 6h10 – 10h00, pictogramme marche, CO2, « n/c » ; lien « Élargissez vos critères » | — | `mobigo-web-brienon-joigny-arrivee-10h-2026-10-19.png` |
| Hors périmètre | Brienon → Paris : message rouge sous le champ « Le lieu sélectionné n'est pas géolocalisé ou il est hors du périmètre de l'application » | — | `mobigo-web-brienon-paris-hors-perimetre-2026-10-19.png` |
| Détail d'un trajet (frise) | ⬜ NON CAPTURÉE | | |
| Guidage en cours de trajet | ⬜ NON CAPTURÉE — aucune capture du store ne le montre | | |
| Départs à un arrêt | nom de l'arrêt + favori ; ligne et direction ; « Ajouter un signalement – Partagez les conditions de transport » ; « Prochains passages » 3 / 16 / 28 min ; **Premier passage 05h29 · Dernier passage 20h59** ; bouton « Acheter un titre » | temps réel : l'écran n'indique pas si les minutes sont réelles | `mobigo-arret-prochains-passages-2026-10-19.jpg` |
| Perturbations | onglet « Infos » avec pastille rouge (barre du bas) ; sur le web, bandeau rose de perturbations en haut de page | contenu non capturé | `mobigo-arret-prochains-passages-2026-10-19.jpg`, `mobigo-web-brienon-joigny-arrivee-10h-2026-10-19.png` |
| TAD / réservation | ⬜ NON CAPTURÉE — aucun écran TAD dans le store ni dans les résultats web du scénario | | |
| Hors ligne | ⬜ NON CAPTURÉE — non mentionné sur la fiche (chercheur §A9) | | |

## Geste principal

Sur viamobigo.fr : le formulaire porte De, Vers, Date (liste déroulante de dates), « Partir à /
Arriver à », heure, minute, profil voyageur, puis « Rechercher » (champs relevés dans le HTML du
formulaire `/fr/itineraires/4/JourneyPlanner` le 2026-10-19) — au minimum **8 interactions** avant le
résultat, plus l'autocomplétion. Dans l'app : ⬜ NON RÉSOLU.

## Ce qui la rend utilisable

- **Premier et dernier passage affichés à l'arrêt** (`mobigo-arret-prochains-passages-2026-10-19.jpg`) : en rural, savoir que le dernier car part à 20h59 vaut plus que les minutes du prochain.
- **Onglets de modes avec durée**, y compris voiture (41 min) : la comparaison est sous les yeux (`mobigo-web-brienon-joigny-arrivee-10h-2026-10-19.png`).
- **Le périmètre est dit** quand la destination sort de la région (`mobigo-web-brienon-paris-hors-perimetre-2026-10-19.png`) — refus explicite plutôt que résultat faux.

## Ce qui la rend pénible

- **Constat propre, 2026-10-19** : pour arriver à Joigny à 10:00 le jeudi 12/11, l'onglet **transports en commun** (pictogramme bus, « 3h49 ») contient une seule réponse : **3 h 49 de marche** (6h10 → 10h00). Le covoiturage affiche « - ». Aucune mention de la 856 sur réservation, aucun taxi (`mobigo-web-brienon-joigny-arrivee-10h-2026-10-19.png`). La voie publique qui existe (car TER 06:27 → Saint-Florentin-Ville, environ 2,8 km à pied, train 08:50 → 09:09 Joigny ; voir `07-constats-scenarios.md`) n'est pas trouvée.
- **Constat propre** : Brienon → Paris est refusé (« hors du périmètre ») alors que le car TER de 06:27 et le train de Troyes existent (voir `07-constats-scenarios.md`).
- Avis datés (source : https://itunes.apple.com/fr/rss/customerreviews/page=1/id=1127428347/sortby=mostrecent/json, relevé le 2026-10-19) :
  - 2026-10-10, 1★ : « bug tout le temps. Impossible de se connecter impossible d'acheter des titres ».
  - 2026-08-02, 1★ : « mauvais calcul d'itinéraire » ; « codé il y a 15 ans ».
  - 2026-06-23, 3★ : demande d'inclure « les horaires de toute la semaine ».
  - 2025-03-28, 3★ : plans de ligne introuvables dans l'app.
  - 2024-09-05, 1★ : « Les TAD on peut réserver avant 17h00 mais à 16h45 trop tard » — affirmation d'utilisateur sur le délai de réservation TAD, **non vérifiée** (le délai reste ⬜ au volet B du chercheur).

## Ce qu'on emprunte / ce qu'on refuse

| Décision | Élément | Raison |
|---|---|---|
| **Emprunte** | Premier / dernier passage à l'arrêt | offre rurale rare : le dernier départ est l'information critique |
| **Emprunte** | Refus explicite quand la demande sort de ce qu'on sait calculer | même honnêteté pour « rien trouvé pour ce jour-là » quand c'est le cas |
| **Refuse** | Une marche de 3 h 49 rangée sous l'onglet transports en commun | une réponse irréaliste n'est pas une réponse : MobiliteIA doit montrer la voie publique réelle (car + marche + train) ou dire qu'il n'y en a pas, puis les alternatives routières |
| **Refuse** | S'arrêter aux frontières régionales | le trajet Brienon → Paris est un besoin réel du brief |
| **Refuse** | Le titre de transport comme centre de l'app | le besoin est d'arriver à l'heure, pas d'acheter un titre |
| **Refuse** | Identité visuelle Mobigo (vert/orange, illustration de ville) | structures et gestes seulement |

## Trous

- ⬜ NON RÉSOLU — l'**app** Mobigo (et non le site) répond-elle autrement pour Brienon → Joigny ? App non installée.
- ⬜ NON RÉSOLU — l'app intègre-t-elle les taxis de l'Yonne et la réservation de la 856 ? Rien sur la fiche ni dans les résultats web.
