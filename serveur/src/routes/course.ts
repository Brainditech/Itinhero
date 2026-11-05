import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { lireReponseCourse, MOTIF_COURSE } from "../itineraires/motis-course.js";
import type { Moteur } from "../motis.js";
import { appelMoteur, refuserEntree } from "./erreurs.js";

/**
 * `GET /v1/course?id=…` (spec 17, D87) : tous les arrêts d'une course, dans l'ordre, avec leur heure prévue.
 * `id` est le champ `course` d'une étape de `POST /v1/itineraires` ; il ne porte ni lieu ni coordonnée de la personne.
 */
export const schemaRequeteCourse = z
  .object({ id: z.string().min(1).max(300).regex(MOTIF_COURSE) })
  .strict();

export function routeCourse(app: FastifyInstance, moteur: Moteur): void {
  app.get("/course", async (requete, reponse) => {
    const entree = schemaRequeteCourse.safeParse(requete.query);
    if (!entree.success) return refuserEntree(reponse, entree.error);
    const course = moteur.course;
    if (!course) return reponse.code(503).send({ erreur: "moteur_indisponible" });
    const arrets = await appelMoteur(reponse, async () => lireReponseCourse(await course(entree.data.id)));
    if (arrets === undefined) return reponse;
    return { arrets };
  });
}
