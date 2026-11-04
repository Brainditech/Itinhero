import { construireApp } from "./app.js";
import { ErreurEnv, lireEnv } from "./env.js";
import { lireManifest } from "./manifest.js";
import { moteurMotis, sondeMotis } from "./motis.js";
import { Limites } from "./acces/limites.js";
import { geocodeurIgn } from "./lieux/ign-geocode.js";
import { chargerLieux } from "./lieux/charger.js";

const CHEMIN_MANIFEST = process.env.FIXTURES_MANIFEST ?? "/fixtures/manifest.json";

async function demarrer(): Promise<void> {
  let env;
  try {
    env = lireEnv(process.env);
  } catch (e) {
    if (e instanceof ErreurEnv) {
      console.error(e.message);
      process.exit(1);
    }
    throw e;
  }
  const manifest = await lireManifest(CHEMIN_MANIFEST);
  const lieux = env.LIEUX_OSM ? await chargerLieux(env.LIEUX_OSM) : undefined;
  const app = construireApp({
    manifest,
    sonde: sondeMotis(env.MOTIS_URL),
    moteur: moteurMotis(env.MOTIS_URL),
    geocodeurIgn: geocodeurIgn(),
    lieux,
    acces: {
      empreintes: env.CLES_APPAREILS,
      limites: new Limites(env.LIMITE_REQ_MINUTE, env.LIMITE_REQ_JOUR),
    },
  });
  await app.listen({ host: "0.0.0.0", port: env.PORT });
}

demarrer().catch((e: unknown) => {
  console.error("Démarrage impossible :", e instanceof Error ? e.message : e);
  process.exit(1);
});
