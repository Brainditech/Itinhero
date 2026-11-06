import type { FastifyInstance } from "fastify";

/**
 * En-têtes HTTP de sécurité (spec 26, D105), posés sur TOUTE réponse : route, 400, 401, 404, 429, 500.
 * L'API ne sert que du JSON à l'app : aucune page, aucun script, aucun cadre.
 * Écrits à la main plutôt que par `@fastify/helmet` : sept en-têtes fixes, aucune dépendance à suivre.
 */
export const ENTETES_SECURITE: Readonly<Record<string, string>> = {
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "cross-origin-resource-policy": "same-origin",
  // Ignoré en HTTP ; utile derrière le HTTPS du VPS (R10).
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  // Une réponse porte des horaires du moment ou des lieux : jamais gardée par un cache intermédiaire.
  "cache-control": "no-store",
};

const routes = new WeakMap<FastifyInstance, string[]>();

/** Routes déclarées (« GET /v1/lieux ») : les tests vérifient que chacune refuse une entrée invalide. */
export function routesDeclarees(app: FastifyInstance): readonly string[] {
  return routes.get(app) ?? [];
}

export function poserEntetesSecurite(app: FastifyInstance): void {
  const liste: string[] = [];
  routes.set(app, liste);
  app.addHook("onRoute", (r) => {
    for (const m of [r.method].flat()) if (m !== "HEAD") liste.push(`${m} ${r.url}`);
  });
  app.addHook("onSend", async (_requete, reponse, corps) => {
    for (const [nom, valeur] of Object.entries(ENTETES_SECURITE)) reponse.header(nom, valeur);
    reponse.removeHeader("x-powered-by");
    return corps;
  });
}
