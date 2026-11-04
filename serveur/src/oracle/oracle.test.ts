import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { lireTableFacultative, minutesGtfs } from "./gtfs.js";
import { ErreurFixtures, Oracle } from "./oracle.js";

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures");

/** Écrit un mini-GTFS zippé et son manifeste dans un dossier temporaire. */
async function miniFixtures(fichiers: Record<string, string>, jeu = "essai"): Promise<string> {
  const dossier = await mkdtemp(path.join(tmpdir(), "itinhero-oracle-"));
  const zip = zipSync(Object.fromEntries(Object.entries(fichiers).map(([n, t]) => [n, strToU8(t)])));
  await writeFile(path.join(dossier, "gtfs.zip"), zip);
  const manifest = {
    version: 1,
    fichiers: [
      {
        jeu,
        type: "gtfs",
        chemin: "gtfs.zip",
        url_source: "https://exemple.org/gtfs.zip",
        licence: "ODbL",
        date_telechargement: "2026-11-04",
        feed_version: null,
        date_fichiers: null,
        taille: zip.length,
        sha256: createHash("sha256").update(zip).digest("hex"),
      },
    ],
  };
  await writeFile(path.join(dossier, "manifest.json"), JSON.stringify(manifest));
  return dossier;
}

const ROUTES = "route_id,route_short_name,route_type\r\nR1,K1,3\r\nR2,T2,2\r\n";
const TRIPS =
  "route_id,service_id,trip_id\r\n" +
  "R1,S1,T1\r\nR1,S1,T2\r\nR2,M1,T3\r\nR2,S1,T4\r\nR1,S1,T5\r\n";
const STOP_TIMES =
  "trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type,drop_off_type\r\n" +
  // T1 : A puis B
  "T1,06:27:00,06:27:00,A,1,0,0\r\nT1,06:37:00,06:37:00,B,2,0,0\r\n" +
  // T2 : B puis A (sens inverse)
  "T2,07:00:00,07:00:00,B,1,0,0\r\nT2,07:10:00,07:10:00,A,2,0,0\r\n" +
  // T3 : après minuit (jour de service), montée à la demande
  "T3,25:10:00,25:10:00,A,1,2,0\r\nT3,25:40:00,25:40:00,B,2,0,0\r\n" +
  // T4 : pas de montée en A
  "T4,08:00:00,08:00:00,A,1,1,0\r\nT4,08:10:00,08:10:00,B,2,0,0\r\n" +
  // T5 : pas de descente en B
  "T5,09:00:00,09:00:00,A,1,0,0\r\nT5,09:10:00,09:10:00,B,2,0,1\r\n";
// BOM, champs entre guillemets avec virgule et guillemets doublés.
const STOPS =
  "﻿stop_id,stop_name,stop_lat,stop_lon\r\n" +
  'A,"Gare, quai ""1""",47.5,3.5\r\nB,Mairie,47.6,3.6\r\n';

describe("oracle, calendar_dates seul (comme SNCF)", () => {
  const fichiers = {
    "calendar_dates.txt": "service_id,date,exception_type\r\nS1,20261112,1\r\nM1,20261112,1\r\n",
    "routes.txt": ROUTES,
    "trips.txt": TRIPS,
    "stop_times.txt": STOP_TIMES,
    "stops.txt": STOPS,
  };

  it("exception 1 ⇒ circule, absence ⇒ ne circule pas", async () => {
    const o = await Oracle.ouvrir(await miniFixtures(fichiers));
    expect(await o.circule("essai", "S1", "2026-11-12")).toBe(true);
    expect(await o.circule("essai", "S1", "2026-11-11")).toBe(false);
  });

  it("courses : A puis B seulement, montée et descente permises, au-delà de 24:00 sans erreur", async () => {
    const o = await Oracle.ouvrir(await miniFixtures(fichiers));
    const c = await o.courses("essai", "A", "B", "2026-11-12");
    expect(c.map((x) => x.tripId)).toEqual(["T1", "T3"]);
    expect(c[0]).toMatchObject({ ligne: "K1", routeType: 3, depart: 387, arrivee: 397, pickupType: 0 });
    expect(c[1]).toMatchObject({ ligne: "T2", routeType: 2, depart: 1510, arrivee: 1540, pickupType: 2 });
    expect(await o.courses("essai", "B", "A", "2026-11-12")).toMatchObject([{ tripId: "T2" }]);
    expect(await o.courses("essai", "A", "B", "2026-11-11")).toEqual([]);
  });

  it("departs : tout passage où la montée est permise (T4 exclu)", async () => {
    const o = await Oracle.ouvrir(await miniFixtures(fichiers));
    const d = await o.departs("essai", "A", "2026-11-12");
    expect(d.map((x) => x.tripId)).toEqual(["T1", "T2", "T5", "T3"]);
  });

  it("lit le BOM et les champs entre guillemets", async () => {
    const o = await Oracle.ouvrir(await miniFixtures(fichiers));
    expect(await o.arret("essai", "A")).toEqual({ id: "A", nom: 'Gare, quai "1"', lat: 47.5, lon: 3.5 });
  });

  it("un fichier absent du zip ⇒ null", async () => {
    const dossier = await miniFixtures(fichiers);
    expect(await lireTableFacultative(path.join(dossier, "gtfs.zip"), "calendar.txt")).toBeNull();
  });
});

describe("oracle, calendar + calendar_dates (comme Mobigo)", () => {
  const fichiers = {
    "calendar.txt":
      "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\r\n" +
      "M1,1,1,1,1,1,1,0,20260921,20270702\r\n" +
      "M2,1,1,1,1,1,0,0,20260921,20270702\r\n",
    "calendar_dates.txt": "service_id,date,exception_type\r\nM1,20261111,2\r\nM2,20261115,1\r\n",
    "routes.txt": ROUTES,
    "trips.txt": TRIPS,
    "stop_times.txt": STOP_TIMES,
    "stops.txt": STOPS,
  };

  it("jour de semaine dans les bornes ⇒ circule ; dimanche ou hors bornes ⇒ non", async () => {
    const o = await Oracle.ouvrir(await miniFixtures(fichiers));
    expect(await o.circule("essai", "M1", "2026-11-12")).toBe(true); // jeudi
    expect(await o.circule("essai", "M1", "2026-11-14")).toBe(true); // samedi
    expect(await o.circule("essai", "M1", "2026-11-15")).toBe(false); // dimanche
    expect(await o.circule("essai", "M1", "2027-07-05")).toBe(false); // après la fin
  });

  it("exception 2 ⇒ ne circule pas ; exception 1 hors calendrier ⇒ circule", async () => {
    const o = await Oracle.ouvrir(await miniFixtures(fichiers));
    expect(await o.circule("essai", "M1", "2026-11-11")).toBe(false);
    expect(await o.circule("essai", "M2", "2026-11-15")).toBe(true);
  });
});

describe("oracle, sha256", () => {
  it("un sha256 faux ⇒ l'oracle refuse de lire", async () => {
    const dossier = await miniFixtures({ "calendar_dates.txt": "service_id,date,exception_type\r\n" });
    await writeFile(path.join(dossier, "gtfs.zip"), "autre contenu");
    await expect(Oracle.ouvrir(dossier)).rejects.toBeInstanceOf(ErreurFixtures);
  });
});

describe("minutesGtfs", () => {
  it("lit les heures au-delà de 24:00 et refuse une heure illisible", () => {
    expect(minutesGtfs("06:27:00")).toBe(387);
    expect(minutesGtfs("25:10:00")).toBe(1510);
    expect(() => minutesGtfs("6h27")).toThrow();
  });
});

describe("oracle sur les vraies fixtures", () => {
  // Constats de la spec 05 §2 (calendar_dates SNCF), relus ici par l'oracle.
  it("le service 000015 circule le 12/11, ni le 11/11 (férié) ni le 15/11 (dimanche)", async () => {
    const o = await Oracle.ouvrir(FIXTURES);
    expect(await o.circule("sncf", "000015", "2026-11-12")).toBe(true);
    expect(await o.circule("sncf", "000015", "2026-11-11")).toBe(false);
    expect(await o.circule("sncf", "000015", "2026-11-15")).toBe(false);
  });

  it("lit un arrêt SNCF avec son accent", async () => {
    const o = await Oracle.ouvrir(FIXTURES);
    const a = await o.arret("sncf", "StopPoint:OCECar TER-87117994");
    expect(a.nom).toBe("Brienon-sur-Armançon Mairie");
  });
});
