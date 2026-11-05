import { z } from "zod";

import { schemaTransport } from "./api";
import { distance } from "./geo";

// Forme unique d'une demande (spec 02, décision 5 ; invariant 9) : produite par le formulaire
// de repli et, plus tard, par `/v1/comprendre`.

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Vrai si « AAAA-MM-JJ » existe au calendrier (refuse le 30/02, le 13e mois…). */
function dateExiste(texte: string): boolean {
  if (!DATE.test(texte)) return false;
  const [a, m, j] = texte.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j;
}

export const MARGE_MAX = 120;
export const LIEU_MAX = 200;
/** `GET /v1/lieux` demande au moins 2 caractères (spec 09 §4.4). */
export const LIEU_MIN_RECHERCHE = 2;

/** Deux lieux choisis plus proches que ça sont « le même lieu » (spec 18, §4.3). */
export const MEME_LIEU_METRES = 50;

/** Lieu choisi dans les suggestions, ou retenu à « Chercher » (D91) : ce qu'on voit dans le champ est ce qui est cherché. */
export const schemaBoutLieu = z.object({
  type: z.literal("lieu"),
  nom: z.string().min(1).max(LIEU_MAX),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  nature: z.enum(["adresse", "lieu", "arret"]),
  commune: z.string().nullish(),
  code_postal: z.string().nullish(),
  /** Gardé pour que l'icône et la ligne de détail restent les mêmes (D92). */
  transport: schemaTransport,
});

/**
 * Un bout du trajet, départ ou arrivée (D77) : Domicile, Ma position, un texte à chercher
 * par `GET /v1/lieux`, ou un lieu déjà choisi (D91). `/v1/comprendre` produira la même forme.
 */
export const schemaBout = z.discriminatedUnion("type", [
  z.object({ type: z.literal("domicile") }),
  z.object({ type: z.literal("position") }),
  z.object({ type: z.literal("texte"), texte: z.string().trim().min(LIEU_MIN_RECHERCHE).max(LIEU_MAX) }),
  schemaBoutLieu,
]);

export type Bout = z.infer<typeof schemaBout>;
export type BoutLieu = z.infer<typeof schemaBoutLieu>;
export type CoteBout = "depart" | "arrivee";

export const schemaDemande = z.object({
  depart: schemaBout,
  arrivee: schemaBout,
  date: z.string().refine(dateExiste),
  heure: z.string().regex(HEURE),
  sens: z.enum(["arriver_avant", "partir_a"]),
  marge: z.number().int().min(0).max(MARGE_MAX),
  /** Fin du rendez-vous, le même jour (spec 19, D94) : le retour se cherche à partir de cette heure. */
  retour: z.string().regex(HEURE).nullish(),
});

export type Demande = z.infer<typeof schemaDemande>;
export type Sens = Demande["sens"];

/** Ce que contient l'écran : texte brut des champs (la marge est tapée au clavier). */
export type ChampsFormulaire = {
  depart: Bout;
  arrivee: Bout;
  date: string; // AAAA-MM-JJ, choisie au sélecteur
  heure: string; // HH:MM, choisie au sélecteur
  sens: Sens;
  marge: string;
  /** Fin du rendez-vous HH:MM choisie au sélecteur, ou null : pas de retour (spec 19). */
  retour: string | null;
};

export type ErreursFormulaire = Partial<Record<CoteBout | "date" | "heure" | "marge" | "retour", string>>;

export type ResultatFormulaire = { ok: true; demande: Demande } | { ok: false; erreurs: ErreursFormulaire };

export const MESSAGES = {
  departVide: "Indiquez le départ.",
  arriveeVide: "Indiquez l'arrivée.",
  memeLieu: "Le départ et l'arrivée sont le même lieu.",
  lieuTropLong: `Le lieu tient en ${LIEU_MAX} caractères au plus.`,
  lieuTropCourt: "Indiquez au moins 2 caractères.",
  datePassee: "Cette date est passée.",
  dateInvalide: "Choisissez une date.",
  heurePassee: "Cette heure est passée.",
  heureInvalide: "Choisissez une heure.",
  marge: `La marge va de 0 à ${MARGE_MAX} minutes.`,
  retourAvant: (heure: string) => `La fin du rendez-vous est après ${heure}.`,
  retourInvalide: "Choisissez une heure de fin.",
} as const;

/** Date et heure de `maintenant` lues à Paris (R11), quel que soit le fuseau de l'appareil. */
export function maintenantAParis(maintenant: Date): { date: string; heure: string } {
  const parties = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(maintenant);
  const v = (type: Intl.DateTimeFormatPartTypes) => parties.find((p) => p.type === type)?.value ?? "";
  return { date: `${v("year")}-${v("month")}-${v("day")}`, heure: `${v("hour")}:${v("minute")}` };
}

/**
 * Demande de « Recalculer depuis ici » (spec 12, §7) : départ à la position, même arrivée, même marge.
 * En « partir à », l'heure prévue est souvent passée quand on s'est perdu : on cherche à partir de maintenant
 * (heure de Paris), jamais avant. En « arriver avant », le rendez-vous ne bouge pas.
 */
export function demandeRecalcul(demande: Demande, maintenant: Date, trajet: Trajet = "aller"): Demande {
  const ici = maintenantAParis(maintenant);
  if (trajet === "retour") return demandeRecalculRetour(demande, ici);
  const suite: Demande = { ...demande, depart: { type: "position" } };
  if (demande.sens !== "partir_a") return suite;
  const passee = `${demande.date} ${demande.heure}` < `${ici.date} ${ici.heure}`;
  if (!passee) return suite;
  const decalee = { ...suite, date: ici.date, heure: ici.heure };
  // Le retour reste cherché s'il est encore après la nouvelle heure de départ (même jour), sinon il tombe.
  const retourGarde = suite.retour == null || (ici.date === demande.date && suite.retour > ici.heure);
  return retourGarde ? decalee : { ...decalee, retour: null };
}

/** L'aller, ou le retour planifié à partir de la fin du rendez-vous (spec 19). */
export type Trajet = "aller" | "retour";

/**
 * « Recalculer depuis ici » pendant un retour (spec 19, D94) : depuis la position vers le départ de l'aller,
 * en « partir à » la fin du rendez-vous ou maintenant (le plus tard), sans nouveau retour.
 */
function demandeRecalculRetour(demande: Demande, ici: { date: string; heure: string }): Demande {
  const fin = { date: demande.date, heure: demande.retour ?? demande.heure };
  const passee = `${fin.date} ${fin.heure}` < `${ici.date} ${ici.heure}`;
  return {
    depart: { type: "position" },
    arrivee: demande.depart,
    ...(passee ? ici : fin),
    sens: "partir_a",
    marge: demande.marge,
    retour: null,
  };
}

/**
 * Valide le formulaire de repli (spec 02, décision 6). `maintenant` est passé en paramètre :
 * aucune horloge cachée, tests déterministes.
 */
export function validerFormulaire(champs: ChampsFormulaire, maintenant: Date): ResultatFormulaire {
  const erreurs: ErreursFormulaire = {};
  const ici = maintenantAParis(maintenant);

  const depart = nettoyerBout(champs.depart);
  const arrivee = nettoyerBout(champs.arrivee);
  const erreurDepart = erreurBout(depart, MESSAGES.departVide);
  const erreurArrivee = erreurBout(arrivee, MESSAGES.arriveeVide);
  if (erreurDepart) erreurs.depart = erreurDepart;
  if (erreurArrivee) erreurs.arrivee = erreurArrivee;
  // Domicile → Domicile, position → position (spec 13, §4.1), deux lieux choisis au même point (spec 18, §4.3).
  else if (memeLieu(depart, arrivee)) erreurs.arrivee = MESSAGES.memeLieu;

  // Les deux chaînes sont au format AAAA-MM-JJ / HH:MM : l'ordre alphabétique est l'ordre du temps.
  const dateValide = dateExiste(champs.date);
  if (!dateValide) erreurs.date = MESSAGES.dateInvalide;
  else if (champs.date < ici.date) erreurs.date = MESSAGES.datePassee;

  if (!HEURE.test(champs.heure)) erreurs.heure = MESSAGES.heureInvalide;
  else if (dateValide && champs.date === ici.date && champs.heure < ici.heure) erreurs.heure = MESSAGES.heurePassee;

  // « Partir à » : pas de rendez-vous, donc rien à retirer ; la marge est ignorée (décision 3).
  let marge = 0;
  if (champs.sens === "arriver_avant") {
    const texte = champs.marge.trim();
    const n = /^\d{1,3}$/.test(texte) ? Number(texte) : NaN;
    if (Number.isInteger(n) && n >= 0 && n <= MARGE_MAX) marge = n;
    else erreurs.marge = MESSAGES.marge;
  }

  // Fin du rendez-vous (spec 19) : facultative, le même jour, après l'heure de l'aller.
  if (champs.retour !== null) {
    if (!HEURE.test(champs.retour)) erreurs.retour = MESSAGES.retourInvalide;
    else if (HEURE.test(champs.heure) && champs.retour <= champs.heure) erreurs.retour = MESSAGES.retourAvant(champs.heure);
  }

  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };
  const demande = schemaDemande.parse({
    depart,
    arrivee,
    date: champs.date,
    heure: champs.heure,
    sens: champs.sens,
    marge,
    retour: champs.retour,
  });
  return { ok: true, demande };
}

function memeLieu(a: Bout, b: Bout): boolean {
  if (a.type === "lieu" && b.type === "lieu") return distance(a, b) < MEME_LIEU_METRES;
  return (a.type === "domicile" || a.type === "position") && a.type === b.type;
}

function nettoyerBout(b: Bout): Bout {
  return b.type === "texte" ? { type: "texte", texte: b.texte.trim() } : b;
}

/** Message d'erreur d'un bout, ou `undefined` s'il est bon. */
function erreurBout(b: Bout, vide: string): string | undefined {
  if (b.type !== "texte") return undefined;
  if (b.texte === "") return vide;
  if (b.texte.length > LIEU_MAX) return MESSAGES.lieuTropLong;
  if (b.texte.length < LIEU_MIN_RECHERCHE) return MESSAGES.lieuTropCourt; // minimum de GET /v1/lieux (spec 10)
  return undefined;
}

/** ⇅ : le départ devient l'arrivée et inversement, texte ou choix (spec 13, §4.1). */
export function echangerBouts<T extends { depart: Bout; arrivee: Bout }>(champs: T): T {
  return { ...champs, depart: champs.arrivee, arrivee: champs.depart };
}

/** Demande du formulaire ⇒ corps de `POST /v1/itineraires` (spec 09 §4.5) ; rien d'autre ne change. */
export function versRequeteItineraires(
  demande: Demande,
  depart: { lat: number; lon: number },
  arrivee: { lat: number; lon: number },
  noms?: { depart?: string; arrivee?: string },
) {
  return {
    depart: { lat: depart.lat, lon: depart.lon },
    arrivee: { lat: arrivee.lat, lon: arrivee.lon },
    date: demande.date,
    heure: demande.heure,
    sens: demande.sens === "arriver_avant" ? ("arriver" as const) : ("partir" as const),
    marge: demande.marge,
    ...(noms ? { noms } : {}),
    ...(demande.retour != null ? { fin_rdv: demande.retour } : {}),
  };
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** « 2026-11-12 » ⇒ « jeudi 12/11/2026 ». Calculé depuis la date seule, sans fuseau. */
export function formaterDate(date: string): string {
  if (!dateExiste(date)) return "—";
  const [a, m, j] = date.split("-");
  const jour = JOURS[new Date(Date.UTC(Number(a), Number(m) - 1, Number(j))).getUTCDay()];
  return `${jour} ${j}/${m}/${a}`;
}

// ——— Sélecteurs d'Android (heure locale de l'appareil, dans les deux sens) ———

const deux = (n: number) => String(n).padStart(2, "0");

/** Date et heure du formulaire ⇒ `Date` pour ouvrir le sélecteur. */
export function versDateLocale(date: string, heure: string): Date {
  const [a, m, j] = date.split("-").map(Number);
  const [h, min] = heure.split(":").map(Number);
  return new Date(a, m - 1, j, h, min);
}

/** `Date` choisie au sélecteur de date ⇒ « AAAA-MM-JJ ». */
export function dateChoisie(d: Date): string {
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
}

/** `Date` choisie au sélecteur d'heure ⇒ « HH:MM ». */
export function heureChoisie(d: Date): string {
  return `${deux(d.getHours())}:${deux(d.getMinutes())}`;
}
