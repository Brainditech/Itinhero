/**
 * Heure de Paris (spec 05, §4). MOTIS rend les heures en UTC (spec 04, §11) ;
 * la conversion passe par `Intl` (ICU complet dans Node 22), changements d'heure compris.
 */
export const FUSEAU = "Europe/Paris";

const format = new Intl.DateTimeFormat("fr-FR", {
  timeZone: FUSEAU,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export type HeureParis = {
  jour: string; // « 2026-11-12 »
  minutes: number; // depuis minuit, heure de Paris
  hhmm: string; // « 06:27 »
};

function parties(instant: Date): Record<string, number> {
  const p: Record<string, number> = {};
  for (const x of format.formatToParts(instant)) if (x.type !== "literal") p[x.type] = Number(x.value);
  return p;
}

const deux = (n: number) => String(n).padStart(2, "0");

export function heureParis(instant: Date): HeureParis {
  const p = parties(instant);
  const h = p.hour ?? 0;
  const m = p.minute ?? 0;
  return {
    jour: `${p.year}-${deux(p.month ?? 0)}-${deux(p.day ?? 0)}`,
    minutes: h * 60 + m,
    hhmm: `${deux(h)}:${deux(m)}`,
  };
}

function lireJour(jour: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour);
  if (!m) throw new Error(`jour illisible : « ${jour} »`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Écart (ms) entre l'heure de Paris et l'UTC à cet instant. */
function decalage(instant: Date): number {
  const p = parties(instant);
  const commeUtc = Date.UTC(p.year ?? 0, (p.month ?? 1) - 1, p.day ?? 1, p.hour ?? 0, p.minute ?? 0, p.second ?? 0);
  return commeUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Instant UTC de « jour à minutes » heure de Paris (minutes peut dépasser 1440). */
export function instantParis(jour: string, minutes: number): Date {
  const [a, mo, j] = lireJour(jour);
  const naif = Date.UTC(a, mo - 1, j, 0, minutes);
  let instant = naif - decalage(new Date(naif));
  instant = naif - decalage(new Date(instant)); // second passage : jour de changement d'heure
  return new Date(instant);
}

/** Minuit, heure de Paris, en UTC. */
export function debutJourParis(jour: string): Date {
  return instantParis(jour, 0);
}

/** Minutes de l'horloge de Paris depuis minuit du `jour` (1440 et plus le lendemain). */
export function minutesDepuis(jour: string, instant: Date): number {
  const h = heureParis(instant);
  const [a, m, j] = lireJour(jour);
  const [a2, m2, j2] = lireJour(h.jour);
  const jours = Math.round((Date.UTC(a2, m2 - 1, j2) - Date.UTC(a, m - 1, j)) / 86_400_000);
  return jours * 1440 + h.minutes;
}

/** 589 ⇒ « 09:49 ». */
export function hhmm(minutes: number): string {
  return `${deux(Math.floor(minutes / 60))}:${deux(minutes % 60)}`;
}
