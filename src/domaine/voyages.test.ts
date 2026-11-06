import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { schemaPossibilite, type Possibilite, type ReponseItineraires } from "./api";
import type { Demande } from "./demande";
import {
  bandeauVoyage,
  champsDepuisVoyage,
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

  it("résumé : jour, lieux, aller et retour (heures, durée, changements), heure d'enregistrement à Paris", () => {
    expect(resumeVoyage(voyage())).toEqual({
      jour: "Jeudi 12/11",
      titre: "Domicile → France Travail Joigny",
      aller: { possible: true, depart: "08:14", arrivee: "10:44", duree: "2 h 30", changements: "1 chgt" },
      retour: { possible: true, depart: "16:23", arrivee: "17:40", duree: "2 h 30", changements: "1 chgt" },
      enregistre: "Enregistré le 06/11 à 14:32",
      phrase:
        "Jeudi 12/11, Domicile vers France Travail Joigny. Aller : départ 08:14, arrivée 10:44, 2 h 30, 1 correspondance. " +
        "Retour : départ 16:23, arrivée 17:40, 2 h 30, 1 correspondance. Horaire prévu, sans suivi en direct. " +
        "Enregistré le 06/11 à 14:32.",
    });
  });

  it("résumé : direct, 2 changements, arrivée le lendemain avec son jour", () => {
    const avec = (p: Partial<Possibilite>) => resumeVoyage(voyage({ reponse: { ...REPONSE, possibilites: [{ ...POSSIBILITE, ...p }] } })).aller;
    expect(avec({ correspondances: 0, duree_minutes: 45 })).toMatchObject({ duree: "45 min", changements: "direct" });
    expect(avec({ correspondances: 2 })).toMatchObject({ changements: "2 chgt" });
    // 23:30 + 7 h 42 ⇒ vendredi 07:12 : l'arrivée garde son jour, comme le Résultat (D79).
    expect(avec({ depart: "23:30", arrivee: "07:12", duree_minutes: 462 })).toMatchObject({ arrivee: "ven. 07:12", duree: "7 h 42" });
  });

  it("bandeau du voyage rouvert : heure d'enregistrement à Paris, jamais « en direct »", () => {
    expect(bandeauVoyage("2026-11-06T13:32:00.000Z")).toBe("Voyage enregistré le 06/11 à 14:32. Horaires prévus, sans suivi en direct.");
    // Heure d'été : 1er juillet 06:05 UTC ⇒ 08:05 à Paris.
    expect(bandeauVoyage("2026-07-01T06:05:00.000Z")).toBe("Voyage enregistré le 01/07 à 08:05. Horaires prévus, sans suivi en direct.");
  });

  it("résumé : sans retour, ou retour impossible", () => {
    const sansRetour = resumeVoyage(voyage({ reponse: { ...REPONSE, retour: null } }));
    expect(sansRetour.retour).toBeNull();
    expect(sansRetour.phrase).not.toContain("Retour");
    const retourImpossible = resumeVoyage(
      voyage({ reponse: { ...REPONSE, retour: { ...REPONSE.retour!, verdict: "impossible", possibilites: [] } } }),
    );
    expect(retourImpossible.retour).toEqual({ possible: false, texte: "aucun ce jour-là" });
    expect(retourImpossible.phrase).toContain("Retour : aucun ce jour-là.");
  });

  it("modifier : le formulaire reprend le voyage, lieux déjà trouvés sans réseau, date passée ramenée à aujourd'hui", () => {
    const v = voyage();
    expect(champsDepuisVoyage(v, "2026-11-06")).toEqual({
      depart: { type: "domicile" },
      // Texte déjà cherché à l'enregistrement : le lieu trouvé est repris tel quel, sans nouvelle recherche.
      arrivee: { type: "lieu", nom: "France Travail Joigny", lat: 47.9822, lon: 3.3974, nature: "lieu", commune: null, code_postal: null },
      date: "2026-11-12",
      heure: "10:00",
      sens: "arriver_avant",
      marge: "10",
      retour: "16:00",
    });
    expect(champsDepuisVoyage(v, "2026-11-20").date).toBe("2026-11-20");
    const position = voyage({ demande: { ...DEMANDE, depart: { type: "position" }, retour: null } });
    expect(champsDepuisVoyage(position, "2026-11-06")).toMatchObject({ depart: { type: "position" }, retour: null });
    const lieu = { type: "lieu" as const, nom: "Gare de Joigny", lat: 47.98, lon: 3.39, nature: "arret" as const, commune: "Joigny", code_postal: "89300" };
    expect(champsDepuisVoyage(voyage({ demande: { ...DEMANDE, arrivee: lieu } }), "2026-11-06").arrivee).toEqual(lieu);
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
