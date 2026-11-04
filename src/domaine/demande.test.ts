import { describe, expect, it } from "vitest";

import {
  dateChoisie,
  formaterDate,
  heureChoisie,
  maintenantAParis,
  MESSAGES,
  schemaDemande,
  validerFormulaire,
  versDateLocale,
  echangerBouts,
  type Bout,
  type ChampsFormulaire,
} from "./demande";

const DOMICILE: Bout = { type: "domicile" };
const POSITION: Bout = { type: "position" };
const texte = (t: string): Bout => ({ type: "texte", texte: t });

// Valeurs de la maquette design/accueil/02-formulaire-repli.png.
const MAQUETTE: ChampsFormulaire = {
  depart: { type: "domicile" },
  arrivee: { type: "texte", texte: "Rendez-vous Joigny" },
  date: "2026-11-12",
  heure: "10:00",
  sens: "arriver_avant",
  marge: "10",
};

// Mardi 3 novembre 2026, 18:00 à Paris (heure d'hiver, UTC+1).
const MAINTENANT = new Date("2026-11-03T17:00:00Z");

function erreurs(champs: Partial<ChampsFormulaire>, maintenant = MAINTENANT) {
  const r = validerFormulaire({ ...MAQUETTE, ...champs }, maintenant);
  return r.ok ? {} : r.erreurs;
}

describe("validerFormulaire", () => {
  it("valeurs de la maquette ⇒ demande valide", () => {
    expect(validerFormulaire(MAQUETTE, MAINTENANT)).toEqual({
      ok: true,
      demande: {
        depart: { type: "domicile" },
        arrivee: { type: "texte", texte: "Rendez-vous Joigny" },
        date: "2026-11-12", heure: "10:00", sens: "arriver_avant",
        marge: 10,
      },
    });
  });

  it("la demande produite passe le schéma Zod", () => {
    const r = validerFormulaire(MAQUETTE, MAINTENANT);
    if (!r.ok) throw new Error("demande attendue");
    expect(schemaDemande.safeParse(r.demande).success).toBe(true);
  });

  it("retire les espaces aux bouts d'un lieu tapé", () => {
    const r = validerFormulaire({ ...MAQUETTE, arrivee: texte("  Joigny  ") }, MAINTENANT);
    expect(r.ok && r.demande.arrivee).toEqual(texte("Joigny"));
  });

  it("bout vide ou fait d'espaces ⇒ erreur sous son champ", () => {
    expect(erreurs({ arrivee: texte("") }).arrivee).toBe(MESSAGES.arriveeVide);
    expect(erreurs({ arrivee: texte("   ") }).arrivee).toBe(MESSAGES.arriveeVide);
    expect(erreurs({ depart: texte(" ") }).depart).toBe(MESSAGES.departVide);
  });

  it("texte d'un seul caractère ⇒ erreur (minimum de /v1/lieux, spec 10)", () => {
    expect(erreurs({ arrivee: texte(" a ") }).arrivee).toBe(MESSAGES.lieuTropCourt);
    expect(erreurs({ depart: texte("a") }).depart).toBe(MESSAGES.lieuTropCourt);
    expect(erreurs({ arrivee: texte("Ay") }).arrivee).toBeUndefined();
  });

  it("texte de plus de 200 caractères ⇒ erreur", () => {
    expect(erreurs({ arrivee: texte("a".repeat(200)) }).arrivee).toBeUndefined();
    expect(erreurs({ arrivee: texte("a".repeat(201)) }).arrivee).toBe(MESSAGES.lieuTropLong);
  });

  it("Domicile → Domicile, position → position ⇒ même lieu (spec 13, critère 1)", () => {
    expect(erreurs({ depart: DOMICILE, arrivee: DOMICILE })).toEqual({ arrivee: MESSAGES.memeLieu });
    expect(erreurs({ depart: POSITION, arrivee: POSITION })).toEqual({ arrivee: MESSAGES.memeLieu });
  });

  it("accepte texte → Domicile, Domicile → texte, position → texte, texte → texte, position → Domicile", () => {
    const cas: [Bout, Bout][] = [
      [texte("Tribunal administratif Dijon"), DOMICILE],
      [DOMICILE, texte("Tribunal administratif Dijon")],
      [POSITION, texte("Joigny")],
      [texte("gare d'Auxerre"), texte("Joigny")],
      [POSITION, DOMICILE],
    ];
    for (const [depart, arrivee] of cas) {
      const r = validerFormulaire({ ...MAQUETTE, depart, arrivee }, MAINTENANT);
      expect(r).toMatchObject({ ok: true, demande: { depart, arrivee } });
      if (r.ok) expect(schemaDemande.safeParse(r.demande).success).toBe(true);
    }
  });

  it("date d'hier ⇒ erreur ; aujourd'hui ⇒ valide", () => {
    expect(erreurs({ date: "2026-11-02" }).date).toBe(MESSAGES.datePassee);
    expect(erreurs({ date: "2026-11-03", heure: "20:00" })).toEqual({});
  });

  it("date qui n'existe pas ⇒ erreur", () => {
    expect(erreurs({ date: "2026-02-30" }).date).toBe(MESSAGES.dateInvalide);
    expect(erreurs({ date: "12/11/2026" }).date).toBe(MESSAGES.dateInvalide);
  });

  it("aujourd'hui à une heure passée ⇒ erreur ; l'heure qu'il est ⇒ valide", () => {
    expect(erreurs({ date: "2026-11-03", heure: "17:59" }).heure).toBe(MESSAGES.heurePassee);
    expect(erreurs({ date: "2026-11-03", heure: "18:00" })).toEqual({});
  });

  it("heure mal formée ⇒ erreur", () => {
    expect(erreurs({ heure: "24:00" }).heure).toBe(MESSAGES.heureInvalide);
    expect(erreurs({ heure: "9:00" }).heure).toBe(MESSAGES.heureInvalide);
  });

  it("marge −1, 121, 7,5, 7.5 ou vide ⇒ erreur", () => {
    for (const marge of ["-1", "121", "7,5", "7.5", "", "  ", "dix"]) {
      expect(erreurs({ marge }).marge, `marge « ${marge} »`).toBe(MESSAGES.marge);
    }
  });

  it("marge 0 et 120 ⇒ valides", () => {
    expect(erreurs({ marge: "0" })).toEqual({});
    expect(erreurs({ marge: "120" })).toEqual({});
    expect(erreurs({ marge: " 15 " })).toEqual({});
  });

  it("« Partir à » ⇒ marge ignorée, demande à marge 0", () => {
    const r = validerFormulaire({ ...MAQUETTE, sens: "partir_a", marge: "n'importe quoi" }, MAINTENANT);
    expect(r).toEqual({ ok: true, demande: { ...validerFormulaireOk().demande, sens: "partir_a", marge: 0 } });
  });

  it("donne toutes les erreurs à la fois", () => {
    expect(Object.keys(erreurs({ arrivee: texte(""), date: "2026-11-01", marge: "" })).sort()).toEqual(["arrivee", "date", "marge"]);
  });

  it("minuit à Paris en heure d'été : le 14/07 est passé à 00:30 le 15/07", () => {
    const juillet = new Date("2026-07-14T22:30:00Z"); // 00:30 le 15/07 à Paris (UTC+2)
    expect(maintenantAParis(juillet)).toEqual({ date: "2026-07-15", heure: "00:30" });
    expect(erreurs({ date: "2026-07-14", heure: "23:00" }, juillet).date).toBe(MESSAGES.datePassee);
    expect(erreurs({ date: "2026-07-15", heure: "00:15" }, juillet).heure).toBe(MESSAGES.heurePassee);
    expect(erreurs({ date: "2026-07-15", heure: "08:00" }, juillet)).toEqual({});
  });

  it("minuit à Paris en heure d'hiver : le 14/01 est passé à 00:30 le 15/01", () => {
    const janvier = new Date("2027-01-14T23:30:00Z"); // 00:30 le 15/01 à Paris (UTC+1)
    expect(maintenantAParis(janvier)).toEqual({ date: "2027-01-15", heure: "00:30" });
    expect(erreurs({ date: "2027-01-14", heure: "23:00" }, janvier).date).toBe(MESSAGES.datePassee);
    expect(erreurs({ date: "2027-01-15", heure: "08:00" }, janvier)).toEqual({});
  });
});

function validerFormulaireOk() {
  const r = validerFormulaire(MAQUETTE, MAINTENANT);
  if (!r.ok) throw new Error("demande attendue");
  return r;
}

describe("formaterDate", () => {
  it("12/11/2026 ⇒ « jeudi 12/11/2026 »", () => {
    expect(formaterDate("2026-11-12")).toBe("jeudi 12/11/2026");
  });

  it("29/02/2028 ⇒ « mardi 29/02/2028 »", () => {
    expect(formaterDate("2028-02-29")).toBe("mardi 29/02/2028");
  });

  it("date impossible ⇒ « — »", () => {
    expect(formaterDate("2027-02-29")).toBe("—");
  });
});

describe("sélecteurs d'Android", () => {
  it("aller-retour date et heure sans perte", () => {
    const d = versDateLocale("2026-11-12", "10:00");
    expect(dateChoisie(d)).toBe("2026-11-12");
    expect(heureChoisie(d)).toBe("10:00");
  });

  it("met les zéros devant (05/03, 07:05)", () => {
    const d = new Date(2027, 2, 5, 7, 5);
    expect(dateChoisie(d)).toBe("2027-03-05");
    expect(heureChoisie(d)).toBe("07:05");
  });
});

describe("echangerBouts (⇅)", () => {
  it("échange un texte et un choix : l'aller devient le retour", () => {
    const aller = { ...MAQUETTE, arrivee: texte("Tribunal administratif Dijon") };
    expect(echangerBouts(aller)).toEqual({ ...aller, depart: texte("Tribunal administratif Dijon"), arrivee: DOMICILE });
  });

  it("échange deux choix, et deux textes", () => {
    expect(echangerBouts({ depart: POSITION, arrivee: DOMICILE })).toEqual({ depart: DOMICILE, arrivee: POSITION });
    expect(echangerBouts({ depart: texte("A1"), arrivee: texte("B2") })).toEqual({ depart: texte("B2"), arrivee: texte("A1") });
  });

  it("deux échanges rendent l'état de départ, le reste du formulaire intact", () => {
    expect(echangerBouts(echangerBouts(MAQUETTE))).toEqual(MAQUETTE);
    expect(echangerBouts(MAQUETTE).date).toBe(MAQUETTE.date);
  });
});
