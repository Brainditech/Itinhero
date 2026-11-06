import type { Abonnements } from "../abonnements/abonnements.js";
import { lireEtatCourse } from "../itineraires/motis-course.js";

/**
 * `suivi-retards` (spec 42, D123, D21) : chaque minute, l'état de chaque course suivie (GTFS-RT via MOTIS) ; une
 * suppression, ou un retard de 5 min puis chaque hausse de 5 min, part en notification Expo Push vers les jetons
 * abonnés. Le message ne contient ni lieu ni heure de trajet personnelle : seulement l'état et l'identifiant de la
 * course, que l'app rapproche de son trajet enregistré (invariants 6 et 10).
 * Tâche du processus de l'API (D123 : pas d'Inngest) ; ce qui a déjà été dit vit en mémoire et se perd au
 * redémarrage (au pire une alerte répétée).
 */
export const RETARD_SIGNALE_MIN = 5;

export type MessagePush = { to: string; title: string; body: string; data: { course: string; supprime: boolean }; channelId: string };
export type EnvoyerPush = (messages: MessagePush[]) => Promise<void>;

/** Expo Push (doc « Sending notifications with Expo's push API ») : 100 messages par requête au plus. */
export function envoyerExpo(jetonAcces: string | undefined): EnvoyerPush {
  return async (messages) => {
    for (let i = 0; i < messages.length; i += 100) {
      const r = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...(jetonAcces ? { authorization: `Bearer ${jetonAcces}` } : {}),
        },
        body: JSON.stringify(messages.slice(i, i + 100)),
        signal: AbortSignal.timeout(15_000),
      });
      if (!r.ok) throw new Error(`expo push ${r.status}`);
    }
  };
}

export class SuiviRetards {
  /** id d'abonnement ⇒ « supprime » ou dernier retard signalé. */
  private readonly dits = new Map<string, "supprime" | number>();

  constructor(
    private readonly abonnements: Abonnements,
    private readonly course: (id: string) => Promise<unknown>,
    private readonly envoyer: EnvoyerPush,
  ) {}

  /** Un tour : rend le nombre de notifications envoyées. Une course illisible est passée sans rien dire. */
  async tour(maintenant: Date): Promise<number> {
    const actifs = this.abonnements.actifs(maintenant);
    const parCourse = new Map<string, typeof actifs>();
    for (const a of actifs) parCourse.set(a.trip_id, [...(parCourse.get(a.trip_id) ?? []), a]);
    const messages: MessagePush[] = [];
    for (const [course, abonnes] of parCourse) {
      let etat;
      try {
        etat = lireEtatCourse(await this.course(course));
      } catch {
        continue;
      }
      for (const a of abonnes) {
        const avant = this.dits.get(a.id);
        if (etat.etat === "supprime" && avant !== "supprime") {
          this.dits.set(a.id, "supprime");
          messages.push({
            to: a.jeton_push,
            title: "Un véhicule de votre trajet est supprimé",
            body: "Touchez pour voir votre trajet et chercher une autre solution.",
            data: { course, supprime: true },
            channelId: "rappels",
          });
        } else if (etat.etat === "retard" && avant !== "supprime" && etat.retard_minutes >= RETARD_SIGNALE_MIN) {
          if (avant === undefined || etat.retard_minutes >= avant + RETARD_SIGNALE_MIN) {
            this.dits.set(a.id, etat.retard_minutes);
            messages.push({
              to: a.jeton_push,
              title: `Retard de ${etat.retard_minutes} min sur votre trajet`,
              body: "Touchez pour voir votre trajet en direct.",
              data: { course, supprime: false },
              channelId: "rappels",
            });
          }
        }
      }
    }
    if (messages.length > 0) await this.envoyer(messages);
    return messages.length;
  }
}
