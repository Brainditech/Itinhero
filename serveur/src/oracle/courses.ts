import { minutesGtfs, type Ligne } from "./gtfs.js";

/**
 * Courses d'un GTFS entre deux arrêts (spec 05, §4). Fonctions pures sur des lignes déjà lues :
 * l'oracle (`oracle.ts`) s'occupe de la lecture et du calendrier.
 */
export type Course = {
  tripId: string;
  serviceId: string;
  ligne: string; // route_short_name
  routeType: number;
  /** Minutes depuis minuit du jour de service (heure locale du GTFS), peut dépasser 1440. */
  depart: number;
  arrivee: number | null; // null pour un simple départ (`departsDe`)
  pickupType: number;
};

export type Voyage = { routeId: string; serviceId: string };
export type Route = { ligne: string; routeType: number };

type Passage = { sequence: number; depart: number; arrivee: number; pickupType: number; dropOffType: number };

function passage(l: Ligne): Passage {
  const arrivee = l.arrival_time || l.departure_time || "";
  const depart = l.departure_time || l.arrival_time || "";
  return {
    sequence: Number(l.stop_sequence),
    depart: minutesGtfs(depart),
    arrivee: minutesGtfs(arrivee),
    pickupType: Number(l.pickup_type || "0"),
    dropOffType: Number(l.drop_off_type || "0"),
  };
}

function decrire(
  tripId: string,
  voyages: Map<string, Voyage>,
  routes: Map<string, Route>,
): { serviceId: string; ligne: string; routeType: number } | null {
  const v = voyages.get(tripId);
  if (!v) return null;
  const r = routes.get(v.routeId);
  return { serviceId: v.serviceId, ligne: r?.ligne ?? "", routeType: r?.routeType ?? -1 };
}

/**
 * Courses qui circulent (selon `circule`) et desservent A puis B, dans cet ordre,
 * avec montée possible en A (pickup_type ≠ 1) et descente possible en B (drop_off_type ≠ 1).
 * `stopTimes` peut ne contenir que les lignes de A et de B.
 */
export function coursesEntre(
  stopTimes: Ligne[],
  voyages: Map<string, Voyage>,
  routes: Map<string, Route>,
  circule: (serviceId: string) => boolean,
  arretA: string,
  arretB: string,
): Course[] {
  const enA = new Map<string, Passage>();
  const enB = new Map<string, Passage>();
  for (const l of stopTimes) {
    const tripId = l.trip_id ?? "";
    if (l.stop_id === arretA) enA.set(tripId, passage(l));
    else if (l.stop_id === arretB) enB.set(tripId, passage(l));
  }
  const courses: Course[] = [];
  for (const [tripId, a] of enA) {
    const b = enB.get(tripId);
    if (!b || b.sequence <= a.sequence) continue; // ordre A puis B
    if (a.pickupType === 1 || b.dropOffType === 1) continue;
    const d = decrire(tripId, voyages, routes);
    if (!d || !circule(d.serviceId)) continue;
    courses.push({ tripId, ...d, depart: a.depart, arrivee: b.arrivee, pickupType: a.pickupType });
  }
  return courses.sort((x, y) => x.depart - y.depart);
}

/** Départs d'un arrêt ce jour-là (montée possible), quelle que soit la destination. */
export function departsDe(
  stopTimes: Ligne[],
  voyages: Map<string, Voyage>,
  routes: Map<string, Route>,
  circule: (serviceId: string) => boolean,
  arret: string,
): Course[] {
  const departs: Course[] = [];
  for (const l of stopTimes) {
    if (l.stop_id !== arret) continue;
    const p = passage(l);
    if (p.pickupType === 1) continue;
    const tripId = l.trip_id ?? "";
    const d = decrire(tripId, voyages, routes);
    if (!d || !circule(d.serviceId)) continue;
    departs.push({ tripId, ...d, depart: p.depart, arrivee: null, pickupType: p.pickupType });
  }
  return departs.sort((x, y) => x.depart - y.depart);
}
