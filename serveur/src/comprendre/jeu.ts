import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appelClaude, schemaComprehension, type Comprehension, type Contexte } from "./comprendre.js";
import { coutEur, MODELES_CLAUDE, type ModeleClaude } from "./cout.js";

/**
 * Jeu de 30 phrases (spec 28, PLAN phase 1 : 27/30 au moins, A16). Lancé par Brainditech, clé dans son
 * environnement : `cd serveur && npm run comprendre:jeu` (lit ANTHROPIC_API_KEY et CLAUDE_MODEL ;
 * plusieurs modèles : CLAUDE_MODEL=claude-haiku-5-5,claude-sonnet-5-5). Rien n'est écrit sur le disque.
 */
export type Cas = { phrase: string; attendu: Partial<Comprehension> };

const CHAMPS = ["lieu_texte", "depart_texte", "date", "heure", "sens", "marge", "fin_rdv"] as const;

const norme = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Champs faux (vide ⇒ phrase réussie). Lieux : sans casse ni accents, l'un contenant l'autre. */
export function ecarts(sortie: unknown, attendu: Partial<Comprehension>): string[] {
  const lu = schemaComprehension.safeParse(sortie);
  if (!lu.success) return ["(hors schéma)"];
  return CHAMPS.filter((champ) => {
    const a = attendu[champ] ?? null;
    const o = lu.data[champ];
    if ((champ === "lieu_texte" || champ === "depart_texte") && typeof a === "string" && typeof o === "string") {
      const [x, y] = [norme(a), norme(o)];
      return !(x.includes(y) || y.includes(x));
    }
    return a !== o;
  });
}

async function principal(): Promise<void> {
  const cle = process.env.ANTHROPIC_API_KEY;
  const modeles = (process.env.CLAUDE_MODEL ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  if (!cle || modeles.length === 0 || modeles.some((m) => !(MODELES_CLAUDE as string[]).includes(m))) {
    console.error(`ANTHROPIC_API_KEY et CLAUDE_MODEL (parmi ${MODELES_CLAUDE.join(", ")}) sont nécessaires.`);
    process.exit(1);
  }
  const ici = path.dirname(fileURLToPath(import.meta.url));
  const jeu = JSON.parse(await readFile(path.join(ici, "../../src/comprendre/jeu-30-phrases.json"), "utf8")) as {
    contexte: Contexte;
    phrases: Cas[];
  };
  for (const modele of modeles as ModeleClaude[]) {
    const appel = appelClaude(cle, modele);
    let reussies = 0;
    let cout = 0;
    for (const cas of jeu.phrases) {
      try {
        const r = await appel(cas.phrase, jeu.contexte);
        cout += coutEur(modele, r.jetons);
        const faux = r.refus ? ["(refus)"] : ecarts(r.sortie, cas.attendu);
        if (faux.length === 0) reussies++;
        else console.log(`✗ ${cas.phrase} — ${faux.join(", ")} — ${JSON.stringify(r.sortie)}`);
      } catch (e) {
        console.log(`✗ ${cas.phrase} — erreur ${(e as Error).name}`);
      }
    }
    console.log(`${modele} : ${reussies}/${jeu.phrases.length} réussies, coût ${cout.toFixed(4)} € (1 $ compté pour 1 €).`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await principal();
