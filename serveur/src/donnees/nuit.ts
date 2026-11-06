/**
 * Ingestion nocturne (spec 44, D125, phase 8, invariant 14) : pour chaque jeu GTFS, le nouveau fichier ne remplace
 * l'ancien qu'après ses contrôles ; un jeu cassé garde l'ancien et n'empêche jamais les autres.
 *
 * `npm run donnees:nuit` prépare un **nouveau dossier** de données à côté de l'actuel (aucun fichier en service n'est
 * touché) : zip retenus, manifest.json, jeux.json, rejets.json, config.yml, horaires.json, et `nuit.json` (une ligne
 * par jeu : inchangé, remplacé, ancien gardé et pourquoi). `scripts/ingestion-nuit.sh` importe ensuite ce dossier
 * dans un MOTIS à part et ne bascule que si l'import réussit (sinon l'ancien reste en service).
 */
import { createHash } from "node:crypto";
import { copyFile, link, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lireHorairesJeu, lireHoraires } from "../itineraires/horaires-gtfs.js";
import { lireManifest, schemaManifest, type Manifest } from "../manifest.js";
import { lireTableFacultative } from "../oracle/gtfs.js";
import { configMotis } from "./config-motis.js";
import { controlerGtfs } from "./controle.js";
import { choisirRessources, schemaListeJeux, type Ressource } from "./selection.js";

/** Un jeu doit couvrir au moins jusqu'à J+30, sauf s'il ne recule pas par rapport à l'ancien. */
export const COUVERTURE_MIN_JOURS = 30;

/** Arrêts témoins (PLAN phase 8) : un jeu qui les contenait doit les contenir encore. */
export const ARRETS_TEMOINS = ["BRIENON SUR ARMANCON-MAIRIE"];

export type EtatJeu = "inchange" | "remplace" | "nouveau" | "ancien_garde" | "ecarte";
export type DecisionJeu = { etiquette: string; jeu: string; etat: EtatJeu; raison: string | null };

/** Ce que l'on sait de l'ancien fichier d'un jeu (celui en service). */
export type Ancien = { sha256: string; fin_validite: string | null; temoins: string[] };
/** Ce que l'on sait du nouveau fichier, après téléchargement et lecture. */
export type Nouveau =
  | { etat: "echec"; raison: string }
  | { etat: "lu"; sha256: string; controle: { ok: true } | { ok: false; raison: string }; fin_validite: string | null; temoins: string[] };

const plusJours = (jour: string, n: number) => {
  const [a, m, j] = jour.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10);
};

/**
 * Décision pour un jeu (pure, testée) : l'ancien est gardé à la moindre raison de douter du nouveau ; sans ancien,
 * un nouveau douteux est écarté.
 */
export function deciderJeu(ancien: Ancien | null, nouveau: Nouveau, aujourdhui: string): { etat: EtatJeu; raison: string | null } {
  const garder = (raison: string) => (ancien ? { etat: "ancien_garde" as const, raison } : { etat: "ecarte" as const, raison });
  if (nouveau.etat === "echec") return garder(nouveau.raison);
  if (ancien && nouveau.sha256 === ancien.sha256) return { etat: "inchange", raison: null };
  if (!nouveau.controle.ok) return garder(nouveau.controle.raison);
  const limite = plusJours(aujourdhui, COUVERTURE_MIN_JOURS);
  const fin = nouveau.fin_validite;
  if (fin === null || fin < aujourdhui) return garder(`horaires finis (${fin ?? "fin inconnue"})`);
  if (ancien && fin < limite && ancien.fin_validite !== null && fin < ancien.fin_validite) {
    return garder(`couverture en recul : ${fin} au lieu de ${ancien.fin_validite}`);
  }
  const perdus = ancien ? ancien.temoins.filter((t) => !nouveau.temoins.includes(t)) : [];
  if (perdus.length > 0) return garder(`arrêt témoin absent : ${perdus.join(", ")}`);
  return { etat: ancien ? "remplace" : "nouveau", raison: null };
}

class Inchange extends Error {}

/** Lien dur (même disque : ni place ni temps perdus pour l'OSM de 5 Go), sinon copie. */
async function lierOuCopier(de: string, vers: string): Promise<void> {
  await rm(vers, { force: true });
  try {
    await link(de, vers);
  } catch {
    await copyFile(de, vers);
  }
}

const sha256 = (o: Uint8Array) => createHash("sha256").update(o).digest("hex");

/** Arrêts témoins présents dans un zip (noms sans casse). */
async function temoinsDe(cheminZip: string): Promise<string[]> {
  const trouves = new Set<string>();
  await lireTableFacultative(cheminZip, "stops.txt", (l) => {
    const nom = (l.stop_name ?? "").trim().toUpperCase();
    for (const t of ARRETS_TEMOINS) if (nom === t) trouves.add(t);
    return false;
  }).catch(() => null);
  return [...trouves];
}

async function principal(): Promise<void> {
  const ici = path.dirname(fileURLToPath(import.meta.url));
  const actuel = path.resolve(process.argv[2] ?? path.join(ici, "../../../donnees"));
  const aujourdhui = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const nouveauDossier = path.resolve(process.argv[3] ?? `${actuel}-${aujourdhui}`);
  // Revue : préparer dans le dossier en service écraserait les fichiers servis avant tout contrôle (invariant 14).
  if (nouveauDossier === actuel) throw new Error("le dossier préparé doit être différent du dossier en service");
  await mkdir(path.join(nouveauDossier, "gtfs"), { recursive: true });

  const manifestActuel: Manifest = await lireManifest(path.join(actuel, "manifest.json"));
  const parEtiquette = new Map(manifestActuel.fichiers.map((f) => [f.jeu, f]));
  const horairesActuels = JSON.parse(await readFile(path.join(actuel, "horaires.json"), "utf8").catch(() => '{"jeux":{}}')) as {
    jeux: Record<string, { fin_validite: string | null }>;
  };
  const jeuxActuels = JSON.parse(await readFile(path.join(actuel, "jeux.json"), "utf8")) as Ressource[];

  const rep = await fetch("https://transport.data.gouv.fr/api/datasets", { signal: AbortSignal.timeout(600_000) });
  if (!rep.ok) throw new Error(`API transport.data.gouv.fr : HTTP ${rep.status}`);
  const ressources = choisirRessources(schemaListeJeux.parse(await rep.json()));
  const vues = new Set(ressources.map((r) => r.etiquette));
  // Un jeu absent de la liste du jour (panne de l'API, ressource renommée) garde son ancien fichier.
  const absents = jeuxActuels.filter((j) => !vues.has(j.etiquette));

  const decisions: DecisionJeu[] = [];
  const retenus: { r: Ressource; taille: number; sha256: string; date: string; source: "ancien" | "nouveau" }[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (i < ressources.length) {
        const r = ressources[i++]!;
        const ancienF = parEtiquette.get(r.etiquette);
        const cheminAncien = ancienF ? path.join(actuel, ancienF.chemin) : null;
        const cheminNouveau = path.join(nouveauDossier, "gtfs", `${r.etiquette}.zip`);
        let nouveau: Nouveau | undefined;
        try {
          const reponse = await fetch(r.url, { redirect: "follow", signal: AbortSignal.timeout(600_000), headers: { "user-agent": "itinhero-ingestion-nuit" } });
          if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
          const octets = new Uint8Array(await reponse.arrayBuffer());
          const controle = (() => {
            try {
              return controlerGtfs(octets);
            } catch (e) {
              return { ok: false as const, raison: `contrôle impossible : ${(e as Error).message}` };
            }
          })();
          const s = sha256(octets);
          if (ancienF && s === ancienF.sha256) {
            // Même fichier : ni écrit ni relu (l'ancien est lié plus bas).
            nouveau = { etat: "lu", sha256: s, controle, fin_validite: null, temoins: [] };
            throw new Inchange();
          }
          await writeFile(cheminNouveau, octets);
          nouveau = controle.ok
            ? { etat: "lu", sha256: sha256(octets), controle, fin_validite: (await lireHorairesJeu(cheminNouveau).catch(() => null))?.fin_validite ?? null, temoins: await temoinsDe(cheminNouveau) }
            : { etat: "lu", sha256: sha256(octets), controle, fin_validite: null, temoins: [] };
        } catch (e) {
          if (!(e instanceof Inchange)) nouveau = { etat: "echec", raison: `téléchargement : ${(e as Error).message}` };
        }
        // L'ancien n'est relu que s'il faut comparer (fichier changé) : sa fin vient de horaires.json.
        const ancien: Ancien | null =
          ancienF && cheminAncien
            ? {
                sha256: ancienF.sha256,
                fin_validite: horairesActuels.jeux[r.etiquette]?.fin_validite ?? null,
                temoins: nouveau!.etat === "lu" && nouveau!.sha256 !== ancienF.sha256 ? await temoinsDe(cheminAncien) : [],
              }
            : null;
        const d = deciderJeu(ancien, nouveau!, aujourdhui);
        decisions.push({ etiquette: r.etiquette, jeu: r.jeu, ...d });
        if ((d.etat === "inchange" || d.etat === "ancien_garde") && ancienF && cheminAncien) {
          await lierOuCopier(cheminAncien, cheminNouveau);
          retenus.push({ r, taille: ancienF.taille, sha256: ancienF.sha256, date: ancienF.date_telechargement, source: "ancien" });
        } else if ((d.etat === "remplace" || d.etat === "nouveau") && nouveau!.etat === "lu") {
          retenus.push({ r, taille: (await stat(cheminNouveau)).size, sha256: nouveau!.sha256, date: aujourdhui, source: "nouveau" });
        } else {
          await rm(cheminNouveau, { force: true });
        }
      }
    }),
  );
  for (const j of absents) {
    const f = parEtiquette.get(j.etiquette);
    if (!f) continue;
    await lierOuCopier(path.join(actuel, f.chemin), path.join(nouveauDossier, f.chemin));
    retenus.push({ r: j, taille: f.taille, sha256: f.sha256, date: f.date_telechargement, source: "ancien" });
    decisions.push({ etiquette: j.etiquette, jeu: j.jeu, etat: "ancien_garde", raison: "absent de la liste du jour" });
  }
  retenus.sort((a, b) => a.r.etiquette.localeCompare(b.r.etiquette));

  const osm = manifestActuel.fichiers.find((f) => f.type === "osm");
  if (!osm) throw new Error("pas d'OSM dans le manifeste actuel");
  await mkdir(path.join(nouveauDossier, "osm"), { recursive: true });
  // L'OSM n'est pas rechargé chaque nuit : le même fichier.
  await lierOuCopier(path.join(actuel, osm.chemin), path.join(nouveauDossier, osm.chemin));

  const manifest = schemaManifest.parse({
    version: 1,
    fichiers: [
      ...retenus.map(({ r, taille, sha256: s, date, source }) => ({
        jeu: r.etiquette,
        type: "gtfs",
        chemin: `gtfs/${r.etiquette}.zip`,
        url_source: r.url,
        licence: r.licence,
        date_telechargement: date,
        feed_version: null,
        date_fichiers: source === "ancien" ? (parEtiquette.get(r.etiquette)?.date_fichiers ?? r.miseAJour) : r.miseAJour,
        taille,
        sha256: s,
      })),
      osm,
    ],
  });
  await writeFile(path.join(nouveauDossier, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  await writeFile(
    path.join(nouveauDossier, "jeux.json"),
    JSON.stringify(retenus.map(({ r }) => ({ etiquette: r.etiquette, jeu: r.jeu, titre: r.titre, producteur: r.producteur, licence: r.licence, miseAJour: r.miseAJour })), null, 2) + "\n",
  );
  await writeFile(path.join(nouveauDossier, "config.yml"), configMotis(retenus.map(({ r }) => r), path.basename(osm.chemin)));
  const horaires = await lireHoraires(manifest, nouveauDossier);
  for (const { r } of retenus) {
    const h = horaires.jeux[r.etiquette];
    if (h && r.producteur) h.nom = r.producteur;
  }
  await writeFile(path.join(nouveauDossier, "horaires.json"), JSON.stringify(horaires));
  await writeFile(path.join(nouveauDossier, "nuit.json"), JSON.stringify({ date: aujourdhui, decisions }, null, 2) + "\n");
  const compte = (e: EtatJeu) => decisions.filter((d) => d.etat === e).length;
  console.log(
    `${nouveauDossier} : ${compte("inchange")} inchangés, ${compte("remplace")} remplacés, ${compte("nouveau")} nouveaux, ` +
      `${compte("ancien_garde")} anciens gardés, ${compte("ecarte")} écartés.`,
  );
  // Code 0 même avec des jeux gardés : chacun est dit dans nuit.json (alerte Sentry quand Sentry sera branché).
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  principal().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}

