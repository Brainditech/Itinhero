import { construireApp } from "./app.js";
import { ErreurEnv, lireEnv } from "./env.js";
import { lireManifest } from "./manifest.js";
import { moteurMotis, sondeMotis } from "./motis.js";
import { Limites } from "./acces/limites.js";
import { adresseIgn, geocodeurIgn } from "./lieux/ign-geocode.js";
import { chargerHoraires } from "./itineraires/horaires-gtfs.js";
import { chargerLieux } from "./lieux/charger.js";
import { appelClaude } from "./comprendre/comprendre.js";
import { CompteurCout } from "./comprendre/cout.js";

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
  const horaires = env.HORAIRES_GTFS ? await chargerHoraires(env.HORAIRES_GTFS) : undefined;
  if (!horaires) console.warn("HORAIRES_GTFS absente : les passages sur réservation ne seront pas signalés (D69).");
  // Spec 28 (D106) : les trois variables de Claude, ou aucune (lireEnv a refusé un mélange).
  const claude =
    env.ANTHROPIC_API_KEY && env.CLAUDE_MODEL && env.CLAUDE_PLAFOND_MENSUEL_EUR
      ? {
          appel: appelClaude(env.ANTHROPIC_API_KEY, env.CLAUDE_MODEL),
          modele: env.CLAUDE_MODEL,
          compteur: new CompteurCout(env.CLAUDE_PLAFOND_MENSUEL_EUR),
        }
      : undefined;
  if (!claude) console.warn("Claude non configuré : /v1/comprendre répond 503, l'app ouvre le formulaire (D106).");
  const app = construireApp({
    manifest,
    sonde: sondeMotis(env.MOTIS_URL),
    moteur: moteurMotis(env.MOTIS_URL),
    geocodeurIgn: geocodeurIgn(),
    adresseIgn: adresseIgn(),
    lieux,
    horaires,
    claude,
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
