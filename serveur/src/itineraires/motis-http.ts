import { request as requeteHttp } from "node:http";
import { request as requeteHttps } from "node:https";

/**
 * Lecture HTTP par les modules `node:http` et `node:https`, sans `fetch` (issue 0020).
 *
 * MOTIS v2.11.4 répond sans `Content-Length` ni `Transfer-Encoding: chunked` : la fin du corps
 * n'est signalée que par la fermeture de la connexion. Sur ces réponses, l'undici de Node 22.23.4
 * (celui de `fetch`) échoue sur `assert(!this.paused)` hors de toute promesse, ce qui tue le
 * processus de l'API. Toute lecture de MOTIS (et de l'IGN) passe donc par ici.
 */
export type ReponseBrute = { statut: number; corps: Buffer };

/** Corps complet d'un GET. Rejette si le serveur est injoignable, coupe la lecture, ou dépasse `delaiMs`. */
export function lireHttp(url: URL, delaiMs: number): Promise<ReponseBrute> {
  return new Promise((resoudre, rejeter) => {
    const envoyer = url.protocol === "https:" ? requeteHttps : requeteHttp;
    const requete = envoyer(url, { method: "GET", headers: { accept: "application/json" } }, (reponse) => {
      const morceaux: Buffer[] = [];
      reponse.on("data", (m: Buffer) => morceaux.push(m));
      reponse.on("end", () => resoudre({ statut: reponse.statusCode ?? 0, corps: Buffer.concat(morceaux) }));
      reponse.on("error", rejeter);
      // Lecture interrompue (délai, connexion coupée) sans « end » : jamais un corps tronqué.
      reponse.on("close", () => {
        if (!reponse.complete) rejeter(new ErreurLecture("lecture interrompue"));
      });
    });
    // Le délai couvre toute la lecture, corps compris, comme `AbortSignal.timeout` avec `fetch`.
    const minuteur = setTimeout(() => requete.destroy(new ErreurLecture("délai dépassé")), delaiMs);
    const arreter = () => clearTimeout(minuteur);
    requete.on("error", (e) => {
      arreter();
      rejeter(e);
    });
    requete.on("close", arreter);
    requete.end();
  });
}

export class ErreurLecture extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurLecture";
  }
}
