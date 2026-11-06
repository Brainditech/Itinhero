import { z } from "zod";

import { schemaReponseItineraires, type Point, type ReponseItineraires } from "./api";
import { maintenantAParis, schemaDemande, type Demande } from "./demande";
import { jourCourt, phraseVerdict } from "./resultat";

// Voyage enregistré (spec 22, D98) : la demande, ses deux lieux et la réponse entière du serveur, gardés sur le
// téléphone seulement (invariant 6). Relu tel quel, sans aucune heure recalculée (invariant 3 par extension).

const schemaLieuVoyage = z.object({
  point: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }),
  nom: z.string().min(1),
  adresse: z.string().nullable(),
});
/** Un bout du voyage : même forme que le lieu retenu par la recherche (`LieuChoisi`). */
export type LieuVoyage = z.infer<typeof schemaLieuVoyage>;

export const schemaVoyage = z.object({
  /** Instant de l'enregistrement, en ISO (UTC). */
  enregistre_le: z.string().datetime(),
  demande: schemaDemande,
  depart: schemaLieuVoyage,
  arrivee: schemaLieuVoyage,
  reponse: schemaReponseItineraires,
});
export type Voyage = z.infer<typeof schemaVoyage>;

/** Ce que la recherche en cours tient : les deux lieux peuvent manquer, la réponse aussi. */
export type RechercheAEnregistrer = {
  demande: Demande;
  depart: { lieu: LieuVoyage | null };
  arrivee: { lieu: LieuVoyage | null };
  reponse: ReponseItineraires | null;
};

/** Un voyage ne s'enregistre que si l'aller a au moins une possibilité (D98, §3.2). */
export function peutEnregistrer(reponse: ReponseItineraires | null | undefined): boolean {
  return !!reponse && reponse.possibilites.length > 0;
}

/** Point arrondi au mètre (5 décimales) : un écart de GPS sous le mètre ne fait pas un autre voyage. */
const auMetre = (p: Point) => [Math.round(p.lat * 1e5), Math.round(p.lon * 1e5)];

/** Même date, heure, sens, marge, fin de rendez-vous et mêmes points ⇒ même voyage (D98, §3.3). */
export function cleVoyage(demande: Demande, depart: LieuVoyage, arrivee: LieuVoyage): string {
  return JSON.stringify([
    demande.date,
    demande.heure,
    demande.sens,
    demande.marge,
    demande.retour ?? null,
    auMetre(depart.point),
    auMetre(arrivee.point),
  ]);
}

/** La recherche en cours ⇒ le voyage à enregistrer, ou null s'il n'y a rien à garder. */
export function voyageDepuisRecherche(r: RechercheAEnregistrer, maintenant: Date): Voyage | null {
  const depart = r.depart.lieu;
  const arrivee = r.arrivee.lieu;
  if (!depart || !arrivee || !r.reponse || !peutEnregistrer(r.reponse)) return null;
  return { enregistre_le: maintenant.toISOString(), demande: r.demande, depart, arrivee, reponse: r.reponse };
}

/** Texte lu en base ⇒ voyage, ou null s'il est absent ou illisible (jamais à moitié, D98 §3.7). */
export function lireVoyage(texte: string | null | undefined): Voyage | null {
  if (!texte) return null;
  try {
    const lu = schemaVoyage.safeParse(JSON.parse(texte));
    return lu.success ? lu.data : null;
  } catch {
    return null;
  }
}

/** « le 06/11 à 14:32 », à l'heure de Paris (R11). */
export function quandEnregistre(iso: string): string {
  const le = maintenantAParis(new Date(iso));
  const [, mois, jour] = le.date.split("-");
  return `le ${jour}/${mois} à ${le.heure}`;
}

/** Bandeau en haut du Résultat d'un voyage rouvert (D98, §3.5) : rien n'est en direct (invariant 12). */
export function bandeauVoyage(iso: string): string {
  return `Voyage enregistré ${quandEnregistre(iso)}. Horaires prévus, sans suivi en direct.`;
}

export type ResumeVoyage = {
  jour: string;
  depart: string | null;
  titre: string;
  retour: string | null;
  enregistre: string;
};

/** Lignes de la carte de Mes trajets (maquette 06) : toutes tirées du voyage, l'heure étant celle du verdict. */
export function resumeVoyage(v: Voyage): ResumeVoyage {
  const aller = phraseVerdict(v.reponse, "aller");
  let retour: string | null = null;
  if (v.reponse.retour) {
    const h = phraseVerdict(v.reponse.retour, "retour").heureDepart;
    retour = h ? `Retour : départ ${h}` : "Retour : aucun ce jour-là";
  }
  return {
    jour: jourCourt(v.demande.date),
    depart: aller.heureDepart ? `Départ ${aller.heureDepart}` : null,
    titre: `${v.depart.nom} → ${v.arrivee.nom}`,
    retour,
    enregistre: `Enregistré ${quandEnregistre(v.enregistre_le)}`,
  };
}

/** Clé de tri d'un voyage : son jour, puis son premier départ, puis l'heure demandée. */
function ordre(v: Voyage): string {
  const premier = v.reponse.possibilites.map((p) => p.depart_utc).sort()[0] ?? "";
  return `${v.demande.date} ${premier} ${v.demande.heure}`;
}

/**
 * À venir (jour du voyage aujourd'hui ou après, à Paris) du plus proche au plus lointain ;
 * passés du plus récent au plus ancien (D98, §3.4).
 */
export function rangerVoyages<T extends Voyage>(voyages: T[], aujourdhui: string): { aVenir: T[]; passes: T[] } {
  const tries = [...voyages].sort((a, b) => ordre(a).localeCompare(ordre(b)));
  return {
    aVenir: tries.filter((v) => v.demande.date >= aujourdhui),
    passes: tries.filter((v) => v.demande.date < aujourdhui).reverse(),
  };
}
