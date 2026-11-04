import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Point } from "../itineraires/motis-plan.js";
import { construireUrlGeocode } from "../lieux/motis-geocode.js";
import { appTest, ENTETE, moteurEnPanne } from "../outils-test.js";

const EXEMPLE = path.join(path.dirname(fileURLToPath(import.meta.url)), "../lieux/__exemples__/geocode-chamvres.json");
const exemple = async (): Promise<unknown> => JSON.parse(await readFile(EXEMPLE, "utf8"));

function moteurGeocode(reponse: () => Promise<unknown>, vu: { texte?: string; proche?: Point } = {}) {
  return {
    plan: () => Promise.reject(new Error("inutile")),
    geocoder: async (texte: string, proche?: Point) => {
      vu.texte = texte;
      vu.proche = proche;
      return reponse();
    },
  };
}

const lieux = (app: ReturnType<typeof appTest>, qs: string) =>
  app.inject({ method: "GET", url: `/v1/lieux?${qs}`, headers: ENTETE });

describe("GET /v1/lieux (critère 4)", () => {
  it("q absent, d'un caractère, de plus de 200, ou paramètre inconnu ⇒ 400", async () => {
    const app = appTest({ moteur: moteurGeocode(exemple) });
    for (const qs of ["", "q=a", `q=${"a".repeat(201)}`, "q=%20%20a%20", "q=Joigny&x=1", "q=Joigny&proche=91,3", "q=Joigny&proche=abc"]) {
      const r = await lieux(app, qs);
      expect(r.statusCode, qs).toBe(400);
      expect(r.json().erreur).toBe("requete_invalide");
    }
  });

  it("réponse enregistrée ⇒ candidats dans l'ordre, type, commune, code postal", async () => {
    const vu: { texte?: string; proche?: Point } = {};
    const app = appTest({ moteur: moteurGeocode(exemple, vu) });
    const r = await lieux(app, "q=%2019%20route%20de%20Chamvres%20Joigny%20");
    expect(r.statusCode).toBe(200);
    expect(vu.texte).toBe("19 route de Chamvres Joigny");
    expect(vu.proche).toBeUndefined();
    const c = r.json().candidats;
    expect(c[0]).toMatchObject({ nom: "Route de Chamvres", type: "adresse", commune: "Joigny", code_postal: "89300" });
    expect(c[0].lat).toBeCloseTo(47.9727, 3);
  });

  it("proche=lat,lon est transmis au géocodeur, avec le biais", async () => {
    const vu: { texte?: string; proche?: Point } = {};
    const app = appTest({ moteur: moteurGeocode(exemple, vu) });
    expect((await lieux(app, "q=Tour%20Eiffel&proche=48.8446,2.3751")).statusCode).toBe(200);
    expect(vu.proche).toEqual({ lat: 48.8446, lon: 2.3751 });
    const url = construireUrlGeocode("http://motis:8080", "Tour Eiffel", vu.proche);
    expect(url.searchParams.get("place")).toBe("48.8446,2.3751");
    expect(url.searchParams.get("placeBias")).toBe("5");
  });

  it("plusieurs codes postaux (Paris) ⇒ aucun code postal", async () => {
    const app = appTest({
      moteur: moteurGeocode(async () => [
        { type: "STOP", name: "Tour Eiffel", lat: 48.86, lon: 2.29, zip: "75000;75001", areas: [{ name: "Paris", default: true }] },
      ]),
    });
    expect((await lieux(app, "q=Tour%20Eiffel")).json().candidats[0]).toMatchObject({ commune: "Paris", code_postal: null });
  });

  it("aucun candidat ⇒ 200 []", async () => {
    const app = appTest({ moteur: moteurGeocode(async () => []) });
    expect((await lieux(app, "q=zzzz")).json()).toEqual({ candidats: [] });
  });

  it("moteur en panne ⇒ 503 ; réponse hors schéma ⇒ 502", async () => {
    expect((await lieux(appTest({ moteur: moteurEnPanne }), "q=Joigny")).statusCode).toBe(503);
    const r = await lieux(appTest({ moteur: moteurGeocode(async () => ({ pas: "un tableau" })) }), "q=Joigny");
    expect(r.statusCode).toBe(502);
    expect(r.json()).toEqual({ erreur: "reponse_moteur_illisible" });
  });
});
