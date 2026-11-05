import type { Candidat, ResultatApi, Transport } from "./api";
import type { Bout, BoutLieu, CoteBout } from "./demande";

// Lieux suggérés pendant la frappe (spec 18, D90, D91) : pur TypeScript, testé sous Node.

/** Nombre de caractères tapés avant la première suggestion (D90). */
export const SUGGESTION_MIN = 3;
/** Attente après la dernière touche avant d'appeler `GET /v1/lieux` (D90). */
export const SUGGESTION_ATTENTE_MS = 350;
/** Nombre de lieux montrés sous le champ (D90). */
export const SUGGESTIONS_MAX = 5;

export const MESSAGES_SUGGESTIONS = {
  attente: "Recherche…",
  indisponibles: "Suggestions indisponibles pour l'instant.",
  choisir: "Choisissez le lieu dans la liste.",
  aucun: (texte: string) => `Aucun lieu trouvé pour « ${texte} ». Essayez avec la commune.`,
} as const;

/** Texte à suggérer pour un bout, ou null : seulement un texte tapé d'au moins 3 caractères (espaces de bord retirés). */
export function texteASuggerer(bout: Bout): string | null {
  if (bout.type !== "texte") return null;
  const t = bout.texte.trim();
  return t.length >= SUGGESTION_MIN ? t : null;
}

/** Candidat touché dans la liste ⇒ bout « lieu choisi » (D91). */
export function boutDuCandidat(c: Candidat): BoutLieu {
  return {
    type: "lieu",
    nom: c.nom,
    lat: c.lat,
    lon: c.lon,
    nature: c.type,
    commune: c.commune ?? null,
    code_postal: c.code_postal ?? null,
    ...(c.transport ? { transport: c.transport } : {}),
  };
}

/** Lieu choisi ⇒ candidat, sans distance (elle dépend de l'autre bout) : pour sa ligne de détail et son adresse. */
export function candidatDuBout(b: BoutLieu): Candidat {
  return {
    nom: b.nom,
    lat: b.lat,
    lon: b.lon,
    type: b.nature,
    commune: b.commune,
    code_postal: b.code_postal,
    ...(b.transport ? { transport: b.transport } : {}),
  };
}

// ——— Ce qu'est le lieu : icône et mot (spec 18, §12 ; D92) ———

/**
 * Icône d'une ligne de la liste : un nom Material Symbols (expo-symbols), ou « M », le signe du métro
 * (le pictogramme `subway` se confond avec le bus à 22 dp, constaté sur le téléphone le 2026-11-05).
 */
export type IconeLieu =
  | "M"
  | "train"
  | "tram"
  | "directions_bus"
  | "directions_boat"
  | "directions_transit"
  | "home_pin"
  | "location_on";

const ICONES_TRANSPORT: Record<Transport, IconeLieu> = {
  train: "train",
  metro: "M",
  tram: "tram",
  car: "directions_bus",
  bus: "directions_bus",
  bateau: "directions_boat",
};

const MOTS_TRANSPORT: Record<Transport, string> = {
  train: "Gare",
  metro: "Métro",
  tram: "Tram",
  car: "Arrêt de car",
  bus: "Arrêt de bus",
  bateau: "Embarcadère",
};

/** Icône d'un candidat : son transport s'il en a un, sinon sa nature. */
export function iconeCandidat(c: Pick<Candidat, "type" | "transport">): IconeLieu {
  if (c.transport) return ICONES_TRANSPORT[c.transport];
  return c.type === "arret" ? "directions_transit" : c.type === "adresse" ? "home_pin" : "location_on";
}

/** Mot qui dit ce qu'est le lieu (« Gare », « Métro », « Adresse »…) ; vide pour un lieu sans transport. */
export function natureLue(c: Pick<Candidat, "type" | "transport">): string {
  if (c.transport) return MOTS_TRANSPORT[c.transport];
  return c.type === "arret" ? "Arrêt" : c.type === "adresse" ? "Adresse" : "";
}

/** Ce que montre la liste sous un champ. */
export type EtatSuggestions =
  | { etat: "ferme" }
  | { etat: "attente"; candidats: Candidat[] }
  | { etat: "ok"; candidats: Candidat[] }
  | { etat: "vide"; texte: string }
  | { etat: "echec" };

/** Réponse de `GET /v1/lieux` ⇒ état de la liste (spec 18, §4.1). Tout échec, clé refusée comprise, se tait ici. */
export function etatSuggestions(resultat: ResultatApi<Candidat[]>, texte: string): EtatSuggestions {
  if (resultat.etat !== "ok") return { etat: "echec" };
  if (resultat.donnees.length === 0) return { etat: "vide", texte };
  return { etat: "ok", candidats: resultat.donnees.slice(0, SUGGESTIONS_MAX) };
}

/** Pendant l'attente d'une nouvelle réponse, la liste précédente reste affichée (pas de clignotement). */
export function enAttente(precedent: EtatSuggestions): EtatSuggestions {
  const candidats = precedent.etat === "ok" || precedent.etat === "attente" ? precedent.candidats : [];
  return { etat: "attente", candidats };
}

/** Phrase lue par TalkBack quand la liste change. */
export function annonceSuggestions(e: EtatSuggestions): string {
  switch (e.etat) {
    case "ok":
      return e.candidats.length === 1 ? "1 lieu proposé" : `${e.candidats.length} lieux proposés`;
    case "vide":
      return MESSAGES_SUGGESTIONS.aucun(e.texte);
    case "echec":
      return MESSAGES_SUGGESTIONS.indisponibles;
    default:
      return "";
  }
}

/**
 * Seule la réponse à la dernière demande compte (D90) : `nouvelle()` rend un numéro,
 * `estDerniere(n)` dit si aucune demande n'a été faite depuis.
 */
export class Derniere {
  private n = 0;
  nouvelle(): number {
    this.n += 1;
    return this.n;
  }
  estDerniere(n: number): boolean {
    return n === this.n;
  }
  /** Oublie la demande en cours : sa réponse, quand elle arrivera, sera ignorée. */
  oublier(): void {
    this.n += 1;
  }
}

/**
 * Lieu retenu à « Chercher » pour un texte (D91) : il s'écrit dans son champ, si ce champ montre toujours
 * le texte cherché (une lettre changée entre-temps ⇒ rien, ce qu'on a tapé depuis n'est jamais écrasé).
 */
export function reporterLieu<T extends Record<CoteBout, Bout>>(champs: T, cote: CoteBout, texteCherche: string, lieu: BoutLieu): T {
  const actuel = champs[cote];
  if (actuel.type !== "texte" || actuel.texte.trim() !== texteCherche.trim()) return champs;
  return { ...champs, [cote]: lieu };
}
