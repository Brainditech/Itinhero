# Image d'outillage pour découper l'extrait OSM du couloir (D41, spec 04).
# Debian épinglée ; osmium-tool vient du dépôt Debian de cette version.
FROM debian:bookworm-20261020-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends osmium-tool \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home outil
USER outil
WORKDIR /travail
ENTRYPOINT ["osmium"]
