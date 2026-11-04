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

/**
 * Garde, pour chaque jeu de transport public, ses ressources GTFS principales disponibles.
 * Écarte les ressources `other`, `update`, `api` (versions modifiées par des tiers,
 * mises à jour partielles, temps réel), indisponibles ou d'un autre format.
 */
export function choisirRessources(jeux: JeuTdg[]): Ressource[] {
  const choisies: Ressource[] = [];
  const vues = new Set<number>();
  for (const jeu of jeux) {
    if (jeu.type !== "public-transit") continue;
    for (const r of jeu.resources) {
      if (r.format !== "GTFS" || r.is_available !== true || r.type !== "main") continue;
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
