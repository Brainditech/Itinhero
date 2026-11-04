import { z } from "zod";
import { lireMotis, type Point } from "../itineraires/motis-plan.js";
import { distanceMetres } from "./distance.js";
import type { Candidat } from "./motis-geocode.js";

/**
 * Géocodeur de la Géoplateforme de l'IGN (D60) : adresses de la Base Adresse Nationale (index `address`,
 * mise à jour chaque semaine) et lieux de la BD TOPO (index `poi`). Service public, sans clé,
 * 50 requêtes par seconde et par adresse IP, licence Etalab 2.0 (openapi.yaml lu le 2026-11-04).
 * Le serveur l'appelle avec le texte du lieu et, s'il est donné, le point `proche` ; rien n'est stocké.
 */
export const URL_IGN = "https://data.geopf.fr/geocodage/search";

export function construireUrlIgn(texte: string, proche?: Point, index: "address" | "poi" = "poi"): URL {
  const url = new URL(URL_IGN);
  url.searchParams.set("q", texte);
  url.searchParams.set("index", index);
  url.searchParams.set("limit", "10");
  if (proche) {
    url.searchParams.set("lat", String(proche.lat));
    url.searchParams.set("lon", String(proche.lon));
  }
  return url;
}

const texteOuListe = z.union([z.string(), z.array(z.string())]).optional();
const premier = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

const schemaFeature = z.object({
  geometry: z.object({ coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]) }),
  properties: z.object({
    _type: z.string(),
    score: z.number().default(0),
    label: z.string().optional(),
    name: texteOuListe,
    type: z.string().optional(),
    city: texteOuListe,
    postcode: texteOuListe,
    classification: z.number().int().min(1).max(9).optional(),
  }),
});

export const schemaReponseIgn = z.object({ features: z.array(schemaFeature) });

export type CandidatNote = Candidat & { score: number };

/**
 * Importance d'un lieu de la BD TOPO : `classification` va de 1 (basilique du Sacré-Cœur, tour Eiffel)
 * à 9 (école, maison de retraite), constaté le 2026-11-04. Bonus de 0,015 par rang au-dessus de 9.
 */
export function importance(classification: number | undefined): number {
  return classification === undefined ? 0 : (9 - classification) * 0.015;
}

export function lireReponseIgn(brut: unknown): CandidatNote[] {
  return schemaReponseIgn.parse(brut).features.flatMap((f) => {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    const estAdresse = p._type === "address";
    if (!estAdresse && p._type !== "poi") return [];
    const nom = estAdresse ? (p.label ?? premier(p.name)) : premier(p.name);
    if (!nom) return [];
    const cp = premier(p.postcode);
    return [
      {
        nom: estAdresse && p.label ? p.label.replace(/\s\d{5}\s.*$/, "") : nom,
        type: estAdresse && p.type !== "municipality" ? ("adresse" as const) : ("lieu" as const),
        commune: premier(p.city) ?? null,
        code_postal: cp && /^\d{5}$/.test(cp) ? cp : null,
        lat,
        lon,
        source: "ign" as const,
        score: p.score + importance(p.classification),
      },
    ];
  });
}

/** Deux candidats à moins de cette distance, aux noms proches, sont le même lieu. */
export const MEME_LIEU_METRES = 80;

/** Note d'un candidat de MOTIS (le premier ; −0,02 par rang) : sous les lieux de l'IGN, sélectionnés et nommés par l'IGN. */
export const NOTE_MOTIS = 0.75;
/**
 * Note d'un lieu d'OSM donné par MOTIS (commerce, œuvre, salle…) : sous un lieu de la BD TOPO, que l'IGN
 * ne retient que s'il est notable (« Sacré-Cœur » : la basilique avant l'œuvre d'art du même nom).
 * Les commerces que l'IGN ne connaît pas (pharmacies, restaurants) restent trouvés par MOTIS.
 */
export const NOTE_LIEU_OSM = 0.6;
/** Une recherche qui commence par un type de voie vise une adresse (« Place de la République »). */
const TYPES_DE_VOIE = /^(rue|avenue|av|boulevard|bd|place|pl|route|chemin|allee|impasse|quai|cours|square|passage|rond point|faubourg)\b/;
const ARTICLE = /^(le|la|les|l) /;

const MOTS_VIDES = new Set(["de", "du", "des", "la", "le", "les", "l", "d", "a", "au", "aux", "et", "en", "un", "une"]);

export const simplifier = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const mots = (s: string) => simplifier(s).split(" ").filter((m) => m && !MOTS_VIDES.has(m));

/** Part des mots de la recherche retrouvés (en début de mot) dans le nom et la commune du candidat. */
export function couverture(recherche: string, c: Candidat): number {
  const cherches = mots(recherche);
  if (cherches.length === 0) return 0;
  const presents = mots(`${c.nom} ${c.commune ?? ""}`);
  return cherches.filter((m) => presents.some((p) => p.startsWith(m))).length / cherches.length;
}

/**
 * Classement des candidats de l'IGN et de MOTIS (D60), comparé à Google Maps le 2026-11-04 :
 * 1. la part des mots de la recherche retrouvés (« tribunal judiciaire Dijon » : Dijon avant Albi) ;
 * 2. une adresse d'abord si la recherche contient un numéro ou commence par un type de voie,
 *    un lieu ou un arrêt sinon (« Aéroport d'Orly » : l'aéroport avant la rue du même nom) ;
 * 3. la note du géocodeur (MOTIS : 0,75 pour un arrêt ou une adresse, 0,6 pour un lieu d'OSM), plus 0,2
 *    si le nom d'un lieu de l'IGN est la recherche même
 *    (« Mont-Saint-Michel » : la commune), moins 0,15 × log10(1 + km) depuis le point `proche`
 *    (« Sacré-Cœur » près de Paris : la basilique avant le lieu-dit de la Marne ;
 *    « Place de la République » : Paris avant Montreuil).
 * Un même lieu donné deux fois n'est gardé qu'une fois. Au plus 10.
 */
export function fusionner(ign: CandidatNote[], motis: Candidat[], proche?: Point, recherche = ""): Candidat[] {
  const veutAdresse = /\d/.test(recherche) || TYPES_DE_VOIE.test(simplifier(recherche));
  const exacte = simplifier(recherche).replace(ARTICLE, "");
  const notes: CandidatNote[] = [
    ...ign,
    ...motis.map((c, i) => ({ ...c, score: (c.type === "lieu" ? NOTE_LIEU_OSM : NOTE_MOTIS) - 0.02 * i })),
  ];
  const cle = (c: CandidatNote) => {
    const proximite = proche ? 0.15 * Math.log10(1 + distanceMetres(c, proche) / 1000) : 0;
    const bonus = c.source === "ign" && simplifier(c.nom).replace(ARTICLE, "") === exacte ? 0.2 : 0;
    const typeAttendu = veutAdresse ? c.type === "adresse" : c.type !== "adresse";
    return { couv: couverture(recherche, c), type: typeAttendu ? 1 : 0, note: c.score + bonus - proximite };
  };
  const classes = notes
    .map((c) => ({ c, k: cle(c) }))
    .sort((a, b) => b.k.couv - a.k.couv || b.k.type - a.k.type || b.k.note - a.k.note)
    .map((x) => x.c);
  const sortie: Candidat[] = [];
  for (const c of classes) {
    if (sortie.length >= 10) break;
    if (sortie.some((x) => distanceMetres(x, c) < MEME_LIEU_METRES && memeNom(x.nom, c.nom))) continue;
    const { score: _score, ...sansScore } = c;
    sortie.push(sansScore);
  }
  return sortie;
}

/** Même lieu si l'un des noms contient l'autre une fois simplifiés (« Gare d'Auxerre » / « Gare d'Auxerre-Saint-Gervais »). */
function memeNom(a: string, b: string): boolean {
  const x = simplifier(a);
  const y = simplifier(b);
  return x.includes(y) || y.includes(x);
}

export type GeocodeurIgn = (texte: string, proche?: Point) => Promise<unknown>;

/**
 * Vraie version : adresses et lieux interrogés à part (leurs notes ne se comparent pas, et les adresses
 * évinçaient les lieux), 2,5 s au plus ; au-delà, la route se contente de MOTIS.
 */
export function geocodeurIgn(delaiMs = 2500): GeocodeurIgn {
  return async (texte, proche) => {
    const [adresses, lieux] = await Promise.all([
      lireMotis(construireUrlIgn(texte, proche, "address"), delaiMs),
      lireMotis(construireUrlIgn(texte, proche, "poi"), delaiMs),
    ]);
    const a = schemaReponseIgn.parse(adresses);
    const l = schemaReponseIgn.parse(lieux);
    return { features: [...a.features, ...l.features] };
  };
}
