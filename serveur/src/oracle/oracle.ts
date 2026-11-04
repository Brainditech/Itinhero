import path from "node:path";
import { lireManifest, verifierManifest, type Ecart } from "../manifest.js";
import { circuleSelon, construireCalendrier, type Calendrier } from "./calendrier.js";
import { coursesEntre, departsDe, type Course, type Route, type Voyage } from "./courses.js";
import { lireTable, lireTableFacultative } from "./gtfs.js";

/**
 * Oracle GTFS (spec 05, invariant 15) : lecteur indépendant de MOTIS.
 * Il ne calcule aucun itinéraire et ne connaît pas OSM : il répond seulement
 * à des questions sur les fichiers figés de `fixtures/`.
 */
export class ErreurFixtures extends Error {
  constructor(public readonly ecarts: Ecart[]) {
    super(
      "sha256 des fixtures différent du manifeste, l'oracle refuse de lire : " +
        ecarts.map((e) => e.chemin).join(", "),
    );
    this.name = "ErreurFixtures";
  }
}

export type Arret = { id: string; nom: string; lat: number; lon: number };

type Jeu = {
  chemin: string;
  calendrier?: Promise<Calendrier>;
  voyages?: Promise<Map<string, Voyage>>;
  routes?: Promise<Map<string, Route>>;
};

export class Oracle {
  private constructor(private readonly jeux: Map<string, Jeu>) {}

  /** Vérifie le sha256 de chaque fichier du manifeste (invariant 14) avant toute lecture. */
  static async ouvrir(dossierFixtures: string): Promise<Oracle> {
    const manifest = await lireManifest(path.join(dossierFixtures, "manifest.json"));
    const ecarts = await verifierManifest(manifest, dossierFixtures);
    if (ecarts.length > 0) throw new ErreurFixtures(ecarts);
    const jeux = new Map<string, Jeu>();
    for (const f of manifest.fichiers) {
      if (f.type === "gtfs") jeux.set(f.jeu, { chemin: path.join(dossierFixtures, f.chemin) });
    }
    return new Oracle(jeux);
  }

  private jeu(nom: string): Jeu {
    const j = this.jeux.get(nom);
    if (!j) throw new Error(`jeu GTFS inconnu du manifeste : « ${nom} »`);
    return j;
  }

  private calendrier(j: Jeu): Promise<Calendrier> {
    j.calendrier ??= Promise.all([
      lireTableFacultative(j.chemin, "calendar.txt"),
      lireTableFacultative(j.chemin, "calendar_dates.txt"),
    ]).then(([cal, dates]) => construireCalendrier(cal, dates ?? []));
    return j.calendrier;
  }

  private voyages(j: Jeu): Promise<Map<string, Voyage>> {
    j.voyages ??= lireTable(j.chemin, "trips.txt").then(
      (lignes) =>
        new Map(
          lignes.map((l) => [l.trip_id ?? "", { routeId: l.route_id ?? "", serviceId: l.service_id ?? "" }]),
        ),
    );
    return j.voyages;
  }

  private routes(j: Jeu): Promise<Map<string, Route>> {
    j.routes ??= lireTable(j.chemin, "routes.txt").then(
      (lignes) =>
        new Map(
          lignes.map((l) => [
            l.route_id ?? "",
            { ligne: l.route_short_name ?? "", routeType: Number(l.route_type) },
          ]),
        ),
    );
    return j.routes;
  }

  /** Le service circule-t-il ce jour-là (« 2026-11-12 ») ? */
  async circule(jeu: string, serviceId: string, jour: string): Promise<boolean> {
    return circuleSelon(await this.calendrier(this.jeu(jeu)), serviceId, jour);
  }

  /** Courses qui circulent ce jour-là et desservent A puis B. Heures GTFS locales, en minutes. */
  async courses(jeu: string, arretA: string, arretB: string, jour: string): Promise<Course[]> {
    const j = this.jeu(jeu);
    const [cal, voyages, routes, stopTimes] = await Promise.all([
      this.calendrier(j),
      this.voyages(j),
      this.routes(j),
      lireTable(j.chemin, "stop_times.txt", (l) => l.stop_id === arretA || l.stop_id === arretB),
    ]);
    return coursesEntre(stopTimes, voyages, routes, (s) => circuleSelon(cal, s, jour), arretA, arretB);
  }

  /** Départs d'un arrêt ce jour-là (montée possible), quelle que soit la destination. */
  async departs(jeu: string, arret: string, jour: string): Promise<Course[]> {
    const j = this.jeu(jeu);
    const [cal, voyages, routes, stopTimes] = await Promise.all([
      this.calendrier(j),
      this.voyages(j),
      this.routes(j),
      lireTable(j.chemin, "stop_times.txt", (l) => l.stop_id === arret),
    ]);
    return departsDe(stopTimes, voyages, routes, (s) => circuleSelon(cal, s, jour), arret);
  }

  /** Nom et coordonnées d'un arrêt, tirés de `stops.txt`. */
  async arret(jeu: string, stopId: string): Promise<Arret> {
    const [l] = await lireTable(this.jeu(jeu).chemin, "stops.txt", (x) => x.stop_id === stopId);
    if (!l) throw new Error(`arrêt « ${stopId} » absent de ${jeu}/stops.txt`);
    return { id: stopId, nom: l.stop_name ?? "", lat: Number(l.stop_lat), lon: Number(l.stop_lon) };
  }
}
