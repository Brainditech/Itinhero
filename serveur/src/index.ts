import { construireApp } from "./app.js";
import { ErreurEnv, lireEnv } from "./env.js";
import { lireManifest } from "./manifest.js";
import { sondeMotis } from "./motis.js";

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
  const app = construireApp({ manifest, sonde: sondeMotis(env.MOTIS_URL) });
  await app.listen({ host: "0.0.0.0", port: env.PORT });
}

demarrer().catch((e: unknown) => {
  console.error("Démarrage impossible :", e instanceof Error ? e.message : e);
  process.exit(1);
});
