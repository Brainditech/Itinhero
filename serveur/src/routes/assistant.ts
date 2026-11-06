import type { FastifyInstance } from "fastify";
import { controlerSortie, GABARITS, schemaRequeteAssistant, type Gabarit } from "../assistant/assistant.js";
import { coutEur } from "../comprendre/cout.js";
import { contexteParis, type Claude } from "./comprendre.js";
import { refuserEntree } from "./erreurs.js";

/**
 * `POST /v1/assistant` (spec 37, D31, D115). Clé d'appareil et limites de débit : celles de toute route `/v1`.
 * Même plafond et même compteur que `/v1/comprendre` (D31).
 * - Claude non configuré, en panne, refus, sortie hors schéma ⇒ 503 `assistant_indisponible` ;
 * - plafond du mois atteint ⇒ 503 `plafond_atteint` : l'app propose « Modifier la recherche ».
 * Ni la demande, ni les réglages, ni la sortie ne vont au journal (invariant 10) : seulement le nom de l'erreur.
 */
export function routeAssistant(
  app: FastifyInstance,
  claude: Claude | undefined,
  maintenant: () => Date = () => new Date(),
  gabarits: Gabarit[] = GABARITS,
): void {
  app.post("/assistant", { bodyLimit: 4096 }, async (requete, reponse) => {
    const entree = schemaRequeteAssistant.safeParse(requete.body);
    if (!entree.success) return refuserEntree(reponse, entree.error);
    if (!claude?.assistant) return reponse.code(503).send({ erreur: "assistant_indisponible" });
    if (claude.compteur.atteint()) {
      requete.log.warn({ erreur: "plafond_atteint" }, "plafond mensuel de Claude atteint");
      return reponse.code(503).send({ erreur: "plafond_atteint" });
    }
    const { phrase, reglages } = entree.data;
    let r;
    try {
      r = await claude.assistant(phrase, reglages, contexteParis(maintenant()));
    } catch (e) {
      requete.log.error({ erreur: (e as Error).name }, "appel à Claude impossible");
      return reponse.code(503).send({ erreur: "assistant_indisponible" });
    }
    claude.compteur.ajouter(coutEur(claude.modele, r.jetons));
    const controlee = r.refus ? null : controlerSortie(r.sortie, phrase, reglages, gabarits);
    if (!controlee) {
      requete.log.warn({ erreur: r.refus ? "refus" : "sortie_hors_schema" }, "sortie de Claude refusée");
      return reponse.code(503).send({ erreur: "assistant_indisponible" });
    }
    return { reponse: controlee };
  });
}
