import { z } from "zod";
import { MODELES_CLAUDE } from "./comprendre/cout.js";

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
    // Spec 28 (D106) : Claude, toutes les trois ou aucune. Absentes ⇒ `/v1/comprendre` répond 503 et l'app
    // passe au formulaire ; une seule ou deux ⇒ le serveur refuse de démarrer.
    ANTHROPIC_API_KEY: z.string().regex(/^sk-ant-[A-Za-z0-9_-]{20,}$/).optional(),
    CLAUDE_MODEL: z.enum(MODELES_CLAUDE).optional(),
    CLAUDE_PLAFOND_MENSUEL_EUR: z.coerce.number().positive().max(1000).optional(),
    // Spec 29 (D107) : fichier SQLite de `abonnements_alerte`, sur un volume. Absente ⇒ table en mémoire.
    ABONNEMENTS_SQLITE: z.string().min(1).optional(),
  })
  .refine((e) => e.LIMITE_REQ_JOUR >= e.LIMITE_REQ_MINUTE, {
    path: ["LIMITE_REQ_JOUR"],
    message: "inférieure à la limite par minute",
  })
  .superRefine((e, ctx) => {
    const claude = ["ANTHROPIC_API_KEY", "CLAUDE_MODEL", "CLAUDE_PLAFOND_MENSUEL_EUR"] as const;
    const presentes = claude.filter((n) => e[n] !== undefined);
    if (presentes.length > 0 && presentes.length < claude.length) {
      for (const n of claude) if (e[n] === undefined) ctx.addIssue({ code: "custom", path: [n], message: "absente alors que Claude est configuré" });
    }
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
  // Une variable vide (`${X:-}` du compose) vaut une variable absente.
  const resultat = schemaEnv.safeParse(Object.fromEntries(Object.entries(source).filter(([, v]) => v !== "")));
  if (!resultat.success) {
    const noms = [...new Set(resultat.error.issues.map((i) => String(i.path[0])))];
    throw new ErreurEnv(noms);
  }
  return resultat.data;
}
