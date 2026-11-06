import { describe, expect, it } from "vitest";
import { IndexHoraires } from "../itineraires/horaires-gtfs.js";
import type { Manifest } from "../manifest.js";
import { horairesAVenir } from "./itineraires.js";

/** Issue 0025 : « Impossible » le 28/12 parce que les horaires d'Île-de-France Mobilités s'arrêtaient au 02/12. */
const fichier = (jeu: string, taille: number) => ({
  jeu,
  type: "gtfs" as const,
  chemin: `gtfs/${jeu}.zip`,
  url_source: "https://transport.data.gouv.fr/",
  licence: "odbl",
  date_telechargement: "2026-11-04",
  feed_version: null,
  date_fichiers: "2026-10-29",
  taille,
  sha256: "0".repeat(64),
});
const manifest: Manifest = {
  version: 1,
  fichiers: [fichier("idfm", 111), fichier("nomad", 44), fichier("petit", 1), fichier("mort", 5), fichier("sncf", 30)],
};
const index = new IndexHoraires({
  version: 1,
  jeux: {
    idfm: { fin_validite: "2026-12-02", reservations: {}, nom: "Île-de-France Mobilités" },
    nomad: { fin_validite: "2027-09-01", reservations: {}, nom: "Syndicat mixte Atoumod" },
    petit: { fin_validite: "2026-12-12", reservations: {} }, // sans nom : compté, pas nommé
    mort: { fin_validite: "2025-08-31", reservations: {}, nom: "Réseau disparu" },
    sncf: { fin_validite: "2026-12-12", reservations: {}, nom: "SNCF" },
  },
});

describe("Horaires pas encore publiés (issue 0025)", () => {
  it("28/12 : trois jeux finissent avant ; les plus gros nommés d'abord ; premier jour sans horaires", () => {
    expect(horairesAVenir(index, manifest, "2026-12-28", "2026-11-06")).toEqual({
      nombre: 3,
      reseaux: [
        { nom: "Île-de-France Mobilités", jusquau: "2026-12-02" },
        { nom: "SNCF", jusquau: "2026-12-12" },
      ],
      des_le: "2026-12-03",
    });
  });

  it("le dernier jour couvert n'est pas « à venir » ; le lendemain l'est", () => {
    expect(horairesAVenir(index, manifest, "2026-12-02", "2026-11-06")).toBeNull();
    expect(horairesAVenir(index, manifest, "2026-12-03", "2026-11-06")?.reseaux).toEqual([{ nom: "Île-de-France Mobilités", jusquau: "2026-12-02" }]);
  });

  it("un jeu déjà fini aujourd'hui (mort) n'est jamais compté ; sans index ⇒ null", () => {
    expect(horairesAVenir(index, manifest, "2026-11-20", "2026-11-06")).toBeNull();
    expect(horairesAVenir(undefined, manifest, "2026-12-28", "2026-11-06")).toBeNull();
  });
});
