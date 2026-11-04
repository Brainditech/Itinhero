import type { Ligne } from "./gtfs.js";

/**
 * Jours de circulation d'un GTFS (spec 05, §4) :
 * `calendar.txt` (jours de la semaine, bornes), puis `calendar_dates.txt`
 * (exception 1 ajoute le jour, 2 le retire). Un jeu sans `calendar.txt` (SNCF)
 * ne vit que par `calendar_dates.txt`.
 */
const JOURS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

type Semaine = { jours: boolean[]; debut: string; fin: string };

export type Calendrier = {
  semaines: Map<string, Semaine>;
  exceptions: Map<string, Map<string, 1 | 2>>;
};

/** « 2026-11-12 » ⇒ « 20261112 » (format des dates GTFS). */
export function dateGtfs(jour: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) throw new Error(`jour illisible : « ${jour} »`);
  return jour.replaceAll("-", "");
}

export function construireCalendrier(calendar: Ligne[] | null, calendarDates: Ligne[]): Calendrier {
  const semaines = new Map<string, Semaine>();
  for (const l of calendar ?? []) {
    semaines.set(l.service_id ?? "", {
      jours: JOURS.map((j) => l[j] === "1"),
      debut: l.start_date ?? "",
      fin: l.end_date ?? "",
    });
  }
  const exceptions = new Map<string, Map<string, 1 | 2>>();
  for (const l of calendarDates) {
    const type = l.exception_type;
    if (type !== "1" && type !== "2") throw new Error(`exception_type illisible : « ${type} »`);
    const service = l.service_id ?? "";
    let dates = exceptions.get(service);
    if (!dates) exceptions.set(service, (dates = new Map()));
    dates.set(l.date ?? "", type === "1" ? 1 : 2);
  }
  return { semaines, exceptions };
}

/** Vrai si le service circule ce jour-là (`jour` au format « 2026-11-12 »). */
export function circuleSelon(cal: Calendrier, serviceId: string, jour: string): boolean {
  const date = dateGtfs(jour);
  const exception = cal.exceptions.get(serviceId)?.get(date);
  if (exception === 1) return true;
  if (exception === 2) return false;
  const semaine = cal.semaines.get(serviceId);
  if (!semaine || date < semaine.debut || date > semaine.fin) return false;
  const [a, m, j] = jour.split("-").map(Number) as [number, number, number];
  const jourSemaine = new Date(Date.UTC(a, m - 1, j)).getUTCDay();
  return semaine.jours[jourSemaine] === true;
}
