import { describe, expect, it } from "vitest";

import { schemaCandidat, type Candidat } from "./api";
import { echangerBouts, schemaBout, type Bout, type BoutLieu } from "./demande";
import {
  annonceSuggestions,
  boutDuCandidat,
  candidatDuBout,
  Derniere,
  enAttente,
  etatSuggestions,
  iconeCandidat,
  MESSAGES_SUGGESTIONS,
  natureLue,
  reporterLieu,
  SUGGESTIONS_MAX,
  texteASuggerer,
} from "./suggestions";

const GARE: Candidat = {
  nom: "Gare d'Auxerre-Saint-Gervais",
  lat: 47.7929,
  lon: 3.5821,
  type: "arret",
  commune: "Auxerre",
  code_postal: "89000",
  distance_metres: 38_000,
};
const LIEU_GARE: BoutLieu = boutDuCandidat(GARE);
const texte = (t: string): Bout => ({ type: "texte", texte: t });

describe("texteASuggerer (spec 18, critère 1)", () => {
  it("rien sous 3 caractères, espaces de bord retirés", () => {
    expect(texteASuggerer(texte(""))).toBeNull();
    expect(texteASuggerer(texte("au"))).toBeNull();
    expect(texteASuggerer(texte("a  "))).toBeNull();
    expect(texteASuggerer(texte("  au  "))).toBeNull();
  });

  it("3 caractères et plus ⇒ le texte sans ses espaces de bord", () => {
    expect(texteASuggerer(texte("gar"))).toBe("gar");
    expect(texteASuggerer(texte("  gare d'aux "))).toBe("gare d'aux");
  });

  it("rien pour Domicile, Ma position, un lieu choisi", () => {
    expect(texteASuggerer({ type: "domicile" })).toBeNull();
    expect(texteASuggerer({ type: "position" })).toBeNull();
    expect(texteASuggerer(LIEU_GARE)).toBeNull();
  });
});

describe("lieu choisi (spec 18, critère 2)", () => {
  it("garde nom, point, nature, commune, code postal ; pas la distance", () => {
    expect(LIEU_GARE).toEqual({
      type: "lieu",
      nom: "Gare d'Auxerre-Saint-Gervais",
      lat: 47.7929,
      lon: 3.5821,
      nature: "arret",
      commune: "Auxerre",
      code_postal: "89000",
    });
    expect(candidatDuBout(LIEU_GARE)).toEqual({ ...GARE, distance_metres: undefined });
  });

  it("commune et code postal absents ⇒ null", () => {
    const { commune: _c, code_postal: _p, ...sans } = GARE;
    expect(boutDuCandidat(sans)).toMatchObject({ commune: null, code_postal: null });
  });

  it("passe le schéma Zod de la demande (invariant 9)", () => {
    expect(schemaBout.safeParse(LIEU_GARE).success).toBe(true);
    expect(schemaBout.safeParse({ ...LIEU_GARE, lat: 120 }).success).toBe(false);
    expect(schemaBout.safeParse({ ...LIEU_GARE, nom: "" }).success).toBe(false);
    expect(schemaBout.safeParse({ ...LIEU_GARE, nature: "ville" }).success).toBe(false);
  });

  it("⇅ échange un lieu choisi ; deux échanges rendent l'état de départ", () => {
    const champs = { depart: LIEU_GARE, arrivee: { type: "domicile" } as Bout };
    expect(echangerBouts(champs)).toEqual({ depart: { type: "domicile" }, arrivee: LIEU_GARE });
    expect(echangerBouts(echangerBouts(champs))).toEqual(champs);
  });
});

describe("reporterLieu (spec 18, critère 4)", () => {
  const champs = { depart: texte("gare d'auxerre "), arrivee: { type: "domicile" } as Bout };

  it("texte inchangé ⇒ le lieu retenu s'écrit dans le champ", () => {
    expect(reporterLieu(champs, "depart", "gare d'auxerre", LIEU_GARE)).toEqual({ ...champs, depart: LIEU_GARE });
  });

  it("texte modifié depuis ⇒ rien n'est écrasé", () => {
    const modifie = { ...champs, depart: texte("gare de sens") };
    expect(reporterLieu(modifie, "depart", "gare d'auxerre", LIEU_GARE)).toBe(modifie);
  });

  it("Domicile, position ou lieu déjà choisi ⇒ inchangés", () => {
    expect(reporterLieu(champs, "arrivee", "gare d'auxerre", LIEU_GARE)).toBe(champs);
    const position = { ...champs, depart: { type: "position" } as Bout };
    expect(reporterLieu(position, "depart", "gare d'auxerre", LIEU_GARE)).toBe(position);
    const choisi = { ...champs, depart: LIEU_GARE };
    expect(reporterLieu(choisi, "depart", "gare d'auxerre", { ...LIEU_GARE, nom: "autre" })).toBe(choisi);
  });
});

describe("état de la liste (spec 18, critère 5)", () => {
  it("5 lieux au plus", () => {
    const dix = Array.from({ length: 10 }, (_, i) => ({ ...GARE, nom: `Lieu ${i}` }));
    const e = etatSuggestions({ etat: "ok", donnees: dix }, "lieu");
    expect(e.etat === "ok" && e.candidats).toHaveLength(SUGGESTIONS_MAX);
    expect(annonceSuggestions(e)).toBe("5 lieux proposés");
    expect(annonceSuggestions(etatSuggestions({ etat: "ok", donnees: [GARE] }, "gare"))).toBe("1 lieu proposé");
  });

  it("aucun lieu ⇒ l'indication avec le texte tapé", () => {
    const e = etatSuggestions({ etat: "ok", donnees: [] }, "zzz");
    expect(e).toEqual({ etat: "vide", texte: "zzz" });
    expect(annonceSuggestions(e)).toBe("Aucun lieu trouvé pour « zzz ». Essayez avec la commune.");
  });

  it("tout échec, clé refusée comprise ⇒ « Suggestions indisponibles »", () => {
    for (const r of [
      { etat: "injoignable" },
      { etat: "erreur_serveur" },
      { etat: "cle_refusee" },
      { etat: "trop_de_demandes", minutes: 1 },
    ] as const) {
      expect(etatSuggestions(r, "gare")).toEqual({ etat: "echec" });
    }
    expect(annonceSuggestions({ etat: "echec" })).toBe(MESSAGES_SUGGESTIONS.indisponibles);
  });

  it("en attente, la liste précédente reste affichée", () => {
    expect(enAttente({ etat: "ok", candidats: [GARE] })).toEqual({ etat: "attente", candidats: [GARE] });
    expect(enAttente({ etat: "attente", candidats: [GARE] })).toEqual({ etat: "attente", candidats: [GARE] });
    expect(enAttente({ etat: "echec" })).toEqual({ etat: "attente", candidats: [] });
    expect(enAttente({ etat: "ferme" })).toEqual({ etat: "attente", candidats: [] });
  });

  it("une réponse arrivée après une plus récente est ignorée", () => {
    const d = new Derniere();
    const premiere = d.nouvelle();
    const seconde = d.nouvelle();
    expect(d.estDerniere(premiere)).toBe(false);
    expect(d.estDerniere(seconde)).toBe(true);
    d.oublier();
    expect(d.estDerniere(seconde)).toBe(false);
  });
});

// Spec 18, §12 (D92) : ce qu'est le lieu, d'un coup d'œil et à l'oreille.
describe("icône et nature d'un candidat (D92)", () => {
  const arret = (transport?: Candidat["transport"]): Candidat => ({ ...GARE, type: "arret", ...(transport ? { transport } : {}) });

  it("icône selon le transport, sinon selon la nature", () => {
    expect(iconeCandidat(arret("train"))).toBe("train");
    expect(iconeCandidat(arret("metro"))).toBe("M");
    expect(iconeCandidat(arret("tram"))).toBe("tram");
    expect(iconeCandidat(arret("car"))).toBe("directions_bus");
    expect(iconeCandidat(arret("bus"))).toBe("directions_bus");
    expect(iconeCandidat(arret("bateau"))).toBe("directions_boat");
    expect(iconeCandidat(arret())).toBe("directions_transit");
    expect(iconeCandidat({ type: "adresse" })).toBe("home_pin");
    expect(iconeCandidat({ type: "lieu" })).toBe("location_on");
    // Gare de la BD TOPO : un lieu avec un transport.
    expect(iconeCandidat({ type: "lieu", transport: "train" })).toBe("train");
  });

  it("mot dit et écrit", () => {
    expect(natureLue(arret("train"))).toBe("Gare");
    expect(natureLue(arret("metro"))).toBe("Métro");
    expect(natureLue(arret("tram"))).toBe("Tram");
    expect(natureLue(arret("car"))).toBe("Arrêt de car");
    expect(natureLue(arret("bus"))).toBe("Arrêt de bus");
    expect(natureLue(arret())).toBe("Arrêt");
    expect(natureLue({ type: "adresse" })).toBe("Adresse");
    expect(natureLue({ type: "lieu" })).toBe("");
  });

  it("le lieu choisi garde son transport, aller et retour", () => {
    const b = boutDuCandidat(arret("metro"));
    expect(b.transport).toBe("metro");
    expect(schemaBout.safeParse(b).success).toBe(true);
    expect(candidatDuBout(b).transport).toBe("metro");
    expect(boutDuCandidat(arret())).not.toHaveProperty("transport");
  });

  it("un transport inconnu (serveur plus récent) est oublié, le candidat reste valable", () => {
    const r = schemaCandidat.safeParse({ ...GARE, transport: "teleportation" });
    expect(r.success).toBe(true);
    expect(r.success && r.data.transport).toBeUndefined();
    expect(schemaCandidat.safeParse({ ...GARE }).success).toBe(true);
  });
});
