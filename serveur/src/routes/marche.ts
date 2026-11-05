import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Manifest } from "../manifest.js";
import type { Moteur } from "../motis.js";
import { lireMarche } from "../itineraires/motis-marche.js";
import { schemaPoint } from "./itineraires.js";
import { appelMoteur, refuserEntree } from "./erreurs.js";

/**
 * `POST /v1/marche` (spec 20, D96) : un nouveau chemin à pied de la position à la fin de la marche en cours,
 * parti maintenant. Rien n'est gardé ; ni `de` ni `a` dans les journaux (invariants 6 et 10).
 */
export const schemaRequeteMarche = z.object({ de: schemaPoint, a: schemaPoint }).strict();

export function routeMarche(app: FastifyInstance, moteur: Moteur, manifest: Manifest): void {
  app.post("/marche", { bodyLimit: 1024 }, async (requete, reponse) => {
    const entree = schemaRequeteMarche.safeParse(requete.body);
    if (!entree.success) return refuserEntree(reponse, entree.error);
    const marche = moteur.marche;
    if (!marche) return reponse.code(503).send({ erreur: "moteur_indisponible" });
    const { de, a } = entree.data;
    const etape = await appelMoteur(reponse, async () => ({ e: lireMarche(await marche(de, a, new Date()), manifest) }));
    if (etape === undefined) return reponse;
    return { marche: etape.e };
  });
}
