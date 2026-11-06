import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Annuaire } from "../fiches/annuaire.js";
import { schemaPoint } from "./itineraires.js";
import { refuserEntree } from "./erreurs.js";

const schemaRequete = z.object({ point: schemaPoint, type: z.enum(["taxi", "tad"]) }).strict();

/**
 * `POST /v1/numeros` (spec 41, D122, D49) : numéros autour d'un point, d'une fiche validée ou retrouvés sur leur
 * page publique (« non vérifié »), au plus 3. Aucun ⇒ liste vide (« aucun numéro connu »). Le point n'est ni gardé
 * ni journalisé (invariants 6 et 10).
 */
export function routeNumeros(app: FastifyInstance, annuaire: Annuaire | undefined): void {
  app.post("/numeros", { bodyLimit: 1024 }, async (requete, reponse) => {
    const entree = schemaRequete.safeParse(requete.body);
    if (!entree.success) return refuserEntree(reponse, entree.error);
    return { numeros: annuaire?.contactsPres(entree.data.point, entree.data.type) ?? [] };
  });
}
