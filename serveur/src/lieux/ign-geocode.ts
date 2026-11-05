import { z } from "zod";
import { lireMotis, type Point } from "../itineraires/motis-plan.js";
import { distanceMetres } from "./distance.js";
import type { Candidat, Transport } from "./motis-geocode.js";

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
    category: texteOuListe,
  }),
});

/**
 * Nature d'un équipement de transport de la BD TOPO ⇒ transport (D92). Constaté le 2026-11-05 :
 * Gare d'Auxerre-Saint-Gervais ⇒ « gare voyageurs et fret » ; Gare Routière d'Auxerre ⇒ « gare routière ».
 * Toute autre catégorie ⇒ aucun transport.
 */
const TRANSPORTS_BD_TOPO: readonly (readonly [RegExp, Transport])[] = [
  [/^gare voyageurs/, "train"],
  [/^station de m[ée]tro/, "metro"],
  [/^station de tram/, "tram"],
  [/^gare routi[èe]re/, "car"],
  [/^gare maritime/, "bateau"],
];

export function transportDesCategories(categories: string | string[] | undefined): Transport | undefined {
  const liste = (Array.isArray(categories) ? categories : categories ? [categories] : []).map((c) => c.toLowerCase());
  return TRANSPORTS_BD_TOPO.find(([motif]) => liste.some((c) => motif.test(c)))?.[1];
}

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
    const transport = estAdresse ? undefined : transportDesCategories(p.category);
    return [
      {
        nom: estAdresse && p.label ? p.label.replace(/\s\d{5}\s.*$/, "") : nom,
        type: estAdresse && p.type !== "municipality" ? ("adresse" as const) : ("lieu" as const),
        commune: premier(p.city) ?? null,
        code_postal: cp && /^\d{5}$/.test(cp) ? cp : null,
        lat,
        lon,
        source: "ign" as const,
        ...(transport ? { transport } : {}),
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
/**
 * Une gare ou une station de métro compte plus qu'un arrêt de bus du même nom (D92, spec 18 §12.7) : « Châtelet » depuis
 * l'Yonne ⇒ le métro de Paris avant les arrêts de bus de Montereau et Corquilleroy (constaté le 2026-11-05).
 */
export const IMPORTANCE_TRANSPORT: Record<Transport, number> = { train: 0.15, metro: 0.2, tram: 0.06, car: 0, bus: 0, bateau: 0 };
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

/** Un mot de la recherche retrouvé dans un mot du lieu : en début de mot, mais un numéro en entier (« 3 » ≠ « 31 »). */
const retrouve = (cherche: string, present: string) => (/^\d+$/.test(cherche) ? present === cherche : present.startsWith(cherche));

/** « Paris 12e Arrondissement » ⇒ « Paris » : l'arrondissement ne se tape pas. */
const sansArrondissement = (commune: string) => commune.replace(/\s+\d+(er|e)\s+arrondissement$/i, "");

/**
 * Part des mots de la recherche retrouvés dans le nom et la commune du candidat. La commune ne compte que si
 * tous ses mots sont dans la recherche (D92) : « 3 rue de la gare joigny » nomme Joigny, pas Joigny-sur-Meuse.
 * Un numéro compte pour moitié : la bonne rue sans ce numéro passe devant une autre rue qui l'a
 * (« 10 rue de rivoli paris » : la rue de Rivoli avant « Rue de Paris à Genève 10 »).
 */
export function couverture(recherche: string, c: Candidat): number {
  const cherches = mots(recherche);
  if (cherches.length === 0) return 0;
  const commune = mots(sansArrondissement(c.commune ?? ""));
  const communeNommee = commune.length > 0 && commune.every((p) => cherches.some((m) => retrouve(m, p)));
  const presents = [...mots(c.nom), ...(communeNommee ? commune : [])];
  const poids = (m: string) => (/^\d+$/.test(m) ? 0.5 : 1);
  const total = cherches.reduce((s, m) => s + poids(m), 0);
  return cherches.filter((m) => presents.some((p) => retrouve(m, p))).reduce((s, m) => s + poids(m), 0) / total;
}

/**
 * Classement des candidats de l'IGN et de MOTIS (D60), comparé à Google Maps le 2026-11-04 :
 * 1. la part des mots de la recherche retrouvés (« tribunal judiciaire Dijon » : Dijon avant Albi) ;
 * 2. une adresse d'abord si la recherche contient un numéro ou commence par un type de voie,
 *    un lieu ou un arrêt sinon (« Aéroport d'Orly » : l'aéroport avant la rue du même nom) ;
 * 3. la note du géocodeur (MOTIS : 0,75 pour un arrêt ou une adresse, 0,6 pour un lieu d'OSM), plus 0,2
 *    si le nom d'un lieu de l'IGN ou d'un arrêt est la recherche même (« Gare de Lyon » : l'arrêt avant le parking)
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
    // Nom identique à la recherche : un lieu de l'IGN, ou un arrêt (« gare de lyon » : la gare avant son parking).
    const nomExact =
      c.source === "ign" ? simplifier(c.nom).replace(ARTICLE, "") === exacte : c.type === "arret" && nomReduit(c.nom) === nomReduit(recherche);
    const bonus = (nomExact ? 0.2 : 0) + (c.transport ? IMPORTANCE_TRANSPORT[c.transport] : 0);
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
    if (sortie.some((x) => memeLieu(x, c))) continue;
    const { score: _score, ...sansScore } = c;
    sortie.push(sansScore);
  }
  return sortie;
}

/**
 * Même nom, même nature et même commune à moins de cette distance : un seul lieu donné plusieurs fois
 * (constaté le 2026-11-05 : « Châtelet » deux fois dans le 1er à 210 m ; les deux quais d'un même arrêt).
 */
export const MEME_NOM_METRES = 300;
/** Une commune donnée par l'IGN et par MOTIS : leurs centres peuvent être à près d'un kilomètre (Saint-Michel-sur-Orge). */
export const MEME_COMMUNE_METRES = 5000;

/** Nom réduit à ses mots utiles : « Basilique de Saint-Denis » = « Basilique Saint-Denis ». */
const nomReduit = (s: string) => mots(s).join(" ");

/** Même lieu si l'un des noms contient l'autre une fois réduits (« Gare d'Auxerre » / « Gare d'Auxerre-Saint-Gervais »). */
function memeNom(a: string, b: string): boolean {
  const x = nomReduit(a);
  const y = nomReduit(b);
  return x.includes(y) || y.includes(x);
}

function memeCommune(a: Candidat, b: Candidat): boolean {
  if (a.code_postal && b.code_postal) return a.code_postal === b.code_postal;
  return !!a.commune && !!b.commune && simplifier(a.commune) === simplifier(b.commune);
}

/**
 * Doublons écartés (constaté le 2026-11-05, « saint michel sur orge » : la commune quatre fois) :
 * 1. noms proches à moins de 80 m, quelle que soit la nature ;
 * 2. même nom réduit à moins de 300 m : deux lieux desservis par un transport (une gare de la BD TOPO et
 *    l'arrêt de MOTIS : « Gare de Lyon » à 250 m, « Châtelet » à 110 m entre le 1er et le 4e), ou même nature
 *    et même commune ;
 * 3. la commune elle-même (lieu nommé comme sa commune), même commune, à moins de 5 km.
 */
function memeLieu(a: Candidat, b: Candidat): boolean {
  // Un arrêt nommé d'après sa rue n'est pas l'adresse (« 3 RUE DE LA GARE » à Joigny avalait « Rue de la Gare »).
  if ((a.type === "arret" && b.type === "adresse") || (a.type === "adresse" && b.type === "arret")) return false;
  const d = distanceMetres(a, b);
  if (d < MEME_LIEU_METRES && memeNom(a.nom, b.nom)) return true;
  if (nomReduit(a.nom) !== nomReduit(b.nom)) return false;
  if (d < MEME_NOM_METRES && !!a.transport && !!b.transport) return true;
  if (a.type !== b.type || !memeCommune(a, b)) return false;
  if (d < MEME_NOM_METRES) return true;
  const estCommune = (c: Candidat) => c.type === "lieu" && !!c.commune && nomReduit(c.commune) === nomReduit(c.nom);
  return d < MEME_COMMUNE_METRES && (estCommune(a) || estCommune(b));
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

// ——— Adresse du lieu d'arrivée (issue 0010, C) ———

export const URL_IGN_INVERSE = "https://data.geopf.fr/geocodage/reverse";

export function construireUrlIgnInverse(p: Point): URL {
  const url = new URL(URL_IGN_INVERSE);
  url.searchParams.set("lat", String(p.lat));
  url.searchParams.set("lon", String(p.lon));
  url.searchParams.set("index", "address");
  url.searchParams.set("limit", "1");
  return url;
}

const schemaReponseInverse = z.object({
  features: z.array(
    z.object({
      properties: z.object({
        _type: z.string().optional(),
        type: z.string().optional(),
        label: z.string().optional(),
        street: z.string().optional(),
        postcode: z.string().optional(),
        city: z.string().optional(),
        distance: z.number().nonnegative().optional(),
      }),
    }),
  ),
});

/**
 * Au-delà de cette distance, le numéro trouvé n'est pas celui du lieu : on donne la rue sans numéro.
 * Constaté le 2026-11-04 : le tribunal administratif de Dijon (22 rue d'Assas) ⇒ « 13 Rue d'Assas » à 15 m.
 */
export const NUMERO_EXACT_METRES = 10;

/** « 13 Rue d'Assas 21000 Dijon » à 15 m ⇒ « Rue d'Assas, 21000 Dijon » ; null si rien d'utilisable. */
export function lireAdresseInverse(brut: unknown): string | null {
  const f = schemaReponseInverse.parse(brut).features[0]?.properties;
  if (!f) return null;
  const ville = [f.postcode, f.city].filter(Boolean).join(" ");
  if (f.type === "housenumber" && f.label && f.distance !== undefined && f.distance <= NUMERO_EXACT_METRES) {
    const sansVille = ville && f.label.endsWith(ville) ? f.label.slice(0, -ville.length).trim() : f.label;
    return ville ? `${sansVille}, ${ville}` : sansVille;
  }
  if (f.street) return ville ? `${f.street}, ${ville}` : f.street;
  return null;
}

/** Adresse postale la plus proche d'un point ; rien n'est gardé ni journalisé (invariants 6 et 10). */
export type AdresseInverse = (p: Point) => Promise<string | null>;

export function adresseIgn(delaiMs = 2500): AdresseInverse {
  return async (p) => lireAdresseInverse(await lireMotis(construireUrlIgnInverse(p), delaiMs));
}
