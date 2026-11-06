import type { Candidat } from "./api";

// Zones dites dans une phrase pour préciser un lieu (spec 35, D113) : régions actuelles et d'avant 2016,
// départements par nom et par numéro (code officiel géographique de l'Insee). Pur TypeScript, testé sous Node.

const DEPARTEMENTS: Record<string, string> = {
  "01": "Ain", "02": "Aisne", "03": "Allier", "04": "Alpes-de-Haute-Provence", "05": "Hautes-Alpes",
  "06": "Alpes-Maritimes", "07": "Ardèche", "08": "Ardennes", "09": "Ariège", "10": "Aube", "11": "Aude",
  "12": "Aveyron", "13": "Bouches-du-Rhône", "14": "Calvados", "15": "Cantal", "16": "Charente",
  "17": "Charente-Maritime", "18": "Cher", "19": "Corrèze", "2A": "Corse-du-Sud", "2B": "Haute-Corse",
  "21": "Côte-d'Or", "22": "Côtes-d'Armor", "23": "Creuse", "24": "Dordogne", "25": "Doubs", "26": "Drôme",
  "27": "Eure", "28": "Eure-et-Loir", "29": "Finistère", "30": "Gard", "31": "Haute-Garonne", "32": "Gers",
  "33": "Gironde", "34": "Hérault", "35": "Ille-et-Vilaine", "36": "Indre", "37": "Indre-et-Loire", "38": "Isère",
  "39": "Jura", "40": "Landes", "41": "Loir-et-Cher", "42": "Loire", "43": "Haute-Loire", "44": "Loire-Atlantique",
  "45": "Loiret", "46": "Lot", "47": "Lot-et-Garonne", "48": "Lozère", "49": "Maine-et-Loire", "50": "Manche",
  "51": "Marne", "52": "Haute-Marne", "53": "Mayenne", "54": "Meurthe-et-Moselle", "55": "Meuse", "56": "Morbihan",
  "57": "Moselle", "58": "Nièvre", "59": "Nord", "60": "Oise", "61": "Orne", "62": "Pas-de-Calais",
  "63": "Puy-de-Dôme", "64": "Pyrénées-Atlantiques", "65": "Hautes-Pyrénées", "66": "Pyrénées-Orientales",
  "67": "Bas-Rhin", "68": "Haut-Rhin", "69": "Rhône", "70": "Haute-Saône", "71": "Saône-et-Loire", "72": "Sarthe",
  "73": "Savoie", "74": "Haute-Savoie", "75": "Paris", "76": "Seine-Maritime", "77": "Seine-et-Marne",
  "78": "Yvelines", "79": "Deux-Sèvres", "80": "Somme", "81": "Tarn", "82": "Tarn-et-Garonne", "83": "Var",
  "84": "Vaucluse", "85": "Vendée", "86": "Vienne", "87": "Haute-Vienne", "88": "Vosges", "89": "Yonne",
  "90": "Territoire de Belfort", "91": "Essonne", "92": "Hauts-de-Seine", "93": "Seine-Saint-Denis",
  "94": "Val-de-Marne", "95": "Val-d'Oise", "971": "Guadeloupe", "972": "Martinique", "973": "Guyane",
  "974": "La Réunion", "976": "Mayotte",
};

const IDF = ["75", "77", "78", "91", "92", "93", "94", "95"];
const PACA = ["04", "05", "06", "13", "83", "84"];

/** Régions actuelles, puis celles d'avant 2016 (on les dit encore : « Basse-Normandie », « Bourgogne »). */
const REGIONS: [string[], string[]][] = [
  [["Auvergne-Rhône-Alpes"], ["01", "03", "07", "15", "26", "38", "42", "43", "63", "69", "73", "74"]],
  [["Bourgogne-Franche-Comté"], ["21", "25", "39", "58", "70", "71", "89", "90"]],
  [["Bretagne"], ["22", "29", "35", "56"]],
  [["Centre-Val de Loire", "Centre"], ["18", "28", "36", "37", "41", "45"]],
  [["Corse"], ["2A", "2B"]],
  [["Grand Est"], ["08", "10", "51", "52", "54", "55", "57", "67", "68", "88"]],
  [["Hauts-de-France"], ["02", "59", "60", "62", "80"]],
  [["Île-de-France", "IDF", "région parisienne"], IDF],
  [["Normandie"], ["14", "27", "50", "61", "76"]],
  [["Nouvelle-Aquitaine"], ["16", "17", "19", "23", "24", "33", "40", "47", "64", "79", "86", "87"]],
  [["Occitanie"], ["09", "11", "12", "30", "31", "32", "34", "46", "48", "65", "66", "81", "82"]],
  [["Pays de la Loire"], ["44", "49", "53", "72", "85"]],
  [["Provence-Alpes-Côte d'Azur", "PACA", "Provence", "Côte d'Azur"], PACA],
  [["Alsace"], ["67", "68"]],
  [["Aquitaine"], ["24", "33", "40", "47", "64"]],
  [["Auvergne"], ["03", "15", "43", "63"]],
  [["Basse-Normandie"], ["14", "50", "61"]],
  [["Haute-Normandie"], ["27", "76"]],
  [["Bourgogne"], ["21", "58", "71", "89"]],
  [["Champagne-Ardenne", "Champagne"], ["08", "10", "51", "52"]],
  [["Franche-Comté"], ["25", "39", "70", "90"]],
  [["Languedoc-Roussillon", "Languedoc"], ["11", "30", "34", "48", "66"]],
  [["Limousin"], ["19", "23", "87"]],
  [["Lorraine"], ["54", "55", "57", "88"]],
  [["Midi-Pyrénées"], ["09", "12", "31", "32", "46", "65", "81", "82"]],
  [["Nord-Pas-de-Calais"], ["59", "62"]],
  [["Picardie"], ["02", "60", "80"]],
  [["Poitou-Charentes"], ["16", "17", "79", "86"]],
  [["Rhône-Alpes"], ["01", "07", "26", "38", "42", "69", "73", "74"]],
];

const simplifier = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    // « en Basse-Normandie », « dans l'Orne », « la Manche ».
    .replace(/^(en|dans|dans le|dans la|dans les|le|la|les|l)\s+/, "");

const PAR_NOM = new Map<string, string[]>();
for (const [code, nom] of Object.entries(DEPARTEMENTS)) PAR_NOM.set(simplifier(nom), [code]);
for (const [noms, codes] of REGIONS) for (const nom of noms) PAR_NOM.set(simplifier(nom), codes);

/** Départements d'une zone dite (nom ou numéro), ou null si elle n'est pas reconnue. */
export function departementsDeZone(zone: string): string[] | null {
  const z = simplifier(zone);
  if (!z) return null;
  const numero = z.toUpperCase();
  if (DEPARTEMENTS[numero]) return [numero];
  if (/^\d$/.test(z) && DEPARTEMENTS[`0${z}`]) return [`0${z}`];
  return PAR_NOM.get(z) ?? null;
}

/** Département d'un code postal : deux chiffres, trois en outre-mer ; Corse : 200xx-201xx ⇒ 2A, sinon 2B. */
export function departementDuCodePostal(cp: string | null | undefined): string | null {
  if (!cp || !/^\d{5}$/.test(cp)) return null;
  if (cp.startsWith("97")) return cp.slice(0, 3);
  if (cp.startsWith("20")) return Number(cp) < 20200 ? "2A" : "2B";
  return cp.slice(0, 2);
}

/**
 * Lieux dans la zone dite (spec 35, §3.3) : seuls ceux dont le code postal est dans un de ses départements.
 * Zone absente ou inconnue, ou aucun lieu dedans ⇒ la liste entière (on ne cache jamais tout).
 */
export function filtrerParZone(candidats: Candidat[], zone: string | null): Candidat[] {
  const departements = zone ? departementsDeZone(zone) : null;
  if (!departements) return candidats;
  const dedans = candidats.filter((c) => {
    const d = departementDuCodePostal(c.code_postal);
    return d !== null && departements.includes(d);
  });
  return dedans.length > 0 ? dedans : candidats;
}
