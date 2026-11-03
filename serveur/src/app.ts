import Fastify, { LogController, type FastifyInstance } from "fastify";
import type { Manifest } from "./manifest.js";
import type { SondeMotis } from "./motis.js";
import { routeHealth } from "./routes/health.js";

export type Dependances = { manifest: Manifest; sonde: SondeMotis };

/**
 * Application Fastify (D39). Journal des requêtes coupé : une URL peut contenir
 * un lieu (`/v1/lieux?q=`), et rien de personnel ne va dans les journaux (invariant 10).
 */
export function construireApp({ manifest, sonde }: Dependances): FastifyInstance {
  const app = Fastify({
    logger: { level: "info" },
    logController: new LogController({ disableRequestLogging: true }),
  });
  routeHealth(app, manifest, sonde);
  return app;
}
