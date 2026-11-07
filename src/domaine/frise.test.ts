import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { schemaPossibilite, type Possibilite } from "./api";
import { lignesFrise, type LigneFrise } from "./frise";
import { decouperGlossaire, GLOSSAIRE } from "./glossaire";

// Brienon → Dijon : marche, bus 803 sur appel (08:25), marche, TER K7 (09:10), marche.
const P: Possibilite = schemaPossibilite.parse(
  JSON.parse(readFileSync(path.join(__dirname, "__exemples__/possibilite-brienon-dijon.json"), "utf8")),
);
const AVEC_COURSES: Possibilite = { ...P, etapes: P.etapes.map((e, i) => ({ ...e, course: i === 1 ? "BUS" : i === 3 ? "TER" : null })) };

const etapes = (l: LigneFrise[]) => l.filter((x): x is Extract<LigneFrise, { type: "etape" }> => x.type === "etape");

describe("Frise verticale (spec 51, critère 1)", () => {
  it("ordre des lignes : étapes, attentes entre elles, arrivée à la fin", () => {
    expect(lignesFrise(P).map((l) => l.type)).toEqual(["etape", "attente", "etape", "etape", "attente", "etape", "etape", "arrivee"]);
  });

  it("heures reprises du serveur, titres et phrases", () => {
    const l = lignesFrise(P);
    expect(etapes(l).map((e) => [e.heure, e.titre])).toEqual([
      ["08:14", "Marche"],
      ["08:25", "Bus 803"],
      ["08:50", "Marche"],
      ["09:10", "TER K7"],
      ["10:24", "Marche"],
    ]);
    expect(l.at(-1)).toEqual({ type: "arrivee", heure: "10:44" });
    expect(etapes(l)[0].phrase).toMatch(/^1 min .*arrivée 08:15$/);
    expect(etapes(l)[1].phrase).toMatch(/arrivée 08:50 \(25 min\)$/);
    expect(etapes(l)[3].exploitant).toBe("SNCF VOYAGEURS");
  });

  it("la ligne avant la première montée dit le passage du véhicule, puis « Attente »", () => {
    const attentes = lignesFrise(P).filter((x) => x.type === "attente");
    expect(attentes[0].texte).toMatch(/08:25/);
    expect(attentes[1]).toEqual({ type: "attente", texte: "Attente 6 min" });
  });

  it("réservation du bus sur appel, rien pour la marche", () => {
    const l = etapes(lignesFrise(P));
    expect(l[1].reservation).toMatch(/réserv/i);
    expect(l[0].reservation).toBeNull();
    expect(l[3].reservation).toBeNull();
  });

  it("horaire : « prévu » sans état, aucun pour la marche", () => {
    const l = etapes(lignesFrise(AVEC_COURSES));
    expect(l[1].horaire).toEqual({ texte: "Horaire prévu, sans suivi en direct", ton: "prevu" });
    expect(l[3].horaire?.ton).toBe("prevu");
    expect(l[0].horaire).toBeNull();
    expect(l[2].horaire).toBeNull();
  });

  it("horaire avec états reçus : « Retard 7 min », « Supprimé »", () => {
    const l = etapes(
      lignesFrise(AVEC_COURSES, [
        { course: "BUS", etat: "retard", retard_minutes: 7 },
        { course: "TER", etat: "supprime" },
      ]),
    );
    expect(l[1].horaire).toEqual({ texte: "Retard 7 min", ton: "retard" });
    expect(l[3].horaire).toEqual({ texte: "Supprimé", ton: "supprime" });
  });

  it("taxi : pas d'horaire suivi", () => {
    const taxi: Possibilite = { ...P, etapes: [{ ...P.etapes[1], mode: "taxi", course: "X" }] };
    expect(etapes(lignesFrise(taxi))[0].horaire).toBeNull();
  });

  it("glossaire : « TER » marqué sur l'étape du TER", () => {
    expect(etapes(lignesFrise(P))[3].glossaire).toEqual([{ texte: "TER", terme: "TER" }, { texte: " K7" }]);
  });
});

describe("Glossaire à la première occurrence (spec 51, critère 2)", () => {
  it("un mot n'est marqué qu'à sa première occurrence", () => {
    expect(decouperGlossaire(["TER K7", "Marche", "TER 2"])).toEqual([
      [{ texte: "TER", terme: "TER" }, { texte: " K7" }],
      [{ texte: "Marche" }],
      [{ texte: "TER 2" }],
    ]);
  });

  it("mot entier, majuscules respectées : « Carte » et « car » non marqués", () => {
    expect(decouperGlossaire(["Carte", "car 803", "Car K941"])).toEqual([
      [{ texte: "Carte" }],
      [{ texte: "car 803" }],
      [{ texte: "Car", terme: "Car" }, { texte: " K941" }],
    ]);
  });

  it("deux mots différents : chacun marqué une fois", () => {
    expect(decouperGlossaire(["Car K941", "RER B", "Car 803", "RER D"])).toEqual([
      [{ texte: "Car", terme: "Car" }, { texte: " K941" }],
      [{ texte: "RER", terme: "RER" }, { texte: " B" }],
      [{ texte: "Car 803" }],
      [{ texte: "RER D" }],
    ]);
  });

  it("expression de plusieurs mots, et titre sans mot inchangé", () => {
    expect(decouperGlossaire(["Transport à la demande", "Métro 14"])).toEqual([
      [{ texte: "Transport à la demande", terme: "Transport à la demande" }],
      [{ texte: "Métro 14" }],
    ]);
  });

  it("chaque mot a son explication", () => {
    for (const texte of Object.values(GLOSSAIRE)) expect(texte.length).toBeGreaterThan(20);
  });
});
