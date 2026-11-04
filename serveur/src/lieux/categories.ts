import { distanceMetres } from "./distance.js";
import type { Candidat } from "./motis-geocode.js";

/**
 * Recherche par catégorie autour d'un point (D61) : « restaurant chinois », « pharmacie », « boulangerie ».
 * Source : les lieux de la carte OSM France (même fichier que MOTIS), extraits par osmium et réduits
 * par `npm run donnees:lieux` dans `donnees/poi/lieux.json` (ignoré par git, comme tout `donnees/`).
 * Ni MOTIS ni l'IGN ne savent chercher une catégorie : constaté le 2026-11-04, « restaurant chinois »
 * près de Paris donnait un restaurant nommé ainsi à Chevilly-Larue.
 */
export type LieuOsm = {
  n: string; // nom
  k: string; // catégorie OSM : amenity, healthcare ou shop
  c?: string[]; // cuisines (cuisine=*)
  v?: string; // commune (addr:city)
  la: number;
  lo: number;
};

/** Ce que demande la recherche : des catégories, et éventuellement des cuisines. */
export type Demande = { categories: string[]; cuisines: string[] };

const RESTAURATION = ["restaurant", "fast_food"];

/** Mots (simplifiés : minuscules, sans accent) ⇒ catégories OSM. */
const MOTS_CATEGORIES: Record<string, string[]> = {
  restaurant: RESTAURATION, restaurants: RESTAURATION, resto: RESTAURATION, restos: RESTAURATION,
  manger: RESTAURATION, traiteur: RESTAURATION,
  "fast food": ["fast_food"], fastfood: ["fast_food"],
  cafe: ["cafe"], bar: ["bar", "pub"], pub: ["pub", "bar"],
  pharmacie: ["pharmacy"], medecin: ["doctors", "doctor"], generaliste: ["doctors", "doctor"],
  docteur: ["doctors", "doctor"], dentiste: ["dentist"], hopital: ["hospital"], urgences: ["hospital"],
  clinique: ["clinic", "hospital"], veterinaire: ["veterinary"], cinema: ["cinema"], theatre: ["theatre"],
  mairie: ["townhall"], poste: ["post_office"], commissariat: ["police"], gendarmerie: ["police"],
  bibliotheque: ["library"], mediatheque: ["library"], banque: ["bank"],
  supermarche: ["supermarket"], boulangerie: ["bakery"], epicerie: ["convenience"], superette: ["convenience"],
  coiffeur: ["hairdresser"], boucherie: ["butcher"], fleuriste: ["florist"], opticien: ["optician"],
  librairie: ["books"],
};

/** Mots ⇒ cuisines OSM ; un mot de cuisine seul suffit à chercher un restaurant (« pizzeria », « sushi »). */
const MOTS_CUISINES: Record<string, string[]> = {
  chinois: ["chinese", "asian"], chinoise: ["chinese", "asian"], asiatique: ["asian", "chinese", "vietnamese", "thai", "japanese"],
  japonais: ["japanese", "sushi"], japonaise: ["japanese", "sushi"], sushi: ["sushi", "japanese"], sushis: ["sushi", "japanese"],
  vietnamien: ["vietnamese"], vietnamienne: ["vietnamese"], thai: ["thai"], thailandais: ["thai"],
  indien: ["indian"], indienne: ["indian"], libanais: ["lebanese"], marocain: ["moroccan"],
  italien: ["italian", "pizza"], italienne: ["italian", "pizza"], pizza: ["pizza", "italian"], pizzeria: ["pizza", "italian"],
  kebab: ["kebab"], burger: ["burger"], burgers: ["burger"], creperie: ["crepe"], crepes: ["crepe"],
  francais: ["french", "regional"], francaise: ["french", "regional"], coreen: ["korean"], turc: ["turkish"],
  grec: ["greek"], mexicain: ["mexican"], espagnol: ["spanish"], portugais: ["portuguese"], africain: ["african"],
  vegetarien: ["vegetarian", "vegan"], vegan: ["vegan", "vegetarian"],
};

const simplifier = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Comprend « restaurant chinois », « pharmacie », « pizzeria » ; null si la recherche n'est pas une catégorie. */
export function comprendreCategorie(recherche: string): Demande | null {
  const texte = simplifier(recherche);
  const mots = texte.split(" ");
  const categories = new Set<string>();
  const cuisines = new Set<string>();
  for (const [mot, cats] of Object.entries(MOTS_CATEGORIES)) {
    if (mot.includes(" ") ? texte.includes(mot) : mots.includes(mot)) cats.forEach((c) => categories.add(c));
  }
  for (const m of mots) MOTS_CUISINES[m]?.forEach((c) => cuisines.add(c));
  if (cuisines.size > 0 && categories.size === 0) RESTAURATION.forEach((c) => categories.add(c));
  if (categories.size === 0) return null;
  // Une recherche de catégorie est courte : au-delà, c'est un nom (« Restaurant du Canal Saint-Martin »).
  const autres = mots.filter((m) => !MOTS_CATEGORIES[m] && !MOTS_CUISINES[m] && !["de", "du", "la", "le", "un", "une", "des"].includes(m));
  if (autres.length > 0) return null;
  return { categories: [...categories], cuisines: [...cuisines] };
}

/** Index en grille (cellules de 0,05°) pour chercher les lieux proches sans tout parcourir. */
export class IndexLieux {
  private readonly cellules = new Map<string, LieuOsm[]>();
  private static readonly PAS = 0.05;

  constructor(lieux: LieuOsm[]) {
    for (const l of lieux) {
      const k = IndexLieux.cle(l.la, l.lo);
      let c = this.cellules.get(k);
      if (!c) this.cellules.set(k, (c = []));
      c.push(l);
    }
  }

  private static cle(lat: number, lon: number): string {
    return `${Math.floor(lat / IndexLieux.PAS)}:${Math.floor(lon / IndexLieux.PAS)}`;
  }

  get taille(): number {
    let n = 0;
    for (const c of this.cellules.values()) n += c.length;
    return n;
  }

  /** Les `max` lieux de la demande les plus proches de `point`, dans un rayon de `rayonM` mètres. */
  chercher(d: Demande, point: { lat: number; lon: number }, rayonM = 5000, max = 5): Candidat[] {
    const pas = IndexLieux.PAS;
    const n = Math.ceil(rayonM / 111_000 / pas / Math.cos((point.lat * Math.PI) / 180)) + 1;
    const [ci, cj] = [Math.floor(point.lat / pas), Math.floor(point.lon / pas)];
    const trouves: { l: LieuOsm; d: number }[] = [];
    for (let i = ci - n; i <= ci + n; i++) {
      for (let j = cj - n; j <= cj + n; j++) {
        for (const l of this.cellules.get(`${i}:${j}`) ?? []) {
          if (!d.categories.includes(l.k)) continue;
          if (d.cuisines.length > 0 && !l.c?.some((c) => d.cuisines.includes(c))) continue;
          const dist = distanceMetres(point, { lat: l.la, lon: l.lo });
          if (dist <= rayonM) trouves.push({ l, d: dist });
        }
      }
    }
    return trouves
      .sort((a, b) => a.d - b.d)
      .slice(0, max)
      .map(({ l }) => ({ nom: l.n, type: "lieu" as const, commune: l.v ?? null, code_postal: null, lat: l.la, lon: l.lo, source: "osm" as const }));
  }
}
