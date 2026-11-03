import { defineConfig } from "vitest/config";

// Serveur Itinhero : TypeScript pur sous Node (spec 04, D40).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
