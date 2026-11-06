import { heureParis } from "../temps.js";

/**
 * Prix de Claude (spec 28, D106), en dollars par million de jetons, API Anthropic en direct.
 * Source : tableau des modèles de la skill officielle `claude-api` (mis en cache le 2026-10-06), lu le 2026-11-06 ;
 * à recontrôler sur https://platform.claude.com/docs/en/about-claude/pricing avant la mise en production.
 * Seuls les modèles dont le prix est connu ici sont acceptés dans `CLAUDE_MODEL` : sans prix, pas de compteur.
 */
export const PRIX_USD_PAR_MTOK = {
  "claude-opus-5-5": { entree: 4, sortie: 20 },
  "claude-sonnet-5-5": { entree: 2, sortie: 10 },
  "claude-haiku-5-5": { entree: 0.1, sortie: 0.5 },
  "claude-opus-5": { entree: 5, sortie: 25 },
  "claude-sonnet-5": { entree: 2, sortie: 10 },
} as const;

export type ModeleClaude = keyof typeof PRIX_USD_PAR_MTOK;
export const MODELES_CLAUDE = Object.keys(PRIX_USD_PAR_MTOK) as [ModeleClaude, ...ModeleClaude[]];

/** Jetons d'un appel (`usage` de la réponse). Les jetons écrits ou lus en cache sont comptés au prix plein d'entrée. */
export type Jetons = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/**
 * Coût d'un appel, en euros. Un dollar est compté pour un euro : le dollar vaut moins qu'un euro depuis
 * des années, donc le compteur surestime la dépense, jamais l'inverse (pas de taux de change à tenir à jour).
 */
export function coutEur(modele: ModeleClaude, j: Jetons): number {
  const prix = PRIX_USD_PAR_MTOK[modele];
  const entree = j.input_tokens + (j.cache_creation_input_tokens ?? 0) * 1.25 + (j.cache_read_input_tokens ?? 0);
  return (entree * prix.entree + j.output_tokens * prix.sortie) / 1_000_000;
}

/**
 * Compteur du mois en cours (mois de Paris), en mémoire. Un redémarrage le remet à zéro (D106) :
 * le serveur ne garde aucun fichier hormis `abonnements_alerte` (invariant 6) ; le dépassement possible
 * reste borné par `max_tokens` de chaque appel et par les limites de débit par clé.
 */
export class CompteurCout {
  private mois = "";
  private cumul = 0;

  constructor(
    readonly plafondEur: number,
    private readonly maintenant: () => Date = () => new Date(),
  ) {}

  private moisCourant(): string {
    const m = heureParis(this.maintenant()).jour.slice(0, 7);
    if (m !== this.mois) {
      this.mois = m;
      this.cumul = 0;
    }
    return m;
  }

  /** Le plafond est-il atteint ? Vérifié avant chaque appel à Claude. */
  atteint(): boolean {
    this.moisCourant();
    return this.cumul >= this.plafondEur;
  }

  ajouter(eur: number): void {
    this.moisCourant();
    this.cumul += eur;
  }

  /** Dépense du mois, en euros (pour les tests et `/health` plus tard ; jamais par demande). */
  depense(): number {
    this.moisCourant();
    return this.cumul;
  }
}
