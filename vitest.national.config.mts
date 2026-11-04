import { defineConfig } from "vitest/config";

// Client de l'app contre une API lancée sur le PC, reliée au MOTIS national (spec 10, §10).
// Variables : ITINHERO_API_URL et ITINHERO_CLE_ESSAI (clé jetable). Jamais en CI.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.national.test.ts"],
    testTimeout: 60_000,
  },
});
