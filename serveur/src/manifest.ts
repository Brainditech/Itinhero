import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

/** Manifeste des fixtures figées (`fixtures/manifest.json`, spec 04, invariant 14). */
const schemaFichier = z.object({
  jeu: z.string().regex(/^[a-z0-9-]+$/, "pas de « _ » : MOTIS l'utilise comme séparateur"),
  type: z.enum(["gtfs", "osm"]),
  chemin: z.string().min(1),
  url_source: z.url(),
  licence: z.string().min(1),
  date_telechargement: z.iso.date(),
  feed_version: z.string().min(1).nullable(),
  date_fichiers: z.iso.date().nullable(),
  taille: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  origine: z
    .object({
      nom: z.string().min(1),
      taille: z.number().int().positive(),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
      decoupage: z.string().min(1),
    })
    .optional(),
});

export const schemaManifest = z.object({
  version: z.literal(1),
  fichiers: z.array(schemaFichier).min(1),
});

export type Manifest = z.infer<typeof schemaManifest>;

export async function lireManifest(cheminManifest: string): Promise<Manifest> {
  const brut: unknown = JSON.parse(await readFile(cheminManifest, "utf8"));
  return schemaManifest.parse(brut);
}

export function sha256Fichier(chemin: string): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const hash = createHash("sha256");
    createReadStream(chemin)
      .on("data", (morceau) => hash.update(morceau))
      .on("error", rejeter)
      .on("end", () => resoudre(hash.digest("hex")));
  });
}

export type Ecart = { chemin: string; attendu: string; trouve: string };

/** Recalcule le sha256 de chaque fichier ; renvoie la liste des écarts (vide si tout concorde). */
export async function verifierManifest(manifest: Manifest, dossier: string): Promise<Ecart[]> {
  const ecarts: Ecart[] = [];
  for (const f of manifest.fichiers) {
    const trouve = await sha256Fichier(path.join(dossier, f.chemin));
    if (trouve !== f.sha256) ecarts.push({ chemin: f.chemin, attendu: f.sha256, trouve });
  }
  return ecarts;
}
