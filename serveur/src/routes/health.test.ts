import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { construireApp } from "../app.js";
import type { Manifest } from "../manifest.js";
import { sondeMotis } from "../motis.js";
import { createServer, type Server } from "node:http";

const manifest: Manifest = {
  version: 1,
  fichiers: [
    {
      jeu: "sncf",
      type: "gtfs",
      chemin: "_rapatrie-2026-10-19/sncf.zip",
      url_source: "https://exemple.org/sncf.zip",
      licence: "ODbL",
      date_telechargement: "2026-10-19",
      feed_version: "2026-10-18",
      date_fichiers: null,
      taille: 1,
      sha256: "a".repeat(64),
    },
    {
      jeu: "osm",
      type: "osm",
      chemin: "osm/couloir.osm.pbf",
      url_source: "https://exemple.org/osm.pbf",
      licence: "ODbL",
      date_telechargement: "2026-11-03",
      feed_version: null,
      date_fichiers: "2026-11-02",
      taille: 1,
      sha256: "b".repeat(64),
    },
  ],
};

let app: FastifyInstance | undefined;
let faux: Server | undefined;
afterEach(async () => {
  await app?.close();
  await new Promise<void>((r) => (faux ? faux.close(() => r()) : r()));
  app = undefined;
  faux = undefined;
});

/** Faux MOTIS local : répond `statut` après `attenteMs`. */
async function fauxMotis(statut: number, attenteMs = 0): Promise<string> {
  faux = createServer((_req, res) => {
    setTimeout(() => res.writeHead(statut).end("{}"), attenteMs);
  });
  await new Promise<void>((r) => faux!.listen(0, "127.0.0.1", () => r()));
  const adresse = faux.address();
  if (adresse === null || typeof adresse === "string") throw new Error("adresse inattendue");
  return `http://127.0.0.1:${adresse.port}`;
}

describe("GET /health", () => {
  it("200 quand MOTIS répond, avec les jeux GTFS du manifeste seulement", async () => {
    app = construireApp({ manifest, sonde: sondeMotis(await fauxMotis(200)) });
    const r = await app.inject({ method: "GET", url: "/health" });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({
      api: "ok",
      motis: "ok",
      horaires: [
        { jeu: "sncf", feed_version: "2026-10-18", date_fichiers: null, sha256: "a".repeat(64) },
      ],
    });
  });

  it("503 quand MOTIS ne répond pas, corps conforme", async () => {
    app = construireApp({ manifest, sonde: sondeMotis("http://127.0.0.1:1") });
    const r = await app.inject({ method: "GET", url: "/health" });
    expect(r.statusCode).toBe(503);
    expect(r.json()).toMatchObject({ api: "ok", motis: "injoignable" });
    expect(r.json().horaires).toHaveLength(1);
  });

  it("503 quand MOTIS dépasse le délai", async () => {
    app = construireApp({ manifest, sonde: sondeMotis(await fauxMotis(200, 500), 100) });
    const r = await app.inject({ method: "GET", url: "/health" });
    expect(r.statusCode).toBe(503);
    expect(r.json().motis).toBe("injoignable");
  });

  it("503 quand MOTIS répond autre chose que 200", async () => {
    app = construireApp({ manifest, sonde: sondeMotis(await fauxMotis(400)) });
    const r = await app.inject({ method: "GET", url: "/health" });
    expect(r.statusCode).toBe(503);
  });
});
