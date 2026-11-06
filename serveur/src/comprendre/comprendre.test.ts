import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { phraseDitUnJour } from "./comprendre.js";

const ici = path.dirname(fileURLToPath(import.meta.url));
const jeu = JSON.parse(readFileSync(path.join(ici, "jeu-30-phrases.json"), "utf8")) as {
  phrases: { phrase: string; attendu: { date?: string } }[];
};

describe("phraseDitUnJour (spec 35, D113, critère 1)", () => {
  it.each(jeu.phrases.filter((p) => p.attendu.date).map((p) => p.phrase))("datée : « %s »", (phrase) => {
    expect(phraseDitUnJour(phrase)).toBe(true);
  });

  it.each(jeu.phrases.filter((p) => !p.attendu.date).map((p) => p.phrase))("sans jour, jeu : « %s »", (phrase) => {
    expect(phraseDitUnJour(phrase)).toBe(false);
  });

  it.each([
    "je veux partir à flers",
    "je veux partir à flers basse normandie",
    "RDV à 10h à Joigny",
    "aller au 12 rue de la gare à Sens",
    "Saint-Denis 93",
  ])("sans jour : « %s »", (phrase) => {
    expect(phraseDitUnJour(phrase)).toBe(false);
  });

  it.each(["le 3 à 9h Auxerre", "rdv le 1er décembre", "Sens 28/12 à 10h", "dans la semaine", "ce soir à Dijon", "Lundi Joigny"])(
    "datée : « %s »",
    (phrase) => {
      expect(phraseDitUnJour(phrase)).toBe(true);
    },
  );
});
