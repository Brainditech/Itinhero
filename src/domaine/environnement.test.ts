import { describe, expect, it } from "vitest";

import { lireEnvironnement } from "./environnement";

describe("lireEnvironnement (spec 10, critère 1)", () => {
  it("accepte http://localhost:3000 (D63) et une adresse https", () => {
    expect(lireEnvironnement({ EXPO_PUBLIC_API_URL: "http://localhost:3000" })).toEqual({
      ok: true,
      env: { urlApi: "http://localhost:3000" },
    });
    expect(lireEnvironnement({ EXPO_PUBLIC_API_URL: " https://api.exemple.fr " })).toEqual({
      ok: true,
      env: { urlApi: "https://api.exemple.fr" },
    });
  });

  it.each([
    ["absente", undefined],
    ["vide", ""],
    ["blanche", "   "],
  ])("refuse une variable %s en la nommant", (_cas, valeur) => {
    const r = lireEnvironnement({ EXPO_PUBLIC_API_URL: valeur });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("EXPO_PUBLIC_API_URL");
  });

  it.each([
    ["sans protocole", "localhost:3000"],
    ["autre protocole", "ftp://serveur-secret:21"],
    ["avec un chemin", "http://serveur-secret:3000/v1"],
    ["avec un / final", "http://serveur-secret:3000/"],
    ["avec des paramètres", "http://serveur-secret:3000?x=1"],
    ["avec un identifiant", "http://moi:motdepasse@serveur-secret:3000"],
    ["illisible", "pas une adresse"],
  ])("refuse une adresse %s sans recopier sa valeur", (_cas, valeur) => {
    const r = lireEnvironnement({ EXPO_PUBLIC_API_URL: valeur });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("EXPO_PUBLIC_API_URL");
      expect(r.message).not.toContain("serveur-secret");
      expect(r.message).not.toContain("motdepasse");
    }
  });
});
