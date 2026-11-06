import type { FastifyInstance } from "fastify";
import { cartesConnues, type Tarif } from "../tarifs/tarifs.js";

/**
 * `GET /v1/fiches` (spec 43, D124) : les cartes de réduction connues (pour les Réglages) et les tarifs validés, avec
 * leur source. La carte cochée reste sur le téléphone (invariant 7) : le serveur ne la reçoit jamais.
 */
export function routeFiches(app: FastifyInstance, tarifs: Tarif[]): void {
  app.get("/fiches", async () => ({
    cartes: cartesConnues(tarifs),
    tarifs: tarifs
      .filter((t) => t.valide_le !== null)
      .map(({ id, reseau, produit, montant_eur, url, lu_le, valide_le }) => ({ id, reseau, produit, montant_eur, url, lu_le, valide_le })),
  }));
}
