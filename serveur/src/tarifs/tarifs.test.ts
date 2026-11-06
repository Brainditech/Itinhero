import { describe, expect, it } from "vitest";
import { IndexHoraires } from "../itineraires/horaires-gtfs.js";
import type { PossibiliteAffichee } from "../itineraires/normaliser.js";
import { appTest, ENTETE } from "../outils-test.js";
import { ajouterTarifs, cartesConnues, chargerTarifs, tarifDeLEtape, type Tarif } from "./tarifs.js";

const tarif = (t: Partial<Tarif> & Pick<Tarif, "id">): Tarif => ({
  reseau: "Mobigo",
  produit: "Ticket unitaire car",
  montant_eur: 2,
  correspondance: { producteurs: ["Région Bourgogne-Franche-Comté"], exploitant: "mobigo", modes: ["bus", "car"] },
  reductions: [{ carte: "avantages-jeunes", nom: "Carte Avantages Jeunes", pourcentage: 100, seulement_aller: true, conditions: "Aller seulement" }],
  canal_vente: "À bord",
  url: "https://www.viamobigo.fr/grille.pdf",
  lu_le: "2026-11-06",
  valide_le: "2026-11-07",
  ...t,
});
const horaires = new IndexHoraires({
  version: 1,
  jeux: {
    r84072: { fin_validite: null, reservations: {}, nom: "Région Bourgogne-Franche-Comté" },
    r83582: { fin_validite: null, reservations: {}, nom: "SNCF" },
  },
});
const gtfs = (jeu: string) => ({ type: "gtfs", jeu });

describe("Tarif d'une étape (spec 43, critère 1)", () => {
  const tarifs = [tarif({ id: "mobigo" }), tarif({ id: "non-valide", montant_eur: 9, valide_le: null, correspondance: { producteurs: ["SNCF"], modes: ["train"] } })];
  it("réseau, mode et exploitant correspondent ⇒ le tarif tel que publié, avec sa source", () => {
    expect(tarifDeLEtape(tarifs, { mode: "bus", exploitant: "MOBIGO 89", source: gtfs("r84072") }, horaires)).toEqual({
      id: "mobigo",
      reseau: "Mobigo",
      produit: "Ticket unitaire car",
      montant_eur: 2,
      reductions: [
        { carte: "avantages-jeunes", nom: "Carte Avantages Jeunes", pourcentage: 100, montant_eur: null, seulement_aller: true, conditions: "Aller seulement" },
      ],
      canal_vente: "À bord",
      url: "https://www.viamobigo.fr/grille.pdf",
      lu_le: "2026-11-06",
    });
  });
  it("tarif non validé, autre mode, autre exploitant, marche, réseau inconnu ⇒ null (« prix non publié »)", () => {
    expect(tarifDeLEtape(tarifs, { mode: "train", exploitant: "SNCF", source: gtfs("r83582") }, horaires)).toBeNull();
    expect(tarifDeLEtape(tarifs, { mode: "train", exploitant: "MOBIGO", source: gtfs("r84072") }, horaires)).toBeNull();
    expect(tarifDeLEtape(tarifs, { mode: "bus", exploitant: "Transdev", source: gtfs("r84072") }, horaires)).toBeNull();
    expect(tarifDeLEtape(tarifs, { mode: "marche", exploitant: null, source: { type: "osm" } }, horaires)).toBeNull();
    expect(tarifDeLEtape(tarifs, { mode: "bus", exploitant: "MOBIGO", source: gtfs("r99999") }, horaires)).toBeNull();
    expect(tarifDeLEtape(tarifs, { mode: "bus", exploitant: "MOBIGO", source: gtfs("r84072") }, undefined)).toBeNull();
  });
  it("chaque étape reçoit son tarif ou null", () => {
    const p = { etapes: [{ mode: "marche", exploitant: null, source: { type: "osm" } }, { mode: "bus", exploitant: "MOBIGO 89", source: gtfs("r84072") }] } as unknown as PossibiliteAffichee;
    const [r] = ajouterTarifs([p], tarifs, horaires);
    expect(r!.etapes.map((e) => e.tarif?.montant_eur ?? null)).toEqual([null, 2]);
  });
  it("revue : un exploitant avec un caractère spécial ne casse rien", () => {
    const t = [tarif({ id: "x", correspondance: { producteurs: ["Région Bourgogne-Franche-Comté"], exploitant: "(Mobigo+", modes: ["bus"] } })];
    expect(tarifDeLEtape(t, { mode: "bus", exploitant: "MOBIGO 89", source: gtfs("r84072") }, horaires)).toBeNull();
    expect(tarifDeLEtape(t, { mode: "bus", exploitant: "Car (Mobigo+ Yonne)", source: gtfs("r84072") }, horaires)?.id).toBe("x");
  });
  it("cartes connues : seulement celles des tarifs validés", () => {
    expect(cartesConnues(tarifs).map((c) => c.carte)).toEqual(["avantages-jeunes"]);
    expect(cartesConnues([tarif({ id: "x", valide_le: null })])).toEqual([]);
  });
  it("le fichier versionné passe le schéma", () => {
    expect(chargerTarifs().length).toBeGreaterThan(0);
  });
});

describe("GET /v1/fiches (spec 43, critère 2)", () => {
  it("cartes et tarifs validés, sans clé ⇒ 401", async () => {
    const app = appTest({ tarifs: [tarif({ id: "mobigo" }), tarif({ id: "brouillon", valide_le: null })] });
    const r = await app.inject({ method: "GET", url: "/v1/fiches", headers: ENTETE });
    expect(r.statusCode).toBe(200);
    expect(r.json().tarifs.map((t: { id: string }) => t.id)).toEqual(["mobigo"]);
    expect(r.json().cartes[0].carte).toBe("avantages-jeunes");
    expect((await app.inject({ method: "GET", url: "/v1/fiches" })).statusCode).toBe(401);
  });
});
