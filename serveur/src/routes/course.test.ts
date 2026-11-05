import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { construireUrlCourse, lireReponseCourse } from "../itineraires/motis-course.js";
import { ErreurMotis } from "../itineraires/motis-plan.js";
import { appTest, ENTETE } from "../outils-test.js";

// Réponse enregistrée le 2026-11-05 sur le MOTIS national : TER P25 Auxerre → Montereau du jeudi 12/11.
const EXEMPLE = path.join(path.dirname(fileURLToPath(import.meta.url)), "../itineraires/__exemples__/course-ter-p25-2026-11-12.json");
const exemple = async (): Promise<unknown> => JSON.parse(await readFile(EXEMPLE, "utf8"));
const ID = "20261112_08:33_r83582_OCESN892602F1187_F:TER:FR:Line::0A658222-AADD-44FF-B769-75FEE61C107E::87683573:87682302:12:1005:20261210";

function moteurCourse(reponse: () => Promise<unknown>, vu: { id?: string } = {}) {
  return {
    plan: () => Promise.reject(new Error("inutile")),
    geocoder: () => Promise.reject(new Error("inutile")),
    course: async (id: string) => {
      vu.id = id;
      return reponse();
    },
  };
}

const course = (app: ReturnType<typeof appTest>, qs: string) =>
  app.inject({ method: "GET", url: `/v1/course?${qs}`, headers: ENTETE });

describe("GET /v1/course (spec 17, D87)", () => {
  it("tous les arrêts de la course, dans l'ordre, avec l'heure de Paris", async () => {
    const vu: { id?: string } = {};
    const app = appTest({ moteur: moteurCourse(exemple, vu) });
    const r = await course(app, `id=${encodeURIComponent(ID)}`);
    expect(r.statusCode).toBe(200);
    expect(vu.id).toBe(ID);
    const arrets = r.json().arrets as { nom: string; passage: string }[];
    expect(arrets[0]).toMatchObject({ nom: "Auxerre Saint-Gervais", passage: "08:33" });
    expect(arrets.at(-1)).toMatchObject({ nom: "Montereau", passage: "10:05" });
    // Laroche - Migennes puis Joigny se suivent : aucun arrêt entre les deux sur cette course.
    const noms = arrets.map((a) => a.nom);
    expect(noms.indexOf("Joigny") - noms.indexOf("Laroche - Migennes")).toBe(1);
    expect(arrets.find((a) => a.nom === "Joigny")?.passage).toBe("09:17");
  });

  it("id absent, mal formé, trop long, ou paramètre inconnu ⇒ 400, sans appeler MOTIS", async () => {
    const vu: { id?: string } = {};
    const app = appTest({ moteur: moteurCourse(exemple, vu) });
    for (const qs of ["", "id=abc", `id=${"2".repeat(301)}`, `id=${encodeURIComponent(ID)}&x=1`]) {
      expect((await course(app, qs)).statusCode, qs).toBe(400);
    }
    expect(vu.id).toBeUndefined();
  });

  it("sans clé ⇒ 401", async () => {
    const app = appTest({ moteur: moteurCourse(exemple) });
    expect((await app.inject({ method: "GET", url: `/v1/course?id=${encodeURIComponent(ID)}` })).statusCode).toBe(401);
  });

  it("MOTIS en panne ⇒ 503 ; réponse hors schéma ⇒ 502", async () => {
    const enPanne = appTest({ moteur: moteurCourse(() => Promise.reject(new ErreurMotis("MOTIS injoignable"))) });
    expect((await course(enPanne, `id=${encodeURIComponent(ID)}`)).statusCode).toBe(503);
    const illisible = appTest({ moteur: moteurCourse(async () => ({ legs: "x" })) });
    expect((await course(illisible, `id=${encodeURIComponent(ID)}`)).statusCode).toBe(502);
  });

  it("un arrêt à 0,0 n'est pas rendu (issue 0019)", () => {
    const a = (name: string, lat: number, lon: number) => ({ name, lat, lon });
    const arrets = lireReponseCourse({
      legs: [
        {
          from: a("A", 47, 3),
          to: a("C", 47.2, 3.2),
          startTime: "2026-11-12T07:00:00Z",
          endTime: "2026-11-12T07:30:00Z",
          intermediateStops: [{ ...a("B", 0, 0), departure: "2026-11-12T07:10:00Z" }],
        },
      ],
    });
    expect(arrets.map((x) => x.nom)).toEqual(["A", "C"]);
  });

  it("URL : /api/v6/trip, sans tracé", () => {
    const url = construireUrlCourse("http://motis:8080", ID);
    expect(url.pathname).toBe("/api/v6/trip");
    expect(url.searchParams.get("tripId")).toBe(ID);
    expect(url.searchParams.get("detailedLegs")).toBe("false");
  });
});
