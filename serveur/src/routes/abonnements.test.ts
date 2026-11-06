import { describe, expect, it } from "vitest";
import { Abonnements, COLONNES, expirationDe } from "../abonnements/abonnements.js";
import { appTest, ENTETE } from "../outils-test.js";

const ID_COURSE = "20261112_08:33_r83582_OCESN892602F1187_F:TER:FR:Line::0A658222-AADD-44FF-B769-75FEE61C107E::87683573:87682302:12:1005:20261210";
const JETON = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";
const CORPS = { trip_id: ID_COURSE, date_service: "2026-11-12", jeton_push: JETON };
const MAINTENANT = new Date("2026-11-06T09:00:00Z");

const poster = (app: ReturnType<typeof appTest>, payload: unknown, headers: Record<string, string> = ENTETE) =>
  app.inject({ method: "POST", url: "/v1/abonnements", headers, payload: payload as object });

describe("abonnements_alerte (spec 29)", () => {
  it("aucun champ personnel : seulement id, course, jour, jeton, expiration (critère 1)", () => {
    expect(new Abonnements().colonnes()).toEqual([...COLONNES]);
  });

  it("expiration à la fin de J+1, heure de Paris, changement d'heure compris (critère 2)", () => {
    expect(expirationDe("2026-11-12").toISOString()).toBe("2026-11-13T23:00:00.000Z");
    expect(expirationDe("2026-07-14").toISOString()).toBe("2026-07-15T22:00:00.000Z");
    expect(expirationDe("2026-10-24").toISOString()).toBe("2026-10-25T23:00:00.000Z"); // passage à l'heure d'hiver le 25
  });

  it("purge : retiré à J+1 24:00, gardé juste avant (critère 2)", () => {
    const t = new Abonnements();
    t.ajouter(ID_COURSE, "2026-11-12", JETON);
    t.ajouter(ID_COURSE, "2026-11-20", JETON);
    expect(t.purger(new Date("2026-11-13T22:59:59Z"))).toBe(0);
    expect(t.purger(new Date("2026-11-13T23:00:00Z"))).toBe(1);
    expect(t.actifs(new Date("2026-11-13T23:00:00Z")).map((a) => a.date_service)).toEqual(["2026-11-20"]);
  });
});

describe("POST et DELETE /v1/abonnements (spec 29)", () => {
  it("201 avec un identifiant de 128 bits et l'expiration ; DELETE ⇒ 204, la ligne disparaît (critère 3)", async () => {
    const abonnements = new Abonnements();
    const app = appTest({ abonnements, horloge: () => MAINTENANT });
    const r = await poster(app, CORPS);
    expect(r.statusCode).toBe(201);
    const { id, expiration } = r.json() as { id: string; expiration: string };
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(expiration).toBe("2026-11-13T23:00:00.000Z");
    expect(abonnements.actifs(MAINTENANT)).toHaveLength(1);
    const d = await app.inject({ method: "DELETE", url: `/v1/abonnements/${id}`, headers: ENTETE });
    expect(d.statusCode).toBe(204);
    expect(abonnements.actifs(MAINTENANT)).toHaveLength(0);
    // Inconnu : 204 aussi, on ne dit pas s'il a existé.
    expect((await app.inject({ method: "DELETE", url: `/v1/abonnements/${id}`, headers: ENTETE })).statusCode).toBe(204);
  });

  it.each([
    ["trip_id absent", { ...CORPS, trip_id: undefined }],
    ["trip_id mal formé", { ...CORPS, trip_id: "abc" }],
    ["jeton qui n'est pas un jeton Expo", { ...CORPS, jeton_push: "fcm:123" }],
    ["date impossible", { ...CORPS, date_service: "2026-02-30" }],
    ["jour passé", { ...CORPS, date_service: "2026-11-04" }],
    ["à plus de 60 jours", { ...CORPS, date_service: "2027-01-06" }],
    ["champ en plus (lieu)", { ...CORPS, lieu: "Joigny" }],
  ])("%s ⇒ 400, rien n'est gardé (critère 4)", async (_cas, corps) => {
    const abonnements = new Abonnements();
    const r = await poster(appTest({ abonnements, horloge: () => MAINTENANT }), corps);
    expect(r.statusCode).toBe(400);
    expect(abonnements.actifs(MAINTENANT)).toHaveLength(0);
  });

  it("identifiant mal formé ⇒ 400 ; sans clé ⇒ 401 ; table absente ⇒ 503 (critère 5)", async () => {
    const app = appTest({ abonnements: new Abonnements(), horloge: () => MAINTENANT });
    expect((await app.inject({ method: "DELETE", url: "/v1/abonnements/xyz", headers: ENTETE })).statusCode).toBe(400);
    expect((await poster(app, CORPS, {})).statusCode).toBe(401);
    expect((await poster(appTest({ horloge: () => MAINTENANT }), CORPS)).statusCode).toBe(503);
  });

  it("ni la course ni le jeton dans les journaux (critère 6)", async () => {
    const lignes: string[] = [];
    const app = appTest({ abonnements: new Abonnements(), horloge: () => MAINTENANT, fluxJournal: { write: (l) => void lignes.push(l) } });
    await poster(app, { ...CORPS, jeton_push: "ExponentPushToken[CANARIJETON1234]", lieu: "CANARI-LIEU" });
    await app.inject({ method: "POST", url: "/v1/abonnements", headers: { ...ENTETE, "content-type": "application/json" }, payload: '{"CANARI' });
    expect(lignes.join("\n")).not.toMatch(/CANARI|OCESN/);
  });
});
