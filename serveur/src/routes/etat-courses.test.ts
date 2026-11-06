import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { lireEtatCourse } from "../itineraires/motis-course.js";
import { appTest, ENTETE } from "../outils-test.js";

// Réponse enregistrée le 2026-11-05 sur le MOTIS national, sans flux temps réel : TER P25 du 12/11.
const EXEMPLE = path.join(path.dirname(fileURLToPath(import.meta.url)), "../itineraires/__exemples__/course-ter-p25-2026-11-12.json");
type Course = { legs: Record<string, unknown>[] };
const exemple = async (): Promise<Course> => JSON.parse(await readFile(EXEMPLE, "utf8"));
const ID = "20261112_08:33_r83582_OCESN892602F1187_F:TER:FR:Line::0A658222-AADD-44FF-B769-75FEE61C107E::87683573:87682302:12:1005:20261210";
const ID2 = "20261112_06:27_r84072_1014608-1-1";

/** La course enregistrée, avec un retard en minutes et le drapeau temps réel. */
async function avecRetard(minutes: number, realTime = true, cancelled = false): Promise<Course> {
  const c = await exemple();
  const decale = (iso: unknown) => new Date(Date.parse(iso as string) + minutes * 60_000).toISOString();
  return {
    ...c,
    legs: c.legs.map((l) => ({ ...l, realTime, cancelled, startTime: decale(l.scheduledStartTime), endTime: decale(l.scheduledEndTime) })),
  };
}

describe("lireEtatCourse (spec 33, critère 1)", () => {
  it("sans temps réel (la réponse enregistrée) ⇒ prévu", async () => {
    expect(lireEtatCourse(await exemple())).toEqual({ etat: "prevu" });
  });
  it("temps réel : 4 min ⇒ en direct ; 5 min ⇒ retard (D21) ; supprimée ⇒ supprimé ; en avance ⇒ 0", async () => {
    expect(lireEtatCourse(await avecRetard(4))).toEqual({ etat: "en_direct", retard_minutes: 4 });
    expect(lireEtatCourse(await avecRetard(5))).toEqual({ etat: "retard", retard_minutes: 5 });
    expect(lireEtatCourse(await avecRetard(0, false, true))).toEqual({ etat: "supprime" });
    expect(lireEtatCourse(await avecRetard(-3))).toEqual({ etat: "en_direct", retard_minutes: 0 });
  });
  it("hors schéma ⇒ erreur", () => {
    expect(() => lireEtatCourse({ legs: [] })).toThrow();
  });
});

describe("POST /v1/etat-courses (spec 33)", () => {
  const moteur = (reponses: Record<string, () => Promise<unknown>>) => ({
    plan: () => Promise.reject(new Error("inutile")),
    geocoder: () => Promise.reject(new Error("inutile")),
    course: (id: string) => (reponses[id] ?? (() => Promise.reject(new Error("inconnue"))))(),
  });
  const poster = (app: ReturnType<typeof appTest>, payload: unknown, headers: Record<string, string> = ENTETE) =>
    app.inject({ method: "POST", url: "/v1/etat-courses", headers, payload: payload as object });

  it("un état par course, dans l'ordre ; une course en panne ⇒ inconnu sans faire échouer l'autre (critère 2)", async () => {
    const app = appTest({ moteur: moteur({ [ID]: () => avecRetard(12) }) });
    const r = await poster(app, { courses: [ID, ID2] });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({
      etats: [
        { course: ID, etat: "retard", retard_minutes: 12 },
        { course: ID2, etat: "inconnu" },
      ],
    });
  });

  it.each([
    ["vide", { courses: [] }],
    ["plus de 20", { courses: Array.from({ length: 21 }, (_, i) => `20261112_06:${String(i).padStart(2, "0")}_r1_t`) }],
    ["doublon", { courses: [ID, ID] }],
    ["mal formée", { courses: ["abc"] }],
    ["champ en plus", { courses: [ID], lieu: "Joigny" }],
  ])("liste %s ⇒ 400 (critère 3)", async (_cas, corps) => {
    expect((await poster(appTest({ moteur: moteur({}) }), corps)).statusCode).toBe(400);
  });

  it("sans clé ⇒ 401 ; toutes en panne ⇒ 503 (critère 4)", async () => {
    const app = appTest({ moteur: moteur({}) });
    expect((await poster(app, { courses: [ID] }, {})).statusCode).toBe(401);
    expect((await poster(app, { courses: [ID] })).statusCode).toBe(503);
  });
});
