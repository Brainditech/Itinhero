/**
 * Téléchargement des données nationales pour le MOTIS du PC (spec 08).
 * Usage (depuis serveur/) : npm run donnees:nationales [-- --reprendre]
 *   --reprendre : garde les zip déjà présents dans donnees/gtfs/ au lieu de les retélécharger.
 * Écrit dans ../donnees/ : gtfs/<étiquette>.zip, manifest.json, rejets.json, config.yml.
 * L'OSM (donnees/osm/*.osm.pbf) est téléchargé à part ; il est seulement relevé ici.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { schemaManifest, sha256Fichier } from "../manifest.js";
import { controlerGtfs } from "./controle.js";
import { choisirRessources, schemaListeJeux, type Ressource } from "./selection.js";

const API = "https://transport.data.gouv.fr/api/datasets";
const OSM_URL = "https://download.geofabrik.de/europe/";
const DOSSIER = path.resolve(process.env.DOSSIER_DONNEES ?? "../donnees");
const PARALLELE = 8;
const DELAI_MS = 10 * 60 * 1000;
const REPRENDRE = process.argv.includes("--reprendre");

type Charge = Ressource & { taille: number; sha256: string };
type Rejet = { etiquette: string; jeu: string; titre: string; url: string; raison: string };

function sha256(octets: Uint8Array): string {
  return createHash("sha256").update(octets).digest("hex");
}

async function obtenir(r: Ressource, chemin: string): Promise<Uint8Array> {
  if (REPRENDRE && existsSync(chemin)) return new Uint8Array(await readFile(chemin));
  const rep = await fetch(r.url, {
    redirect: "follow",
    signal: AbortSignal.timeout(DELAI_MS),
    headers: { "user-agent": "itinhero-donnees-nationales" },
  });
  if (!rep.ok) throw new Error(`HTTP ${rep.status}`);
  return new Uint8Array(await rep.arrayBuffer());
}

async function traiter(r: Ressource, charges: Charge[], rejets: Rejet[]): Promise<void> {
  const chemin = path.join(DOSSIER, "gtfs", `${r.etiquette}.zip`);
  const rejet = (raison: string) =>
    rejets.push({ etiquette: r.etiquette, jeu: r.jeu, titre: r.titre, url: r.url, raison });
  let octets: Uint8Array;
  try {
    octets = await obtenir(r, chemin);
  } catch (e) {
    rejet(`téléchargement : ${e instanceof Error ? e.message : String(e)}`);
    return;
  }
  let controle: ReturnType<typeof controlerGtfs>;
  try {
    controle = controlerGtfs(octets);
  } catch (e) {
    controle = { ok: false, raison: `contrôle impossible : ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!controle.ok) {
    rejet(controle.raison);
    return;
  }
  if (!REPRENDRE || !existsSync(chemin)) await writeFile(chemin, octets);
  charges.push({ ...r, taille: octets.byteLength, sha256: sha256(octets) });
}

async function parLots<T>(elements: T[], n: number, f: (e: T) => Promise<void>): Promise<void> {
  let i = 0;
  let faits = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < elements.length) {
        const e = elements[i++]!;
        await f(e);
        faits++;
        if (faits % 25 === 0) console.log(`  ${faits}/${elements.length}`);
      }
    }),
  );
}

function configMotis(charges: Charge[], osm: string): string {
  const jeux = charges
    .map((c) => `    ${c.etiquette}:  # ${c.jeu.slice(0, 60)}\n      path: /donnees/gtfs/${c.etiquette}.zip`)
    .join("\n");
  return `# Configuration MOTIS v2.11.4 nationale, générée par serveur/src/donnees/telecharger.ts (spec 08).
# Ne pas modifier à la main : relancer le script.
server:
  port: 8080
osm: /donnees/osm/${osm}
timetable:
  first_day: TODAY
  num_days: 90
  max_footpath_length: 50      # D42
  merge_dupes_intra_src: true
  merge_dupes_inter_src: true
  datasets:
${jeux}
street_routing: true
osr_footpath: true
geocoding: true
`;
}

async function principal(): Promise<void> {
  await mkdir(path.join(DOSSIER, "gtfs"), { recursive: true });
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const osms = (await readdir(path.join(DOSSIER, "osm"))).filter((f) => f.endsWith(".osm.pbf"));
  if (osms.length !== 1) throw new Error(`Un seul fichier .osm.pbf attendu dans donnees/osm, trouvé : ${osms.length}`);
  const osm = osms[0]!;

  console.log(`Liste des jeux : ${API}`);
  const rep = await fetch(API, { signal: AbortSignal.timeout(DELAI_MS) });
  if (!rep.ok) throw new Error(`API transport.data.gouv.fr : HTTP ${rep.status}`);
  const ressources = choisirRessources(schemaListeJeux.parse(await rep.json()));
  console.log(`${ressources.length} ressources GTFS principales à télécharger`);

  const charges: Charge[] = [];
  const rejets: Rejet[] = [];
  await parLots(ressources, PARALLELE, (r) => traiter(r, charges, rejets));
  charges.sort((a, b) => a.etiquette.localeCompare(b.etiquette));
  rejets.sort((a, b) => a.etiquette.localeCompare(b.etiquette));

  console.log(`sha256 de l'OSM ${osm}…`);
  const cheminOsm = path.join(DOSSIER, "osm", osm);
  const manifest = schemaManifest.parse({
    version: 1,
    fichiers: [
      ...charges.map((c) => ({
        jeu: c.etiquette,
        type: "gtfs",
        chemin: `gtfs/${c.etiquette}.zip`,
        url_source: c.url,
        licence: c.licence,
        date_telechargement: aujourdhui,
        feed_version: null,
        date_fichiers: c.miseAJour,
        taille: c.taille,
        sha256: c.sha256,
      })),
      {
        jeu: "osm",
        type: "osm",
        chemin: `osm/${osm}`,
        url_source: `${OSM_URL}${osm}`,
        licence: "ODbL",
        date_telechargement: aujourdhui,
        feed_version: null,
        date_fichiers: null,
        taille: (await stat(cheminOsm)).size,
        sha256: await sha256Fichier(cheminOsm),
      },
    ],
  });
  // Le schéma ne garde que les champs du manifeste ; le détail des jeux va à côté.
  const detail = charges.map(({ etiquette, jeu, titre, producteur, licence, miseAJour }) => ({
    etiquette,
    jeu,
    titre,
    producteur,
    licence,
    miseAJour,
  }));

  await writeFile(path.join(DOSSIER, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  await writeFile(path.join(DOSSIER, "jeux.json"), JSON.stringify(detail, null, 2) + "\n");
  await writeFile(path.join(DOSSIER, "rejets.json"), JSON.stringify(rejets, null, 2) + "\n");
  await writeFile(path.join(DOSSIER, "config.yml"), configMotis(charges, osm));
  const total = charges.reduce((s, c) => s + c.taille, 0);
  console.log(
    `${charges.length} jeux gardés (${(total / 1e6).toFixed(0)} Mo), ${rejets.length} écartés. ` +
      `Écrit : manifest.json, jeux.json, rejets.json, config.yml dans ${DOSSIER}`,
  );
}

principal().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
