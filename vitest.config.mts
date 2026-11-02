import { defineConfig } from "vitest/config";

// Domaine en TypeScript pur, testé sous Node (A5) : aucun rendu React Native ici.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
