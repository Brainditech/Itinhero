import { z } from "zod";

import { schemaReponseItineraires, type Point, type ReponseItineraires, type ReponseSens } from "./api";
import { maintenantAParis, schemaDemande, type Bout, type ChampsFormulaire, type Demande, type Trajet } from "./demande";
import {
  formaterDuree,
  jourApres,
  jourCourt,
  joursEnPlus,
  libelleCorrespondances,
  possibiliteDuVerdict,
} from "./resultat";
import { TRIS, trier, type Tri } from "./tri";

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
  /** Sens enregistré (D101) : un retour seul a ses lieux échangés. Absent sur un voyage d'avant D101. */
  trajet: z.enum(["aller", "retour"]).optional(),
  /** Tri choisi au Résultat à l'enregistrement (D97, D101) ; absent ⇒ « Arrivée la plus tôt ». */
  tri: z.enum(TRIS).optional(),
});
export type Voyage = z.infer<typeof schemaVoyage>;

/** Ce que la recherche en cours tient : les deux lieux peuvent manquer, la réponse aussi. */
export type RechercheAEnregistrer = {
  demande: Demande;
  depart: { lieu: LieuVoyage | null };
  arrivee: { lieu: LieuVoyage | null };
  reponse: ReponseItineraires | null;
};

/** Ce que la disquette enregistre (spec 24 §7.2, D101). */
export type ChoixEnregistrement = "aller_retour" | "aller" | "retour";
/** Le tri choisi pour chaque sens au Résultat (D97). */
export type TrisVoyage = Record<Trajet, Tri>;

const sensPossible = (r: ReponseSens | null | undefined): boolean => !!r && r.possibilites.length > 0;

/**
 * Choix offerts par la disquette : un sens ne s'enregistre que s'il a au moins une possibilité (D98, D101).
 * Les deux possibles ⇒ « Aller et retour », « Aller seulement », « Retour seulement » ; sinon le seul possible.
 */
export function choixPossibles(reponse: ReponseItineraires | null | undefined): ChoixEnregistrement[] {
  const aller = sensPossible(reponse);
  const retour = sensPossible(reponse?.retour);
  if (aller && retour) return ["aller_retour", "aller", "retour"];
  if (aller) return ["aller"];
  if (retour) return ["retour"];
  return [];
}

export function peutEnregistrer(reponse: ReponseItineraires | null | undefined): boolean {
  return choixPossibles(reponse).length > 0;
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

type Base = Pick<Voyage, "enregistre_le" | "demande" | "depart" | "arrivee" | "reponse">;

/** L'aller seul : ni la demande ni la réponse ne gardent le retour. */
function allerSeul(v: Base): Voyage {
  return { ...v, demande: { ...v.demande, retour: null }, reponse: { ...v.reponse, retour: null }, trajet: "aller" };
}

/**
 * Le retour seul devient un trajet ordinaire (D101) : lieux échangés, « Partir à » la fin du rendez-vous, même
 * date et même marge ; la réponse du retour telle que le serveur l'a donnée (invariant 3). Son arrivée garde
 * l'adresse connue du départ de l'aller (l'IGN a donné celle de l'arrivée de l'aller, spec 19).
 */
function retourSeul(v: Base): Voyage | null {
  const r = v.reponse.retour;
  if (!r) return null;
  const d = v.demande;
  return {
    enregistre_le: v.enregistre_le,
    demande: {
      depart: d.arrivee,
      arrivee: d.depart,
      date: d.date,
      heure: d.retour ?? r.demande.heure,
      sens: "partir_a",
      marge: d.marge,
      retour: null,
    },
    depart: v.arrivee,
    arrivee: v.depart,
    reponse: { ...r, arrivee: { nom: v.depart.nom, adresse: v.depart.adresse }, retour: null },
    trajet: "retour",
  };
}

/** La recherche en cours ⇒ les trajets à enregistrer selon le choix ; un sens sans possibilité n'est jamais gardé. */
export function voyagesDepuisRecherche(r: RechercheAEnregistrer, choix: ChoixEnregistrement, tris: TrisVoyage, maintenant: Date): Voyage[] {
  const depart = r.depart.lieu;
  const arrivee = r.arrivee.lieu;
  if (!depart || !arrivee || !r.reponse) return [];
  const base: Base = { enregistre_le: maintenant.toISOString(), demande: r.demande, depart, arrivee, reponse: r.reponse };
  const voyages: Voyage[] = [];
  if (choix !== "retour" && sensPossible(r.reponse)) voyages.push({ ...allerSeul(base), tri: tris.aller });
  const retour = choix !== "aller" && sensPossible(r.reponse.retour) ? retourSeul(base) : null;
  if (retour) voyages.push({ ...retour, tri: tris.retour });
  return voyages;
}

/**
 * La disquette d'une possibilité (spec 24 §8, D102) : le sens touché, avec cette seule possibilité, telle que le
 * serveur l'a donnée (invariant 3). Rouvert, le trajet ne montre qu'elle ; son verdict s'appuie sur elle.
 * Même clé pour toutes les possibilités d'un sens : en enregistrer une autre remplace la première.
 */
export function voyageDePossibilite(r: RechercheAEnregistrer, trajet: Trajet, index: number, maintenant: Date): Voyage | null {
  const sensTouche = trajet === "retour" ? r.reponse?.retour : r.reponse;
  const p = sensTouche?.possibilites[index];
  if (!p) return null;
  const [v] = voyagesDepuisRecherche(r, trajet, { aller: "arrivee", retour: "arrivee" }, maintenant);
  if (!v) return null;
  const { tri: _tri, ...sansTri } = v;
  return { ...sansTri, reponse: { ...v.reponse, verdict: "possible", possibilites: [p] } };
}

/**
 * Voyage d'avant D101, enregistré avec son retour ⇒ l'aller et le retour à part (un sens sans possibilité part).
 * Sans retour, il reste tel quel.
 */
export function separerVoyage(v: Voyage): Voyage[] {
  if (!v.reponse.retour) return [v];
  const parts = [sensPossible(v.reponse) ? allerSeul(v) : null, sensPossible(v.reponse.retour) ? retourSeul(v) : null];
  return parts.filter((p): p is Voyage => p !== null);
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

/** Les horaires d'un trajet dans le rectangle de Mes trajets (spec 24, D100, D101). */
export type ResumeSens =
  | { possible: true; depart: string; arrivee: string; duree: string; changements: string }
  | { possible: false; texte: string };

export type ResumeVoyage = {
  jour: string;
  titre: string;
  /** « Aller » ou « Retour » (D101). */
  libelle: string;
  horaires: ResumeSens;
  enregistre: string;
  /** Ce que TalkBack lit du rectangle, d'un bloc. */
  phrase: string;
};

/**
 * La possibilité que le rectangle montre (D101) : la première du tri gardé ; avec « Arrivée la plus tôt », ou
 * si le tri n'en garde aucune, celle du verdict (D114).
 */
export function possibiliteMontree(r: ReponseSens, tri: Tri | undefined) {
  if (r.verdict === "impossible") return undefined;
  const triee = tri && tri !== "arrivee" ? trier(r.possibilites, tri)[0]?.possibilite : undefined;
  return triee ?? possibiliteDuVerdict(r);
}

function resumeSens(r: ReponseSens, date: string, tri: Tri | undefined): { resume: ResumeSens; phrase: string } {
  const p = possibiliteMontree(r, tri);
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
 * Rectangle de Mes trajets (spec 24, D100, D101) : jour, lieux, une ligne d'horaires (heures, durée, changements).
 * Tout vient de la réponse enregistrée : aucune heure recalculée (invariant 3), l'horaire est dit prévu (invariant 12).
 */
export function resumeVoyage(v: Voyage): ResumeVoyage {
  const jour = jourCourt(v.demande.date);
  const enregistre = `Enregistré ${quandEnregistre(v.enregistre_le)}`;
  const libelle = v.trajet === "retour" ? "Retour" : "Aller";
  const horaires = resumeSens(v.reponse, v.demande.date, v.tri);
  const phrase = [
    `${jour}, ${libelle.toLowerCase()}, ${v.depart.nom} vers ${v.arrivee.nom} : ${horaires.phrase}.`,
    "Horaire prévu, sans suivi en direct.",
    `${enregistre}.`,
  ].join(" ");
  return { jour, titre: `${v.depart.nom} → ${v.arrivee.nom}`, libelle, horaires: horaires.resume, enregistre, phrase };
}

/** Un bout du voyage pour le formulaire : Domicile et Ma position restent tels quels ; un texte déjà trouvé devient ce lieu. */
function boutDuVoyage(bout: Bout, lieu: Pick<LieuVoyage, "nom" | "point">): Bout {
  if (bout.type !== "texte") return bout;
  return { type: "lieu", nom: lieu.nom, lat: lieu.point.lat, lon: lieu.point.lon, nature: "lieu", commune: null, code_postal: null };
}

/**
 * « Modifier » (spec 24, D100, §3.2) : le formulaire reprend le voyage. Les lieux déjà trouvés ne sont pas
 * recherchés de nouveau ; une date passée devient aujourd'hui (le formulaire refuse une date passée).
 */
export function champsDepuisVoyage(v: Voyage, aujourdhui: string): ChampsFormulaire {
  return champsDepuisRecherche(v.demande, v.depart, v.arrivee, aujourdhui);
}

/**
 * « Modifier la recherche » du Résultat (spec 34, D112, §3.5) : le formulaire reprend la recherche en cours, ses lieux
 * déjà trouvés compris, même s'il a été fermé par l'onglet Accueil. Mêmes règles que « Modifier » d'un voyage.
 */
export function champsDepuisRecherche(
  d: Demande,
  depart: Pick<LieuVoyage, "nom" | "point">,
  arrivee: Pick<LieuVoyage, "nom" | "point">,
  aujourdhui: string,
): ChampsFormulaire {
  return {
    depart: boutDuVoyage(d.depart, depart),
    arrivee: boutDuVoyage(d.arrivee, arrivee),
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
