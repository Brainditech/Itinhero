import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Manifest } from "../manifest.js";
import { lireTable, lireTableFacultative } from "../oracle/gtfs.js";

/**
 * Ce que MOTIS v2.11.4 ne rend pas, lu dans les GTFS chargés (issue 0010, D69) :
 * - les passages sur réservation : `pickup_type` ou `drop_off_type` à 2 (« appeler l'agence »)
 *   ou 3 (« s'arranger avec le conducteur »). MOTIS les rend « NORMAL » (son `PickupDropoffType`
 *   n'a que NORMAL et NOT_ALLOWED, openapi.yaml du tag) ;
 * - la fin de validité de chaque jeu (`feed_info.feed_end_date`, sinon la dernière date de
 *   `calendar.txt` et `calendar_dates.txt`).
 * Produit une fois par `npm run donnees:horaires` (le `stop_times.txt` national ne se relit pas à
 * chaque démarrage), lu par l'API au démarrage, validé par Zod (invariant 9).
 */
export type HorairesJeu = {
  /** « 2027-08-31 », ou null si le jeu ne dit rien. */
  fin_validite: string | null;
  /** trip_id ⇒ arrêts où monter (`m:`) ou descendre (`d:`) demande une réservation. */
  reservations: Record<string, string[]>;
  /** Issue 0025 : nom du réseau (producteur dans `jeux.json`), pour dire lequel n'a pas encore publié. */
  nom?: string;
  /** Spec 41 (D122) : `agency_name` ⇒ `agency_phone` de `agency.txt`, quand l'exploitant en publie un. */
  agences?: Record<string, string>;
  /** Revue PR #61 : emprise des arrêts du jeu `[latMin, lonMin, latMax, lonMax]`, pour ne parler que des réseaux du trajet. */
  emprise?: [number, number, number, number];
};

export type FichierHoraires = { version: 1; jeux: Record<string, HorairesJeu> };

const schemaFichier = z.object({
  version: z.literal(1),
  jeux: z.record(
    z.string(),
    z.object({
      fin_validite: z.iso.date().nullable(),
      reservations: z.record(z.string(), z.array(z.string().regex(/^[md]:/))),
      nom: z.string().min(1).max(120).optional(),
      agences: z.record(z.string(), z.string().regex(/^\+?[0-9 .()-]{6,25}$/)).optional(),
      emprise: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
    }),
  ),
});

const SUR_RESERVATION = new Set(["2", "3"]);

/** « 20270831 » ⇒ « 2027-08-31 » ; null si illisible. */
function dateIso(d: string | undefined): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(d?.trim() ?? "");
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

const plusTardive = (dates: (string | null)[]): string | null =>
  dates.filter((d): d is string => d !== null).sort().at(-1) ?? null;

/** Lit un GTFS zippé ; seules les lignes sur réservation de `stop_times.txt` restent en mémoire. */
export async function lireHorairesJeu(cheminZip: string): Promise<HorairesJeu> {
  const reservations: Record<string, string[]> = {};
  const lignes = await lireTable(
    cheminZip,
    "stop_times.txt",
    (l) => SUR_RESERVATION.has(l.pickup_type?.trim() ?? "") || SUR_RESERVATION.has(l.drop_off_type?.trim() ?? ""),
  );
  for (const l of lignes) {
    const trip = l.trip_id ?? "";
    const arret = l.stop_id ?? "";
    const liste = (reservations[trip] ??= []);
    if (SUR_RESERVATION.has(l.pickup_type?.trim() ?? "")) liste.push(`m:${arret}`);
    if (SUR_RESERVATION.has(l.drop_off_type?.trim() ?? "")) liste.push(`d:${arret}`);
  }

  const info = await lireTableFacultative(cheminZip, "feed_info.txt");
  let fin = dateIso(info?.[0]?.feed_end_date);
  if (fin === null) {
    const calendar = await lireTableFacultative(cheminZip, "calendar.txt");
    const dates = await lireTableFacultative(cheminZip, "calendar_dates.txt", (l) => l.exception_type?.trim() === "1");
    fin = plusTardive([...(calendar ?? []).map((l) => dateIso(l.end_date)), ...(dates ?? []).map((l) => dateIso(l.date))]);
  }
  // Spec 41 : téléphones des exploitants, gardés seulement s'ils ressemblent à un numéro.
  const agences: Record<string, string> = {};
  // Un `agency.txt` mal formé (r83511, constaté le 2026-11-06) ne fait perdre ni les réservations ni la fin de validité.
  const lignesAgences = await lireTableFacultative(cheminZip, "agency.txt").catch(() => null);
  for (const a of lignesAgences ?? []) {
    const nom = a.agency_name?.trim();
    const tel = a.agency_phone?.trim();
    if (nom && tel && /^\+?[0-9 .()-]{6,25}$/.test(tel) && tel.replace(/[^0-9]/g, "").length >= 9) agences[nom] = tel;
  }
  // Emprise des arrêts : calculée pendant la lecture, sans garder les lignes ; 0,0 et coordonnées folles écartés.
  let emprise: [number, number, number, number] | null = null;
  await lireTableFacultative(cheminZip, "stops.txt", (l) => {
    const lat = Number(l.stop_lat);
    const lon = Number(l.stop_lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return false;
    emprise = emprise
      ? [Math.min(emprise[0], lat), Math.min(emprise[1], lon), Math.max(emprise[2], lat), Math.max(emprise[3], lon)]
      : [lat, lon, lat, lon];
    return false;
  }).catch(() => null);
  return {
    fin_validite: fin,
    reservations,
    ...(Object.keys(agences).length > 0 ? { agences } : {}),
    ...(emprise ? { emprise } : {}),
  };
}

/** Tous les GTFS du manifeste ; un jeu illisible est signalé et laissé de côté (rien n'est inventé pour lui). */
export async function lireHoraires(
  manifest: Manifest,
  dossier: string,
  signaler: (jeu: string, erreur: unknown) => void = () => {},
): Promise<FichierHoraires> {
  const jeux: Record<string, HorairesJeu> = {};
  for (const f of manifest.fichiers) {
    if (f.type !== "gtfs") continue;
    try {
      jeux[f.jeu] = await lireHorairesJeu(path.join(dossier, f.chemin));
    } catch (e) {
      signaler(f.jeu, e);
    }
  }
  return { version: 1, jeux };
}

export type ReservationEtape = "appel" | null;

/** Index en mémoire, consulté pour chaque étape. */
export class IndexHoraires {
  private readonly reservations = new Map<string, Map<string, Set<string>>>();
  private readonly fins = new Map<string, string | null>();
  private readonly noms = new Map<string, string>();
  private readonly agences = new Map<string, Record<string, string>>();
  private readonly emprises = new Map<string, [number, number, number, number]>();

  constructor(fichier: FichierHoraires) {
    for (const [jeu, h] of Object.entries(fichier.jeux)) {
      this.fins.set(jeu, h.fin_validite);
      if (h.nom) this.noms.set(jeu, h.nom);
      if (h.agences) this.agences.set(jeu, h.agences);
      if (h.emprise) this.emprises.set(jeu, h.emprise);
      this.reservations.set(jeu, new Map(Object.entries(h.reservations).map(([t, l]) => [t, new Set(l)])));
    }
  }

  /** Vrai si le jeu a été lu : sans lui, on ne sait pas (et l'on ne dit pas « sans réservation »). */
  connait(jeu: string): boolean {
    return this.fins.has(jeu);
  }

  finValidite(jeu: string): string | null {
    return this.fins.get(jeu) ?? null;
  }

  /**
   * Issue 0025 : jeux encore valables aujourd'hui mais dont les horaires s'arrêtent avant `date` (leur suite
   * n'est pas encore publiée). Un jeu déjà fini aujourd'hui est un jeu mort, pas un jeu « à venir » : écarté.
   */
  nonPublies(
    date: string,
    aujourdhui: string,
    zone?: [number, number, number, number],
  ): { jeu: string; nom: string | null; fin: string }[] {
    const liste: { jeu: string; nom: string | null; fin: string }[] = [];
    for (const [jeu, fin] of this.fins) {
      if (fin === null || fin < aujourdhui || fin >= date) continue;
      // Revue PR #61 : un jeu dont les arrêts sont loin du trajet ne l'explique pas. Sans emprise connue : gardé.
      const e = this.emprises.get(jeu);
      if (zone && e && (e[2] < zone[0] || e[0] > zone[2] || e[3] < zone[1] || e[1] > zone[3])) continue;
      liste.push({ jeu, nom: this.noms.get(jeu) ?? null, fin });
    }
    return liste;
  }

  /** Spec 43 : nom du réseau (producteur du jeu), ou null. */
  nomDuJeu(jeu: string): string | null {
    return this.noms.get(jeu) ?? null;
  }

  /** Spec 41 : téléphone publié par l'exploitant dans le GTFS du jeu, ou null. */
  telephone(jeu: string, exploitant: string | null): string | null {
    return exploitant ? (this.agences.get(jeu)?.[exploitant] ?? null) : null;
  }

  /** « appel » si monter à `de` ou descendre à `a` demande de réserver ce passage. */
  reservation(jeu: string, tripId: string, de: string | null, a: string | null): ReservationEtape {
    const arrets = this.reservations.get(jeu)?.get(tripId);
    if (!arrets) return null;
    return (de !== null && arrets.has(`m:${de}`)) || (a !== null && arrets.has(`d:${a}`)) ? "appel" : null;
  }
}

export async function chargerHoraires(chemin: string): Promise<IndexHoraires> {
  return new IndexHoraires(schemaFichier.parse(JSON.parse(await readFile(chemin, "utf8"))));
}
