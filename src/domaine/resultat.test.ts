import { describe, expect, it } from "vitest";

import type { Etape, Possibilite, ReponseItineraires } from "./api";
import { REPONSE_CHATELET } from "./reponse-chatelet";
import { versRequeteItineraires } from "./demande";
import {
  aMarcheLongue,
  dateHoraires,
  detailCandidat,
  formaterDistance,
  formaterDuree,
  jetonMode,
  jourCourt,
  libelleCorrespondances,
  libelleEtape,
  phraseVerdict,
  resumePossibilite,
  sousTitreDemande,
} from "./resultat";

const chatelet = REPONSE_CHATELET.possibilites[0]!;
const marche = chatelet.etapes[0]!;
const metro = chatelet.etapes[1]!;

function etape(modif: Partial<Etape>): Etape {
  return { ...metro, ...modif };
}

const ARRIVER: ReponseItineraires = {
  verdict: "possible",
  demande: { date: "2026-11-12", heure: "10:00", sens: "arriver", marge: 10, limite: "09:50" },
  possibilites: [{ ...chatelet, depart: "06:27", arrivee: "09:24" }],
};

describe("phraseVerdict (spec 10, critère 3)", () => {
  it("« arriver avant » : départ, limite, rendez-vous, marge et arrivée", () => {
    expect(phraseVerdict(ARRIVER)).toEqual({
      possible: true,
      titre: "Possible",
      heureDepart: "06:27",
      detail: "À faire : être sur place avant 09:50 (rendez-vous 10:00, marge 10 min). Arrivée prévue à 09:24.",
    });
  });

  it("« arriver avant » sans marge", () => {
    const r = phraseVerdict({ ...ARRIVER, demande: { ...ARRIVER.demande, marge: 0, limite: "10:00" } });
    expect(r.detail).toBe("À faire : être sur place avant 10:00 (rendez-vous 10:00, sans marge). Arrivée prévue à 09:24.");
  });

  it("« partir à » : départ et arrivée", () => {
    expect(phraseVerdict(REPONSE_CHATELET)).toEqual({
      possible: true,
      titre: "Possible",
      heureDepart: "07:01",
      detail: "Arrivée prévue à 07:30.",
    });
  });

  it("« impossible » : aucune heure de trajet (invariant 13)", () => {
    const r = phraseVerdict({ ...ARRIVER, verdict: "impossible", possibilites: [] });
    expect(r).toEqual({
      possible: false,
      titre: "Impossible",
      heureDepart: null,
      detail: "Aucun trajet ce jour-là pour arriver avant 09:50.",
    });
    const p = phraseVerdict({ ...REPONSE_CHATELET, verdict: "impossible", possibilites: [] });
    expect(p.detail).toBe("Aucun trajet ce jour-là au départ de 07:00.");
  });
});

describe("étapes", () => {
  it("libellés", () => {
    expect(libelleEtape(marche)).toBe("Marche 4 min");
    expect(libelleEtape(metro)).toBe("Métro 14");
    expect(libelleEtape(etape({ mode: "train_banlieue", ligne: "B" }))).toBe("RER B");
    expect(libelleEtape(etape({ mode: "train_banlieue", ligne: "N" }))).toBe("Train N");
    expect(libelleEtape(etape({ mode: "train_banlieue", ligne: null }))).toBe("Train de banlieue");
    expect(libelleEtape(etape({ mode: "car", ligne: "K941" }))).toBe("Car K941");
    expect(libelleEtape(etape({ mode: "bus", ligne: null }))).toBe("Bus");
    expect(libelleEtape(etape({ mode: "transport_a_la_demande", ligne: "856" }))).toBe("Transport à la demande");
    expect(libelleEtape(etape({ mode: "autre", ligne: "X" }))).toBe("Transport X");
  });

  it("résumé d'une possibilité", () => {
    expect(resumePossibilite(chatelet)).toBe("Marche 4 min · Métro 14 · Marche 3 min");
  });

  it("marche longue : avertie à 16 min, pas à 15 (D3)", () => {
    const avec = (min: number): Possibilite => ({ ...chatelet, etapes: [{ ...marche, duree_minutes: min }, metro] });
    expect(aMarcheLongue(avec(15))).toBe(false);
    expect(aMarcheLongue(avec(16))).toBe(true);
    // Un trajet en transport de 22 min n'est pas une marche.
    expect(aMarcheLongue({ ...chatelet, etapes: [metro] })).toBe(false);
  });

  it("couleurs : jetons du design system seulement (D67)", () => {
    expect(jetonMode("metro")).toBe("mode-train");
    expect(jetonMode("train_banlieue")).toBe("mode-train");
    expect(jetonMode("tram")).toBe("mode-train");
    expect(jetonMode("bus")).toBe("mode-car");
    expect(jetonMode("car")).toBe("mode-car");
    expect(jetonMode("transport_a_la_demande")).toBe("mode-tad");
    expect(jetonMode("marche")).toBe("mode-marche");
    expect(jetonMode("bateau")).toBe("mode-taxi");
    expect(jetonMode("inconnu")).toBe("mode-taxi");
  });

  it("correspondances et durées", () => {
    expect(libelleCorrespondances(0)).toBe("Direct");
    expect(libelleCorrespondances(1)).toBe("1 correspondance");
    expect(libelleCorrespondances(3)).toBe("3 correspondances");
    expect(formaterDuree(29)).toBe("29 min");
    expect(formaterDuree(60)).toBe("1 h");
    expect(formaterDuree(139)).toBe("2 h 19");
    expect(formaterDuree(305)).toBe("5 h 05");
  });
});

describe("date des horaires", () => {
  it("la plus ancienne version GTFS, l'OSM ignoré", () => {
    const autre: Possibilite = {
      ...chatelet,
      etapes: [etape({ source: { type: "gtfs", jeu: "r1", version: "2026-09-21", trip_id: "t", date_service: "2026-11-13" } })],
    };
    expect(dateHoraires([chatelet])).toBe("29/10");
    expect(dateHoraires([chatelet, autre])).toBe("21/09");
  });

  it("version qui n'est pas une date : montrée telle quelle ; aucun GTFS : rien", () => {
    const texte: Possibilite = {
      ...chatelet,
      etapes: [etape({ source: { type: "gtfs", jeu: "r1", version: "v42", trip_id: "t", date_service: "2026-11-13" } })],
    };
    expect(dateHoraires([texte])).toBe("v42");
    expect(dateHoraires([{ ...chatelet, etapes: [marche] }])).toBeNull();
    expect(dateHoraires([])).toBeNull();
  });
});

describe("Confirmation", () => {
  const demande = { lieu_texte: "France Travail Joigny", date: "2026-11-12", heure: "10:00", sens: "arriver_avant" as const, marge: 10 };

  it("jour court sans fuseau (R11)", () => {
    expect(jourCourt("2026-11-12")).toBe("Jeudi 12/11");
    expect(jourCourt("2026-11-15")).toBe("Dimanche 15/11");
  });

  it("sous-titre de la maquette 03", () => {
    expect(sousTitreDemande(demande, "domicile")).toBe("Jeudi 12/11 · arriver avant 10:00 · marge 10 min · depuis Domicile");
    expect(sousTitreDemande({ ...demande, sens: "partir_a", marge: 0 }, "position")).toBe(
      "Jeudi 12/11 · partir à 10:00 · depuis ma position",
    );
    expect(sousTitreDemande({ ...demande, marge: 0 }, "domicile")).toContain("sans marge");
  });

  it("détail d'un candidat", () => {
    const c = { nom: "Agence France travail", type: "lieu" as const, commune: "Joigny", code_postal: "89300", lat: 0, lon: 0, distance_metres: 17480 };
    expect(detailCandidat(c)).toBe("Joigny, 89300 · à 17 km");
    expect(detailCandidat({ ...c, type: "arret", code_postal: null, distance_metres: 240 })).toBe("Arrêt, Joigny · à 240 m");
    expect(detailCandidat({ ...c, type: "adresse", commune: null, code_postal: null, distance_metres: null })).toBe("Adresse");
  });

  it("distances", () => {
    expect(formaterDistance(58)).toBe("60 m");
    expect(formaterDistance(1234)).toBe("1,2 km");
    expect(formaterDistance(17480)).toBe("17 km");
  });
});

describe("versRequeteItineraires", () => {
  const depart = { lat: 47.991, lon: 3.617 };
  const arrivee = { lat: 47.97449, lon: 3.386229 };

  it("« arriver avant » ⇒ arriver, marge transmise", () => {
    expect(
      versRequeteItineraires({ lieu_texte: "x", date: "2026-11-12", heure: "10:00", sens: "arriver_avant", marge: 10 }, depart, arrivee),
    ).toEqual({ depart, arrivee, date: "2026-11-12", heure: "10:00", sens: "arriver", marge: 10 });
  });

  it("« partir à » ⇒ partir ; le texte du lieu ne part jamais", () => {
    const r = versRequeteItineraires({ lieu_texte: "chez le médecin", date: "2026-11-13", heure: "07:00", sens: "partir_a", marge: 0 }, depart, arrivee);
    expect(r.sens).toBe("partir");
    expect(JSON.stringify(r)).not.toContain("médecin");
  });
});
