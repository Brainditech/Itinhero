import { defineConfig } from "vitest/config";

// Serveur Itinhero : TypeScript pur sous Node (spec 04, D40).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Le test Joigny interroge le vrai MOTIS : commande à part, `npm run test:joigny` (spec 05).
    exclude: ["**/node_modules/**", "src/**/*.integration.test.ts"],
  },
});
