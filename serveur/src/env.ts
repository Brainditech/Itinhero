import { z } from "zod";

/**
 * Variables d'environnement du serveur (PLAN §3, invariant 11).
 * Règle 6 : une variable n'entre ici que dans la phase qui l'utilise.
 * Phase 0 (spec 04) : MOTIS_URL seulement.
 */
const schemaEnv = z.object({
  MOTIS_URL: z.url({ protocol: /^https?$/ }),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
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
