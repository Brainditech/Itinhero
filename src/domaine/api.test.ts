import { describe, expect, it, vi } from "vitest";

import { clientApi, formaterPoint, messageEchec, minutesAttente } from "./api";
import { REPONSE_CHATELET } from "./reponse-chatelet";

const URL_API = "http://localhost:3000";
const CLE = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde";

function repondre(status: number, corps: unknown, entetes: Record<string, string> = {}) {
  return vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify(corps), { status, headers: entetes }));
}

const REQUETE = {
  depart: { lat: 48.85835, lon: 2.34849 },
  arrivee: { lat: 48.74803, lon: 2.37267 },
  date: "2026-11-13",
  heure: "07:00",
  sens: "partir" as const,
  marge: 0,
};

describe("clientApi.marche (spec 20)", () => {
  const de = { lat: 47.97636, lon: 3.39367 };
  const a = { lat: 47.973656, lon: 3.393667 };
  const etape = REPONSE_CHATELET.possibilites[0]!.etapes[0]!; // une marche

  it("POST JSON des deux points, la marche rendue ; null quand il n'y en a pas", async () => {
    const fetch = repondre(200, { marche: etape });
    const r = await clientApi({ urlApi: URL_API, cle: CLE, fetch }).marche({ ...de, nom: "secret" } as typeof de, a);
    expect(r).toMatchObject({ etat: "ok", donnees: { mode: "marche" } });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("http://localhost:3000/v1/marche");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ authorization: `Bearer ${CLE}` });
    expect(JSON.parse(init.body as string)).toEqual({ de, a }); // rien d'autre que les deux points
    const vide = await clientApi({ urlApi: URL_API, cle: CLE, fetch: repondre(200, { marche: null }) }).marche(de, a);
    expect(vide).toEqual({ etat: "ok", donnees: null });
  });

  it("réponse non conforme ⇒ erreur_serveur ; 503 ⇒ erreur_serveur", async () => {
    expect(await clientApi({ urlApi: URL_API, cle: CLE, fetch: repondre(200, { marche: { mode: "marche" } }) }).marche(de, a)).toEqual({
      etat: "erreur_serveur",
    });
    expect(await clientApi({ urlApi: URL_API, cle: CLE, fetch: repondre(503, {}) }).marche(de, a)).toEqual({ etat: "erreur_serveur" });
  });
});

describe("clientApi (spec 10, critère 2)", () => {
  it("itinéraires : 200 conforme ⇒ ok, avec la clé, en POST JSON", async () => {
    const fetch = repondre(200, REPONSE_CHATELET);
    const r = await clientApi({ urlApi: URL_API, cle: CLE, fetch }).itineraires(REQUETE);
    // Réponse enregistrée avant la spec 11 : sans tracé ni consignes, ils valent null.
    expect(r).toMatchObject({ etat: "ok", donnees: REPONSE_CHATELET });
    if (r.etat === "ok") expect(r.donnees.possibilites[0]!.etapes[0]).toMatchObject({ trace: null, consignes: null });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("http://localhost:3000/v1/itineraires");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ authorization: `Bearer ${CLE}`, "content-type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual(REQUETE);
  });

  it("lieux : q et proche dans l'adresse, candidats rendus (champs en plus ignorés)", async () => {
    const candidat = {
      nom: "Agence France travail",
      type: "lieu",
      commune: "Joigny",
      code_postal: "89300",
      lat: 47.97449,
      lon: 3.386229,
      source: "ign",
      distance_metres: 17480,
    };
    const fetch = repondre(200, { candidats: [candidat, { ...candidat, type: "arret", commune: "Auxerre", code_postal: null }] });
    const r = await clientApi({ urlApi: URL_API, cle: CLE, fetch }).lieux("France Travail Joigny", { lat: 47.99, lon: 3.62 });
    expect(r.etat).toBe("ok");
    if (r.etat === "ok") {
      expect(r.donnees).toHaveLength(2);
      expect(r.donnees[0]).not.toHaveProperty("source");
      expect(r.donnees[1]!.code_postal).toBeNull();
    }
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("http://localhost:3000/v1/lieux?q=France+Travail+Joigny&proche=47.99000%2C3.62000");
    expect(init.headers).toMatchObject({ authorization: `Bearer ${CLE}` });
  });

  it("une étape sans source ⇒ toute la réponse est refusée (invariant 4)", async () => {
    const sansSource = structuredClone(REPONSE_CHATELET) as unknown as { possibilites: { etapes: Record<string, unknown>[] }[] };
    delete sansSource.possibilites[0]!.etapes[1]!.source;
    const r = await clientApi({ urlApi: URL_API, cle: CLE, fetch: repondre(200, sansSource) }).itineraires(REQUETE);
    expect(r).toEqual({ etat: "erreur_serveur" });
  });

  it("« possible » sans aucune possibilité ⇒ refusé", async () => {
    const r = await clientApi({ urlApi: URL_API, cle: CLE, fetch: repondre(200, { ...REPONSE_CHATELET, possibilites: [] }) }).itineraires(
      REQUETE,
    );
    expect(r).toEqual({ etat: "erreur_serveur" });
  });

  it("« impossible » sans possibilité ⇒ accepté", async () => {
    const impossible = { verdict: "impossible", demande: { ...REPONSE_CHATELET.demande }, arrivee: { nom: null, adresse: null }, possibilites: [] };
    const r = await clientApi({ urlApi: URL_API, cle: CLE, fetch: repondre(200, impossible) }).itineraires(REQUETE);
    expect(r).toEqual({ etat: "ok", donnees: impossible });
  });

  it("corps illisible ⇒ erreur_serveur", async () => {
    const fetch = vi.fn(async () => new Response("<html>", { status: 200 }));
    expect(await clientApi({ urlApi: URL_API, cle: CLE, fetch }).lieux("Paris")).toEqual({ etat: "erreur_serveur" });
  });

  it("401 ⇒ cle_refusee", async () => {
    const r = await clientApi({ urlApi: URL_API, cle: CLE, fetch: repondre(401, { erreur: "cle_invalide" }) }).lieux("Paris");
    expect(r).toEqual({ etat: "cle_refusee" });
  });

  it("429 avec Retry-After: 90 ⇒ 2 minutes", async () => {
    const r = await clientApi({ urlApi: URL_API, cle: CLE, fetch: repondre(429, {}, { "retry-after": "90" }) }).lieux("Paris");
    expect(r).toEqual({ etat: "trop_de_demandes", minutes: 2 });
  });

  it.each([400, 500, 503])("%i ⇒ erreur_serveur", async (status) => {
    const r = await clientApi({ urlApi: URL_API, cle: CLE, fetch: repondre(status, {}) }).lieux("Paris");
    expect(r).toEqual({ etat: "erreur_serveur" });
  });

  it("réseau coupé ⇒ injoignable", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("Network request failed");
    });
    expect(await clientApi({ urlApi: URL_API, cle: CLE, fetch }).lieux("Paris")).toEqual({ etat: "injoignable" });
  });

  it("délai dépassé ⇒ injoignable", async () => {
    const fetch = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_ok, echec) => init.signal?.addEventListener("abort", () => echec(new Error("abandon")))),
    );
    const r = await clientApi({ urlApi: URL_API, cle: CLE, fetch, delaiMs: 10 }).lieux("Paris");
    expect(r).toEqual({ etat: "injoignable" });
  });
});

describe("outils", () => {
  it("minutesAttente : arrondi au-dessus, au moins 1", () => {
    expect(minutesAttente("90")).toBe(2);
    expect(minutesAttente("60")).toBe(1);
    expect(minutesAttente("1")).toBe(1);
    expect(minutesAttente(null)).toBe(1);
    expect(minutesAttente("demain")).toBe(1);
    expect(minutesAttente("36000")).toBe(600);
  });

  it("formaterPoint : 5 décimales, accepté par le serveur", () => {
    expect(formaterPoint({ lat: 48.85835, lon: 2.34849 })).toBe("48.85835,2.34849");
    expect(formaterPoint({ lat: -0.1, lon: -179.123456 })).toBe("-0.10000,-179.12346");
    expect(/^-?\d{1,2}(\.\d+)?,-?\d{1,3}(\.\d+)?$/.test(formaterPoint({ lat: 47.123456789, lon: 3.1 }))).toBe(true);
  });
});

describe("messageEchec", () => {
  it("un texte par échec", () => {
    expect(messageEchec({ etat: "injoignable" })).toBe("Le serveur ne répond pas.");
    expect(messageEchec({ etat: "trop_de_demandes", minutes: 2 })).toBe("Trop de recherches. Réessayez dans 2 min.");
    expect(messageEchec({ etat: "erreur_serveur" })).toBe("La recherche a échoué.");
  });
});

describe("hors de la zone couverte (spec 27, critère 3)", () => {
  it("422 hors_zone ⇒ etat hors_zone avec les points ; 422 d'une autre forme ⇒ erreur_serveur", async () => {
    const client = (corps: unknown) => clientApi({ urlApi: URL_API, cle: CLE, fetch: repondre(422, corps) });
    expect(await client({ erreur: "hors_zone", points: ["arrivee"] }).itineraires(REQUETE)).toEqual({ etat: "hors_zone", points: ["arrivee"] });
    expect(await client({ erreur: "autre" }).itineraires(REQUETE)).toEqual({ etat: "erreur_serveur" });
    expect(await client({ erreur: "hors_zone", points: [] }).itineraires(REQUETE)).toEqual({ etat: "erreur_serveur" });
  });
  it("le message nomme le point et la zone, jamais « La recherche a échoué »", () => {
    expect(messageEchec({ etat: "hors_zone", points: ["depart"] })).toBe(
      "Le départ est hors de la zone couverte : Itinhero ne connaît que la France métropolitaine et la Corse.",
    );
    expect(messageEchec({ etat: "hors_zone", points: ["arrivee"] })).toMatch(/^L'arrivée est hors de la zone couverte/);
    expect(messageEchec({ etat: "hors_zone", points: ["depart", "arrivee"] })).toMatch(/^Le départ et l'arrivée sont hors/);
  });
});

describe("clientApi.etatCourses (spec 33, critère 5)", () => {
  it("POST des identifiants ; états lus ; état inconnu du schéma ⇒ erreur_serveur", async () => {
    const etats = [{ course: "c1", etat: "retard", retard_minutes: 7 }, { course: "c2", etat: "prevu" }];
    const fetch = repondre(200, { etats });
    const r = await clientApi({ urlApi: URL_API, cle: CLE, fetch }).etatCourses(["c1", "c2"]);
    expect(r).toEqual({ etat: "ok", donnees: etats });
    expect(fetch.mock.calls[0]![0]).toBe("http://localhost:3000/v1/etat-courses");
    expect(JSON.parse(fetch.mock.calls[0]![1].body as string)).toEqual({ courses: ["c1", "c2"] });
    const bizarre = repondre(200, { etats: [{ course: "c1", etat: "en_avance" }] });
    expect(await clientApi({ urlApi: URL_API, cle: CLE, fetch: bizarre }).etatCourses(["c1"])).toEqual({ etat: "erreur_serveur" });
  });
});
