import { z } from "zod";

/**
 * Choix des GTFS à charger dans le MOTIS national (spec 08, D46, D54).
 * Source : https://transport.data.gouv.fr/api/datasets (liste de tous les jeux publiés).
 */

const schemaRessource = z.object({
  id: z.number().int(),
  format: z.string().nullable().optional(),
  is_available: z.boolean().nullable().optional(),
  type: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  url: z.string(),
  updated: z.string().nullable().optional(),
});

const schemaJeu = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  type: z.string(),
  licence: z.string().nullable().optional(),
  publisher: z.object({ name: z.string().nullable().optional() }).nullable().optional(),
  resources: z.array(schemaRessource),
});

export const schemaListeJeux = z.array(schemaJeu);
export type JeuTdg = z.infer<typeof schemaJeu>;

export type Ressource = {
  /** Étiquette MOTIS : préfixe des identifiants d'arrêts et de courses, sans « _ » (séparateur). */
  etiquette: string;
  jeu: string;
  titre: string;
  producteur: string | null;
  url: string;
  licence: string;
  miseAJour: string | null;
};

/** Étiquette MOTIS d'une ressource : `r<id>`. */
export function etiquette(idRessource: number): string {
  return `r${idRessource}`;
}

const estGtfsPrincipal = (r: JeuTdg["resources"][number]) =>
  r.format === "GTFS" && r.is_available === true && r.type === "main";

/** Un zip qui se présente comme un GTFS (titre ou adresse), publié sous un autre format (LiA : « zip »). */
const ressembleGtfs = (r: JeuTdg["resources"][number]) =>
  r.format === "GTFS" || (/^zip$/i.test(r.format ?? "") && /gtfs/i.test(`${r.title ?? ""} ${r.url}`));

const RANG_TYPE: Record<string, number> = { main: 0, other: 1, api: 2 };

/**
 * Repli (D59) : pour un jeu sans GTFS principal disponible, le meilleur GTFS disponible
 * (format GTFS d'abord, puis type main > other > api, puis une version non « modifiée » par un tiers).
 * Constaté le 2026-11-04 : sans ce repli, 34 réseaux manquaient, dont Lyon TCL (GTFS officiel
 * derrière un compte), BlaBlaCar Bus (type `api`), Le Havre LiA (format `zip`).
 */
export function choisirRepli(jeu: JeuTdg): JeuTdg["resources"][number] | null {
  const candidats = jeu.resources
    .filter((r) => r.is_available === true && ressembleGtfs(r) && (r.type ?? "") in RANG_TYPE)
    .sort(
      (a, b) =>
        Number(b.format === "GTFS") - Number(a.format === "GTFS") ||
        RANG_TYPE[a.type ?? ""]! - RANG_TYPE[b.type ?? ""]! ||
        Number(/modifi/i.test(a.title ?? "")) - Number(/modifi/i.test(b.title ?? "")) ||
        a.id - b.id,
    );
  return candidats[0] ?? null;
}

/**
 * Garde, pour chaque jeu de transport public, ses ressources GTFS principales disponibles ;
 * à défaut, une seule ressource de repli (D59). Les mises à jour partielles (`update`),
 * le temps réel et les autres formats ne sont jamais pris.
 */
export function choisirRessources(jeux: JeuTdg[]): Ressource[] {
  const choisies: Ressource[] = [];
  const vues = new Set<number>();
  for (const jeu of jeux) {
    if (jeu.type !== "public-transit") continue;
    const principales = jeu.resources.filter(estGtfsPrincipal);
    const repli = principales.length === 0 ? choisirRepli(jeu) : null;
    for (const r of repli ? [repli] : principales) {
      if (vues.has(r.id)) continue;
      vues.add(r.id);
      choisies.push({
        etiquette: etiquette(r.id),
        jeu: jeu.slug,
        titre: (r.title ?? "").trim(),
        producteur: jeu.publisher?.name ?? null,
        url: r.url,
        licence: jeu.licence ?? "notspecified",
        miseAJour: r.updated ? r.updated.slice(0, 10) : null,
      });
    }
  }
  return choisies;
}
