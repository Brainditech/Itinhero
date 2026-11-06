import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { schemaPossibilite, type Possibilite, type ReponseItineraires } from "./api";
import type { Demande } from "./demande";
import {
  bandeauVoyage,
  champsDepuisVoyage,
  choixPossibles,
  cleVoyage,
  lireVoyage,
  peutEnregistrer,
  rangerVoyages,
  resumeVoyage,
  separerVoyage,
  voyageDePossibilite,
  voyagesDepuisRecherche,
  type LieuVoyage,
  type TrisVoyage,
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

const PAR_ARRIVEE: TrisVoyage = { aller: "arrivee", retour: "arrivee" };

const RETOUR_IMPOSSIBLE: ReponseItineraires = { ...REPONSE, retour: { ...REPONSE.retour!, verdict: "impossible", possibilites: [] } };

/** L'aller enregistré seul (spec 24 §7, D101), puis ce que le cas change. */
function voyage(changes: Partial<Voyage> = {}): Voyage {
  return { ...voyagesDepuisRecherche(RECHERCHE, "aller", PAR_ARRIVEE, MAINTENANT)[0]!, ...changes };
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

  it("aller impossible sans retour ⇒ rien à enregistrer", () => {
    const vide = { ...sens([], "10:00", "impossible"), retour: null };
    expect(peutEnregistrer(vide)).toBe(false);
    expect(choixPossibles(vide)).toEqual([]);
    expect(voyagesDepuisRecherche({ ...RECHERCHE, reponse: vide }, "aller", PAR_ARRIVEE, MAINTENANT)).toEqual([]);
    expect(voyagesDepuisRecherche({ ...RECHERCHE, reponse: null }, "aller", PAR_ARRIVEE, MAINTENANT)).toEqual([]);
    expect(voyagesDepuisRecherche({ ...RECHERCHE, depart: { lieu: null } }, "aller", PAR_ARRIVEE, MAINTENANT)).toEqual([]);
    expect(peutEnregistrer(REPONSE)).toBe(true);
  });

  it("bandeau du voyage rouvert : heure d'enregistrement à Paris, jamais « en direct »", () => {
    expect(bandeauVoyage("2026-11-06T13:32:00.000Z")).toBe("Voyage enregistré le 06/11 à 14:32. Horaires prévus, sans suivi en direct.");
    // Heure d'été : 1er juillet 06:05 UTC ⇒ 08:05 à Paris.
    expect(bandeauVoyage("2026-07-01T06:05:00.000Z")).toBe("Voyage enregistré le 01/07 à 08:05. Horaires prévus, sans suivi en direct.");
  });

  it("modifier : le formulaire reprend le voyage, lieux déjà trouvés sans réseau, date passée ramenée à aujourd'hui", () => {
    const v = voyage({ demande: DEMANDE });
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

describe("un trajet par sens (spec 24 §7, D101)", () => {
  it("choix offerts : les trois avec un retour possible, un seul sens sinon", () => {
    expect(choixPossibles(REPONSE)).toEqual(["aller_retour", "aller", "retour"]);
    expect(choixPossibles({ ...REPONSE, retour: null })).toEqual(["aller"]);
    expect(choixPossibles(RETOUR_IMPOSSIBLE)).toEqual(["aller"]);
    const allerImpossible: ReponseItineraires = { ...REPONSE, verdict: "impossible", possibilites: [] };
    expect(choixPossibles(allerImpossible)).toEqual(["retour"]);
    expect(peutEnregistrer(allerImpossible)).toBe(true);
  });

  it("aller seul : sans retour, ni dans la demande ni dans la réponse", () => {
    const [aller, ...reste] = voyagesDepuisRecherche(RECHERCHE, "aller", PAR_ARRIVEE, MAINTENANT);
    expect(reste).toEqual([]);
    expect(aller).toMatchObject({ trajet: "aller", tri: "arrivee", depart: DEPART, arrivee: ARRIVEE });
    expect(aller!.demande).toEqual({ ...DEMANDE, retour: null });
    expect(aller!.reponse.retour).toBeNull();
    expect(aller!.reponse.possibilites).toEqual(REPONSE.possibilites);
  });

  it("retour seul : lieux échangés, « partir à » la fin du rendez-vous, réponse du retour telle quelle", () => {
    const [retour, ...reste] = voyagesDepuisRecherche(RECHERCHE, "retour", { aller: "arrivee", retour: "marche" }, MAINTENANT);
    expect(reste).toEqual([]);
    expect(retour).toMatchObject({ trajet: "retour", tri: "marche", depart: ARRIVEE, arrivee: DEPART });
    expect(retour!.demande).toEqual({
      depart: DEMANDE.arrivee,
      arrivee: DEMANDE.depart,
      date: "2026-11-12",
      heure: "16:00",
      sens: "partir_a",
      marge: 10,
      retour: null,
    });
    // Aucune heure recalculée (invariant 3) ; l'arrivée garde l'adresse connue du départ de l'aller.
    expect(retour!.reponse.possibilites).toEqual(REPONSE.retour!.possibilites);
    expect(retour!.reponse.demande).toEqual(REPONSE.retour!.demande);
    expect(retour!.reponse.arrivee).toEqual({ nom: "Domicile", adresse: "Brienon-sur-Armançon" });
    expect(retour!.reponse.retour).toBeNull();
  });

  it("aller et retour : deux trajets, deux clés", () => {
    const deux = voyagesDepuisRecherche(RECHERCHE, "aller_retour", PAR_ARRIVEE, MAINTENANT);
    expect(deux.map((v) => v.trajet)).toEqual(["aller", "retour"]);
    const cles = deux.map((v) => cleVoyage(v.demande, v.depart, v.arrivee));
    expect(new Set(cles).size).toBe(2);
  });

  it("un sens impossible n'est jamais enregistré, même demandé", () => {
    const r = voyagesDepuisRecherche({ ...RECHERCHE, reponse: RETOUR_IMPOSSIBLE }, "aller_retour", PAR_ARRIVEE, MAINTENANT);
    expect(r.map((v) => v.trajet)).toEqual(["aller"]);
  });

  it("ancien voyage avec retour ⇒ coupé en aller et retour ; sans retour ⇒ inchangé", () => {
    const ancien = { enregistre_le: "2026-11-06T13:32:00.000Z", demande: DEMANDE, depart: DEPART, arrivee: ARRIVEE, reponse: REPONSE };
    const lu = lireVoyage(JSON.stringify(ancien))!;
    const attendu = voyagesDepuisRecherche(RECHERCHE, "aller_retour", PAR_ARRIVEE, MAINTENANT).map(({ tri: _tri, ...v }) => v);
    expect(separerVoyage(lu)).toEqual(attendu);
    const sansRetour = voyage();
    expect(separerVoyage(sansRetour)).toEqual([sansRetour]);
    // Retour impossible : seul l'aller reste.
    expect(separerVoyage({ ...lu, reponse: RETOUR_IMPOSSIBLE }).map((v) => v.trajet)).toEqual(["aller"]);
  });

  it("résumé : jour, lieux, une ligne d'horaires (heures, durée, changements), heure d'enregistrement à Paris", () => {
    expect(resumeVoyage(voyage())).toEqual({
      jour: "Jeudi 12/11",
      titre: "Domicile → France Travail Joigny",
      libelle: "Aller",
      horaires: { possible: true, depart: "08:14", arrivee: "10:44", duree: "2 h 30", changements: "1 chgt" },
      enregistre: "Enregistré le 06/11 à 14:32",
      phrase:
        "Jeudi 12/11, aller, Domicile vers France Travail Joigny : départ 08:14, arrivée 10:44, 2 h 30, 1 correspondance. " +
        "Horaire prévu, sans suivi en direct. Enregistré le 06/11 à 14:32.",
    });
    const retour = voyagesDepuisRecherche(RECHERCHE, "retour", PAR_ARRIVEE, MAINTENANT)[0]!;
    expect(resumeVoyage(retour)).toMatchObject({
      titre: "France Travail Joigny → Domicile",
      libelle: "Retour",
      horaires: { possible: true, depart: "16:23", arrivee: "17:40" },
    });
  });

  it("résumé : direct, 2 changements, arrivée le lendemain avec son jour", () => {
    const avec = (p: Partial<Possibilite>) =>
      resumeVoyage(voyage({ reponse: { ...REPONSE, retour: null, possibilites: [{ ...POSSIBILITE, ...p }] } })).horaires;
    expect(avec({ correspondances: 0, duree_minutes: 45 })).toMatchObject({ duree: "45 min", changements: "direct" });
    expect(avec({ correspondances: 2 })).toMatchObject({ changements: "2 chgt" });
    // 23:30 + 7 h 42 ⇒ vendredi 07:12 : l'arrivée garde son jour, comme le Résultat (D79).
    expect(avec({ depart: "23:30", arrivee: "07:12", duree_minutes: 462 })).toMatchObject({ arrivee: "ven. 07:12", duree: "7 h 42" });
  });

  it("résumé : le tri gardé choisit la possibilité montrée ; « arrivée » ou tri vide ⇒ celle du verdict", () => {
    // Même trajet avec une seule marche de 18 min, parti à 07:02 : « Moins de marche » le met en tête. Les deux
    // ont une marche longue (20 et 18 min) : D103 ne départage pas, le verdict garde la première.
    const marcheSeule = { ...POSSIBILITE.etapes.find((e) => e.mode === "marche")!, duree_minutes: 18 };
    const sansMarche: Possibilite = {
      ...POSSIBILITE,
      depart: "07:02",
      arrivee: "10:50",
      depart_utc: "2026-11-14T06:02:00.000Z",
      arrivee_utc: "2026-11-14T09:50:00.000Z",
      etapes: [...POSSIBILITE.etapes.filter((e) => e.mode !== "marche"), marcheSeule],
    };
    const reponse: ReponseItineraires = { ...REPONSE, retour: null, possibilites: [POSSIBILITE, sansMarche] };
    const montre = (tri: Voyage["tri"]) => {
      const h = resumeVoyage(voyage({ reponse, tri })).horaires;
      return h.possible ? h.depart : null;
    };
    expect(montre("arrivee")).toBe("08:14");
    expect(montre(undefined)).toBe("08:14");
    expect(montre("marche")).toBe("07:02");
    // Le bus de l'exemple est à réserver : « Sans réservation » ne garde rien ⇒ la possibilité du verdict.
    expect(montre("sans_reservation")).toBe("08:14");
  });
});

describe("un trajet choisi parmi les possibilités (spec 24 §8, D102)", () => {
  const AUTRE: Possibilite = {
    ...POSSIBILITE,
    depart: "07:02",
    arrivee: "09:40",
    depart_utc: "2026-11-12T06:02:00.000Z",
    arrivee_utc: "2026-11-12T08:40:00.000Z",
  };
  const DEUX: ReponseItineraires = { ...REPONSE, possibilites: [POSSIBILITE, AUTRE] };
  const R = { ...RECHERCHE, reponse: DEUX };

  it("aller : seule la possibilité touchée est gardée, telle que le serveur l'a donnée", () => {
    const v = voyageDePossibilite(R, "aller", 1, MAINTENANT)!;
    expect(v).toMatchObject({ trajet: "aller", depart: DEPART, arrivee: ARRIVEE });
    expect(v.tri).toBeUndefined();
    expect(v.demande.retour).toBeNull();
    expect(v.reponse.retour).toBeNull();
    expect(v.reponse.verdict).toBe("possible");
    expect(v.reponse.possibilites).toEqual([AUTRE]);
    // Rouvert ou dans Mes trajets, c'est elle qu'on voit.
    const h = resumeVoyage(v).horaires;
    expect(h.possible && h.depart).toBe("07:02");
  });

  it("retour : lieux échangés, seule la possibilité touchée du retour", () => {
    const retours = [REPONSE.retour!.possibilites[0]!, { ...AUTRE, depart: "17:05", arrivee: "18:20" }];
    const r = { ...R, reponse: { ...DEUX, retour: { ...REPONSE.retour!, possibilites: retours } } };
    const v = voyageDePossibilite(r, "retour", 1, MAINTENANT)!;
    expect(v).toMatchObject({ trajet: "retour", depart: ARRIVEE, arrivee: DEPART });
    expect(v.demande).toMatchObject({ sens: "partir_a", heure: "16:00", retour: null });
    expect(v.reponse.possibilites).toEqual([retours[1]]);
  });

  it("deux possibilités du même sens ⇒ même clé : la seconde remplace la première", () => {
    const a = voyageDePossibilite(R, "aller", 0, MAINTENANT)!;
    const b = voyageDePossibilite(R, "aller", 1, MAINTENANT)!;
    expect(cleVoyage(a.demande, a.depart, a.arrivee)).toBe(cleVoyage(b.demande, b.depart, b.arrivee));
  });

  it("rang absent, sens impossible ou lieu manquant ⇒ rien", () => {
    expect(voyageDePossibilite(R, "aller", 2, MAINTENANT)).toBeNull();
    expect(voyageDePossibilite({ ...R, reponse: RETOUR_IMPOSSIBLE }, "retour", 0, MAINTENANT)).toBeNull();
    expect(voyageDePossibilite({ ...R, depart: { lieu: null } }, "aller", 0, MAINTENANT)).toBeNull();
  });
});
