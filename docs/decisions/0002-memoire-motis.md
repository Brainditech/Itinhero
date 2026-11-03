# 0002 — Mémoire de MOTIS chargé avec les fixtures (R1)

- **Date** : 2026-11-03
- **Statut** : mesure (spec 04). Elle sert au choix du VPS (phase 10), elle ne le tranche pas.

## Ce qui est chargé

- MOTIS v2.11.4 (`ghcr.io/motis-project/motis:2.11.4`), configuration `motis/config.yml` : 120 jours d'horaires à partir du 2026-10-19, `street_routing`, `osr_footpath`, `geocoding`, `max_footpath_length=50` (D42).
- GTFS SNCF (`feed_version` 2026-10-18, 5,4 Mo) et Mobigo 89 (fichiers du 2026-09-21, 2,0 Mo), sha256 dans `fixtures/manifest.json`.
- OSM : extrait du couloir seulement (`fixtures/osm/couloir-yonne-2026-11-02.osm.pbf`, 4,5 Mo, D41).

## Mesures (PC de Brainditech : Docker 29.9.2, 20 cœurs, 31 Gio alloués à Docker)

| Moment | Mémoire du conteneur `motis` | Méthode |
|---|---|---|
| Au repos, juste après le démarrage | 64 à 75 Mio (RSS 75 376 kB, dont 60 116 kB anonymes et 15 260 kB de fichiers projetés) | `docker stats --no-stream` ; `/proc/1/status` dans le conteneur |
| Pendant 5 recherches Brienon → Joigny enchaînées | 117 Mio au plus haut | `docker stats --no-stream` pendant la boucle de `curl` |
| Données importées (`/data`) | 60,8 Mo sur disque | `du -sh /data` |
| API Itinhero (Node) au repos | 27 Mio | `docker stats --no-stream` |

Non mesuré : le pic pendant `motis import` (court, une fois par jeu).

## Limite de la mesure

L'OSM de production sera un extrait régional Geofabrik (A13), environ 200 Mo pour la Bourgogne au lieu de 4,5 Mo : la mémoire du routage piéton et du géocodage grandira avec lui. Avant de choisir le VPS (phase 10), il faut refaire cette mesure avec l'OSM de production et le GTFS national du jour.
