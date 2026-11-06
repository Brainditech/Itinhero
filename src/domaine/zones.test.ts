import { describe, expect, it } from "vitest";

import type { Candidat } from "./api";
import { departementDuCodePostal, departementsDeZone, filtrerParZone } from "./zones";

const lieu = (nom: string, code_postal: string | null): Candidat => ({ nom, lat: 48.7, lon: -0.57, type: "lieu", commune: null, code_postal });

describe("zones (spec 35, D113, critère 3)", () => {
  it.each([
    ["Basse-Normandie", ["14", "50", "61"]],
    ["basse normandie", ["14", "50", "61"]],
    ["en Basse-Normandie", ["14", "50", "61"]],
    ["Normandie", ["14", "27", "50", "61", "76"]],
    ["Orne", ["61"]],
    ["l'Orne", ["61"]],
    ["61", ["61"]],
    ["Yonne", ["89"]],
    ["89", ["89"]],
    ["Bourgogne", ["21", "58", "71", "89"]],
    ["Corse", ["2A", "2B"]],
    ["Île-de-France", ["75", "77", "78", "91", "92", "93", "94", "95"]],
    ["IDF", ["75", "77", "78", "91", "92", "93", "94", "95"]],
    ["Côte-d'Or", ["21"]],
    ["Haute-Savoie", ["74"]],
    ["Guadeloupe", ["971"]],
    ["Nord", ["59"]],
  ])("« %s »", (zone, attendus) => {
    expect(departementsDeZone(zone)?.slice().sort()).toEqual(attendus.slice().sort());
  });

  it.each(["Mars", "Espagne", "", "999"])("zone inconnue « %s » ⇒ null", (zone) => {
    expect(departementsDeZone(zone)).toBeNull();
  });

  it("département d'un code postal, Corse et outre-mer compris", () => {
    expect(departementDuCodePostal("61100")).toBe("61");
    expect(departementDuCodePostal("89300")).toBe("89");
    expect(departementDuCodePostal("20000")).toBe("2A");
    expect(departementDuCodePostal("20200")).toBe("2B");
    expect(departementDuCodePostal("97110")).toBe("971");
    expect(departementDuCodePostal(null)).toBeNull();
  });

  it("filtrer : Flers 61100 gardé, Flers 80360 et sans code postal retirés ; zone qui retire tout ⇒ liste entière", () => {
    const candidats = [lieu("Flers", "61100"), lieu("Flers", "80360"), lieu("Flers Bourg", null), lieu("St Michel FLERS", "61100")];
    expect(filtrerParZone(candidats, "basse normandie").map((c) => c.code_postal)).toEqual(["61100", "61100"]);
    expect(filtrerParZone(candidats, "Bretagne")).toEqual(candidats);
    expect(filtrerParZone(candidats, "Mars")).toEqual(candidats);
    expect(filtrerParZone(candidats, null)).toEqual(candidats);
  });
});
