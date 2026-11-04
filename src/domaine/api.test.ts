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

describe("clientApi (spec 10, critère 2)", () => {
  it("itinéraires : 200 conforme ⇒ ok, avec la clé, en POST JSON", async () => {
    const fetch = repondre(200, REPONSE_CHATELET);
    const r = await clientApi({ urlApi: URL_API, cle: CLE, fetch }).itineraires(REQUETE);
    expect(r).toEqual({ etat: "ok", donnees: REPONSE_CHATELET });
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
