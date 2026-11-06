import { describe, expect, it } from "vitest";
import { Abonnements } from "../abonnements/abonnements.js";
import { SuiviRetards, type MessagePush } from "./suivi.js";

/** Spec 42 (D123, D21) : flux GTFS-RT simulé (réponses `/api/v6/trip` de MOTIS) ⇒ notifications Expo Push. */
const reponseTrip = (retardMin: number, opts: { realTime?: boolean; cancelled?: boolean } = {}) => ({
  legs: [
    {
      startTime: new Date(Date.UTC(2026, 10, 12, 8, 10 + retardMin)).toISOString(),
      endTime: new Date(Date.UTC(2026, 10, 12, 8, 40 + retardMin)).toISOString(),
      scheduledStartTime: "2026-11-12T08:10:00.000Z",
      scheduledEndTime: "2026-11-12T08:40:00.000Z",
      realTime: opts.realTime ?? true,
      cancelled: opts.cancelled ?? false,
    },
  ],
});
const COURSE = "20261112_09:10_r83582_OCESN1";
const JETON = "ExponentPushToken[abcdefghijklmnop]";

describe("suivi-retards (spec 42, critère 2)", () => {
  it("retard à 5 min puis à chaque hausse de 5, suppression une fois, prévu ou illisible : rien", async () => {
    const abonnements = new Abonnements(undefined);
    const maintenant = new Date("2026-11-12T07:00:00Z");
    abonnements.ajouter(COURSE, "2026-11-12", JETON);
    let reponse: unknown = reponseTrip(0, { realTime: false });
    const envoyes: MessagePush[] = [];
    const suivi = new SuiviRetards(abonnements, async () => reponse, async (m) => void envoyes.push(...m));

    expect(await suivi.tour(maintenant)).toBe(0);
    reponse = reponseTrip(7);
    expect(await suivi.tour(maintenant)).toBe(1);
    reponse = reponseTrip(9);
    expect(await suivi.tour(maintenant)).toBe(0);
    reponse = reponseTrip(12);
    expect(await suivi.tour(maintenant)).toBe(1);
    reponse = { pas: "un trip" };
    expect(await suivi.tour(maintenant)).toBe(0);
    reponse = reponseTrip(0, { cancelled: true });
    expect(await suivi.tour(maintenant)).toBe(1);
    expect(await suivi.tour(maintenant)).toBe(0);

    expect(envoyes.map((m) => m.title)).toEqual([
      "Retard de 7 min sur votre trajet",
      "Retard de 12 min sur votre trajet",
      "Un véhicule de votre trajet est supprimé",
    ]);
    expect(envoyes[2]).toMatchObject({ to: JETON, data: { course: COURSE, supprime: true }, channelId: "rappels" });
    // Aucun lieu ni heure dans le message (invariants 6 et 10).
    for (const m of envoyes) expect(`${m.title} ${m.body}`).not.toMatch(/\d{2}:\d{2}/);
  });

  it("abonnement expiré : plus suivi", async () => {
    const abonnements = new Abonnements(undefined);
    abonnements.ajouter(COURSE, "2026-11-12", JETON);
    const envoyes: MessagePush[] = [];
    const suivi = new SuiviRetards(abonnements, async () => reponseTrip(20), async (m) => void envoyes.push(...m));
    expect(await suivi.tour(new Date("2026-11-15T00:00:00Z"))).toBe(0);
  });
});
