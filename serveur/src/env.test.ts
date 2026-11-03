import { describe, expect, it } from "vitest";
import { ErreurEnv, lireEnv } from "./env.js";

describe("lireEnv", () => {
  it("accepte une MOTIS_URL valide et met le port par défaut", () => {
    expect(lireEnv({ MOTIS_URL: "http://motis:8080" })).toEqual({
      MOTIS_URL: "http://motis:8080",
      PORT: 3000,
    });
  });

  it("refuse une MOTIS_URL absente en nommant la variable", () => {
    expect(() => lireEnv({})).toThrow(ErreurEnv);
    expect(() => lireEnv({})).toThrow(/MOTIS_URL/);
  });

  it("refuse une MOTIS_URL mal formée sans recopier sa valeur", () => {
    const valeur = "pas-une-url-canari-7f3a";
    try {
      lireEnv({ MOTIS_URL: valeur });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ErreurEnv);
      expect((e as Error).message).toContain("MOTIS_URL");
      expect((e as Error).message).not.toContain(valeur);
    }
  });

  it("refuse un protocole autre que http(s)", () => {
    expect(() => lireEnv({ MOTIS_URL: "ftp://motis:8080" })).toThrow(/MOTIS_URL/);
  });

  it("refuse un port hors limites", () => {
    expect(() => lireEnv({ MOTIS_URL: "http://motis:8080", PORT: "70000" })).toThrow(/PORT/);
  });
});
