import type { FastifyReply } from "fastify";
import { z } from "zod";
import { ErreurMotis } from "../itineraires/motis-plan.js";
import { Sentry } from "../sentry/init.js";

/** 400 qui nomme les champs refusés sans jamais recopier leur valeur (invariants 9 et 10). */
export function refuserEntree(reponse: FastifyReply, erreur: z.ZodError): FastifyReply {
  const champs = [...new Set(erreur.issues.map((i) => i.path.join(".") || "(corps)"))];
  return reponse.code(400).send({ erreur: "requete_invalide", champs });
}

/**
 * Appel au moteur : injoignable ou en erreur ⇒ 503 ; réponse hors schéma ⇒ 502.
 * Le journal ne reçoit que le nom de l'erreur, jamais l'URL (elle porte un lieu ou des coordonnées).
 */
export async function appelMoteur<T>(reponse: FastifyReply, appel: () => Promise<T>): Promise<T | undefined> {
  try {
    return await appel();
  } catch (e) {
    if (e instanceof z.ZodError) {
      reponse.log.error({ erreur: "reponse_moteur_illisible" }, "réponse de MOTIS hors schéma");
      // Spec 50 : message fixe, sans l'URL ni le contenu de la réponse.
      Sentry.captureMessage("réponse de MOTIS hors schéma", "error");
      reponse.code(502).send({ erreur: "reponse_moteur_illisible" });
      return undefined;
    }
    reponse.log.error({ erreur: e instanceof ErreurMotis ? e.message : (e as Error).name }, "moteur indisponible");
    // Spec 50 : message fixe et nom de l'erreur seulement (le message de MOTIS porte une URL).
    Sentry.captureMessage("moteur indisponible", { level: "error", tags: { erreur: (e as Error).name } });
    reponse.code(503).send({ erreur: "moteur_indisponible" });
    return undefined;
  }
}
