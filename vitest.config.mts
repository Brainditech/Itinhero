import { configDefaults, defineConfig } from "vitest/config";

// Domaine en TypeScript pur, testé sous Node (A5) : aucun rendu React Native ici.
// Les tests `*.national.test.ts` demandent un serveur lancé : `npm run test:national` (spec 10), jamais en CI.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "src/**/*.national.test.ts"],
  },
});
