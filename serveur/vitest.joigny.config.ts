import { defineConfig } from "vitest/config";

// Test Joigny (spec 05) : interroge le vrai MOTIS (`MOTIS_URL`, par défaut http://127.0.0.1:8080).
// Lancer d'abord « docker compose up -d » à la racine. `npm test` reste sans réseau ni Docker.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
