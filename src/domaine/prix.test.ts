import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { schemaPossibilite, type Possibilite, type TarifEtape } from "./api";
import { comparerPrix, montantReduit, prixTrajet, textePrix } from "./prix";
import { trier } from "./tri";

// Brienon → Dijon : marche, bus 803 (Mobigo), marche, TER K7, marche.
const P: Possibilite = schemaPossibilite.parse(
  JSON.parse(readFileSync(path.join(__dirname, "__exemples__/possibilite-brienon-dijon.json"), "utf8")),
);
const MOBIGO: TarifEtape = {
  id: "mobigo",
  reseau: "Mobigo",
  produit: "Ticket unitaire car",
  montant_eur: 2,
  reductions: [{ carte: "avantages-jeunes", nom: "Carte Avantages Jeunes", pourcentage: 100, montant_eur: null, seulement_aller: true, conditions: null }],
  canal_vente: "À bord",
  url: "https://www.viamobigo.fr/grille.pdf",
  lu_le: "2026-11-06",
};
const TER: TarifEtape = { ...MOBIGO, id: "ter", reseau: "TER", produit: "Billet", montant_eur: 12.4, reductions: [{ carte: "solidaire", nom: "Solidaire", pourcentage: 75, montant_eur: null, seulement_aller: false, conditions: null }] };
const avec = (bus: TarifEtape | null, train: TarifEtape | null): Possibilite => ({
  ...P,
  etapes: P.etapes.map((e, i) => (i === 1 ? { ...e, tarif: bus } : i === 3 ? { ...e, tarif: train } : e)),
});

describe("Prix d'un trajet (spec 43, critère 3)", () => {
  it("tous les véhicules avec un tarif ⇒ total ; carte cochée ⇒ réduit (Solidaire −75 % sur le train)", () => {
    expect(prixTrajet(avec(MOBIGO, TER), [])).toEqual({ etat: "complet", total: 14.4 });
    expect(prixTrajet(avec(MOBIGO, TER), ["solidaire"])).toEqual({ etat: "complet", total: 5.1 });
    expect(montantReduit(MOBIGO, ["avantages-jeunes"])).toBe(0);
    expect(textePrix(prixTrajet(avec(MOBIGO, TER), ["solidaire"]))).toBe("Prix : 5,10 €");
  });

  it("un véhicule sans tarif ⇒ la part connue et « prix non publié » pour lui ; aucun ⇒ « Prix non publié »", () => {
    const partiel = prixTrajet(avec(MOBIGO, null), []);
    expect(partiel).toEqual({ etat: "partiel", connu: 2, nonPublies: ["TER K7"] });
    expect(textePrix(partiel)).toBe("2,00 € + prix non publié (TER K7)");
    expect(textePrix(prixTrajet(P, []))).toBe("Prix non publié");
  });

  it("un taxi n'a jamais de prix", () => {
    const taxi = { ...P, etapes: P.etapes.map((e, i) => (i === 1 ? { ...e, mode: "taxi", tarif: MOBIGO } : i === 3 ? { ...e, tarif: TER } : e)) };
    expect(prixTrajet(taxi, [])).toMatchObject({ etat: "partiel", connu: 12.4 });
  });
});

describe("Tri « Moins cher » (spec 43, critère 4, D97)", () => {
  it("complets par prix croissant, puis partiels, puis sans prix ; le rang du serveur est gardé", () => {
    const cher = avec(MOBIGO, TER);
    const moinsCher = avec(MOBIGO, { ...TER, montant_eur: 5 });
    const partiel = avec(MOBIGO, null);
    const rien = P;
    expect(trier([rien, partiel, cher, moinsCher], "moins_cher").map((r) => r.index)).toEqual([3, 2, 1, 0]);
    expect(comparerPrix({ etat: "non_publie" }, { etat: "partiel", connu: 9, nonPublies: [] })).toBeGreaterThan(0);
  });

  it("la carte change l'ordre", () => {
    const busCher = avec({ ...MOBIGO, montant_eur: 6 }, TER); // 18,40 sans carte, 9,10 avec Solidaire
    const sansReduction = avec({ ...MOBIGO, montant_eur: 3 }, { ...TER, reductions: [] }); // 15,40
    expect(trier([busCher, sansReduction], "moins_cher").map((r) => r.index)).toEqual([1, 0]);
    expect(trier([busCher, sansReduction], "moins_cher", ["solidaire"]).map((r) => r.index)).toEqual([0, 1]);
  });
});

describe("Réductions, revue PR #61", () => {
  it("montant réduit publié (IDFM 1,30 €) plutôt que calculé (1,28 €) ; aller seulement ⇒ plein tarif au retour", () => {
    const idfm: TarifEtape = { ...MOBIGO, montant_eur: 2.55, reductions: [{ carte: "reduit", nom: "Réduit", pourcentage: 50, montant_eur: 1.3, seulement_aller: false, conditions: null }] };
    expect(montantReduit(idfm, ["reduit"])).toBe(1.3);
    expect(montantReduit({ ...idfm, reductions: [{ ...idfm.reductions[0]!, montant_eur: null }] }, ["reduit"])).toBe(1.28);
    expect(montantReduit(MOBIGO, ["avantages-jeunes"], "aller")).toBe(0);
    expect(montantReduit(MOBIGO, ["avantages-jeunes"], "retour")).toBe(2);
  });
});
