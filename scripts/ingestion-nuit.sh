#!/usr/bin/env bash
# Ingestion nocturne (spec 44, D125, phase 8). À lancer chaque nuit par cron sur le serveur (heure de Paris), par ex. :
#   15 3 * * * /srv/itinhero/scripts/ingestion-nuit.sh >> /srv/itinhero/ingestion.log 2>&1
#
# 1. `npm run donnees:nuit` prépare donnees-AAAA-MM-JJ à côté du dossier en service (jeu par jeu : l'ancien fichier est
#    gardé quand le nouveau échoue à ses contrôles ; le dossier en service n'est jamais touché).
# 2. MOTIS importe ce dossier dans un volume neuf, pendant que l'ancien MOTIS continue de répondre.
# 3. Bascule seulement si l'import a réussi : `donnees-actives.env` désigne le nouveau dossier et le nouveau volume, puis
#    `up -d`. Si /health ne revient pas à 200, retour au dossier et au volume d'avant (invariant 14).
# Les deux derniers dossiers et volumes sont gardés pour un retour en arrière à la main.
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RACINE"
# Revue : un nom par passage (date et heure), jamais celui en service, même relancé le même jour.
JOUR="$(TZ=Europe/Paris date +%F-%H%M)"
# Spec 52 (D136) : sur le VPS, ITINHERO_PROJET=itinhero-prod ajoute docker-compose.prod.yml ; sur le PC, le national.
PROJET="${ITINHERO_PROJET:-$(sed -n 's/^ITINHERO_PROJET=//p' .env 2>/dev/null | tail -1)}"
PROJET="${PROJET:-itinhero-national}"
COMPOSE=(docker compose --env-file .env --env-file donnees-actives.env -p "$PROJET" -f docker-compose.yml -f docker-compose.national.yml)
if [ "$PROJET" = "itinhero-prod" ]; then COMPOSE+=(-f docker-compose.prod.yml); fi
MOTIS_IMAGE="ghcr.io/motis-project/motis:2.11.4"

touch donnees-actives.env
# shellcheck disable=SC1091
source donnees-actives.env
ACTUEL="${DONNEES:-./donnees}"
VOLUME_ACTUEL="${MOTIS_DONNEES:-${PROJET}_motis-data}"
NOUVEAU="./donnees-$JOUR"
VOLUME_NOUVEAU="itinhero-motis-$JOUR"
if [ "$NOUVEAU" = "$ACTUEL" ] || [ -e "$NOUVEAU" ] || docker volume inspect "$VOLUME_NOUVEAU" >/dev/null 2>&1; then
  echo "$(date -Is) $NOUVEAU ou $VOLUME_NOUVEAU existe déjà : rien n'est fait" >&2
  exit 1
fi

echo "$(date -Is) ingestion : $ACTUEL ⇒ $NOUVEAU"
(cd serveur && npm run --silent donnees:nuit -- "../$ACTUEL" "../$NOUVEAU")
# Les lieux d'OSM (D61) ne changent pas la nuit : même dossier.
mkdir -p "$NOUVEAU/poi" && cp -n "$ACTUEL/poi/lieux.json" "$NOUVEAU/poi/lieux.json" 2>/dev/null || true

echo "$(date -Is) import MOTIS dans $VOLUME_NOUVEAU"
if ! docker run --rm -v "$RACINE/${NOUVEAU#./}:/donnees:ro" -v "$VOLUME_NOUVEAU:/data" "$MOTIS_IMAGE" \
  /motis import -c /donnees/config.yml -d /data; then
  echo "$(date -Is) import échoué : on reste sur $ACTUEL" >&2
  docker volume rm "$VOLUME_NOUVEAU" >/dev/null 2>&1 || true
  rm -rf "$NOUVEAU"
  exit 1
fi

basculer() {
  # PRECEDENT_* : ce qu'il faut garder pour revenir en arrière à la main.
  printf 'DONNEES=%s\nMOTIS_DONNEES=%s\nPRECEDENT_DONNEES=%s\nPRECEDENT_MOTIS=%s\n' "$1" "$2" "$3" "$4" > donnees-actives.env
  "${COMPOSE[@]}" up -d --no-build motis api
}

attendre_sante() {
  for _ in $(seq 1 120); do
    if [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/health)" = "200" ]; then return 0; fi
    sleep 10
  done
  return 1
}

basculer "$NOUVEAU" "$VOLUME_NOUVEAU" "$ACTUEL" "$VOLUME_ACTUEL"
if attendre_sante; then
  echo "$(date -Is) bascule faite : $NOUVEAU, $VOLUME_NOUVEAU"
else
  echo "$(date -Is) /health en échec après bascule : retour à $ACTUEL" >&2
  basculer "$ACTUEL" "$VOLUME_ACTUEL" "${PRECEDENT_DONNEES:-}" "${PRECEDENT_MOTIS:-}"
  attendre_sante || echo "$(date -Is) l'ancien ne répond pas non plus : intervention nécessaire" >&2
  exit 1
fi

# Ménage : on garde le dossier et le volume en service et ceux d'avant (retour en arrière) ; le reste part.
for d in donnees-20??-??-*; do
  [ -d "$d" ] || continue
  case "./$d" in "$NOUVEAU" | "$ACTUEL") continue ;; esac
  rm -rf "$d"
done
for v in $(docker volume ls --format '{{.Name}}' | grep '^itinhero-motis-20' || true); do
  [ "$v" = "$VOLUME_NOUVEAU" ] || [ "$v" = "$VOLUME_ACTUEL" ] || docker volume rm "$v" || true
done
