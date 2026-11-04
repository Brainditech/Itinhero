import { defineConfig } from "vitest/config";

// Serveur Itinhero : TypeScript pur sous Node (spec 04, D40).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Le test Joigny (spec 05) et les tests nationaux (spec 09) interrogent le vrai MOTIS :
    // commandes à part, `npm run test:joigny` et `npm run test:national`.
    exclude: ["**/node_modules/**", "src/**/*.integration.test.ts", "src/**/*.national.test.ts"],
  },
});
