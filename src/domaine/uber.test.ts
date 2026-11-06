import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { Etape, Possibilite } from "./api";
import { BASE_UBER, lienUber } from "./uber";

const P: Possibilite = JSON.parse(readFileSync(path.join(__dirname, "__exemples__/possibilite-brienon-dijon.json"), "utf8"));
const TAXI: Etape = { ...P.etapes[1]!, mode: "taxi" };

describe("lienUber (spec 31, critère 1)", () => {
  it("prise en charge et dépose de l'étape, en Location JSON encodé, sans prix ni client_id", () => {
    const url = new URL(lienUber(TAXI)!);
    expect(`${url.origin}${url.pathname}`).toBe(BASE_UBER);
    expect(JSON.parse(url.searchParams.get("pickup")!)).toEqual({ latitude: TAXI.de.lat, longitude: TAXI.de.lon, addressLine1: TAXI.de.nom });
    expect(JSON.parse(url.searchParams.get("drop[0]")!)).toEqual({ latitude: TAXI.a.lat, longitude: TAXI.a.lon, addressLine1: TAXI.a.nom });
    expect([...url.searchParams.keys()]).toEqual(["pickup", "drop[0]"]);
  });
  it("un nom avec « & » ou des accents reste dans son paramètre", () => {
    const e = { ...TAXI, a: { ...TAXI.a, nom: "Gare & Café, Saint-Florentin" } };
    expect(JSON.parse(new URL(lienUber(e)!).searchParams.get("drop[0]")!).addressLine1).toBe("Gare & Café, Saint-Florentin");
  });
  it("pas de lien hors d'une étape en taxi", () => {
    expect(lienUber(P.etapes[1]!)).toBeNull();
  });
});
