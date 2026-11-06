import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import type { Contexte } from "../comprendre/comprendre.js";
import { coutEur, MODELES_CLAUDE, type ModeleClaude } from "../comprendre/cout.js";
import { appelAssistant, controlerSortie, type Reglages, type ReponseAssistant } from "./assistant.js";
import jeuJson from "./jeu-30-demandes.json" with { type: "json" };

/** Le jeu, embarqué à la compilation (le fichier suit `dist/`). */
export const JEU = jeuJson as unknown as JeuAssistant;

/**
 * Jeu de 30 demandes de l'Assistant (spec 37, PLAN phase 6 bis : 27/30 au moins). Lancé avec la clé dans
 * l'environnement : `cd serveur && npm run assistant:jeu` (lit ANTHROPIC_API_KEY et CLAUDE_MODEL ; plusieurs
 * modèles séparés par des virgules). Rien n'est écrit sur le disque.
 */
export type CasAssistant = { phrase: string; attendu: ReponseAssistant };
export type JeuAssistant = { contexte: Contexte; reglages: Reglages; demandes: CasAssistant[] };

const norme = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Lieux en texte : sans casse ni accents, l'un contenant l'autre ; tout le reste à l'identique. */
function lieuxProches(a: unknown, b: unknown): boolean {
  if (typeof a === "string" && typeof b === "string") {
    const [x, y] = [norme(a), norme(b)];
    return x.includes(y) || y.includes(x);
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return isDeepStrictEqual(ka, kb) && ka.every((k) => lieuxProches((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return isDeepStrictEqual(a, b);
}

/** La réponse contrôlée correspond-elle à l'attendu ? (lieux comparés souplement, le reste exactement) */
export function conforme(obtenu: ReponseAssistant | null, attendu: ReponseAssistant): boolean {
  return obtenu !== null && lieuxProches(obtenu, attendu);
}

async function principal(): Promise<void> {
  const cle = process.env.ANTHROPIC_API_KEY;
  const modeles = (process.env.CLAUDE_MODEL ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  if (!cle || modeles.length === 0 || modeles.some((m) => !(MODELES_CLAUDE as string[]).includes(m))) {
    console.error(`ANTHROPIC_API_KEY et CLAUDE_MODEL (parmi ${MODELES_CLAUDE.join(", ")}) sont nécessaires.`);
    process.exit(1);
  }
  const jeu = JEU;
  for (const modele of modeles as ModeleClaude[]) {
    const appel = appelAssistant(cle, modele);
    let reussies = 0;
    let cout = 0;
    for (const cas of jeu.demandes) {
      try {
        const r = await appel(cas.phrase, jeu.reglages, jeu.contexte);
        cout += coutEur(modele, r.jetons);
        const obtenu = r.refus ? null : controlerSortie(r.sortie, cas.phrase, jeu.reglages);
        if (conforme(obtenu, cas.attendu)) reussies++;
        else console.log(`✗ ${cas.phrase} — obtenu ${JSON.stringify(obtenu)} — attendu ${JSON.stringify(cas.attendu)}`);
      } catch (e) {
        console.log(`✗ ${cas.phrase} — erreur ${(e as Error).name}`);
      }
    }
    console.log(`${modele} : ${reussies}/${jeu.demandes.length} réussies, coût ${cout.toFixed(4)} € (1 $ compté pour 1 €).`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await principal();
