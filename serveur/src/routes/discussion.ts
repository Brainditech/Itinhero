import type { FastifyInstance } from "fastify";
import { schemaPropositionRecherche, schemaRequeteDiscussion, type PropositionRecherche } from "../assistant/discussion.js";
import { filtreFlux } from "../assistant/filtre.js";
import { coutEur, type Jetons } from "../comprendre/cout.js";
import { ENTETES_SECURITE } from "../securite.js";
import { contexteParis, type Claude } from "./comprendre.js";
import { refuserEntree } from "./erreurs.js";

/** 20 messages de 1 000 caractères, le résumé de la recherche et une pièce jointe de 2 Mo en base64 (spec 45). */
const CORPS_MAX = 3 * 1024 * 1024;

export type EvenementDiscussion = {
  texte: { texte: string };
  recherche: PropositionRecherche;
  fin: Record<string, never>;
  erreur: { erreur: "indisponible" };
};

/** Jour de Paris d'un instant. */
const jourParis = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);

/**
 * `POST /v1/assistant/discussion` (spec 39, D117). Clé d'appareil et limites de débit : celles de toute route `/v1` ;
 * même plafond et même compteur que `/v1/comprendre` (invariant 8).
 * - Entrée hors schéma (coordonnées, champ inconnu, plus de 20 messages, message trop long) ⇒ 400 JSON.
 * - Sinon, flux `text/event-stream` : `texte` (morceau déjà filtré, §5), puis `fin` ; ou `erreur` `indisponible`
 *   (Claude non configuré, plafond atteint, panne, refus).
 * - L'app ferme la connexion (« Arrêter ») ⇒ l'appel à Claude est coupé ; les jetons consommés comptent.
 * Rien n'est gardé, et le journal ne reçoit que la durée, les jetons et l'issue (invariants 6 et 10).
 */
export function routeDiscussion(app: FastifyInstance, claude: Claude | undefined, maintenant: () => Date = () => new Date()): void {
  app.post("/assistant/discussion", { bodyLimit: CORPS_MAX }, async (requete, reponse) => {
    const entree = schemaRequeteDiscussion.safeParse(requete.body);
    if (!entree.success) return refuserEntree(reponse, entree.error);

    const debut = Date.now();
    // Flux écrit à la main : le crochet `onSend` (en-têtes de sécurité) ne passe pas, ils sont posés ici.
    reponse.hijack();
    const flux = reponse.raw;
    flux.writeHead(200, {
      ...ENTETES_SECURITE,
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no",
    });
    // En-têtes envoyés tout de suite : l'app montre la bulle de l'Assistant avant le premier mot.
    flux.flushHeaders();
    let termine = false;
    const envoyer = <E extends keyof EvenementDiscussion>(evenement: E, donnees: EvenementDiscussion[E]) => {
      if (!flux.writableEnded && !flux.destroyed) flux.write(`event: ${evenement}\ndata: ${JSON.stringify(donnees)}\n\n`);
    };
    const clore = (issue: string, jetons?: Jetons) => {
      termine = true;
      requete.log.info(
        { duree_ms: Date.now() - debut, jetons_entree: jetons?.input_tokens ?? 0, jetons_sortie: jetons?.output_tokens ?? 0, issue },
        "discussion de l'Assistant",
      );
      if (!flux.writableEnded) flux.end();
    };

    if (!claude?.discussion) {
      envoyer("erreur", { erreur: "indisponible" });
      return clore("non_configure");
    }
    if (claude.compteur.atteint()) {
      requete.log.warn({ erreur: "plafond_atteint" }, "plafond mensuel de Claude atteint");
      envoyer("erreur", { erreur: "indisponible" });
      return clore("plafond_atteint");
    }

    const controle = new AbortController();
    flux.on("close", () => {
      if (!termine) controle.abort();
    });
    const filtre = filtreFlux();
    try {
      const fin = await claude.discussion(
        entree.data,
        contexteParis(maintenant()),
        (morceau) => {
          const t = filtre.pousser(morceau);
          if (t) envoyer("texte", { texte: t });
        },
        controle.signal,
      );
      claude.compteur.ajouter(coutEur(claude.modele, fin.jetons));
      if (controle.signal.aborted) return clore("arretee", fin.jetons);
      const reste = filtre.finir();
      if (reste) envoyer("texte", { texte: reste });
      if (fin.refus) {
        envoyer("erreur", { erreur: "indisponible" });
        return clore("refus", fin.jetons);
      }
      // Spec 45 (D126) : la recherche proposée, revalidée (invariant 9) ; un jour passé est laissé de côté.
      for (const brute of (fin.recherches ?? []).slice(0, 1)) {
        const lue = schemaPropositionRecherche.safeParse(brute);
        if (lue.success && lue.data.date >= jourParis(maintenant())) envoyer("recherche", lue.data);
      }
      envoyer("fin", {});
      return clore("complete", fin.jetons);
    } catch (e) {
      if (controle.signal.aborted) return clore("arretee");
      requete.log.error({ erreur: (e as Error).name }, "appel à Claude impossible");
      envoyer("erreur", { erreur: "indisponible" });
      return clore("panne");
    }
  });
}
