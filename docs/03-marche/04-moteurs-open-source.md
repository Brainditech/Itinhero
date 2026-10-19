# Volet D — Moteurs d'itinéraire open source

> Agent : kodivine-chercheur · relevé le 2026-10-19 via l'API GitHub publique (métadonnées de
> dépôt, dernière release, dernier commit), puis lecture des fichiers LICENSE quand GitHub
> affichait `NOASSERTION`. L'API GitHub non authentifiée (60 requêtes/heure) s'est épuisée en
> cours de relevé : le nombre de mainteneurs n'a pas pu être compté (trou déclaré en D4).

## Épreuve de l'amont

Le brief qualifie Navitia d'« open source ». Le mensonge subtil : **Hove a annoncé la
restriction de l'accès au code** et une « nouvelle version » propriétaire ; le dépôt reste public
et publie encore des releases en octobre 2026, mais la trajectoire déclarée de l'éditeur est la
fermeture. Deuxième piège : le besoin RAM « pour la France » n'est publié par **aucun** des trois
projets ; seul OpenTripPlanner donne des ordres de grandeur (Finlande, Allemagne).

## D1. OpenTripPlanner (OTP)

- Licence : **LGPL-3.0** ou ultérieure (GitHub affiche `NOASSERTION` ; le fichier LICENSE dit « GNU Lesser General Public License … version 3 ») (source: https://github.com/opentripplanner/OpenTripPlanner/blob/dev-2.x/LICENSE, vérifié le 2026-10-19).
- Dernière release **v2.10.0 du 2026-09-09** ; dernier commit le 2026-10-19 ; 2 760 étoiles ; non archivé (source: https://api.github.com/repos/opentripplanner/OpenTripPlanner, vérifié le 2026-10-19).
- Temps réel GTFS-RT : updaters `stop-time-updater` (TripUpdates en HTTP), `mqtt-gtfs-rt-updater` (TripUpdates en flux), `real-time-alerts`, `vehicle-positions` (source: https://docs.opentripplanner.org/en/latest/GTFS-RT-Config/, vérifié le 2026-10-19).
- Mémoire : « de moins d'un Go à plus de 100 Go » ; toutes les données disponibles de la **Finlande ≈ un peu plus de 10 Go**, l'**Allemagne ≈ 95 Go** (source: https://docs.opentripplanner.org/en/latest/System-Requirements/, vérifié le 2026-10-19).
- ⬜ NON RÉSOLU — RAM pour l'Yonne seule ou la BFC (GTFS SNCF + Mobigo + OSM BFC). Non publié ; se mesure en chargeant le graphe (c'est une mesure, pas une recherche).

## D2. Navitia

- Composants : Kraken (cœur C++), Jörmungandr (frontal Python), Ed (base PostgreSQL de binarisation) ; développement mené par Hove (ex-Kisio Digital, ex-CanalTP) (source: https://github.com/hove-io/navitia, vérifié le 2026-10-19).
- Licence **AGPL-3.0** (source: https://api.github.com/repos/hove-io/navitia, champ license.spdx_id, vérifié le 2026-10-19).
- Dernière release **v15.119.0 du 2026-10-05**, dernier commit le 2026-10-05, 457 étoiles, dépôt public non archivé (source: https://api.github.com/repos/hove-io/navitia, vérifié le 2026-10-19).
- Le README annonce : « nous avons pris la décision de limiter l'accès à notre code source. Cette décision se traduit par la fermeture progressive d'ici à fin septembre de nos répertoires sur Github », la version historique ouverte en 2014 « restera disponible », et l'offre freemium navitia.io « évoluera progressivement vers notre nouvelle version » (source: https://github.com/hove-io/navitia/blob/dev/readme.rst, vérifié le 2026-10-19).
- L'année de cette annonce n'est pas écrite dans le texte ; l'historique du fichier montre un commit « readme nouvelle politique » du 14/06/2023, qui en est probablement l'origine — inférence, non vérifiée par lecture du diff (source: https://github.com/hove-io/navitia/commits/dev/readme.rst, vérifié le 2026-10-19).
- **Incohérence signalée** : l'annonce de fermeture « d'ici fin septembre » coexiste avec un dépôt public publiant des releases jusqu'au 2026-10-05 (source: les deux URL ci-dessus, vérifiées le 2026-10-19).
- Modes de rabattement documentés : `walking`, `car`, `bike`, `bss`, `ridesharing`, `taxi` ; niveau « on demand transportation » (le voyageur doit appeler l'agence) ; le temps réel s'active par `data_freshness=realtime` (source: https://doc.navitia.io/, vérifié le 2026-10-19).
- ⬜ NON RÉSOLU — format temps réel accepté par Navitia auto-hébergé (GTFS-RT via un composant séparé ?) : le README ne le dit pas. Où chercher : section « Real time integration » de https://doc.navitia.io/.
- ⬜ NON RÉSOLU — RAM et coût d'hébergement de Navitia : non publiés.

## D3. MOTIS

- Licence **MIT** ; dernière release **v2.11.3 du 2026-09-10** ; dernier commit le 2026-10-12 ; 613 étoiles (source: https://api.github.com/repos/motis-project/motis, vérifié le 2026-10-19).
- Entrées statiques : GTFS et NeTEx, « including GTFS Flex and GTFS Fares v2 » ; temps réel : GTFS-RT, SIRI-ET, SIRI-SX, SIRI-FM, VDV 454 ; réseau piéton/routier depuis un fichier OSM `.pbf`, y compris le routage intérieur (indoor-routing) (source: https://github.com/motis-project/motis, vérifié le 2026-10-19).
- Le projet se dit « optimisé pour la haute performance avec une faible consommation mémoire », permettant des « planet-sized deployments on affordable hardware », et « charger un an d'horaires ne prend pas beaucoup plus de RAM qu'un mois » — affirmations du projet, sans chiffre (source: même page, vérifiée le 2026-10-19).
- Instance hébergée Transitous : couverture mondiale, usage **non commercial uniquement** (source: https://transitous.org/api/, vérifié le 2026-10-19).
- ⬜ NON RÉSOLU — RAM chiffrée de MOTIS pour une région ou la France. Où chercher : documentation de déploiement de Transitous, ou mesure locale.
- ⬜ NON RÉSOLU — Transitous intègre-t-il déjà le GTFS Mobigo 89 et le GTFS SNCF ? Où chercher : page « Sources » de transitous.org.

## D4. Maintenance comparée

| Moteur | Licence | Dernière release | Dernier commit | Mainteneurs |
|---|---|---|---|---|
| OpenTripPlanner | LGPL-3.0 | v2.10.0, 2026-09-09 | 2026-10-19 | ⬜ |
| Navitia | AGPL-3.0 (fermeture annoncée) | v15.119.0, 2026-10-05 | 2026-10-05 | ⬜ |
| MOTIS | MIT | v2.11.3, 2026-09-10 | 2026-10-12 | ⬜ |

(source: https://api.github.com/repos/opentripplanner/OpenTripPlanner, https://api.github.com/repos/hove-io/navitia, https://api.github.com/repos/motis-project/motis, vérifiés le 2026-10-19)

- ⬜ NON RÉSOLU — nombre de mainteneurs actifs (auteurs distincts sur 90 jours) des trois moteurs : l'API GitHub a répondu « rate limit exceeded » le 2026-10-19 à 17:24 UTC. Où chercher : `https://api.github.com/repos/<dépôt>/commits?since=…` avec un jeton, ou l'onglet Insights > Contributors.

## D5. Coût d'hébergement indicatif

- ⬜ NON RÉSOLU — aucun des trois projets ne publie un coût mensuel d'hébergement ; le seul repère publié est la machine `D8as v5` choisie par Digitransit pour OTP Finlande (source: https://docs.opentripplanner.org/en/latest/System-Requirements/, vérifié le 2026-10-19). Le prix de cette machine n'a pas été relevé. Où chercher : grille tarifaire Azure, ou mesure RAM réelle sur l'Yonne puis grille d'un hébergeur.
