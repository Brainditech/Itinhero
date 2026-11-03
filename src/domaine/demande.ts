import { z } from "zod";

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

export const schemaDemande = z.object({
  lieu_texte: z.string().trim().min(1).max(LIEU_MAX),
  date: z.string().refine(dateExiste),
  heure: z.string().regex(HEURE),
  sens: z.enum(["arriver_avant", "partir_a"]),
  marge: z.number().int().min(0).max(MARGE_MAX),
});

export type Demande = z.infer<typeof schemaDemande>;
export type Sens = Demande["sens"];

/** Ce que contient l'écran : texte brut des champs (la marge est tapée au clavier). */
export type ChampsFormulaire = {
  lieu: string;
  date: string; // AAAA-MM-JJ, choisie au sélecteur
  heure: string; // HH:MM, choisie au sélecteur
  sens: Sens;
  marge: string;
};

export type ErreursFormulaire = Partial<Record<"lieu" | "date" | "heure" | "marge", string>>;

export type ResultatFormulaire = { ok: true; demande: Demande } | { ok: false; erreurs: ErreursFormulaire };

export const MESSAGES = {
  lieuVide: "Indiquez le lieu du rendez-vous.",
  lieuTropLong: `Le lieu tient en ${LIEU_MAX} caractères au plus.`,
  datePassee: "Cette date est passée.",
  dateInvalide: "Choisissez une date.",
  heurePassee: "Cette heure est passée.",
  heureInvalide: "Choisissez une heure.",
  marge: `La marge va de 0 à ${MARGE_MAX} minutes.`,
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
 * Valide le formulaire de repli (spec 02, décision 6). `maintenant` est passé en paramètre :
 * aucune horloge cachée, tests déterministes.
 */
export function validerFormulaire(champs: ChampsFormulaire, maintenant: Date): ResultatFormulaire {
  const erreurs: ErreursFormulaire = {};
  const ici = maintenantAParis(maintenant);

  const lieu = champs.lieu.trim();
  if (lieu === "") erreurs.lieu = MESSAGES.lieuVide;
  else if (lieu.length > LIEU_MAX) erreurs.lieu = MESSAGES.lieuTropLong;

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

  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };
  const demande = schemaDemande.parse({ lieu_texte: lieu, date: champs.date, heure: champs.heure, sens: champs.sens, marge });
  return { ok: true, demande };
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
