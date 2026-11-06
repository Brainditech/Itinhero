import { empreinte, nouvelleCle } from "./acces/cle.js";
import { Limites } from "./acces/limites.js";
import { construireApp, type Dependances } from "./app.js";
import type { Manifest } from "./manifest.js";
import type { Moteur } from "./motis.js";

/** Outils partagés par les tests de route (aucune valeur attendue ici). */
export const CLE_TEST = nouvelleCle();
export const ENTETE = { authorization: `Bearer ${CLE_TEST}` };

export const MANIFEST_TEST: Manifest = {
  version: 1,
  fichiers: [
    {
      jeu: "r84072",
      type: "gtfs",
      chemin: "gtfs/r84072.zip",
      url_source: "https://exemple.org/r84072.zip",
      licence: "lov2",
      date_telechargement: "2026-11-04",
      feed_version: null,
      date_fichiers: "2026-09-21",
      taille: 1,
      sha256: "a".repeat(64),
    },
    {
      jeu: "r83582",
      type: "gtfs",
      chemin: "gtfs/r83582.zip",
      url_source: "https://exemple.org/r83582.zip",
      licence: "odc-odbl",
      date_telechargement: "2026-11-04",
      feed_version: "2026-10-30",
      date_fichiers: "2026-10-30",
      taille: 1,
      sha256: "b".repeat(64),
    },
    {
      jeu: "r80742",
      type: "gtfs",
      chemin: "gtfs/r80742.zip",
      url_source: "https://exemple.org/r80742.zip",
      licence: "odc-odbl",
      date_telechargement: "2026-11-04",
      feed_version: null,
      date_fichiers: "2026-10-20",
      taille: 1,
      sha256: "c".repeat(64),
    },
    {
      jeu: "osm",
      type: "osm",
      chemin: "osm/france.osm.pbf",
      url_source: "https://exemple.org/france.osm.pbf",
      licence: "ODbL",
      date_telechargement: "2026-11-04",
      feed_version: null,
      date_fichiers: null,
      taille: 1,
      sha256: "d".repeat(64),
    },
  ],
};

export const moteurEnPanne: Moteur = {
  plan: () => Promise.reject(new Error("panne")),
  geocoder: () => Promise.reject(new Error("panne")),
};

export function appTest(d: Partial<Dependances> & { maintenant?: () => Date; parMinute?: number; parJour?: number } = {}) {
  return construireApp({
    manifest: d.manifest ?? MANIFEST_TEST,
    sonde: d.sonde ?? (async () => true),
    moteur: d.moteur ?? moteurEnPanne,
    acces: d.acces ?? {
      empreintes: [empreinte(CLE_TEST)],
      limites: new Limites(d.parMinute ?? 1000, d.parJour ?? 10_000, d.maintenant),
    },
    geocodeurIgn: d.geocodeurIgn,
    lieux: d.lieux,
    horaires: d.horaires,
    adresseIgn: d.adresseIgn,
    claude: d.claude,
    abonnements: d.abonnements,
    horloge: d.horloge,
    fluxJournal: d.fluxJournal ?? { write: () => {} },
  });
}
