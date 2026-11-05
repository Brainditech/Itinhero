import { describe, expect, it } from "vitest";

import type { Consigne } from "./api";
import { designationRue, distanceConsigne, libelleVoirChemin, phraseConsigne } from "./consignes";

const c = (x: Partial<Consigne> & Pick<Consigne, "manoeuvre">): Consigne => ({ rue: null, distance_metres: 0, lat: 47, lon: 5, ...x });

describe("phrases des consignes (spec 11, §4.2)", () => {
  it("virages avec et sans nom de rue", () => {
    expect(phraseConsigne(c({ manoeuvre: "droite", rue: "Rue Guillaume Tell" }), "x")).toBe("Tournez à droite rue Guillaume Tell");
    expect(phraseConsigne(c({ manoeuvre: "gauche", rue: "Avenue Maréchal Foch" }), "x")).toBe("Tournez à gauche avenue Maréchal Foch");
    expect(phraseConsigne(c({ manoeuvre: "legerement_gauche", rue: "N 77" }), "x")).toBe("Prenez légèrement à gauche sur la N 77");
    expect(phraseConsigne(c({ manoeuvre: "gauche" }), "x")).toBe("Tournez à gauche sur le chemin");
  });
  it("continuer, départ, demi-tour, escalier", () => {
    expect(phraseConsigne(c({ manoeuvre: "tout_droit", rue: "Place Darcy" }), "x")).toBe("Continuez place Darcy");
    expect(phraseConsigne(c({ manoeuvre: "tout_droit", rue: "D 43" }), "x")).toBe("Continuez sur la D 43");
    expect(phraseConsigne(c({ manoeuvre: "depart", rue: "Cour de la Gare Pierre Semard", cap: "est" }), "x")).toBe(
      "Partez vers l'est cour de la Gare Pierre Semard",
    );
    expect(phraseConsigne(c({ manoeuvre: "depart", cap: "nord-est" }), "x")).toBe("Partez vers le nord-est");
    expect(phraseConsigne(c({ manoeuvre: "demi_tour" }), "x")).toBe("Faites demi-tour");
    expect(phraseConsigne(c({ manoeuvre: "escalier", niveau: "monter" }), "x")).toBe("Prenez l'escalier pour monter");
  });
  it("arrivée : côté du lieu", () => {
    expect(phraseConsigne(c({ manoeuvre: "arrivee", cote_arrivee: "gauche" }), "tribunal administratif")).toBe(
      "Tribunal administratif est sur votre gauche",
    );
    expect(phraseConsigne(c({ manoeuvre: "arrivee", cote_arrivee: "devant" }), "arrêt Mairie")).toBe("Arrêt Mairie est devant vous");
  });
  it("désignations et libellés", () => {
    expect(designationRue("Rue de l'Est")).toBe("rue de l'Est");
    expect(designationRue("Grande Rue")).toBe("Grande Rue");
    expect(designationRue("Courtépée")).toBe("Courtépée");
    expect(designationRue("RN 6")).toBe("la RN 6");
    expect(distanceConsigne(c({ manoeuvre: "droite", distance_metres: 123 }))).toBe("120 m");
    expect(distanceConsigne(c({ manoeuvre: "arrivee" }))).toBeNull();
    expect(libelleVoirChemin(1)).toBe("Voir le chemin (1 consigne)");
    expect(libelleVoirChemin(8)).toBe("Voir le chemin (8 consignes)");
  });
  it("issue 0014 : numéro et nom d'une même route", () => {
    expect(designationRue("N 77 (Avenue du 19 Mars 1962)")).toBe("la N 77 (avenue du 19 Mars 1962)");
    expect(phraseConsigne(c({ manoeuvre: "legerement_gauche", rue: "N 77 (Avenue du 19 Mars 1962)" }), "x")).toBe(
      "Prenez légèrement à gauche sur la N 77 (avenue du 19 Mars 1962)",
    );
    expect(phraseConsigne(c({ manoeuvre: "tout_droit", rue: "D 43 (Route de la Gare)" }), "x")).toBe("Continuez sur la D 43 (route de la Gare)");
  });
});
