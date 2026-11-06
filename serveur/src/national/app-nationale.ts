import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { empreinte, nouvelleCle } from "../acces/cle.js";
import { Limites } from "../acces/limites.js";
import { construireApp } from "../app.js";
import { lireManifest } from "../manifest.js";
import { moteurMotis, sondeMotis } from "../motis.js";
import { adresseIgn, geocodeurIgn } from "../lieux/ign-geocode.js";
import { chargerHoraires } from "../itineraires/horaires-gtfs.js";
import { chargerLieux } from "../lieux/charger.js";

/**
 * Application construite contre le MOTIS national du PC (spec 08), avec une clé jetable :
 * sert au test de régression (spec 09, §4.7) et aux comparaisons. Jamais en CI.
 */
export const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const MOTIS_URL = process.env.MOTIS_URL ?? "http://127.0.0.1:8080";

export async function appNationale() {
  if (!(await sondeMotis(MOTIS_URL, 5000)())) {
    throw new Error(
      `MOTIS injoignable à ${MOTIS_URL}. Lancer le stack national (docker-compose.national.yml, spec 08). ` +
        "Le test échoue au lieu d'être sauté.",
    );
  }
  const manifest = await lireManifest(path.join(RACINE, "donnees/manifest.json"));
  if (manifest.fichiers.filter((f) => f.type === "gtfs").length < 100) {
    throw new Error("donnees/manifest.json n'est pas le manifeste national (moins de 100 jeux).");
  }
  const cheminLieux = path.join(RACINE, "donnees/poi/lieux.json");
  const lieux = existsSync(cheminLieux) ? await chargerLieux(cheminLieux) : undefined;
  const cheminHoraires = path.join(RACINE, "donnees/horaires.json");
  if (!existsSync(cheminHoraires)) throw new Error("donnees/horaires.json absent : lancer `npm run donnees:horaires` (D69).");
  const horaires = await chargerHoraires(cheminHoraires);
  const cle = nouvelleCle();
  const app = construireApp({
    manifest,
    sonde: sondeMotis(MOTIS_URL),
    moteur: moteurMotis(MOTIS_URL),
    geocodeurIgn: geocodeurIgn(),
    adresseIgn: adresseIgn(),
    lieux,
    horaires,
    acces: { empreintes: [empreinte(cle)], limites: new Limites(100_000, 1_000_000) },
    fluxJournal: process.env.JOURNAL_NATIONAL ? { write: (l: string) => void (l.includes("\"level\":50") && process.stderr.write(l)) } : { write: () => {} },
  });
  return { app, entete: { authorization: `Bearer ${cle}` } };
}

export { distanceMetres } from "../lieux/distance.js";
