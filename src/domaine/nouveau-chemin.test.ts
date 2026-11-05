import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { schemaPossibilite, type Etape } from "./api";
import { ETAT_INITIAL, instantDuTrajet, positionSimulee, preparer, situer, type EtatGuidage } from "./guidage";
import {
  AVANCE_MIN_MS,
  choisirApresEcart,
  NOUVEAU_CHEMIN,
  phraseNouveauChemin,
  phraseNouvelleRecherche,
  remplacerMarche,
} from "./nouveau-chemin";

/**
 * Spec 20 (D96), critère 2. Brienon → Dijon, samedi 14/11/2026 (même réponse que les tests du guidage) :
 * étape 2, marche de 14 min (08:50 → 09:04) vers la gare de Saint-Florentin, puis le TER K7 de 09:10 (étape 3) ;
 * étape 4, marche gare de Dijon → tribunal, qui finit le trajet.
 */
const POSSIBILITE = schemaPossibilite.parse(
  JSON.parse(readFileSync(path.join(__dirname, "__exemples__/possibilite-brienon-dijon.json"), "utf8")),
);
const parcours = preparer(POSSIBILITE);
const heure = (hhmm: string) => instantDuTrajet(POSSIBILITE, hhmm);
const MIN = 60_000;

/** Chemin à pied tel que le rend `POST /v1/marche` : parti `depart`, `minutes` de marche, un autre tracé. */
function nouvelleMarche(depart: number, minutes: number): Etape {
  const autre = POSSIBILITE.etapes[4]!; // un tracé et des consignes qui ne sont pas ceux de l'étape 2
  return {
    ...POSSIBILITE.etapes[2]!,
    de: { nom: "Départ", type: "depart", arret: null, lat: 47.98, lon: 3.74 },
    a: { nom: "Arrivée", type: "arrivee", arret: null, lat: 47.99, lon: 3.75 },
    trace: autre.trace,
    consignes: autre.consignes,
    duree_minutes: minutes,
    distance_metres: minutes * 80,
    depart_utc: new Date(depart).toISOString(),
    arrivee_utc: new Date(depart + minutes * MIN).toISOString(),
  };
}

describe("D96 : nouveau chemin ou recherche complète", () => {
  const maintenant = heure("09:00"); // le train K7 part dans 10 min

  it("train dans 10 min, nouvelle marche de 5 min ⇒ nouveau chemin", () => {
    expect(choisirApresEcart(parcours, 2, nouvelleMarche(maintenant, 5), maintenant)).toEqual({ type: "marche" });
  });

  it("arrivée exactement 2 min avant ⇒ nouveau chemin ; 1 min avant ⇒ recherche complète, avec la raison", () => {
    expect(AVANCE_MIN_MS).toBe(2 * MIN);
    expect(choisirApresEcart(parcours, 2, nouvelleMarche(maintenant, 8), maintenant)).toEqual({ type: "marche" });
    const choix = choisirApresEcart(parcours, 2, nouvelleMarche(maintenant, 9), maintenant);
    expect(choix).toEqual({ type: "recherche", raison: "Le TER K7 de 09:10 n'est plus à portée" });
    expect(phraseNouvelleRecherche(choix.type === "recherche" ? choix.raison : "")).toBe(
      "Le TER K7 de 09:10 n'est plus à portée : nouvelle recherche…",
    );
  });

  it("la durée vient des instants rendus par le serveur, pas des minutes arrondies", () => {
    const m = { ...nouvelleMarche(maintenant, 8), duree_minutes: 7, arrivee_utc: new Date(maintenant + 8 * MIN + 30_000).toISOString() };
    expect(choisirApresEcart(parcours, 2, m, maintenant).type).toBe("recherche");
  });

  it("dernière marche, en retard ⇒ nouveau chemin quand même", () => {
    const tard = heure("11:30"); // l'arrivée était prévue à 10:44
    expect(choisirApresEcart(parcours, 4, nouvelleMarche(tard, 20), tard)).toEqual({ type: "marche" });
  });

  it("aucun chemin à pied, ou plus de 1 h ⇒ recherche complète, « Aucun chemin à pied »", () => {
    expect(choisirApresEcart(parcours, 2, null, maintenant)).toEqual({ type: "recherche", raison: "Aucun chemin à pied" });
    expect(choisirApresEcart(parcours, 4, nouvelleMarche(maintenant, 61), maintenant)).toEqual({
      type: "recherche",
      raison: "Aucun chemin à pied",
    });
  });
});

describe("remplacerMarche", () => {
  const maintenant = heure("09:00");
  const etat: EtatGuidage = {
    ...ETAT_INITIAL,
    etape: 2,
    abscisse: 420,
    horsCheminDepuis: maintenant - 20_000,
    annonces: ["0:1:10", "2:3:150", "2:ecart:123", "3:descente"],
  };
  const marche = nouvelleMarche(maintenant, 5);
  const r = remplacerMarche(parcours, etat, 2, marche, maintenant);

  it("l'étape 2 a le nouveau tracé, les nouvelles consignes et les nouvelles heures ; sa fin ne change pas", () => {
    const e = r.parcours.possibilite.etapes[2]!;
    expect(e.trace).toBe(marche.trace);
    expect(e.consignes).toEqual(marche.consignes);
    expect(e.depart).toBe("09:00");
    expect(e.arrivee).toBe("09:05");
    expect(e.depart_utc).toBe(new Date(maintenant).toISOString());
    expect(e.a).toEqual(POSSIBILITE.etapes[2]!.a);
    expect(e.de.nom).toBe("Votre position");
    const g = r.parcours.etapes[2]!;
    expect(g.etape).toBe(e);
    expect(g.departMs).toBe(maintenant);
    expect(g.arriveeMs).toBe(maintenant + 5 * MIN);
    expect(g.ligne).not.toBe(parcours.etapes[2]!.ligne);
    expect(g.consignes.length).toBe(marche.consignes!.length);
  });

  it("toutes les autres étapes sont identiques, l'arrivée du trajet aussi", () => {
    for (const i of [0, 1, 3, 4]) {
      expect(r.parcours.etapes[i]).toBe(parcours.etapes[i]);
      expect(r.parcours.possibilite.etapes[i]).toBe(POSSIBILITE.etapes[i]);
    }
    expect(r.parcours.arriveeMs).toBe(parcours.arriveeMs);
    expect(r.parcours.possibilite.arrivee).toBe(POSSIBILITE.arrivee);
    expect(r.parcours.possibilite.depart_utc).toBe(POSSIBILITE.depart_utc);
  });

  it("l'état repart au début de l'étape 2, sans écart, ses annonces oubliées", () => {
    expect(r.etat).toMatchObject({ etape: 2, abscisse: 0, horsCheminDepuis: null, aBord: false });
    expect(r.etat.annonces).toEqual(["0:1:10", "3:descente"]);
  });

  it("dernière marche remplacée : l'arrivée du trajet devient la sienne", () => {
    const tard = heure("11:30");
    const fin = remplacerMarche(parcours, { ...ETAT_INITIAL, etape: 4 }, 4, nouvelleMarche(tard, 20), tard);
    expect(fin.parcours.possibilite.arrivee).toBe("11:50");
    expect(fin.parcours.arriveeMs).toBe(tard + 20 * MIN);
    expect(fin.parcours.possibilite.etapes[4]!.a).toEqual(POSSIBILITE.etapes[4]!.a);
  });

  it("au début du nouveau chemin, le guidage suit la nouvelle marche, sans écart", () => {
    const debut = positionSimulee(r.parcours, 2, 0)!;
    const s = situer(r.parcours, r.etat, debut, maintenant + 1000);
    expect(s.vue.type).toBe("marche");
    expect(s.ecart).toBeNull();
    expect(s.courante?.etape.trace).toBe(marche.trace);
    if (s.vue.type === "marche") expect(s.vue.destination).toBe("gare de Saint-Florentin - Vergigny");
  });

  it("la voix dit « Nouveau chemin », puis la première consigne", () => {
    // Première consigne de la marche rendue : « départ » vers l'est, cour de la Gare Pierre Semard.
    expect(NOUVEAU_CHEMIN).toBe("Nouveau chemin");
    expect(phraseNouveauChemin(r.parcours, 2)).toMatch(/^Nouveau chemin\. Partez .*Pierre Semard/);
  });
});
