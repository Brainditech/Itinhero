import { createReadStream } from "node:fs";
import { parse } from "csv-parse";
import { Unzip, UnzipInflate } from "fflate";

/**
 * Lecture d'un GTFS zippé, en flux (spec 05, D43).
 * `stop_times.txt` SNCF fait 83 Mo décompressé : il n'est jamais chargé en entier,
 * seules les lignes retenues par `garder` restent en mémoire.
 */
export type Ligne = Record<string, string>;

export class ErreurTableAbsente extends Error {
  constructor(
    public readonly cheminZip: string,
    public readonly nom: string,
  ) {
    super(`${nom} absent de ${cheminZip}`);
    this.name = "ErreurTableAbsente";
  }
}

/** Lit `nom` dans le zip ; `null` si le fichier n'y est pas (ex. `calendar.txt` SNCF). */
export function lireTableFacultative(
  cheminZip: string,
  nom: string,
  garder: (ligne: Ligne) => boolean = () => true,
): Promise<Ligne[] | null> {
  return new Promise((resoudre, rejeter) => {
    const lignes: Ligne[] = [];
    let trouve = false;
    let fini = false;
    const echouer = (erreur: unknown) => {
      if (fini) return;
      fini = true;
      flux.destroy();
      analyseur.destroy();
      rejeter(erreur instanceof Error ? erreur : new Error(String(erreur)));
    };

    // BOM retiré, champs entre guillemets et fins de ligne \r\n gérés par csv-parse.
    const analyseur = parse({ columns: true, bom: true, skip_empty_lines: true });
    analyseur.on("readable", () => {
      let ligne: Ligne | null;
      while ((ligne = analyseur.read() as Ligne | null) !== null) {
        if (garder(ligne)) lignes.push(ligne);
      }
    });
    analyseur.on("error", echouer);
    analyseur.on("end", () => {
      if (fini) return;
      fini = true;
      resoudre(lignes);
    });
    analyseur.on("drain", () => flux.resume());

    const dezip = new Unzip((fichier) => {
      if (fichier.name !== nom) return; // les autres fichiers ne sont pas décompressés
      trouve = true;
      fichier.ondata = (erreur, morceau, dernier) => {
        if (erreur) return echouer(erreur);
        // Copie : fflate demande de ne pas garder son tampon.
        if (!analyseur.write(Buffer.from(morceau))) flux.pause();
        if (dernier) analyseur.end();
      };
      fichier.start();
    });
    dezip.register(UnzipInflate);

    const flux = createReadStream(cheminZip);
    flux.on("data", (morceau) => {
      try {
        dezip.push(morceau as Buffer);
      } catch (erreur) {
        echouer(erreur);
      }
    });
    flux.on("error", echouer);
    flux.on("end", () => {
      try {
        dezip.push(new Uint8Array(0), true);
      } catch (erreur) {
        return echouer(erreur);
      }
      if (!trouve && !fini) {
        fini = true;
        resoudre(null);
      }
    });
  });
}

/** Comme `lireTableFacultative`, mais un fichier absent est une erreur. */
export async function lireTable(
  cheminZip: string,
  nom: string,
  garder?: (ligne: Ligne) => boolean,
): Promise<Ligne[]> {
  const lignes = await lireTableFacultative(cheminZip, nom, garder);
  if (lignes === null) throw new ErreurTableAbsente(cheminZip, nom);
  return lignes;
}

/** Heure GTFS « HH:MM:SS » en minutes depuis minuit du jour de service ; peut dépasser 24:00. */
export function minutesGtfs(heure: string): number {
  const m = /^(\d{1,3}):([0-5]\d):([0-5]\d)$/.exec(heure.trim());
  if (!m) throw new Error(`heure GTFS illisible : « ${heure} »`);
  return Number(m[1]) * 60 + Number(m[2]);
}
