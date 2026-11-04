import { parse } from "csv-parse/sync";
import { strFromU8, unzipSync } from "fflate";

/** Fichiers sans lesquels MOTIS ne peut pas lire un GTFS (spec 08 §3). */
const OBLIGATOIRES = ["stops.txt", "routes.txt", "trips.txt", "stop_times.txt"] as const;

export type Controle = { ok: true } | { ok: false; raison: string };

/** Liste les noms des fichiers d'un zip sans les décompresser. */
export function nomsDuZip(octets: Uint8Array): string[] {
  const noms: string[] = [];
  unzipSync(octets, {
    filter: (f) => {
      noms.push(f.name);
      return false;
    },
  });
  return noms;
}

/** Vrai si un agency.txt présent a une ligne sans agency_timezone (MOTIS : « timezone not set »). */
function fuseauManquant(octets: Uint8Array): boolean {
  const f = unzipSync(octets, { filter: (x) => x.name === "agency.txt" })["agency.txt"];
  if (f === undefined) return false;
  const lignes = parse(strFromU8(f), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
  }) as Record<string, string>[];
  return lignes.length === 0 || lignes.some((l) => !(l.agency_timezone ?? "").trim());
}

function geojsonCommenceParBom(octets: Uint8Array): boolean {
  const f = unzipSync(octets, { filter: (x) => x.name === "locations.geojson" })["locations.geojson"];
  return f !== undefined && f[0] === 0xef && f[1] === 0xbb && f[2] === 0xbf;
}

/** Vrai si le fichier se lit en CSV sans tolérance sur les guillemets ni sur le nombre de colonnes. */
function csvStrictLisible(octets: Uint8Array, nom: string): boolean {
  const f = unzipSync(octets, { filter: (x) => x.name === nom })[nom];
  if (f === undefined) return true;
  try {
    parse(strFromU8(f), { bom: true, columns: true, skip_empty_lines: true });
    return true;
  } catch {
    return false;
  }
}

/** Contrôle d'un GTFS avant import : zip lisible, fichiers à la racine, fichiers obligatoires présents. */
export function controlerGtfs(octets: Uint8Array): Controle {
  let noms: string[];
  try {
    noms = nomsDuZip(octets);
  } catch {
    return { ok: false, raison: "zip illisible" };
  }
  const racine = new Set(noms.filter((n) => !n.includes("/")));
  const enSousDossier = noms.some((n) => n.includes("/") && n.endsWith("stop_times.txt"));
  const manquants = OBLIGATOIRES.filter((f) => !racine.has(f));
  if (manquants.length > 0) {
    return {
      ok: false,
      raison: enSousDossier
        ? "fichiers rangés dans un sous-dossier"
        : `fichiers manquants : ${manquants.join(", ")}`,
    };
  }
  if (!racine.has("calendar.txt") && !racine.has("calendar_dates.txt")) {
    return { ok: false, raison: "ni calendar.txt ni calendar_dates.txt" };
  }
  if (fuseauManquant(octets)) {
    // Constaté le 2026-11-04 : MOTIS refuse tout l'import. On ne devine pas le fuseau (horaires décalés).
    return { ok: false, raison: "agency_timezone absent dans agency.txt" };
  }
  if (!csvStrictLisible(octets, "routes.txt")) {
    // Constaté le 2026-11-04 (guillemet jamais refermé) : MOTIS perd l'agence de la ligne, « timezone not set ».
    return { ok: false, raison: "routes.txt mal formé (guillemets)" };
  }
  if (racine.has("locations.geojson") && geojsonCommenceParBom(octets)) {
    // Constaté le 2026-11-04 : MOTIS v2.11.4 refuse tout l'import (« syntax error [boost.json:1] »).
    return { ok: false, raison: "locations.geojson commence par un BOM UTF-8 (refusé par MOTIS)" };
  }
  return { ok: true };
}
