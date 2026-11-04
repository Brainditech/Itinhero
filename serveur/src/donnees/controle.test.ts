import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { controlerGtfs } from "./controle.js";

const AGENCE = "agency_id,agency_name,agency_url,agency_timezone\nA,Bus,https://bus.fr,Europe/Paris\n";
const contenu = (f: string) => strToU8(f.endsWith("agency.txt") ? AGENCE : "x\n");

function fichiers(noms: string[]): Record<string, Uint8Array> {
  return Object.fromEntries(noms.map((f) => [f, contenu(f)]));
}

function zip(noms: string[]): Uint8Array {
  return zipSync(fichiers(noms));
}

const COMPLET = ["agency.txt", "stops.txt", "routes.txt", "trips.txt", "stop_times.txt"];

describe("controlerGtfs", () => {
  it("accepte un GTFS avec calendar.txt ou calendar_dates.txt", () => {
    expect(controlerGtfs(zip([...COMPLET, "calendar.txt"]))).toEqual({ ok: true });
    expect(controlerGtfs(zip([...COMPLET, "calendar_dates.txt"]))).toEqual({ ok: true });
  });

  it("refuse un GTFS sans calendrier", () => {
    expect(controlerGtfs(zip(COMPLET))).toEqual({
      ok: false,
      raison: "ni calendar.txt ni calendar_dates.txt",
    });
  });

  it("nomme les fichiers manquants", () => {
    expect(controlerGtfs(zip(["stops.txt", "routes.txt", "calendar.txt"]))).toEqual({
      ok: false,
      raison: "fichiers manquants : trips.txt, stop_times.txt",
    });
  });

  it("refuse un GTFS rangé dans un sous-dossier", () => {
    const r = controlerGtfs(zip([...COMPLET, "calendar.txt"].map((f) => `gtfs/${f}`)));
    expect(r).toEqual({ ok: false, raison: "fichiers rangés dans un sous-dossier" });
  });

  it("refuse un locations.geojson qui commence par un BOM UTF-8, accepte le même sans BOM", () => {
    const base = fichiers([...COMPLET, "calendar.txt"]);
    const geo = strToU8('{"type":"FeatureCollection","features":[]}');
    const avecBom = zipSync({ ...base, "locations.geojson": new Uint8Array([0xef, 0xbb, 0xbf, ...geo]) });
    expect(controlerGtfs(avecBom)).toEqual({
      ok: false,
      raison: "locations.geojson commence par un BOM UTF-8 (refusé par MOTIS)",
    });
    expect(controlerGtfs(zipSync({ ...base, "locations.geojson": geo }))).toEqual({ ok: true });
  });

  it("refuse un agency.txt sans fuseau, accepte le même avec Europe/Paris (BOM toléré)", () => {
    const base = fichiers([...COMPLET, "calendar.txt"]);
    const agence = (tz: string) =>
      strToU8(`﻿agency_id,agency_name,agency_url,agency_timezone\nA,Bus,https://bus.fr,${tz}\n`);
    expect(controlerGtfs(zipSync({ ...base, "agency.txt": agence("") }))).toEqual({
      ok: false,
      raison: "agency_timezone absent dans agency.txt",
    });
    expect(controlerGtfs(zipSync({ ...base, "agency.txt": agence("Europe/Paris") }))).toEqual({ ok: true });
  });

  it("tolère une ligne d'agency.txt au nombre de colonnes irrégulier", () => {
    const base = fichiers([...COMPLET, "calendar.txt"]);
    const agence = strToU8(`${AGENCE}B,Car,https://car.fr,Europe/Paris,en trop\n`);
    expect(controlerGtfs(zipSync({ ...base, "agency.txt": agence }))).toEqual({ ok: true });
  });

  it("refuse un routes.txt au guillemet jamais refermé (cas du réseau Tiva)", () => {
    const base = fichiers([...COMPLET, "calendar.txt"]);
    const routes = (nom: string) =>
      strToU8(`route_id,agency_id,route_short_name,route_long_name,route_type\nR1,A,T,${nom},3\n`);
    expect(
      controlerGtfs(zipSync({ ...base, "routes.txt": routes('VIRE - "Les Mancellières - Parc Commercial') })),
    ).toEqual({ ok: false, raison: "routes.txt mal formé (guillemets)" });
    expect(
      controlerGtfs(zipSync({ ...base, "routes.txt": routes('"VIRE - Les Mancellières, Parc"') })),
    ).toEqual({ ok: true });
  });

  it("refuse un fichier qui n'est pas un zip", () => {
    expect(controlerGtfs(strToU8("<html>erreur 404</html>"))).toEqual({
      ok: false,
      raison: "zip illisible",
    });
  });
});
