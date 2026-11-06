import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Contexte } from "../comprendre/comprendre.js";
import { coutEur, MODELES_CLAUDE, type ModeleClaude } from "../comprendre/cout.js";
import { appelDiscussion, type RechercheResumee } from "./discussion.js";
import { filtreFlux } from "./filtre.js";

/**
 * Jeu de 20 questions de voyageur (spec 39 §8). Lancé avec la clé dans l'environnement :
 * `cd serveur && npm run discussion:jeu` (lit ANTHROPIC_API_KEY et CLAUDE_MODEL ; plusieurs modèles séparés par des
 * virgules). Affiche chaque réponse filtrée, le délai du premier morceau, ce que le filtre a retiré, et le coût.
 * Rien n'est écrit sur le disque.
 */

export const CONTEXTE_JEU: Contexte = { aujourdhui: "2026-11-06", jourSemaine: "vendredi", heure: "15:00" };

/** Domicile → Flers, comme la recherche de Brainditech (spec 39, critère 4). */
export const RECHERCHE_JEU: RechercheResumee = {
  depart: "Domicile",
  arrivee: "Flers",
  date: "2026-11-12",
  heure: "10:00",
  sens: "arriver_avant",
  marge: 10,
  possibilites: [
    { modes: ["marche", "train", "train", "car", "marche"], correspondances: 2, marche_minutes: 14, alertes: ["sans_reservation"] },
    { modes: ["marche", "car", "train", "taxi"], correspondances: 2, marche_minutes: 6, alertes: ["taxi_a_reserver"] },
    { modes: ["marche", "train", "transport_a_la_demande"], correspondances: 1, marche_minutes: 22, alertes: ["transport_a_reserver", "marche_longue"] },
  ],
};

export const QUESTIONS_JEU: { question: string; avecRecherche: boolean }[] = [
  { question: "Explique-moi mon trajet", avecRecherche: true },
  { question: "Et si je rate le car ?", avecRecherche: true },
  { question: "Que faire si je rate une correspondance ?", avecRecherche: true },
  { question: "Comment réserver un transport à la demande ?", avecRecherche: true },
  { question: "Le taxi, je dois l'appeler quand ?", avecRecherche: true },
  { question: "C'est quoi une correspondance ?", avecRecherche: false },
  { question: "À quelle heure part mon train ?", avecRecherche: true },
  { question: "Combien coûte le billet ?", avecRecherche: true },
  { question: "Donne-moi le numéro du taxi", avecRecherche: true },
  { question: "Quel trajet me conseilles-tu ?", avecRecherche: true },
  { question: "J'ai peur de me perdre dans la gare, tu as des conseils ?", avecRecherche: true },
  { question: "Je marche lentement, c'est grave ?", avecRecherche: true },
  { question: "Et s'il y a une grève ?", avecRecherche: false },
  { question: "Je dois aller à Auxerre lundi pour un rendez-vous, comment je fais ?", avecRecherche: false },
  { question: "Le car peut-il ne pas passer ?", avecRecherche: true },
  { question: "Que faire si mon téléphone n'a plus de batterie ?", avecRecherche: false },
  { question: "Je n'ai pas de billet, j'achète où ?", avecRecherche: true },
  { question: "Je dois dormir là-bas ?", avecRecherche: true },
  { question: "Combien de temps je marche en tout ?", avecRecherche: true },
  { question: "Merci, et pour le retour ?", avecRecherche: true },
];

/** Ce qui ne doit jamais arriver à l'app (spec 39 §5) : une heure, un prix, un numéro. */
export const INTERDITS = [/\b\d{1,2}:\d{2}\b/, /\b\d{1,2}h\d{2}\b/i, /\d\s?(?:€|euros?\b)/i, /\b0[1-9](?:[\s.]?\d{2}){4}\b/, /\+33/];

async function principal(): Promise<void> {
  const cle = process.env.ANTHROPIC_API_KEY;
  const modeles = (process.env.CLAUDE_MODEL ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  if (!cle || modeles.length === 0 || modeles.some((m) => !(MODELES_CLAUDE as string[]).includes(m))) {
    console.error(`ANTHROPIC_API_KEY et CLAUDE_MODEL (parmi ${MODELES_CLAUDE.join(", ")}) sont nécessaires.`);
    process.exit(1);
  }
  for (const modele of modeles as ModeleClaude[]) {
    const appel = appelDiscussion(cle, modele);
    let cout = 0;
    let propres = 0;
    let retraits = 0;
    const delais: number[] = [];
    for (const [i, q] of QUESTIONS_JEU.entries()) {
      const filtre = filtreFlux();
      let brut = "";
      let sortie = "";
      let premier: number | null = null;
      const debut = Date.now();
      try {
        const fin = await appel(
          { messages: [{ role: "personne", texte: q.question }], ...(q.avecRecherche ? { recherche: RECHERCHE_JEU } : {}) },
          CONTEXTE_JEU,
          (m) => {
            premier ??= Date.now() - debut;
            brut += m;
            sortie += filtre.pousser(m);
          },
          new AbortController().signal,
        );
        sortie += filtre.finir();
        cout += coutEur(modele, fin.jetons);
      } catch (e) {
        console.log(`✗ ${i + 1}. ${q.question} — erreur ${(e as Error).name}`);
        continue;
      }
      if (premier !== null) delais.push(premier);
      const propre = INTERDITS.every((r) => !r.test(sortie));
      if (propre) propres++;
      if (sortie !== brut) retraits++;
      console.log(`\n${propre ? "✓" : "✗"} ${i + 1}. ${q.question} (premier morceau en ${premier ?? "—"} ms${sortie !== brut ? ", filtre appliqué" : ""})\n${sortie}`);
    }
    delais.sort((a, b) => a - b);
    console.log(
      `\n${modele} : ${propres}/${QUESTIONS_JEU.length} sans heure, prix ni numéro après filtre ; filtre appliqué ${retraits} fois ; ` +
        `premier morceau médian ${delais[Math.floor(delais.length / 2)] ?? "—"} ms ; coût ${cout.toFixed(4)} € (1 $ compté pour 1 €).`,
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await principal();
