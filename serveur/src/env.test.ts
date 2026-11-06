import { describe, expect, it } from "vitest";
import { ErreurEnv, lireEnv } from "./env.js";

const E1 = "a".repeat(64);
const E2 = "b".repeat(64);
const BASE = { MOTIS_URL: "http://motis:8080", CLES_APPAREILS: E1, LIMITE_REQ_MINUTE: "30", LIMITE_REQ_JOUR: "500" };

/** Vérifie le refus, la variable nommée, et la valeur jamais recopiée. */
function refuse(source: Record<string, string | undefined>, variable: string, valeur?: string): void {
  try {
    lireEnv(source);
    expect.unreachable();
  } catch (e) {
    expect(e).toBeInstanceOf(ErreurEnv);
    expect((e as Error).message).toContain(variable);
    if (valeur) expect((e as Error).message).not.toContain(valeur);
  }
}

describe("lireEnv", () => {
  it("accepte un environnement complet et met le port par défaut", () => {
    expect(lireEnv({ ...BASE, CLES_APPAREILS: ` ${E1}, ${E2} ` })).toEqual({
      MOTIS_URL: "http://motis:8080",
      PORT: 3000,
      CLES_APPAREILS: [E1, E2],
      LIMITE_REQ_MINUTE: 30,
      LIMITE_REQ_JOUR: 500,
    });
  });

  it("refuse une MOTIS_URL absente en nommant la variable", () => {
    expect(() => lireEnv({ ...BASE, MOTIS_URL: undefined })).toThrow(ErreurEnv);
    refuse({ ...BASE, MOTIS_URL: undefined }, "MOTIS_URL");
  });

  it("refuse une MOTIS_URL mal formée sans recopier sa valeur", () => {
    refuse({ ...BASE, MOTIS_URL: "pas-une-url-canari-7f3a" }, "MOTIS_URL", "canari-7f3a");
  });

  it("refuse un protocole autre que http(s)", () => {
    refuse({ ...BASE, MOTIS_URL: "ftp://motis:8080" }, "MOTIS_URL");
  });

  it("refuse un port hors limites", () => {
    refuse({ ...BASE, PORT: "70000" }, "PORT");
  });

  it("CLES_APPAREILS : absente, vide, 63 caractères, majuscules ou doublon ⇒ refus sans recopier", () => {
    refuse({ ...BASE, CLES_APPAREILS: undefined }, "CLES_APPAREILS");
    refuse({ ...BASE, CLES_APPAREILS: "" }, "CLES_APPAREILS");
    refuse({ ...BASE, CLES_APPAREILS: "c".repeat(63) }, "CLES_APPAREILS", "c".repeat(63));
    refuse({ ...BASE, CLES_APPAREILS: "C".repeat(64) }, "CLES_APPAREILS", "C".repeat(64));
    refuse({ ...BASE, CLES_APPAREILS: `${E1},${E1}` }, "CLES_APPAREILS", E1);
  });

  it("limites : absentes, nulles, ou jour < minute ⇒ refus", () => {
    refuse({ ...BASE, LIMITE_REQ_MINUTE: undefined }, "LIMITE_REQ_MINUTE");
    refuse({ ...BASE, LIMITE_REQ_MINUTE: "0" }, "LIMITE_REQ_MINUTE");
    refuse({ ...BASE, LIMITE_REQ_JOUR: "abc" }, "LIMITE_REQ_JOUR");
    refuse({ ...BASE, LIMITE_REQ_JOUR: "10" }, "LIMITE_REQ_JOUR");
  });
});

describe("lireEnv, Claude (spec 28, D106)", () => {
  const CLE = "sk-ant-api03-" + "x".repeat(40);
  const CLAUDE = { ANTHROPIC_API_KEY: CLE, CLAUDE_MODEL: "claude-haiku-5-5", CLAUDE_PLAFOND_MENSUEL_EUR: "5" };
  it("les trois variables ⇒ lues ; aucune ⇒ Claude absent", () => {
    expect(lireEnv({ ...BASE, ...CLAUDE })).toMatchObject({ CLAUDE_MODEL: "claude-haiku-5-5", CLAUDE_PLAFOND_MENSUEL_EUR: 5 });
    expect(lireEnv(BASE).ANTHROPIC_API_KEY).toBeUndefined();
    // Le compose passe `${X:-}` : vides, elles valent absentes.
    expect(lireEnv({ ...BASE, ANTHROPIC_API_KEY: "", CLAUDE_MODEL: "", CLAUDE_PLAFOND_MENSUEL_EUR: "" }).CLAUDE_MODEL).toBeUndefined();
  });
  it("une ou deux seulement ⇒ refus qui nomme celles qui manquent", () => {
    refuse({ ...BASE, ANTHROPIC_API_KEY: CLE }, "CLAUDE_MODEL", CLE);
    refuse({ ...BASE, ANTHROPIC_API_KEY: CLE, CLAUDE_MODEL: "claude-haiku-5-5" }, "CLAUDE_PLAFOND_MENSUEL_EUR", CLE);
  });
  it("clé mal formée, modèle sans prix connu, plafond nul ⇒ refus sans recopier la valeur", () => {
    refuse({ ...BASE, ...CLAUDE, ANTHROPIC_API_KEY: "cle-canari-1234567890" }, "ANTHROPIC_API_KEY", "canari");
    refuse({ ...BASE, ...CLAUDE, CLAUDE_MODEL: "modele-canari" }, "CLAUDE_MODEL", "canari");
    refuse({ ...BASE, ...CLAUDE, CLAUDE_PLAFOND_MENSUEL_EUR: "0" }, "CLAUDE_PLAFOND_MENSUEL_EUR");
  });
});
