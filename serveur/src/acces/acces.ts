import type { FastifyInstance } from "fastify";
import { empreinteAutorisee } from "./cle.js";
import type { Limites } from "./limites.js";

export type Acces = { empreintes: readonly string[]; limites: Limites };

/**
 * Contrôle d'accès des routes `/v1/` (invariant 8) : à appeler dans le greffon enregistré
 * avec le préfixe `/v1`, donc jamais sur `/health`. 401 avant 429 : une clé inconnue n'est pas comptée.
 */
export function controlerAcces(app: FastifyInstance, { empreintes, limites }: Acces): void {
  app.addHook("onRequest", async (requete, reponse) => {
    const e = empreinteAutorisee(requete.headers.authorization, empreintes);
    if (!e) return reponse.code(401).send({ erreur: "cle_invalide" });
    const refus = limites.compter(e);
    if (refus) {
      return reponse
        .code(429)
        .header("retry-after", String(refus.retryAfterSecondes))
        .send({ erreur: "trop_de_requetes", fenetre: refus.fenetre });
    }
  });
}
