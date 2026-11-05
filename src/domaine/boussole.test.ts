import { describe, expect, it } from "vitest";

import { capBoussole, directionCardinale, FENETRE_MEDIANE, FILTRE_VIDE, filtrerCap, medianeCirculaire, rotationSuivante, capFusionne, declinaison } from "./boussole";

const ecart = (a: number, b: number) => ((((a - b + 180) % 360) + 360) % 360) - 180;
const jouer = (caps: number[]) => caps.reduce(filtrerCap, FILTRE_VIDE).lisse!;

describe("capBoussole", () => {
  it("prend le nord vrai quand il existe", () => {
    expect(capBoussole({ trueHeading: 92.5, magHeading: 90 })).toBe(92.5);
  });
  it("prend le nord magnétique quand le nord vrai vaut -1", () => {
    expect(capBoussole({ trueHeading: -1, magHeading: 90 })).toBe(90);
  });
  it("ramène 360 à 0", () => {
    expect(capBoussole({ trueHeading: 360, magHeading: 0 })).toBe(0);
  });
  it("rend null sans valeur utilisable", () => {
    expect(capBoussole({ trueHeading: -1, magHeading: -1 })).toBeNull();
    expect(capBoussole({ trueHeading: Number.NaN, magHeading: Number.NaN })).toBeNull();
  });
});

describe("directionCardinale", () => {
  it("nomme les huit directions", () => {
    expect([0, 45, 90, 135, 180, 225, 270, 315].map(directionCardinale)).toEqual([
      "nord",
      "nord-est",
      "est",
      "sud-est",
      "sud",
      "sud-ouest",
      "ouest",
      "nord-ouest",
    ]);
  });
  it("coupe à mi-chemin entre deux directions", () => {
    expect(directionCardinale(22)).toBe("nord");
    expect(directionCardinale(23)).toBe("nord-est");
    expect(directionCardinale(350)).toBe("nord");
    expect(directionCardinale(-10)).toBe("nord");
  });
});

describe("rotationSuivante", () => {
  it("tourne la rose à l'inverse du cap", () => {
    expect(rotationSuivante(0, 90)).toBe(-90);
  });
  it("passe par le nord de 350° à 10°, sans tour complet", () => {
    const a = rotationSuivante(0, 350); // -350 ≡ +10
    expect(a).toBe(10);
    const b = rotationSuivante(a, 10); // cible -10 : 20° dans l'autre sens
    expect(b).toBe(-10);
  });
  it("reste continu sur plusieurs tours", () => {
    let r = 0;
    for (const cap of [90, 180, 270, 0, 90]) r = rotationSuivante(r, cap);
    expect(r).toBe(-450);
  });
});

describe("medianeCirculaire", () => {
  it("écarte une valeur isolée", () => {
    expect(medianeCirculaire([44, 46, 45, 123, 47])).toBe(46);
  });
  it("ne saute pas à 0/360", () => {
    expect(medianeCirculaire([358, 2, 0, 180, 1])).toBe(1);
  });
});

describe("filtrerCap", () => {
  it("prend le premier relevé tel quel", () => {
    expect(filtrerCap(FILTRE_VIDE, 45).lisse).toBe(45);
  });
  it("ignore les pointes isolées du magnétomètre (série enregistrée le 2026-11-05, téléphone immobile)", () => {
    // Extrait réel : autour de 45°, des pointes à 25-27° et une rafale de trois relevés à 99, 123 et 76°.
    const serie = [46, 47, 49, 50, 50, 62, 42, 42, 46, 49, 44, 44, 27, 40, 48, 51, 49, 46, 23, 45, 44, 50, 99, 123, 76, 47, 49, 45];
    let etat = FILTRE_VIDE;
    for (const [i, c] of serie.entries()) {
      etat = filtrerCap(etat, c);
      if (i >= FENETRE_MEDIANE) expect(Math.abs(ecart(etat.lisse!, 46))).toBeLessThan(6);
    }
  });
  it("suit un vrai quart de tour en moins de 2 s (10 relevés à 5 par seconde)", () => {
    const apres = jouer([...Array(10).fill(45), ...Array(10).fill(135)]);
    expect(Math.abs(ecart(apres, 135))).toBeLessThanOrEqual(5);
  });
  it("traverse le nord sans faire le tour", () => {
    const apres = jouer([...Array(10).fill(350), ...Array(12).fill(10)]);
    expect(Math.abs(ecart(apres, 10))).toBeLessThanOrEqual(2);
  });
});

describe("capFusionne", () => {
  it("convertit alpha (opposé de l'azimut, en radians) en cap en degrés", () => {
    expect(capFusionne(0)).toBe(0);
    expect(capFusionne(-Math.PI / 2)).toBeCloseTo(90);
    expect(capFusionne(Math.PI / 2)).toBeCloseTo(270);
  });
  it("ajoute la déclinaison pour le nord vrai", () => {
    expect(capFusionne(-Math.PI / 2, 2.6)).toBeCloseTo(92.6);
    expect(capFusionne(0, -1)).toBeCloseTo(359);
  });
  it("rend null sans valeur", () => {
    expect(capFusionne(Number.NaN)).toBeNull();
  });
});

describe("declinaison", () => {
  it("rend nord vrai − nord magnétique, même autour de 0/360", () => {
    expect(declinaison({ trueHeading: 32, magHeading: 29.4 })).toBeCloseTo(2.6);
    expect(declinaison({ trueHeading: 1, magHeading: 358.4 })).toBeCloseTo(2.6);
  });
  it("rend 0 sans nord vrai", () => {
    expect(declinaison({ trueHeading: -1, magHeading: 90 })).toBe(0);
  });
});
