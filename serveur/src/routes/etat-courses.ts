import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { lireEtatCourse, MOTIF_COURSE, type EtatCourse } from "../itineraires/motis-course.js";
import type { Moteur } from "../motis.js";
import { refuserEntree } from "./erreurs.js";

/** Au plus 20 courses par appel : un trajet en compte rarement plus de cinq. */
export const MAX_COURSES = 20;

const schemaRequete = z
  .object({
    courses: z
      .array(z.string().min(1).max(300).regex(MOTIF_COURSE))
      .min(1)
      .max(MAX_COURSES)
      .refine((l) => new Set(l).size === l.length, "doublon"),
  })
  .strict();

/**
 * `POST /v1/etat-courses` (spec 33, D111) : l'état de chaque course d'un trajet enregistré, pour le rafraîchir.
 * Une course illisible ou injoignable vaut « inconnu » sans faire échouer les autres ; MOTIS absent ⇒ 503.
 */
export function routeEtatCourses(app: FastifyInstance, moteur: Moteur): void {
  app.post("/etat-courses", { bodyLimit: 16 * 1024 }, async (requete, reponse) => {
    const entree = schemaRequete.safeParse(requete.body);
    if (!entree.success) return refuserEntree(reponse, entree.error);
    const course = moteur.course;
    if (!course) return reponse.code(503).send({ erreur: "moteur_indisponible" });
    const etats = await Promise.all(
      entree.data.courses.map(async (id): Promise<{ course: string } & (EtatCourse | { etat: "inconnu" })> => {
        try {
          return { course: id, ...lireEtatCourse(await course(id)) };
        } catch (e) {
          requete.log.warn({ erreur: (e as Error).name }, "état d'une course illisible");
          return { course: id, etat: "inconnu" };
        }
      }),
    );
    if (etats.every((e) => e.etat === "inconnu")) return reponse.code(503).send({ erreur: "moteur_indisponible" });
    return { etats };
  });
}
