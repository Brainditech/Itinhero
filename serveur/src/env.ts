import { z } from "zod";

/**
 * Variables d'environnement du serveur (PLAN §3, invariant 11).
 * Règle 6 : une variable n'entre ici que dans la phase qui l'utilise.
 * Spec 04 : MOTIS_URL. Spec 09 : CLES_APPAREILS, LIMITE_REQ_MINUTE, LIMITE_REQ_JOUR (D55, D56).
 * Issue 0010 : HORAIRES_GTFS (D69).
 */
const empreinte = z.string().regex(/^[0-9a-f]{64}$/);

const schemaEnv = z
  .object({
    MOTIS_URL: z.url({ protocol: /^https?$/ }),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    // Empreintes sha256 (hexadécimal minuscule) des clés d'appareil, séparées par des virgules (D55).
    CLES_APPAREILS: z
      .string()
      .transform((s) => s.split(",").map((x) => x.trim()))
      .pipe(z.array(empreinte).min(1))
      .refine((l) => new Set(l).size === l.length, "doublon"),
    LIMITE_REQ_MINUTE: z.coerce.number().int().min(1),
    LIMITE_REQ_JOUR: z.coerce.number().int().min(1),
    // Facultative (D61) : chemin de `lieux.json` (recherche par catégorie). Absente ⇒ pas de catégorie.
    LIEUX_OSM: z.string().min(1).optional(),
    // Facultative (D69) : chemin de `horaires.json` (`npm run donnees:horaires`). Absente ⇒ réservations non signalées.
    HORAIRES_GTFS: z.string().min(1).optional(),
  })
  .refine((e) => e.LIMITE_REQ_JOUR >= e.LIMITE_REQ_MINUTE, {
    path: ["LIMITE_REQ_JOUR"],
    message: "inférieure à la limite par minute",
  });

export type Env = z.infer<typeof schemaEnv>;

export class ErreurEnv extends Error {
  constructor(public readonly variables: string[]) {
    super(
      `Variables d'environnement absentes ou mal formées : ${variables.join(", ")}. ` +
        "Le serveur refuse de démarrer.",
    );
    this.name = "ErreurEnv";
  }
}

/** Lit l'environnement ; le message d'erreur nomme les variables sans jamais recopier leur valeur. */
export function lireEnv(source: Record<string, string | undefined>): Env {
  const resultat = schemaEnv.safeParse(source);
  if (!resultat.success) {
    const noms = [...new Set(resultat.error.issues.map((i) => String(i.path[0])))];
    throw new ErreurEnv(noms);
  }
  return resultat.data;
}
