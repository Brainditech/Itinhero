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

---

# Mesure avec les données de toute la France (D46, D54, spec 08)

- **Date** : 2026-11-04, PC de Brainditech (Docker 29.9.2, 20 cœurs, 31 Gio alloués à Docker).
- **Statut** : mesure ; elle sert au choix du VPS (phase 10), elle ne le tranche pas.

## Ce qui est chargé

- MOTIS v2.11.4, configuration générée `donnees/config.yml` : `first_day: TODAY` (2026-11-04), `num_days: 90`, `merge_dupes_intra_src` et `merge_dupes_inter_src`, `street_routing`, `osr_footpath`, `geocoding`, `max_footpath_length: 50`.
- OSM : `france-261102.osm.pbf` de Geofabrik, 5 108 959 196 octets, md5 `582b04d62530fdf8d6b8a0da5a71fc86` (égal au md5 publié), sha256 `04e5444443f883cd39e00afa1176a5b37720275400f2326a73cced27c22d3684`.
- GTFS : 516 jeux de transport.data.gouv.fr (1 825 Mo), 10 écartés au contrôle avec leur raison. Liste, sha256 et licences : `docs/preuves/2026-11-04-donnees-nationales/`.

## Mesures

| Moment | Mémoire du conteneur | Méthode |
|---|---|---|
| Import, étapes de la carte (`osr` 1 min 50, `adr` 5 min 37) | 10,5 Gio au plus haut | `docker stats --no-stream` toutes les 10 s |
| Import, étapes des horaires et des marches (`tt` 2 min 30, `matches` 21 s, `osr_footpath` 6 min 11) | **15,6 Gio au plus haut** | idem |
| Au repos, après le démarrage (`healthy` en 19 s) | 7,0 Gio | `docker stats --no-stream` |
| Pendant 4 recherches nationales (0,2 à 1,5 s chacune) | 7,4 Gio | idem |
| Données importées (`/data`) | 16,6 Go sur disque (dont `tt_ext.bin` 5,1 Go, `tt.bin` 2,0 Go, `shapes_data.bin` 2,1 Go) | `du -sh /data` |

Durées tirées de `/data/timing.txt` (écrit par MOTIS). L'import complet, s'il est fait d'une traite, dure environ 15 min (la carte et les horaires se calculent en parallèle). Ici il a été fait en quatre fois : trois jeux refusés par MOTIS (§ spec 08, « Constats ») ont été ajoutés au contrôle, MOTIS gardant à chaque fois les étapes déjà faites.

## Conséquence pour le VPS (à trancher en phase 10)

- Le service seul tient dans environ 8 Gio ; l'import en demande environ 16. Un VPS de 16 Gio ne suffit pas si l'import nocturne (D20) tourne à côté du serveur en service : il faut soit 32 Gio, soit importer ailleurs (le PC) et copier `/data`.
- Disque : prévoir au moins 2 × 17 Go (jeu actif et jeu en cours d'import, D20) plus les sources (environ 7 Go).
