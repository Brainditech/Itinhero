import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppelAssistant } from "../assistant/assistant.js";
import { phraseDitUnJour, schemaComprehension, type AppelClaude, type Contexte } from "../comprendre/comprendre.js";
import { coutEur, type CompteurCout, type ModeleClaude } from "../comprendre/cout.js";
import { heureParis } from "../temps.js";
import { refuserEntree } from "./erreurs.js";

/** Claude (spec 28) ; `assistant` : l'appel de `/v1/assistant` (spec 37), même modèle et même compteur. */
export type Claude = { appel: AppelClaude; modele: ModeleClaude; compteur: CompteurCout; assistant?: AppelAssistant };

const schemaRequete = z.object({ phrase: z.string().trim().min(3).max(300) }).strict();

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** Date, jour de la semaine et heure de Paris : fournis par le serveur, jamais devinés par Claude (D106). */
export function contexteParis(instant: Date): Contexte {
  const p = heureParis(instant);
  const [a, m, j] = p.jour.split("-").map(Number) as [number, number, number];
  return { aujourdhui: p.jour, jourSemaine: JOURS[new Date(Date.UTC(a, m - 1, j)).getUTCDay()]!, heure: p.hhmm };
}

/**
 * `POST /v1/comprendre` (spec 28, D106). Clé d'appareil et limites de débit : celles de toute route `/v1`.
 * - Claude non configuré ⇒ 503 `comprendre_indisponible` ; plafond du mois atteint ⇒ 503 `plafond_atteint` :
 *   l'app ouvre le formulaire de repli.
 * - Claude en panne, refus, sortie hors schéma ⇒ 503 `comprendre_indisponible`.
 * Ni la phrase ni la sortie ne vont au journal (invariant 10) : seulement le nom de l'erreur.
 */
export function routeComprendre(app: FastifyInstance, claude: Claude | undefined, maintenant: () => Date = () => new Date()): void {
  app.post("/comprendre", { bodyLimit: 2048 }, async (requete, reponse) => {
    const entree = schemaRequete.safeParse(requete.body);
    if (!entree.success) return refuserEntree(reponse, entree.error);
    if (!claude) return reponse.code(503).send({ erreur: "comprendre_indisponible" });
    if (claude.compteur.atteint()) {
      requete.log.warn({ erreur: "plafond_atteint" }, "plafond mensuel de Claude atteint");
      return reponse.code(503).send({ erreur: "plafond_atteint" });
    }
    let r;
    try {
      r = await claude.appel(entree.data.phrase, contexteParis(maintenant()));
    } catch (e) {
      requete.log.error({ erreur: (e as Error).name }, "appel à Claude impossible");
      return reponse.code(503).send({ erreur: "comprendre_indisponible" });
    }
    claude.compteur.ajouter(coutEur(claude.modele, r.jetons));
    const lu = schemaComprehension.safeParse(r.sortie);
    if (r.refus || !lu.success) {
      requete.log.warn({ erreur: r.refus ? "refus" : "sortie_hors_schema" }, "sortie de Claude refusée");
      return reponse.code(503).send({ erreur: "comprendre_indisponible" });
    }
    // Spec 35 (D113) : une date que la phrase ne dit pas est ignorée.
    const comprehension = phraseDitUnJour(entree.data.phrase) ? lu.data : { ...lu.data, date: null };
    return { comprehension };
  });
}
