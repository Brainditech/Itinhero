import { z } from "zod";

import type { Candidat } from "./api";

// Domicile (D65) : gardé sur le téléphone seulement (table `reglages`), jamais sur le serveur (invariant 6).

export const schemaDomicile = z.object({
  libelle: z.string().min(1).max(200),
  detail: z.string().max(200).nullable(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type Domicile = z.infer<typeof schemaDomicile>;

/** Valeur lue en base ⇒ domicile, ou null si absente ou illisible (jamais à moitié). */
export function lireDomicile(texte: string | null | undefined): Domicile | null {
  if (!texte) return null;
  try {
    const lu = schemaDomicile.safeParse(JSON.parse(texte));
    return lu.success ? lu.data : null;
  } catch {
    return null;
  }
}

/** Candidat choisi dans Réglages ⇒ domicile. */
export function domicileDepuisCandidat(c: Candidat): Domicile {
  const detail = [c.commune, c.code_postal].filter((v): v is string => !!v).join(", ");
  return schemaDomicile.parse({ libelle: c.nom, detail: detail === "" ? null : detail, lat: c.lat, lon: c.lon });
}
