import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { schemaPossibilite, type Possibilite } from "./api";
import { alertesNouvelles, etapesSuivies, libelleEtat } from "./temps-reel";

// Brienon → Dijon : marche, bus 803 (08:25), marche, TER K7 (09:10), marche.
const P: Possibilite = schemaPossibilite.parse(
  JSON.parse(readFileSync(path.join(__dirname, "__exemples__/possibilite-brienon-dijon.json"), "utf8")),
);
const avecCourses: Possibilite = { ...P, etapes: P.etapes.map((e, i) => ({ ...e, course: i === 1 ? "BUS" : i === 3 ? "TER" : null })) };

describe("Temps réel d'un trajet enregistré (spec 42, critère 1)", () => {
  it("seules les étapes en véhicule avec une course sont suivies", () => {
    expect(etapesSuivies(avecCourses).map((s) => [s.index, s.course])).toEqual([
      [1, "BUS"],
      [3, "TER"],
    ]);
  });

  it("pastilles", () => {
    expect(libelleEtat(undefined).texte).toBe("Horaire prévu, sans suivi en direct");
    expect(libelleEtat({ course: "x", etat: "en_direct", retard_minutes: 0 })).toEqual({ texte: "En direct, à l'heure", ton: "direct" });
    expect(libelleEtat({ course: "x", etat: "en_direct", retard_minutes: 3 }).texte).toBe("En direct, 3 min de retard");
    expect(libelleEtat({ course: "x", etat: "retard", retard_minutes: 7 })).toEqual({ texte: "Retard 7 min", ton: "retard" });
    expect(libelleEtat({ course: "x", etat: "supprime" })).toEqual({ texte: "Supprimé", ton: "supprime" });
  });

  it("D21 : retard à 5 min, puis à chaque hausse de 5 min ; suppression une seule fois ; rien sinon", () => {
    const r1 = alertesNouvelles(avecCourses, [{ course: "TER", etat: "retard", retard_minutes: 7 }, { course: "BUS", etat: "prevu" }], {});
    expect(r1.alertes.map((a) => a.titre)).toEqual(["Retard de 7 min : TER K7 de 09:10"]);
    const r2 = alertesNouvelles(avecCourses, [{ course: "TER", etat: "retard", retard_minutes: 10 }], r1.dejaDit);
    expect(r2.alertes).toEqual([]);
    const r3 = alertesNouvelles(avecCourses, [{ course: "TER", etat: "retard", retard_minutes: 12 }], r2.dejaDit);
    expect(r3.alertes.map((a) => a.titre)).toEqual(["Retard de 12 min : TER K7 de 09:10"]);
    const r4 = alertesNouvelles(avecCourses, [{ course: "TER", etat: "supprime" }], r3.dejaDit);
    expect(r4.alertes).toMatchObject([{ titre: "Supprimé : TER K7 de 09:10", supprime: true }]);
    expect(alertesNouvelles(avecCourses, [{ course: "TER", etat: "supprime" }, { course: "TER", etat: "retard", retard_minutes: 30 }], r4.dejaDit).alertes).toEqual([]);
    expect(alertesNouvelles(avecCourses, [{ course: "BUS", etat: "en_direct", retard_minutes: 4 }], {}).alertes).toEqual([]);
  });
});
