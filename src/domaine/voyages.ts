import { z } from "zod";

import { schemaReponseItineraires, type Point, type ReponseItineraires, type ReponseSens } from "./api";
import { maintenantAParis, schemaDemande, type Bout, type ChampsFormulaire, type Demande } from "./demande";
import {
  formaterDuree,
  jourApres,
  jourCourt,
  joursEnPlus,
  libelleCorrespondances,
  possibiliteDuVerdict,
} from "./resultat";

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

/** Un sens du voyage dans le rectangle de Mes trajets (spec 24, D100), tiré de la possibilité du verdict (D80). */
export type ResumeSens =
  | { possible: true; depart: string; arrivee: string; duree: string; changements: string }
  | { possible: false; texte: string };

export type ResumeVoyage = {
  jour: string;
  titre: string;
  aller: ResumeSens;
  retour: ResumeSens | null;
  enregistre: string;
  /** Ce que TalkBack lit du rectangle, d'un bloc. */
  phrase: string;
};

function resumeSens(r: ReponseSens, date: string): { resume: ResumeSens; phrase: string } {
  const p = r.verdict === "impossible" ? undefined : possibiliteDuVerdict(r);
  if (!p) return { resume: { possible: false, texte: "aucun ce jour-là" }, phrase: "aucun ce jour-là" };
  // L'arrivée garde son jour quand elle tombe le lendemain (« ven. 07:12 »), comme le Résultat (D79).
  const plus = joursEnPlus(p);
  const jour = plus > 0 ? jourApres(date, plus) : null;
  const duree = formaterDuree(p.duree_minutes);
  return {
    resume: {
      possible: true,
      depart: p.depart,
      arrivee: jour ? `${jour.slice(0, 3)}. ${p.arrivee}` : p.arrivee,
      duree,
      changements: p.correspondances === 0 ? "direct" : `${p.correspondances} chgt`,
    },
    phrase: `départ ${p.depart}, arrivée ${jour ? `${jour} ` : ""}${p.arrivee}, ${duree}, ${libelleCorrespondances(p.correspondances).toLowerCase()}`,
  };
}

/**
 * Rectangle de Mes trajets (spec 24, D100) : jour, lieux, aller et retour (heures, durée, changements).
 * Tout vient de la réponse enregistrée : aucune heure recalculée (invariant 3), l'horaire est dit prévu (invariant 12).
 */
export function resumeVoyage(v: Voyage): ResumeVoyage {
  const jour = jourCourt(v.demande.date);
  const enregistre = `Enregistré ${quandEnregistre(v.enregistre_le)}`;
  const aller = resumeSens(v.reponse, v.demande.date);
  const retour = v.reponse.retour ? resumeSens(v.reponse.retour, v.demande.date) : null;
  const phrase = [
    `${jour}, ${v.depart.nom} vers ${v.arrivee.nom}.`,
    `Aller : ${aller.phrase}.`,
    ...(retour ? [`Retour : ${retour.phrase}.`] : []),
    "Horaire prévu, sans suivi en direct.",
    `${enregistre}.`,
  ].join(" ");
  return { jour, titre: `${v.depart.nom} → ${v.arrivee.nom}`, aller: aller.resume, retour: retour?.resume ?? null, enregistre, phrase };
}

/** Un bout du voyage pour le formulaire : Domicile et Ma position restent tels quels ; un texte déjà trouvé devient ce lieu. */
function boutDuVoyage(bout: Bout, lieu: LieuVoyage): Bout {
  if (bout.type !== "texte") return bout;
  return { type: "lieu", nom: lieu.nom, lat: lieu.point.lat, lon: lieu.point.lon, nature: "lieu", commune: null, code_postal: null };
}

/**
 * « Modifier » (spec 24, D100, §3.2) : le formulaire reprend le voyage. Les lieux déjà trouvés ne sont pas
 * recherchés de nouveau ; une date passée devient aujourd'hui (le formulaire refuse une date passée).
 */
export function champsDepuisVoyage(v: Voyage, aujourdhui: string): ChampsFormulaire {
  const d = v.demande;
  return {
    depart: boutDuVoyage(d.depart, v.depart),
    arrivee: boutDuVoyage(d.arrivee, v.arrivee),
    date: d.date < aujourdhui ? aujourdhui : d.date,
    heure: d.heure,
    sens: d.sens,
    marge: String(d.marge),
    retour: d.retour ?? null,
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
