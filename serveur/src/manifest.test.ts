import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { lireManifest, schemaManifest, sha256Fichier, verifierManifest } from "./manifest.js";

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../fixtures");

describe("fixtures/manifest.json", () => {
  it("respecte le schéma", async () => {
    const m = await lireManifest(path.join(FIXTURES, "manifest.json"));
    expect(m.fichiers.map((f) => f.jeu)).toEqual(["sncf", "mobigo", "osm"]);
  });

  it("chaque sha256 recalculé égale celui du manifeste (invariant 14)", async () => {
    const m = await lireManifest(path.join(FIXTURES, "manifest.json"));
    expect(await verifierManifest(m, FIXTURES)).toEqual([]);
  });
});

describe("verifierManifest", () => {
  it("signale un fichier dont un octet a changé", async () => {
    const dossier = await mkdtemp(path.join(tmpdir(), "itinhero-manifest-"));
    await writeFile(path.join(dossier, "a.bin"), "contenu");
    const bon = await sha256Fichier(path.join(dossier, "a.bin"));
    const manifest = schemaManifest.parse({
      version: 1,
      fichiers: [
        {
          jeu: "essai",
          type: "gtfs",
          chemin: "a.bin",
          url_source: "https://exemple.org/a.bin",
          licence: "ODbL",
          date_telechargement: "2026-11-03",
          feed_version: null,
          date_fichiers: null,
          taille: 7,
          sha256: bon,
        },
      ],
    });
    expect(await verifierManifest(manifest, dossier)).toEqual([]);
    await writeFile(path.join(dossier, "a.bin"), "contenU");
    const ecarts = await verifierManifest(manifest, dossier);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]?.attendu).toBe(bon);
  });
});

describe("schemaManifest", () => {
  it("refuse un manifeste hors schéma", () => {
    expect(schemaManifest.safeParse({ version: 1, fichiers: [] }).success).toBe(false);
    expect(
      schemaManifest.safeParse({
        version: 1,
        fichiers: [{ jeu: "sncf_x", type: "gtfs", chemin: "x", sha256: "abc" }],
      }).success,
    ).toBe(false);
  });
});
