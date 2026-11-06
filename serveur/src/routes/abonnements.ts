import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Abonnements } from "../abonnements/abonnements.js";
import { MOTIF_COURSE } from "../itineraires/motis-course.js";
import { heureParis } from "../temps.js";
import { refuserEntree } from "./erreurs.js";

/** Jeton Expo Push (doc expo-notifications SDK 58 : `ExponentPushToken[…]`). */
const JETON_EXPO = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$/;
const JOUR_MS = 24 * 60 * 60 * 1000;
/** Une course d'au plus 60 jours à venir (fenêtre des GTFS, phase 8) ; hier accepté (course de nuit). */
const JOURS_A_VENIR = 60;

export const schemaRequeteAbonnement = z
  .object({
    trip_id: z.string().min(1).max(300).regex(MOTIF_COURSE),
    date_service: z.iso.date(),
    jeton_push: z.string().regex(JETON_EXPO),
  })
  .strict();

const schemaId = z.object({ id: z.string().regex(/^[0-9a-f]{32}$/) }).strict();

/**
 * `POST /v1/abonnements`, `DELETE /v1/abonnements/:id` (spec 29, D107). Sous la clé d'appareil de `/v1`.
 * Rien d'autre que la course, son jour et le jeton push n'est reçu ni gardé ; le journal n'en voit rien.
 */
export function routeAbonnements(app: FastifyInstance, abonnements: Abonnements | undefined, maintenant: () => Date = () => new Date()): void {
  app.post("/abonnements", { bodyLimit: 1024 }, async (requete, reponse) => {
    const entree = schemaRequeteAbonnement.safeParse(requete.body);
    if (!entree.success) return refuserEntree(reponse, entree.error);
    if (!abonnements) return reponse.code(503).send({ erreur: "abonnements_indisponibles" });
    const aujourdhui = heureParis(maintenant()).jour;
    const ecart = (Date.parse(entree.data.date_service) - Date.parse(aujourdhui)) / JOUR_MS;
    if (ecart < -1 || ecart > JOURS_A_VENIR) {
      return reponse.code(400).send({ erreur: "requete_invalide", champs: ["date_service"] });
    }
    const a = abonnements.ajouter(entree.data.trip_id, entree.data.date_service, entree.data.jeton_push);
    if (!a) {
      requete.log.warn({ erreur: "abonnements_pleins" }, "plafond des abonnements atteint");
      return reponse.code(503).send({ erreur: "abonnements_indisponibles" });
    }
    return reponse.code(201).send({ id: a.id, expiration: a.expiration });
  });

  app.delete("/abonnements/:id", async (requete, reponse) => {
    const entree = schemaId.safeParse(requete.params);
    if (!entree.success) return refuserEntree(reponse, entree.error);
    if (!abonnements) return reponse.code(503).send({ erreur: "abonnements_indisponibles" });
    // 204 dans les deux cas : on ne dit pas si un identifiant a existé.
    abonnements.retirer(entree.data.id);
    return reponse.code(204).send();
  });
}
