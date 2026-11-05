import { writeFile } from "node:fs/promises";
import { lireMotis } from "../itineraires/motis-plan.js";

/**
 * Audit national des quais injoignables à pied (issue 0008).
 * Pour chaque station (arrêts regroupés par `parentId`) desservie par autre chose que le bus,
 * on demande à MOTIS (`/api/v6/one-to-all`, `transitModes` vide) quels quais il atteint à pied
 * depuis le point de la station, avec la limite de coût de marche donnée. Un quai desservi, à moins
 * de 300 m, que la marche n'atteint pas est « orphelin » : la recherche ne peut pas y monter
 * depuis la rue.
 * Usage (MOTIS national lancé) : npm run audit:quais -- [http://127.0.0.1:8080] [sortie.json] [coût en s]
 * Coût 1800 : ce que voit la recherche ordinaire ; 3600 : ce que voit la seconde recherche (D62).
 */
const MOTIS = process.argv[2] ?? "http://127.0.0.1:8080";
const SORTIE = process.argv[3] ?? "../donnees/audit-quais.json"; // donnees/ est ignoré par git
const INSTANT = "2026-11-13T07:00:00Z"; // vendredi 08:00 à Paris : le plus de services
const RAYON_METRES = 300;
/** Limite de coût de la marche d'accès (secondes osr), comme `maxPreTransitTime` du serveur. */
const COUT_MARCHE = Number(process.argv[4] ?? 1800);
const MODES_BUS = new Set(["BUS", "COACH"]);

type Arret = { stopId: string; name: string; lat: number; lon: number; level?: number; modes?: string[]; parentId?: string };

function distance(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = 6_371_000;
  const p = Math.PI / 180;
  const x = (b.lon - a.lon) * p * Math.cos(((a.lat + b.lat) / 2) * p);
  const y = (b.lat - a.lat) * p;
  return Math.sqrt(x * x + y * y) * r;
}

/** Sans `fetch` : il fait planter le processus sur les réponses de MOTIS (issue 0020). */
async function json(url: string): Promise<unknown> {
  return lireMotis(new URL(url), 120_000);
}

/** Tous les arrêts d'un rectangle, en le découpant tant que MOTIS répond « too many stops ». */
async function arrets(s: number, o: number, n: number, e: number): Promise<Arret[]> {
  const r = await json(`${MOTIS}/api/v6/map/stops?min=${s},${o}&max=${n},${e}`);
  if (Array.isArray(r)) return r as Arret[];
  const ml = (s + n) / 2;
  const mo = (o + e) / 2;
  const parts = await Promise.all([arrets(s, o, ml, mo), arrets(s, mo, ml, e), arrets(ml, o, n, mo), arrets(ml, mo, n, e)]);
  return parts.flat();
}

async function enParallele<T, R>(items: T[], n: number, f: (t: T) => Promise<R>): Promise<R[]> {
  const res: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const k = i++;
        res[k] = await f(items[k]!);
      }
    }),
  );
  return res;
}

const t0 = Date.now();
const tous = new Map<string, Arret>();
for (const a of await arrets(41.0, -5.5, 51.5, 10.0)) tous.set(a.stopId, a);
console.log(`${tous.size} arrêts en ${Math.round((Date.now() - t0) / 1000)} s`);

// Stations : regroupées par parent ; un arrêt sans parent est sa propre station.
const stations = new Map<string, { centre: { lat: number; lon: number }; quais: Arret[] }>();
for (const a of tous.values()) {
  const cle = a.parentId ?? a.stopId;
  const parent = a.parentId ? tous.get(a.parentId) : undefined;
  const st = stations.get(cle) ?? { centre: parent ?? a, quais: [] };
  st.quais.push(a);
  stations.set(cle, st);
}
const ferrees = [...stations.entries()].filter(([, st]) => st.quais.some((q) => (q.modes ?? []).some((m) => !MODES_BUS.has(m))));
console.log(`${stations.size} stations, dont ${ferrees.length} desservies par autre chose que le bus`);

type Quai = { stopId: string; level?: number; modes?: string[]; metres: number; minutes?: number };
type Constat = { station: string; nom: string; orphelins: Quai[]; lents: Quai[]; sansService: number };

type UnVersTous = { all?: { place: { stopId?: string }; duration: number; k: number }[] };
function unVersTous(centre: { lat: number; lon: number }, aPied: boolean): Promise<UnVersTous> {
  const qs = new URLSearchParams({
    one: `${centre.lat},${centre.lon}`,
    time: INSTANT,
    maxTravelTime: String(Math.ceil(COUT_MARCHE / 60) + 5),
    maxTransfers: "0",
    maxPreTransitTime: String(COUT_MARCHE),
    useRoutedTransfers: "true",
  });
  if (aPied) qs.set("transitModes", ""); // à pied seulement : une entrée par arrêt atteint en marchant
  return json(`${MOTIS}/api/v6/one-to-all?${qs}`) as Promise<UnVersTous>;
}

const constats = await enParallele(ferrees, 8, async ([cle, st]): Promise<Constat> => {
  // Avec transport : les arrêts qui ont du service (une seule entrée par arrêt, la plus rapide).
  // À pied seulement : ceux que la marche d'accès atteint, et en combien de minutes.
  const [avec, aPied] = await Promise.all([unVersTous(st.centre, false), unVersTous(st.centre, true)]);
  const desservis = new Set((avec.all ?? []).map((x) => x.place.stopId));
  const marche = new Map((aPied.all ?? []).map((x) => [x.place.stopId, x.duration]));
  const orphelins: Quai[] = [];
  const lents: Quai[] = [];
  let sansService = 0;
  for (const q of st.quais) {
    if (q.stopId === cle && st.quais.length > 1) continue; // la station parente elle-même
    const metres = Math.round(distance(st.centre, q));
    if (metres > RAYON_METRES) continue;
    const minutes = marche.get(q.stopId);
    const quai = { stopId: q.stopId, level: q.level, modes: q.modes, metres, minutes };
    if (minutes === undefined && !desservis.has(q.stopId)) sansService++;
    else if (minutes === undefined) orphelins.push(quai);
    else if (minutes > 3 + (2.5 * metres) / 1.2 / 60) lents.push(quai); // plus de 2,5 fois la marche à vol d'oiseau, + 3 min
  }
  return { station: cle, nom: st.quais[0]!.name, orphelins, lents, sansService };
});

const resume = (titre: string, quais: Quai[], stations: number) => {
  const parNiveau = new Map<string, number>();
  for (const q of quais) parNiveau.set(String(q.level ?? 0), (parNiveau.get(String(q.level ?? 0)) ?? 0) + 1);
  const parMode = new Map<string, number>();
  for (const q of quais) for (const m of q.modes ?? ["?"]) parMode.set(m, (parMode.get(m) ?? 0) + 1);
  console.log(`\n${titre} : ${quais.length} quais dans ${stations} stations`);
  if (quais.length) console.log("  par niveau OSM :", Object.fromEntries(parNiveau), "| par mode :", Object.fromEntries(parMode));
};
const avecOrphelins = constats.filter((c) => c.orphelins.length > 0);
const avecLents = constats.filter((c) => c.lents.length > 0);
console.log(`\ncoût de marche ${COUT_MARCHE} s, rayon ${RAYON_METRES} m, ${ferrees.length} stations`);
resume("Orphelins (injoignables à pied)", avecOrphelins.flatMap((c) => c.orphelins), avecOrphelins.length);
resume("Lents (marche plus de 2,5 fois le vol d'oiseau)", avecLents.flatMap((c) => c.lents), avecLents.length);
console.log(`quais sans service à ${INSTANT} (non jugés) : ${constats.reduce((s, c) => s + c.sansService, 0)}`);
console.log(`durée : ${Math.round((Date.now() - t0) / 1000)} s`);
await writeFile(
  SORTIE,
  JSON.stringify({ instant: INSTANT, rayon: RAYON_METRES, cout: COUT_MARCHE, stations: ferrees.length, constats: constats.filter((c) => c.orphelins.length || c.lents.length) }, null, 1),
);
