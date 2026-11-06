import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { schemaPossibilite, type Possibilite, type ReponseItineraires } from "./api";
import type { Demande } from "./demande";
import {
  bandeauVoyage,
  cleVoyage,
  lireVoyage,
  peutEnregistrer,
  rangerVoyages,
  resumeVoyage,
  voyageDepuisRecherche,
  type LieuVoyage,
  type Voyage,
} from "./voyages";

/**
 * Spec 22 (D98), critère 1. Base : Brienon → Dijon (bus 803, TER K7), réponse du serveur reconstruite autour
 * de la possibilité d'exemple ; chaque cas change seulement ce qu'il teste.
 */
const POSSIBILITE: Possibilite = schemaPossibilite.parse(
  JSON.parse(readFileSync(path.join(__dirname, "__exemples__/possibilite-brienon-dijon.json"), "utf8")),
);

const DEMANDE: Demande = {
  depart: { type: "domicile" },
  arrivee: { type: "texte", texte: "France Travail Joigny" },
  date: "2026-11-12",
  heure: "10:00",
  sens: "arriver_avant",
  marge: 10,
  retour: "16:00",
};

const DEPART: LieuVoyage = { point: { lat: 47.9918, lon: 3.617 }, nom: "Domicile", adresse: "Brienon-sur-Armançon" };
const ARRIVEE: LieuVoyage = { point: { lat: 47.9822, lon: 3.3974 }, nom: "France Travail Joigny", adresse: null };

function sens(possibilites: Possibilite[], heure = "10:00", verdict: "possible" | "impossible" = "possible") {
  return {
    verdict,
    demande: { date: "2026-11-12", heure, sens: "arriver" as const, marge: 10, limite: "09:50" },
    arrivee: { nom: "France Travail Joigny", adresse: null },
    possibilites,
  };
}

const REPONSE: ReponseItineraires = {
  ...sens([POSSIBILITE]),
  retour: { ...sens([{ ...POSSIBILITE, depart: "16:23", arrivee: "17:40" }], "16:00"), demande: { date: "2026-11-12", heure: "16:00", sens: "partir", marge: null, limite: null } },
};

// 2026-11-06 14:32 à Paris (heure d'hiver, UTC+1).
const MAINTENANT = new Date("2026-11-06T13:32:00Z");

const RECHERCHE = { demande: DEMANDE, depart: { lieu: DEPART }, arrivee: { lieu: ARRIVEE }, reponse: REPONSE };

function voyage(changes: Partial<Voyage> = {}): Voyage {
  return { ...voyageDepuisRecherche(RECHERCHE, MAINTENANT)!, ...changes };
}

describe("voyage enregistré (spec 22, D98)", () => {
  it("enregistrer puis relire rend le même voyage", () => {
    const v = voyage();
    expect(v.enregistre_le).toBe("2026-11-06T13:32:00.000Z");
    expect(lireVoyage(JSON.stringify(v))).toEqual(v);
  });

  it.each([
    ["absent", null],
    ["vide", ""],
    ["illisible", "{pas du json"],
    ["d'une autre forme", JSON.stringify({ demande: DEMANDE })],
    ["réponse abîmée", JSON.stringify({ ...voyage(), reponse: { ...REPONSE, possibilites: "x" } })],
  ])("texte %s ⇒ null, jamais à moitié", (_cas, texte) => {
    expect(lireVoyage(texte)).toBeNull();
  });

  it("même recherche ⇒ même clé ; tout changement de la demande ou d'un point ⇒ autre clé", () => {
    const cle = cleVoyage(DEMANDE, DEPART, ARRIVEE);
    expect(cleVoyage({ ...DEMANDE }, { ...DEPART, nom: "Autre nom" }, ARRIVEE)).toBe(cle);
    // Au mètre près : un écart sous le mètre ne fait pas un autre voyage.
    expect(cleVoyage(DEMANDE, { ...DEPART, point: { lat: 47.991801, lon: 3.617 } }, ARRIVEE)).toBe(cle);
    for (const autre of [
      cleVoyage({ ...DEMANDE, date: "2026-11-13" }, DEPART, ARRIVEE),
      cleVoyage({ ...DEMANDE, heure: "11:00" }, DEPART, ARRIVEE),
      cleVoyage({ ...DEMANDE, sens: "partir_a" }, DEPART, ARRIVEE),
      cleVoyage({ ...DEMANDE, marge: 20 }, DEPART, ARRIVEE),
      cleVoyage({ ...DEMANDE, retour: "17:00" }, DEPART, ARRIVEE),
      cleVoyage({ ...DEMANDE, retour: null }, DEPART, ARRIVEE),
      cleVoyage(DEMANDE, DEPART, { ...ARRIVEE, point: { lat: 47.99, lon: 3.3974 } }),
    ]) {
      expect(autre).not.toBe(cle);
    }
  });

  it("aller impossible sans possibilité ⇒ rien à enregistrer", () => {
    const vide = { ...sens([], "10:00", "impossible"), retour: null };
    expect(peutEnregistrer(vide)).toBe(false);
    expect(voyageDepuisRecherche({ ...RECHERCHE, reponse: vide }, MAINTENANT)).toBeNull();
    expect(voyageDepuisRecherche({ ...RECHERCHE, reponse: null }, MAINTENANT)).toBeNull();
    expect(voyageDepuisRecherche({ ...RECHERCHE, depart: { lieu: null } }, MAINTENANT)).toBeNull();
    expect(peutEnregistrer(REPONSE)).toBe(true);
  });

  it("résumé : jour, départ du verdict, lieux, retour, heure d'enregistrement à Paris", () => {
    expect(resumeVoyage(voyage())).toEqual({
      jour: "Jeudi 12/11",
      depart: `Départ ${POSSIBILITE.depart}`,
      titre: "Domicile → France Travail Joigny",
      retour: "Retour : départ 16:23",
      enregistre: "Enregistré le 06/11 à 14:32",
    });
  });

  it("bandeau du voyage rouvert : heure d'enregistrement à Paris, jamais « en direct »", () => {
    expect(bandeauVoyage("2026-11-06T13:32:00.000Z")).toBe("Voyage enregistré le 06/11 à 14:32. Horaires prévus, sans suivi en direct.");
    // Heure d'été : 1er juillet 06:05 UTC ⇒ 08:05 à Paris.
    expect(bandeauVoyage("2026-07-01T06:05:00.000Z")).toBe("Voyage enregistré le 01/07 à 08:05. Horaires prévus, sans suivi en direct.");
  });

  it("résumé : sans retour, ou retour impossible", () => {
    const sansRetour = voyage({ reponse: { ...REPONSE, retour: null } });
    expect(resumeVoyage(sansRetour).retour).toBeNull();
    const retourImpossible = voyage({ reponse: { ...REPONSE, retour: { ...REPONSE.retour!, verdict: "impossible", possibilites: [] } } });
    expect(resumeVoyage(retourImpossible).retour).toBe("Retour : aucun ce jour-là");
  });

  it("rangement : aujourd'hui compte à venir ; à venir du plus proche, passés du plus récent", () => {
    const le = (date: string, heure = "10:00") => voyage({ demande: { ...DEMANDE, date, heure } });
    const hier = le("2026-11-05");
    const avantHier = le("2026-11-04");
    const aujourdhui = le("2026-11-06");
    const demainTot = le("2026-11-07", "08:00");
    const demainTard = le("2026-11-07", "18:00");
    const r = rangerVoyages([demainTard, avantHier, aujourdhui, hier, demainTot], "2026-11-06");
    expect(r.aVenir).toEqual([aujourdhui, demainTot, demainTard]);
    expect(r.passes).toEqual([hier, avantHier]);
  });
});
