import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configMotis } from "./config-motis.js";

/** `npm run donnees:config` (spec 42) : réécrit donnees/config.yml depuis jeux.json, sans rien retélécharger. */
const DOSSIER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../donnees");

async function principal(): Promise<void> {
  const jeux = JSON.parse(await readFile(path.join(DOSSIER, "jeux.json"), "utf8")) as { etiquette: string; jeu: string }[];
  const osms = (await readdir(path.join(DOSSIER, "osm"))).filter((f) => f.endsWith(".osm.pbf"));
  if (osms.length !== 1) throw new Error(`Un seul fichier .osm.pbf attendu dans donnees/osm, trouvé : ${osms.length}`);
  await writeFile(path.join(DOSSIER, "config.yml"), configMotis(jeux, osms[0]!));
  console.log(`config.yml réécrite : ${jeux.length} jeux.`);
}

principal().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
