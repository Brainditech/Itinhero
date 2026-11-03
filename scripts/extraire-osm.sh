#!/usr/bin/env bash
# Découpe une seule fois l'extrait OSM du couloir Brienon–Saint-Florentin–Joigny (D41, spec 04).
# Entrée : .cache/osm/bourgogne-261102.osm.pbf (Geofabrik, non versionné).
# Sortie : fixtures/osm/couloir-yonne-2026-11-02.osm.pbf (versionné) et son sha256.
# Ne relancez pas ce script pour « réparer » un sha256 (invariant 14).
set -euo pipefail
cd "$(dirname "$0")/.."

SOURCE_NOM=bourgogne-261102.osm.pbf
SOURCE_URL="https://download.geofabrik.de/europe/france/$SOURCE_NOM"
SORTIE=fixtures/osm/couloir-yonne-2026-11-02.osm.pbf
RECTANGLE=3.35,47.92,3.80,48.05   # lon min, lat min, lon max, lat max

mkdir -p .cache/osm fixtures/osm
if [ ! -f ".cache/osm/$SOURCE_NOM" ]; then
  curl -sSfL -o ".cache/osm/$SOURCE_NOM" "$SOURCE_URL"
  curl -sSfL -o ".cache/osm/$SOURCE_NOM.md5" "$SOURCE_URL.md5"
fi
(cd .cache/osm && md5sum -c "$SOURCE_NOM.md5")

docker build -q -t itinhero-osmium:bookworm-20261020 outils/osmium >/dev/null
docker run --rm \
  -v "$(pwd -W 2>/dev/null || pwd)/.cache/osm:/entree:ro" \
  -v "$(pwd -W 2>/dev/null || pwd)/fixtures/osm:/sortie" \
  itinhero-osmium:bookworm-20261020 \
  extract --bbox "$RECTANGLE" --strategy complete_ways --overwrite \
  --output "/sortie/$(basename "$SORTIE")" "/entree/$SOURCE_NOM"

docker run --rm itinhero-osmium:bookworm-20261020 --version | head -1
sha256sum ".cache/osm/$SOURCE_NOM" "$SORTIE"
