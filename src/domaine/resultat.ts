import type { Candidat, Etape, Possibilite, ReponseItineraires } from "./api";
import type { Demande } from "./demande";

// Ce qu'affichent la Confirmation et le Résultat (spec 10, §4.1). Tout vient de la réponse de l'API :
// l'app ne calcule aucune heure (invariant 3 par extension : rien d'inventé côté client).

const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

/** « 2026-11-12 » ⇒ « Jeudi 12/11 », sans fuseau (R11). */
export function jourCourt(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const jour = JOURS[new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()];
  return `${jour} ${m[3]}/${m[2]}`;
}

export type Depart = "domicile" | "position";

/** Sous-titre de la Confirmation : « Jeudi 12/11 · arriver avant 10:00 · marge 10 min · depuis Domicile ». */
export function sousTitreDemande(demande: Demande, depart: Depart): string {
  const morceaux = [jourCourt(demande.date)];
  if (demande.sens === "arriver_avant") {
    morceaux.push(`arriver avant ${demande.heure}`, demande.marge > 0 ? `marge ${demande.marge} min` : "sans marge");
  } else {
    morceaux.push(`partir à ${demande.heure}`);
  }
  morceaux.push(depart === "domicile" ? "depuis Domicile" : "depuis ma position");
  return morceaux.join(" · ");
}

/** Deuxième ligne d'un candidat : commune et code postal, puis la distance si le serveur la donne. */
export function detailCandidat(c: Candidat): string {
  const lieu = [c.commune, c.code_postal].filter((v): v is string => !!v).join(", ");
  const nature = c.type === "arret" ? "Arrêt" : c.type === "adresse" ? "Adresse" : "";
  const morceaux = [nature && lieu ? `${nature}, ${lieu}` : nature || lieu];
  if (c.distance_metres != null) morceaux.push(`à ${formaterDistance(c.distance_metres)}`);
  return morceaux.filter((m) => m !== "").join(" · ");
}

export function formaterDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  const km = metres / 1000;
  return km < 10 ? `${km.toFixed(1).replace(".", ",")} km` : `${Math.round(km)} km`;
}

// ——— Verdict ———

export type PhraseVerdict = { possible: boolean; titre: string; heureDepart: string | null; detail: string };

/**
 * Carte du verdict. « Impossible » ne montre aucune heure (invariant 13 : pas de changement de jour,
 * pas de trajet d'un autre jour proposé à la place).
 */
export function phraseVerdict(r: ReponseItineraires): PhraseVerdict {
  const premiere = r.possibilites[0];
  if (r.verdict === "impossible" || !premiere) {
    const quand = r.demande.sens === "arriver" ? `pour arriver avant ${r.demande.limite ?? r.demande.heure}` : `au départ de ${r.demande.heure}`;
    return {
      possible: false,
      titre: "Impossible",
      heureDepart: null,
      detail: `Aucun trajet ce jour-là ${quand}.`,
    };
  }
  let detail: string;
  if (r.demande.sens === "arriver") {
    const marge = r.demande.marge ?? 0;
    const precision = marge > 0 ? `rendez-vous ${r.demande.heure}, marge ${marge} min` : `rendez-vous ${r.demande.heure}, sans marge`;
    detail = `À faire : être sur place avant ${r.demande.limite ?? r.demande.heure} (${precision}). Arrivée prévue à ${premiere.arrivee}.`;
  } else {
    detail = `Arrivée prévue à ${premiere.arrivee}.`;
  }
  return { possible: true, titre: "Possible", heureDepart: premiere.depart, detail };
}

// ——— Étapes ———

/** Couleur d'un mode (D67) : jetons du design system seulement (invariant 20). */
export type JetonMode = "mode-train" | "mode-car" | "mode-tad" | "mode-marche" | "mode-taxi";

export function jetonMode(mode: string): JetonMode {
  switch (mode) {
    case "train":
    case "train_banlieue":
    case "metro":
    case "tram":
    case "remontee":
      return "mode-train";
    case "bus":
    case "car":
      return "mode-car";
    case "transport_a_la_demande":
      return "mode-tad";
    case "marche":
      return "mode-marche";
    default:
      return "mode-taxi";
  }
}

const NOMS_MODES: Record<string, string> = {
  train: "Train",
  metro: "Métro",
  tram: "Tram",
  bus: "Bus",
  car: "Car",
  transport_a_la_demande: "Transport à la demande",
  bateau: "Bateau",
  remontee: "Funiculaire ou téléphérique",
};

/** « Métro 14 », « RER B », « Car K941 », « Marche 4 min ». */
export function libelleEtape(e: Etape): string {
  if (e.mode === "marche") return `Marche ${e.duree_minutes} min`;
  if (e.mode === "train_banlieue") {
    if (e.ligne && /^[A-E]$/.test(e.ligne)) return `RER ${e.ligne}`;
    return e.ligne ? `Train ${e.ligne}` : "Train de banlieue";
  }
  const nom = NOMS_MODES[e.mode] ?? "Transport";
  return e.ligne && e.mode !== "transport_a_la_demande" ? `${nom} ${e.ligne}` : nom;
}

/** Résumé d'une possibilité : « Marche 4 min · Métro 14 · Marche 3 min ». */
export function resumePossibilite(p: Possibilite): string {
  return p.etapes.map(libelleEtape).join(" · ");
}

export const MARCHE_LONGUE_MIN = 15;

/** D3 : avertir quand une marche dépasse 15 min (16 et plus). */
export function aMarcheLongue(p: Possibilite): boolean {
  return p.etapes.some((e) => e.mode === "marche" && e.duree_minutes > MARCHE_LONGUE_MIN);
}

/** Correspondances dites en mots. */
export function libelleCorrespondances(n: number): string {
  if (n === 0) return "Direct";
  return n === 1 ? "1 correspondance" : `${n} correspondances`;
}

export function formaterDuree(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/**
 * « Horaires du 29/10 » : la plus ancienne version des jeux GTFS utilisés par les possibilités montrées.
 * Une version qui n'est pas une date ISO est montrée telle quelle. Aucun jeu ⇒ null (rien à dire).
 */
export function dateHoraires(possibilites: Possibilite[]): string | null {
  const versions = possibilites.flatMap((p) => p.etapes.flatMap((e) => (e.source.type === "gtfs" ? [e.source.version] : [])));
  if (versions.length === 0) return null;
  const plusAncienne = [...versions].sort()[0]!;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(plusAncienne);
  return m ? `${m[3]}/${m[2]}` : plusAncienne;
}
