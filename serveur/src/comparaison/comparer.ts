import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { PossibiliteAffichee } from "../itineraires/normaliser.js";
import { appNationale } from "../national/app-nationale.js";

/**
 * Comparaisons avec d'autres applications (Google Maps, SNCF Connect…), sur le MOTIS national du PC.
 * Passe par les routes du serveur, comme l'app : `/v1/lieux` puis `/v1/itineraires` (issue 0007, §5).
 * Usage : npm run build && node dist/comparaison/comparer.js <scenarios.json> [id…]
 */
const schemaLieu = z.union([
  z.object({ texte: z.string(), proche: z.object({ lat: z.number(), lon: z.number() }).optional(), choix: z.number().int().min(0).default(0) }),
  z.object({ lat: z.number(), lon: z.number(), nom: z.string() }),
]);
const schemaScenario = z.object({
  id: z.string(),
  de: schemaLieu,
  a: schemaLieu,
  date: z.iso.date(),
  heure: z.string(),
  sens: z.enum(["partir", "arriver"]),
  marge: z.number().optional(),
});
type Lieu = z.infer<typeof schemaLieu>;

const { app, entete } = await appNationale();

async function resoudre(l: Lieu): Promise<{ lat: number; lon: number; nom: string }> {
  if ("lat" in l) return l;
  const qs = new URLSearchParams({ q: l.texte });
  if (l.proche) qs.set("proche", `${l.proche.lat},${l.proche.lon}`);
  const r = await app.inject({ method: "GET", url: `/v1/lieux?${qs}`, headers: entete });
  const c = r.json().candidats?.[l.choix];
  if (!c) throw new Error(`aucun candidat pour « ${l.texte} »`);
  return { lat: c.lat, lon: c.lon, nom: `${c.nom} (${c.commune ?? "?"})` };
}

const ligne = (p: PossibiliteAffichee) =>
  `${p.depart} → ${p.arrivee} (${p.duree_minutes} min, ${p.correspondances} corr.) ` +
  p.etapes
    .map((e) => (e.mode === "marche" ? `marche ${e.duree_minutes}′` : `${e.mode} ${e.ligne ?? ""} ${e.depart}`.trim()))
    .join(" › ");

const [fichier, ...ids] = process.argv.slice(2);
const scenarios = z.array(schemaScenario).parse(JSON.parse(await readFile(fichier!, "utf8")));
for (const s of scenarios.filter((x) => ids.length === 0 || ids.includes(x.id))) {
  try {
    const de = await resoudre(s.de);
    const a = await resoudre(s.a);
    const t0 = Date.now();
    const r = await app.inject({
      method: "POST",
      url: "/v1/itineraires",
      headers: entete,
      payload: { depart: { lat: de.lat, lon: de.lon }, arrivee: { lat: a.lat, lon: a.lon }, date: s.date, heure: s.heure, sens: s.sens, marge: s.marge },
    });
    const c = r.json();
    console.log(`\n## ${s.id} — ${s.sens} ${s.date} ${s.heure} (${Date.now() - t0} ms)\n   de ${de.nom} ${de.lat.toFixed(5)},${de.lon.toFixed(5)}\n   à  ${a.nom} ${a.lat.toFixed(5)},${a.lon.toFixed(5)}`);
    if (r.statusCode !== 200) console.log(`   ERREUR ${r.statusCode} ${r.body}`);
    else {
      console.log(`   verdict ${c.verdict}, ${c.possibilites.length} possibilités`);
      const ps = c.possibilites as PossibiliteAffichee[];
      // « arriver » : les dernières, au plus près du rendez-vous ; « partir » : les premières.
      for (const p of s.sens === "arriver" ? ps.slice(-6) : ps.slice(0, 6)) console.log(`   - ${ligne(p)}`);
    }
  } catch (e) {
    console.log(`\n## ${s.id} — ÉCHEC : ${(e as Error).message}`);
  }
}
await app.close();
