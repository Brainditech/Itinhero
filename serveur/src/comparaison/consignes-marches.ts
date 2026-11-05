import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { calculerConsignes, type Consigne, type Morceau } from "../itineraires/consignes.js";
import type { PossibiliteAffichee } from "../itineraires/normaliser.js";
import { appNationale, MOTIS_URL } from "../national/app-nationale.js";

/**
 * Consignes de marche de la boucle de comparaison (spec 11, critère 4 ; issue 0014), sur le MOTIS national du PC.
 * Pour chaque scénario : première possibilité (dernière pour « arriver »), chaque marche d'au moins 3 min ;
 * on montre les consignes de l'itinéraire, puis on redemande la marche seule à MOTIS (`directModes=WALK`)
 * et on garde ses morceaux bruts, pour écrire un test de régression.
 * Usage : npm run build && node dist/comparaison/consignes-marches.js <scenarios.json> <dossier-sortie> [id…]
 */
const schemaScenario = z.object({
  id: z.string(),
  de: z.unknown(),
  a: z.unknown(),
  date: z.string(),
  heure: z.string(),
  sens: z.enum(["partir", "arriver"]),
  marge: z.number().optional(),
});

const { app, entete } = await appNationale();

type Lieu = { texte: string; proche?: { lat: number; lon: number }; choix?: number } | { lat: number; lon: number; nom: string };
async function resoudre(l: Lieu): Promise<{ lat: number; lon: number }> {
  if ("lat" in l) return l;
  const qs = new URLSearchParams({ q: l.texte });
  if (l.proche) qs.set("proche", `${l.proche.lat},${l.proche.lon}`);
  const r = await app.inject({ method: "GET", url: `/v1/lieux?${qs}`, headers: entete });
  const c = r.json().candidats?.[l.choix ?? 0];
  if (!c) throw new Error(`aucun candidat pour « ${l.texte} »`);
  return c;
}

const ligne = (c: Consigne) =>
  `${c.manoeuvre}${c.rue ? ` « ${c.rue} »` : ""}${c.cap ? ` ${c.cap}` : ""}${c.cote_arrivee ? ` (${c.cote_arrivee})` : ""}${c.distance_metres ? ` — ${c.distance_metres} m` : ""}`;

async function marcheSeule(de: { lat: number; lon: number }, a: { lat: number; lon: number }): Promise<Morceau[]> {
  const url = new URL("/api/v6/plan", MOTIS_URL);
  url.searchParams.set("fromPlace", `${de.lat},${de.lon}`);
  url.searchParams.set("toPlace", `${a.lat},${a.lon}`);
  url.searchParams.set("directModes", "WALK");
  url.searchParams.set("transitModes", "");
  url.searchParams.set("detailedLegs", "true");
  const r = await fetch(url);
  const j = (await r.json()) as { direct?: { legs: { steps?: Morceau[] }[] }[] };
  return j.direct?.[0]?.legs.flatMap((l) => l.steps ?? []) ?? [];
}

const [fichier, sortie, ...ids] = process.argv.slice(2);
await mkdir(sortie!, { recursive: true });
const scenarios = z.array(schemaScenario).parse(JSON.parse(await readFile(fichier!, "utf8")));
for (const s of scenarios.filter((x) => ids.length === 0 || ids.includes(x.id))) {
  try {
    const de = await resoudre(s.de as Lieu);
    const a = await resoudre(s.a as Lieu);
    const r = await app.inject({
      method: "POST",
      url: "/v1/itineraires",
      headers: entete,
      payload: { depart: { lat: de.lat, lon: de.lon }, arrivee: { lat: a.lat, lon: a.lon }, date: s.date, heure: s.heure, sens: s.sens, marge: s.marge },
    });
    const ps = (r.json().possibilites ?? []) as PossibiliteAffichee[];
    const p = s.sens === "arriver" ? ps[ps.length - 1] : ps[0];
    if (!p) {
      console.log(`\n## ${s.id} — aucune possibilité`);
      continue;
    }
    let k = 0;
    for (const e of p.etapes) {
      k++;
      if (e.mode !== "marche" || e.duree_minutes < 3) continue;
      console.log(`\n## ${s.id} #${k} — ${e.de.nom} → ${e.a.nom} (${e.duree_minutes} min)`);
      console.log(`   de ${e.de.lat.toFixed(6)},${e.de.lon.toFixed(6)}  à ${e.a.lat.toFixed(6)},${e.a.lon.toFixed(6)}`);
      for (const c of e.consignes ?? []) console.log(`   - ${ligne(c)}`);
      const morceaux = await marcheSeule(e.de, e.a);
      await writeFile(path.join(sortie!, `${s.id}-${k}.json`), JSON.stringify({ de: e.de, a: e.a, morceaux }, null, 1));
      console.log(`   marche seule (${morceaux.length} morceaux) :`);
      for (const c of calculerConsignes(morceaux, e.a)) console.log(`   · ${ligne(c)}`);
    }
  } catch (err) {
    console.log(`\n## ${s.id} — ÉCHEC : ${(err as Error).message}`);
  }
}
await app.close();
