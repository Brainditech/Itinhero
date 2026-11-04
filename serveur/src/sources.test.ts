import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** Garde-fou : aucun caractère de contrôle (ex. retour arrière à la place de `\b`) dans les sources. */
describe("sources", () => {
  it("aucun caractère de contrôle hors tabulation et fin de ligne", async () => {
    const racine = path.dirname(fileURLToPath(import.meta.url));
    const fichiers = (await readdir(racine, { recursive: true })).filter((f) => f.endsWith(".ts"));
    for (const f of fichiers) {
      const texte = await readFile(path.join(racine, f), "utf8");
      expect(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(texte), f).toBe(false);
    }
  });
});
