import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lireManifest } from "../manifest.js";
import { lireHoraires } from "../itineraires/horaires-gtfs.js";

/**
 * `npm run donnees:horaires [manifeste] [sortie]` (D69) : lit les passages sur réservation et la fin de
 * validité de chaque GTFS du manifeste, et les écrit dans un fichier lu par l'API (`HORAIRES_GTFS`).
 * Par défaut : `donnees/manifest.json` ⇒ `donnees/horaires.json`. À relancer après chaque
 * `npm run donnees:nationales`.
 */
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

async function principal(): Promise<void> {
  const manifeste = path.resolve(process.argv[2] ?? path.join(RACINE, "donnees/manifest.json"));
  const sortie = path.resolve(process.argv[3] ?? path.join(path.dirname(manifeste), "horaires.json"));
  const manifest = await lireManifest(manifeste);
  const debut = Date.now();
  const fichier = await lireHoraires(manifest, path.dirname(manifeste), (jeu, e) =>
    console.error(`${jeu} : illisible (${e instanceof Error ? e.message : String(e)}), laissé de côté`),
  );
  // Issue 0025 : le nom du réseau (producteur du jeu sur transport.data.gouv.fr), quand `jeux.json` est là.
  try {
    const liste = JSON.parse(await readFile(path.join(path.dirname(manifeste), "jeux.json"), "utf8")) as {
      etiquette: string;
      producteur?: string;
    }[];
    for (const j of liste) {
      const h = fichier.jeux[j.etiquette];
      if (h && j.producteur?.trim()) h.nom = j.producteur.trim().slice(0, 120);
    }
  } catch {
    console.warn("jeux.json absent ou illisible : les réseaux restent sans nom.");
  }
  await writeFile(sortie, JSON.stringify(fichier));
  const jeux = Object.values(fichier.jeux);
  const courses = jeux.reduce((n, j) => n + Object.keys(j.reservations).length, 0);
  console.log(
    `${jeux.length} jeux lus en ${Math.round((Date.now() - debut) / 1000)} s ; ` +
      `${courses} courses avec au moins un arrêt sur réservation ; ${sortie}`,
  );
}

principal().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
