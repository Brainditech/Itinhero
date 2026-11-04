import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import type { LieuOsm } from "../lieux/categories.js";

/**
 * `npm run donnees:lieux` (D61) : réduit `donnees/poi/poi.geojsonseq` (lieux d'OSM extraits par osmium,
 * commande dans le README) en `donnees/poi/lieux.json`, lu par l'API pour la recherche par catégorie.
 * Un lieu sans nom est écarté ; une surface est ramenée à la moyenne de son contour.
 */
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const ENTREE = path.join(RACINE, "donnees/poi/poi.geojsonseq");
const SORTIE = path.join(RACINE, "donnees/poi/lieux.json");

type Feature = {
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, string | undefined>;
};

export function point(g: Feature["geometry"]): [number, number] | null {
  if (g.type === "Point") return g.coordinates as [number, number];
  const anneau =
    g.type === "Polygon" ? (g.coordinates as number[][][])[0] : g.type === "MultiPolygon" ? (g.coordinates as number[][][][])[0]?.[0] : undefined;
  if (!anneau || anneau.length === 0) return null;
  let sx = 0;
  let sy = 0;
  for (const [x, y] of anneau) {
    sx += x ?? 0;
    sy += y ?? 0;
  }
  return [sx / anneau.length, sy / anneau.length];
}

export function reduire(f: Feature): LieuOsm | null {
  const p = f.properties;
  const nom = p.name?.trim();
  const k = p.amenity ?? p.healthcare ?? p.shop;
  const c = point(f.geometry);
  if (!nom || !k || !c) return null;
  const cuisines = p.cuisine?.split(";").map((x) => x.trim().toLowerCase()).filter(Boolean);
  return {
    n: nom,
    k,
    ...(cuisines?.length ? { c: cuisines } : {}),
    ...(p["addr:city"] ? { v: p["addr:city"] } : {}),
    la: Math.round(c[1] * 1e6) / 1e6,
    lo: Math.round(c[0] * 1e6) / 1e6,
  };
}

async function principal(): Promise<void> {
  const lieux: LieuOsm[] = [];
  const lignes = createInterface({ input: createReadStream(ENTREE, "utf8"), crlfDelay: Infinity });
  for await (const brute of lignes) {
    const ligne = brute.replace(/^\u001e/, "").trim();
    if (!ligne) continue;
    const l = reduire(JSON.parse(ligne) as Feature);
    if (l) lieux.push(l);
  }
  await writeFile(SORTIE, JSON.stringify(lieux));
  console.log(`${lieux.length} lieux écrits dans ${SORTIE}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await principal();
