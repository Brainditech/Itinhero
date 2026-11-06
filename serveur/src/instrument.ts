// Spec 50 : chargé avant l'API par `node --import ./dist/instrument.js dist/index.js` (guide Fastify de Sentry),
// pour que Sentry instrumente Fastify avant son import.
import { initSentry } from "./sentry/init.js";

initSentry();
