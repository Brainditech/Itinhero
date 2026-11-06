import { describe, expect, it } from "vitest";

import type { Etape, Possibilite, ReponseItineraires } from "./api";
import { REPONSE_CHATELET } from "./reponse-chatelet";
import { versRequeteItineraires, type BoutLieu } from "./demande";
import { trier } from "./tri";
import {
  aMarcheLongue,
  attenteApres,
  directionEtape,
  finHoraires,
  minutesEntre,
  nomLieuEtape,
  phraseMontee,
  phraseReservation,
  detailCandidat,
  formaterDistance,
  formaterDuree,
  jetonMode,
  jourCourt,
  libelleCorrespondances,
  libelleEtape,
  phraseVerdict,
  possibiliteDuVerdict,
  resumePossibilite,
  nomBout,
  NOM_MAX,
  quandDemande,
  possibiliteDe,
  trajetDuParametre,
  adresseBout,
  adresseArrivee,
  phraseVotreTrajet,
  formaterAttente,
  joursEnPlus,
  jourApres,
  nuitDehors,
  phraseTaxi,
} from "./resultat";

const LIEU_GARE: BoutLieu = {
  type: "lieu",
  nom: "Gare d'Auxerre-Saint-Gervais",
  lat: 47.7929,
  lon: 3.5821,
  nature: "arret",
  commune: "Auxerre",
  code_postal: "89000",
};

const chatelet = REPONSE_CHATELET.possibilites[0]!;
const marche = chatelet.etapes[0]!;
const metro = chatelet.etapes[1]!;

function etape(modif: Partial<Etape>): Etape {
  return { ...metro, ...modif };
}

const ARRIVER: ReponseItineraires = {
  verdict: "possible",
  demande: { date: "2026-11-12", heure: "10:00", sens: "arriver", marge: 10, limite: "09:50" },
  arrivee: { nom: null, adresse: null },
  possibilites: [{ ...chatelet, depart: "06:27", arrivee: "09:24" }],
};

describe("phraseVerdict (spec 10, critère 3)", () => {
  it("« arriver avant » : départ, limite, rendez-vous, marge et arrivée", () => {
    expect(phraseVerdict(ARRIVER)).toEqual({
      possible: true,
      etat: "possible",
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
      etat: "possible",
      titre: "Possible",
      heureDepart: "07:01",
      detail: "Arrivée prévue à 07:30.",
    });
  });

  it("« impossible » : aucune heure de trajet (invariant 13)", () => {
    const r = phraseVerdict({ ...ARRIVER, verdict: "impossible", possibilites: [] });
    expect(r).toEqual({
      possible: false,
      etat: "impossible",
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
    expect(libelleEtape(etape({ mode: "train", mode_motis: "REGIONAL_RAIL", ligne: "TER", exploitant: "Nomad Train (SNCF, Région Normandie)" }))).toBe("TER");
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

describe("fin de validité des horaires (issue 0010, H)", () => {
  const gtfs = (fin: string | null) =>
    etape({ source: { type: "gtfs", jeu: "r1", version: "2026-09-21", trip_id: "t", date_service: "2026-11-13", fin_validite: fin, date_horaires: null } });
  it("la fin la plus proche parmi les jeux, l'OSM ignoré", () => {
    expect(finHoraires([chatelet])).toBe("31/12/2026");
    expect(finHoraires([chatelet, { ...chatelet, etapes: [gtfs("2026-11-30")] }])).toBe("30/11/2026");
  });
  it("aucune fin connue ⇒ rien", () => {
    expect(finHoraires([{ ...chatelet, etapes: [gtfs(null)] }])).toBeNull();
    expect(finHoraires([{ ...chatelet, etapes: [marche] }])).toBeNull();
    expect(finHoraires([])).toBeNull();
  });
});

describe("issue 0010 : Brienon → Dijon lisible", () => {
  const bus = etape({
    mode: "bus",
    mode_motis: "BUS",
    ligne: "803",
    direction: "Auxerre",
    exploitant: "MOBIGO 89",
    reservation: "appel",
    de: { nom: "Mairie", type: "arret", arret: "600326", lat: 47.99, lon: 3.61 },
    a: { nom: "Saint-Florentin-Vergigny, 3 rue de la Gare", type: "arret", arret: "3103848", lat: 47.97, lon: 3.72 },
    depart: "08:25",
    arrivee: "08:50",
  });
  const train = etape({
    mode: "train",
    mode_motis: "REGIONAL_RAIL",
    ligne: "K7",
    direction: "Lyon Part Dieu",
    numero: "17769",
    exploitant: "SNCF VOYAGEURS",
    de: { nom: "Saint-Florentin - Vergigny", type: "gare", arret: null, lat: 47.98, lon: 3.73 },
    depart: "09:10",
    arrivee: "10:24",
  });
  const aPied = (depart: string, arrivee: string): Etape => ({ ...marche, depart, arrivee });

  it("A : « TER K7 n° 17769 vers Lyon Part Dieu »", () => {
    expect(libelleEtape(train)).toBe("TER K7");
    expect(directionEtape(train)).toBe("n° 17769 vers Lyon Part Dieu");
    expect(directionEtape(bus)).toBe("vers Auxerre");
    expect(directionEtape(marche)).toBeNull();
  });

  it("B : réservation obligatoire, sans numéro de téléphone (invariant 16)", () => {
    const p = phraseReservation(bus)!;
    expect(p).toBe("Réservation obligatoire : appelez MOBIGO 89 avant de partir.");
    expect(p).not.toMatch(/\d{2}[ .]?\d{2}/);
    expect(phraseReservation(train)).toBeNull();
  });

  it("D : « Arrivez à l'arrêt à 08:15, le bus passe à 08:25. »", () => {
    const p: Possibilite = {
      ...chatelet,
      montee: { arriver_a: "08:15", vehicule: "08:25", marge_minutes: 10 },
      etapes: [aPied("08:14", "08:15"), bus],
    };
    expect(phraseMontee(p)).toBe("Arrivez à l'arrêt à 08:15, le bus passe à 08:25.");
    const enGare: Possibilite = { ...p, montee: { arriver_a: "09:04", vehicule: "09:10", marge_minutes: 6 }, etapes: [aPied("09:00", "09:04"), train] };
    expect(phraseMontee(enGare)).toBe("Arrivez à la gare à 09:04, le train part à 09:10.");
    expect(phraseMontee({ ...p, montee: null })).toBeNull();
  });

  it("E : 6 min d'attente entre la marche (arrivée 09:04) et le train de 09:10 ; 2 min ne se disent pas", () => {
    const etapes = [bus, aPied("08:50", "09:04"), train];
    expect(attenteApres(etapes, 0)).toBeNull();
    expect(attenteApres(etapes, 1)).toBe(6);
    expect(attenteApres(etapes, 2)).toBeNull();
    expect(attenteApres([aPied("09:00", "09:08"), train], 0)).toBeNull();
    expect(minutesEntre("23:58", "00:03")).toBe(5);
  });

  it("F : « arrêt Mairie », « gare de Saint-Florentin - Vergigny », sans répéter ce que dit le nom", () => {
    expect(nomLieuEtape(bus.de)).toBe("arrêt Mairie");
    expect(nomLieuEtape(train.de)).toBe("gare de Saint-Florentin - Vergigny");
    expect(nomLieuEtape({ ...train.de, nom: "Dijon Gare", type: "station" })).toBe("Dijon Gare");
    expect(nomLieuEtape({ ...train.de, nom: "Godrans Les Halles", type: "station" })).toBe("station Godrans Les Halles");
    expect(nomLieuEtape({ ...train.de, nom: "Gare de Lyon", type: "gare" })).toBe("Gare de Lyon");
    expect(nomLieuEtape({ ...train.de, nom: "Tribunal administratif de Dijon", type: "arrivee" })).toBe("Tribunal administratif de Dijon");
  });
});

describe("Lieux du formulaire", () => {

  it("jour court sans fuseau (R11)", () => {
    expect(jourCourt("2026-11-12")).toBe("Jeudi 12/11");
    expect(jourCourt("2026-11-15")).toBe("Dimanche 15/11");
  });

  it("noms envoyés à l'API pour chaque forme de bout (spec 13, §4.4)", () => {
    expect(nomBout({ type: "domicile" }, null)).toBe("Domicile");
    expect(nomBout({ type: "position" }, null)).toBe("Ma position");
    expect(nomBout({ type: "texte", texte: "tribunal dijon" }, { nom: "Tribunal Administratif de Dijon" })).toBe(
      "Tribunal Administratif de Dijon",
    );
    expect(nomBout({ type: "texte", texte: "x" }, { nom: "a".repeat(200) })).toHaveLength(NOM_MAX);
    // Lieu choisi dans les suggestions (D91) : son nom, quel que soit le candidat passé.
    expect(nomBout(LIEU_GARE, null)).toBe("Gare d'Auxerre-Saint-Gervais");
    expect(nomBout({ ...LIEU_GARE, nom: "b".repeat(200) }, null)).toHaveLength(NOM_MAX);
  });

  it("adresse d'un lieu choisi : celle de sa nature et de sa commune (spec 18, §4.4)", () => {
    expect(adresseBout(LIEU_GARE, { type: "arret", commune: "Auxerre", code_postal: "89000" })).toBe("Arrêt, 89000 Auxerre");
    expect(adresseBout({ ...LIEU_GARE, nature: "lieu" }, { type: "lieu", commune: "Auxerre", code_postal: null })).toBe("Auxerre");
  });

  it("détail d'un candidat", () => {
    const c = { nom: "Agence France travail", type: "lieu" as const, commune: "Joigny", code_postal: "89300", lat: 0, lon: 0, distance_metres: 17480 };
    expect(detailCandidat(c)).toBe("Joigny, 89300 · à 17 km");
    expect(detailCandidat({ ...c, type: "arret", code_postal: null, distance_metres: 240 })).toBe("Arrêt, Joigny · à 240 m");
    expect(detailCandidat({ ...c, type: "adresse", commune: null, code_postal: null, distance_metres: null })).toBe("Adresse");
  });

  it("détail : le transport dit (D92), la commune pas redite sous un lieu de son nom", () => {
    const c = { nom: "Saint-Michel-sur-Orge", type: "lieu" as const, commune: "Saint-Michel-sur-Orge", code_postal: "91240", lat: 0, lon: 0, distance_metres: 120000 };
    expect(detailCandidat(c)).toBe("91240 · à 120 km");
    expect(detailCandidat({ ...c, type: "arret", transport: "train" })).toBe("Gare, 91240 · à 120 km");
    expect(detailCandidat({ ...c, nom: "Châtelet", type: "arret", commune: "Paris", code_postal: "75004", transport: "metro", distance_metres: null })).toBe(
      "Métro, Paris, 75004",
    );
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
      versRequeteItineraires({ depart: { type: "domicile" as const }, arrivee: { type: "texte" as const, texte: "x" }, date: "2026-11-12", heure: "10:00", sens: "arriver_avant", marge: 10 }, depart, arrivee),
    ).toEqual({ depart, arrivee, date: "2026-11-12", heure: "10:00", sens: "arriver", marge: 10 });
  });

  it("« partir à » ⇒ partir ; le texte du lieu ne part jamais", () => {
    const r = versRequeteItineraires({ depart: { type: "domicile" as const }, arrivee: { type: "texte" as const, texte: "chez le médecin" }, date: "2026-11-13", heure: "07:00", sens: "partir_a", marge: 0 }, depart, arrivee);
    expect(r.sens).toBe("partir");
    expect(JSON.stringify(r)).not.toContain("médecin");
  });

  it("noms du départ et du lieu choisi envoyés pour remplacer « Départ » et « Arrivée » (issue 0010, C)", () => {
    const d = { depart: { type: "domicile" as const }, arrivee: { type: "texte" as const, texte: "x" }, date: "2026-11-14", heure: "15:35", sens: "arriver_avant" as const, marge: 10 };
    const noms = { depart: "Domicile", arrivee: "Tribunal Administratif de Dijon" };
    expect(versRequeteItineraires(d, depart, arrivee, noms).noms).toEqual(noms);
    expect(versRequeteItineraires(d, depart, arrivee)).not.toHaveProperty("noms");
  });
});

describe("Votre trajet (spec 14)", () => {
  const demande = { depart: { type: "domicile" as const }, arrivee: { type: "texte" as const, texte: "France Travail Joigny" }, date: "2026-11-12", heure: "10:00", sens: "arriver_avant" as const, marge: 10 };
  const domicile = { type: "domicile" as const };
  const tape = { type: "texte" as const, texte: "France Travail Joigny" };

  it("quandDemande : arriver avant avec et sans marge, partir à (critère 1)", () => {
    expect(quandDemande(demande)).toBe("Jeudi 12/11 · arriver avant 10:00 · marge 10 min");
    expect(quandDemande({ ...demande, marge: 0 })).toBe("Jeudi 12/11 · arriver avant 10:00 · sans marge");
    expect(quandDemande({ ...demande, date: "2026-11-05", heure: "17:00", sens: "partir_a" })).toBe("Jeudi 05/11 · partir à 17:00");
  });

  it("adresse du domicile, avec et sans détail, code postal remis devant la commune (critère 2)", () => {
    expect(adresseBout(domicile, { libelle: "12 rue de la Mairie", detail: "Brienon-sur-Armançon, 89210" })).toBe(
      "12 rue de la Mairie, 89210 Brienon-sur-Armançon",
    );
    expect(adresseBout(domicile, { libelle: "12 rue de la Mairie", detail: null })).toBe("12 rue de la Mairie");
    expect(adresseBout(domicile, { libelle: "Mairie", detail: "Brienon-sur-Armançon" })).toBe("Mairie, Brienon-sur-Armançon");
  });

  it("Ma position n'a pas d'adresse ; un lieu tapé donne commune et code postal, sans distance (critère 2)", () => {
    expect(adresseBout({ type: "position" }, {})).toBeNull();
    expect(adresseBout(tape, { type: "lieu", commune: "Joigny", code_postal: "89300" })).toBe("89300 Joigny");
    expect(adresseBout(tape, { type: "arret", commune: "Joigny", code_postal: "89300" })).toBe("Arrêt, 89300 Joigny");
    expect(adresseBout(tape, { type: "adresse", commune: "Joigny", code_postal: null })).toBe("Joigny");
    expect(adresseBout(tape, { type: "lieu" })).toBeNull();
  });

  it("arrivée : l'adresse IGN d'abord, sauf pour le domicile enregistré (critère 2)", () => {
    expect(adresseArrivee(tape, "89300 Joigny", "19 Route de Chamvres, 89300 Joigny")).toBe("19 Route de Chamvres, 89300 Joigny");
    expect(adresseArrivee(tape, "89300 Joigny", null)).toBe("89300 Joigny");
    expect(adresseArrivee(domicile, "12 rue de la Mairie, 89210 Brienon-sur-Armançon", "11 Rue de la Mairie, 89210 Brienon")).toBe(
      "12 rue de la Mairie, 89210 Brienon-sur-Armançon",
    );
    expect(adresseArrivee({ type: "position" }, null, null)).toBeNull();
  });

  it("TalkBack lit tout le trajet d'un bloc (critère 5)", () => {
    expect(
      phraseVotreTrajet(
        { nom: "Domicile", adresse: "12 rue de la Mairie, 89210 Brienon-sur-Armançon" },
        { nom: "France Travail", adresse: "19 Route de Chamvres, 89300 Joigny" },
        demande,
      ),
    ).toBe(
      "Votre trajet : de Domicile, 12 rue de la Mairie, 89210 Brienon-sur-Armançon, à France Travail, 19 Route de Chamvres, 89300 Joigny. Jeudi 12/11, arriver avant 10:00, marge 10 min.",
    );
    expect(phraseVotreTrajet({ nom: "Ma position", adresse: null }, { nom: "Joigny", adresse: null }, demande)).toContain(
      "de Ma position, à Joigny.",
    );
  });
});

// ——— Spec 15 : nuit dehors et changement de jour (D79) ———

function lieu(nom: string): Etape["a"] {
  return { ...metro.a, nom };
}

/** Dijon → Brienon, jeudi 05/11, partir à 17:00 (issue 0011) : 20:11 → 06:32, nuit à Laroche-Migennes. */
const NUIT: Possibilite = {
  ...chatelet,
  depart: "20:11",
  arrivee: "06:32",
  duree_minutes: 621,
  etapes: [
    etape({ mode: "marche", depart: "20:11", arrivee: "20:31", duree_minutes: 20, a: lieu("Dijon Gare") }),
    etape({ mode: "train", ligne: "P5", depart: "20:36", arrivee: "22:22", duree_minutes: 106, a: lieu("Laroche-Migennes") }),
    etape({ mode: "marche", depart: "22:22", arrivee: "22:23", duree_minutes: 1, a: lieu("Laroche-Migennes") }),
    etape({ mode: "car", ligne: "K941", depart: "06:14", arrivee: "06:27", duree_minutes: 13, a: lieu("Brienon-sur-Armançon Mairie") }),
    etape({ mode: "marche", depart: "06:27", arrivee: "06:32", duree_minutes: 5, a: lieu("Domicile") }),
  ],
};

function avecAttente(de: string, a: string): Possibilite {
  return {
    ...chatelet,
    etapes: [
      etape({ depart: "00:00", arrivee: de, a: lieu("Gare") }),
      etape({ depart: a, arrivee: a, a: lieu("Fin") }),
    ],
  };
}

const RETOUR_DIJON: ReponseItineraires = {
  verdict: "possible",
  demande: { date: "2026-11-05", heure: "17:00", sens: "partir", marge: null, limite: null },
  arrivee: { nom: "Domicile", adresse: null },
  possibilites: [NUIT],
};

describe("nuit dehors et changement de jour (spec 15)", () => {
  it("nuitDehors : 22:23 → 06:14 oui ; l'après-midi, ou 20 min autour de minuit, non ; 04:00 → 05:30 oui", () => {
    expect(nuitDehors(NUIT)).toEqual({ lieu: "Laroche-Migennes", minutes: 471 });
    expect(nuitDehors(avecAttente("14:00", "17:30"))).toBeNull();
    expect(nuitDehors(avecAttente("23:50", "00:10"))).toBeNull();
    expect(nuitDehors(avecAttente("04:00", "05:30"))).toEqual({ lieu: "Gare", minutes: 90 });
  });

  it("joursEnPlus, jourApres, formaterAttente", () => {
    expect(joursEnPlus(NUIT)).toBe(1);
    expect(joursEnPlus({ ...chatelet, depart: "06:17", duree_minutes: 135 })).toBe(0);
    expect(jourApres("2026-11-05", 1)).toBe("vendredi");
    expect(jourApres("2026-11-14", 1)).toBe("dimanche");
    expect(formaterAttente(471)).toBe("7 h 51");
    expect(formaterAttente(12)).toBe("12 min");
  });

  it("une nuit dehors n'est jamais « Possible » en vert", () => {
    expect(phraseVerdict(RETOUR_DIJON)).toEqual({
      possible: false,
      etat: "nuit",
      titre: "Nuit dehors",
      heureDepart: "20:11",
      detail:
        "Arrivée vendredi 06:32 après 7 h 51 d'attente de nuit à Laroche-Migennes. Aucun trajet sans nuit dehors trouvé.",
    });
  });

  it("le verdict s'appuie sur la première possibilité sans nuit, même placée après", () => {
    const soir = { ...chatelet, depart: "17:03", arrivee: "19:05", duree_minutes: 122 };
    const r = phraseVerdict({ ...RETOUR_DIJON, possibilites: [NUIT, soir] });
    expect(r.etat).toBe("possible");
    expect(r.heureDepart).toBe("17:03");
    expect(r.detail).toBe("Arrivée prévue à 19:05.");
  });

  it("une arrivée le lendemain sans nuit dehors est dite", () => {
    const tard = { ...chatelet, depart: "23:30", arrivee: "00:20", duree_minutes: 50 };
    expect(phraseVerdict({ ...RETOUR_DIJON, possibilites: [tard] }).detail).toBe("Arrivée prévue vendredi 00:20.");
  });
});

// ——— Spec 16 : taxi comme étape (D48, D80) ———

describe("taxi comme étape (spec 16)", () => {
  const taxi = etape({ mode: "taxi", mode_motis: "CAR", ligne: null, depart: "18:31", arrivee: "18:43", duree_minutes: 12 });
  const soirTaxi: Possibilite = { ...chatelet, depart: "17:23", arrivee: "18:43", duree_minutes: 80, etapes: [etape({ depart: "17:23", arrivee: "18:30" }), taxi] };

  it("libellé et consigne : prise en charge, route estimée, délai non connu, aucun numéro", () => {
    expect(libelleEtape(taxi)).toBe("Taxi 12 min");
    expect(phraseTaxi(taxi)).toBe(
      "À réserver : prise en charge à 18:31. 12 min de route estimée, hors attente. Délai pour appeler non connu.",
    );
    expect(phraseTaxi(metro)).toBeNull();
  });

  it("le verdict préfère le taxi du soir à une nuit dehors, et le dit", () => {
    const r = phraseVerdict({ ...RETOUR_DIJON, possibilites: [soirTaxi, NUIT] });
    expect(r.etat).toBe("possible");
    expect(r.heureDepart).toBe("17:23");
    expect(r.detail).toBe("Arrivée prévue à 18:43. Avec un taxi à réserver (prix non publié).");
  });

  it("D114 : le verdict prend la première de la liste, même avec un taxi ; le taxi est dit", () => {
    const soir = { ...chatelet, depart: "19:00", arrivee: "20:10", duree_minutes: 70, arrivee_utc: "2026-11-05T19:10:00.000Z" };
    const taxiTot = { ...soirTaxi, arrivee_utc: "2026-11-05T17:43:00.000Z" };
    const v = phraseVerdict({ ...RETOUR_DIJON, possibilites: [soir, taxiTot] });
    expect(v.heureDepart).toBe("17:23");
    expect(v.detail).toContain("taxi à réserver");
    expect(trier([soir, taxiTot], "arrivee")[0]!.possibilite).toBe(taxiTot);
  });
});

describe("retour planifié (spec 19, D94)", () => {
  const RETOUR = {
    ...ARRIVER,
    demande: { date: "2026-11-12", heure: "16:00", sens: "partir" as const, marge: null, limite: null },
    possibilites: [{ ...chatelet, depart: "16:12", arrivee: "17:05" }],
  };
  const AVEC_RETOUR: ReponseItineraires = { ...ARRIVER, retour: RETOUR };

  it("versRequeteItineraires : fin_rdv envoyé seulement avec une fin de rendez-vous", () => {
    const d = { depart: { type: "domicile" as const }, arrivee: { type: "texte" as const, texte: "x" }, date: "2026-11-12", heure: "10:00", sens: "arriver_avant" as const, marge: 10 };
    const p = { lat: 47.8, lon: 3.6 };
    expect(versRequeteItineraires({ ...d, retour: "16:00" }, p, p).fin_rdv).toBe("16:00");
    expect(versRequeteItineraires({ ...d, retour: null }, p, p)).not.toHaveProperty("fin_rdv");
    expect(versRequeteItineraires(d, p, p)).not.toHaveProperty("fin_rdv");
  });

  it("quandDemande dit le retour", () => {
    const d = { depart: { type: "domicile" as const }, arrivee: { type: "texte" as const, texte: "x" }, date: "2026-11-12", heure: "10:00", sens: "arriver_avant" as const, marge: 10, retour: "16:00" };
    expect(quandDemande(d)).toBe("Jeudi 12/11 · arriver avant 10:00 · marge 10 min · retour après 16:00");
  });

  it("verdict du retour : possible, départ et arrivée", () => {
    expect(phraseVerdict(RETOUR, "retour")).toMatchObject({ etat: "possible", heureDepart: "16:12", detail: "Arrivée prévue à 17:05." });
  });

  it("aucun retour ⇒ « Impossible », « Aucun retour ce jour-là après 16:00. »", () => {
    expect(phraseVerdict({ ...RETOUR, verdict: "impossible", possibilites: [] }, "retour")).toEqual({
      possible: false,
      etat: "impossible",
      titre: "Impossible",
      heureDepart: null,
      detail: "Aucun retour ce jour-là après 16:00.",
    });
  });

  it("possibiliteDe : l'aller ou le retour selon le paramètre `t`", () => {
    expect(possibiliteDe(AVEC_RETOUR, "aller", 0)?.depart).toBe("06:27");
    expect(possibiliteDe(AVEC_RETOUR, "retour", 0)?.depart).toBe("16:12");
    expect(possibiliteDe(ARRIVER, "retour", 0)).toBeUndefined();
    expect(possibiliteDe(null, "aller", 0)).toBeUndefined();
    expect(trajetDuParametre("retour")).toBe("retour");
    expect(trajetDuParametre(undefined)).toBe("aller");
    expect(trajetDuParametre("autre")).toBe("aller");
  });
});

describe("D103 (spec 25) : le verdict évite une longue marche", () => {
  const marche = chatelet.etapes.find((e) => e.mode === "marche")!;
  const avecMarche = (depart: string, minutes: number): Possibilite => ({
    ...chatelet,
    depart,
    etapes: [{ ...marche, duree_minutes: minutes }, ...chatelet.etapes.filter((e) => e.mode !== "marche")],
  });

  it("s'appuie sur un trajet sans marche longue quand il y en a un", () => {
    const r = phraseVerdict({ ...REPONSE_CHATELET, possibilites: [avecMarche("06:18", 48), avecMarche("06:50", 12)] });
    expect(r.heureDepart).toBe("06:50");
  });

  it("toutes avec une marche longue : la première, comme avant", () => {
    const r = phraseVerdict({ ...REPONSE_CHATELET, possibilites: [avecMarche("06:18", 48), avecMarche("06:50", 20)] });
    expect(r.heureDepart).toBe("06:18");
  });

  it("une nuit dehors reste évitée avant tout, même avec une longue marche", () => {
    const longue = { ...RETOUR_DIJON, possibilites: [NUIT, avecMarche("19:00", 48)] };
    expect(phraseVerdict(longue).heureDepart).toBe("19:00");
  });

  it("un taxi est évité avant une longue marche", () => {
    const taxi = etape({ mode: "taxi", mode_motis: "CAR", ligne: null, duree_minutes: 12 });
    const avecTaxi: Possibilite = { ...chatelet, depart: "06:40", etapes: [taxi, ...chatelet.etapes.filter((e) => e.mode !== "marche")] };
    expect(possibiliteDuVerdict({ ...REPONSE_CHATELET, possibilites: [avecTaxi, avecMarche("06:18", 48)] })?.depart).toBe("06:18");
  });
});
