import { defineConfig } from "vitest/config";

// Tests sur le MOTIS national du PC (spec 09, §4.7) : jamais en CI (D54).
// Lancer d'abord le stack national (docker-compose.national.yml). `npm test` reste sans réseau ni Docker.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.national.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
