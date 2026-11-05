import { describe, expect, it } from "vitest";

import {
  dateChoisie,
  demandeRecalcul,
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
  retour: null,
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
        retour: null,
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

  it("lieux choisis des deux côtés acceptés ; à moins de 50 m ⇒ même lieu (spec 18, critère 3)", () => {
    const gare: Bout = { type: "lieu", nom: "Gare d'Auxerre", lat: 47.7929, lon: 3.5821, nature: "arret", commune: "Auxerre", code_postal: null };
    const joigny: Bout = { type: "lieu", nom: "Joigny", lat: 47.9822, lon: 3.3972, nature: "lieu", commune: "Joigny", code_postal: "89300" };
    for (const [depart, arrivee] of [
      [gare, joigny],
      [gare, DOMICILE],
      [POSITION, gare],
      [texte("Joigny"), gare],
    ] as [Bout, Bout][]) {
      const r = validerFormulaire({ ...MAQUETTE, depart, arrivee }, MAINTENANT);
      expect(r).toMatchObject({ ok: true, demande: { depart, arrivee } });
    }
    // 0,0003° de latitude ≈ 33 m ; 0,0006° ≈ 67 m.
    expect(erreurs({ depart: gare, arrivee: { ...gare, nom: "Parvis", lat: 47.7932 } })).toEqual({ arrivee: MESSAGES.memeLieu });
    expect(erreurs({ depart: gare, arrivee: { ...gare, nom: "Parvis", lat: 47.7935 } })).toEqual({});
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

describe("demandeRecalcul (« Recalculer depuis ici », PR #20)", () => {
  const demande = schemaDemande.parse({
    depart: { type: "domicile" },
    arrivee: { type: "texte", texte: "Tribunal administratif de Dijon" },
    date: "2026-11-14",
    heure: "08:14",
    sens: "partir_a",
    marge: 10,
  });
  // Samedi 14 novembre 2026, 09:05 à Paris : perdu 50 min après le départ prévu.
  const perdu = new Date("2026-11-14T08:05:00Z");
  it("en « partir à », cherche à l'heure actuelle, pas à l'heure d'origine passée", () => {
    expect(demandeRecalcul(demande, perdu)).toEqual({ ...demande, depart: POSITION, heure: "09:05" });
  });
  it("en « partir à », une heure prévue encore à venir est gardée", () => {
    expect(demandeRecalcul(demande, new Date("2026-11-14T07:00:00Z")).heure).toBe("08:14");
  });
  it("le lendemain de la date prévue, la date suit aussi", () => {
    expect(demandeRecalcul(demande, new Date("2026-11-15T00:30:00Z"))).toMatchObject({ date: "2026-11-15", heure: "01:30" });
  });
  it("en « arriver avant », le rendez-vous et la marge ne bougent pas", () => {
    const r = demandeRecalcul({ ...demande, sens: "arriver_avant", heure: "15:35" }, perdu);
    expect(r).toEqual({ ...demande, sens: "arriver_avant", heure: "15:35", depart: POSITION });
  });
});

describe("fin du rendez-vous et retour planifié (spec 19, D94)", () => {
  it("sans fin du rendez-vous ⇒ demande sans retour, requête sans fin_rdv", () => {
    const r = validerFormulaire(MAQUETTE, MAINTENANT);
    expect(r.ok && r.demande.retour).toBeNull();
  });

  it("fin 16:00 après un rendez-vous à 10:00 ⇒ gardée dans la demande", () => {
    const r = validerFormulaire({ ...MAQUETTE, retour: "16:00" }, MAINTENANT);
    expect(r.ok && r.demande.retour).toBe("16:00");
  });

  it.each(["10:00", "09:30"])("fin %s, pas après 10:00 ⇒ message sous le champ", (fin) => {
    expect(erreurs({ retour: fin })).toEqual({ retour: "La fin du rendez-vous est après 10:00." });
  });

  it("heure de fin illisible ⇒ « Choisissez une heure de fin. »", () => {
    expect(erreurs({ retour: "16h" })).toEqual({ retour: MESSAGES.retourInvalide });
  });

  describe("demandeRecalcul pendant le retour", () => {
    const allerRetour = schemaDemande.parse({
      depart: { type: "domicile" },
      arrivee: { type: "texte", texte: "Gifi Joigny" },
      date: "2026-11-12",
      heure: "10:00",
      sens: "arriver_avant",
      marge: 10,
      retour: "16:00",
    });

    it("perdu avant la fin du rendez-vous ⇒ vers le domicile, « partir à » 16:00, sans nouveau retour", () => {
      // Jeudi 12/11, 15:00 à Paris.
      expect(demandeRecalcul(allerRetour, new Date("2026-11-12T14:00:00Z"), "retour")).toEqual({
        depart: POSITION,
        arrivee: DOMICILE,
        date: "2026-11-12",
        heure: "16:00",
        sens: "partir_a",
        marge: 10,
        retour: null,
      });
    });

    it("perdu après la fin ⇒ à partir de maintenant", () => {
      // Jeudi 12/11, 17:20 à Paris.
      expect(demandeRecalcul(allerRetour, new Date("2026-11-12T16:20:00Z"), "retour")).toMatchObject({
        arrivee: DOMICILE,
        heure: "17:20",
        sens: "partir_a",
      });
    });

    it("pendant l'aller en « partir à », le retour reste s'il est encore à venir, sinon il tombe", () => {
      const partir = { ...allerRetour, sens: "partir_a" as const, heure: "08:00" };
      // 09:05 : la fin 16:00 est encore à venir.
      expect(demandeRecalcul(partir, new Date("2026-11-12T08:05:00Z")).retour).toBe("16:00");
      // 16:30 : la fin est passée, plus de retour à chercher avec cet aller.
      expect(demandeRecalcul(partir, new Date("2026-11-12T15:30:00Z")).retour).toBeNull();
    });
  });
});
