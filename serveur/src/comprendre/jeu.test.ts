import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ecarts, type Cas } from "./jeu.js";

const ICI = path.dirname(fileURLToPath(import.meta.url));

describe("jeu de 30 phrases (spec 28, critère 11)", () => {
  it("30 phrases, chaque attendu conforme au schéma", async () => {
    const jeu = JSON.parse(await readFile(path.join(ICI, "jeu-30-phrases.json"), "utf8")) as { phrases: Cas[] };
    expect(jeu.phrases).toHaveLength(30);
    const plein = (a: Cas["attendu"]) => ({ lieu_texte: null, depart_texte: null, date: null, heure: null, sens: null, marge: null, fin_rdv: null, ...a });
    for (const c of jeu.phrases) expect(ecarts(plein(c.attendu), c.attendu), c.phrase).toEqual([]);
  });
  it("notation : lieu sans casse ni accents ; autres champs exacts ; hors schéma ⇒ échec", () => {
    const vide = { lieu_texte: null, depart_texte: null, date: null, heure: null, sens: null, marge: null, fin_rdv: null };
    expect(ecarts({ ...vide, lieu_texte: "france travail JOIGNY" }, { lieu_texte: "France Travail Joigny" })).toEqual([]);
    expect(ecarts({ ...vide, lieu_texte: "hopital" }, { lieu_texte: "hôpital d'Auxerre" })).toEqual([]);
    expect(ecarts({ ...vide, lieu_texte: "Sens", heure: "10:00" }, { lieu_texte: "Sens" })).toEqual(["heure"]);
    expect(ecarts({ ...vide, heure: "1000" }, {})).toEqual(["(hors schéma)"]);
  });
});
