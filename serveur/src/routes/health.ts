import type { FastifyInstance } from "fastify";
import type { Manifest } from "../manifest.js";
import type { SondeMotis } from "../motis.js";

export type ReponseHealth = {
  api: "ok";
  motis: "ok" | "injoignable";
  horaires: {
    jeu: string;
    feed_version: string | null;
    date_fichiers: string | null;
    sha256: string;
  }[];
};

/** `GET /health` (spec 04 §6) : sans clé d'appareil, aucune donnée de trajet ni chemin du PC. */
export function routeHealth(app: FastifyInstance, manifest: Manifest, sonde: SondeMotis): void {
  const horaires = manifest.fichiers
    .filter((f) => f.type === "gtfs")
    .map((f) => ({
      jeu: f.jeu,
      feed_version: f.feed_version,
      date_fichiers: f.date_fichiers,
      sha256: f.sha256,
    }));

  app.get("/health", async (_requete, reponse) => {
    const motisOk = await sonde();
    const corps: ReponseHealth = { api: "ok", motis: motisOk ? "ok" : "injoignable", horaires };
    return reponse.code(motisOk ? 200 : 503).send(corps);
  });
}
