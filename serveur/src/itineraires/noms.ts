/**
 * Noms de lieux affichables (issue 0010, F). Les GTFS donnent des noms bruts : « MAIRIE »,
 * « SAINT FLORENTIN-VERGIGNY 3 RUE DE LA GARE », « DIJON Gare ». Seule la casse et la ponctuation
 * changent : aucun mot n'est ajouté, retiré ni deviné.
 */

const MINUSCULES = new Set(["de", "du", "des", "la", "le", "les", "et", "sur", "sous", "en", "aux", "au", "lès"]);
/** Sigles gardés en capitales. */
const SIGLES = new Set(["SNCF", "RER", "TER", "TGV", "RATP", "CHU", "CHR", "IUT", "ZA", "ZI", "ZAC", "EHPAD", "HLM", "RN", "RD", "CES", "CFA", "LEP", "CAF", "CPAM", "ESAT", "IME", "PMI", "MJC", "SDIS", "ENSAM", "INSA", "UFR"]);
const VOIES = new Set([
  "rue",
  "avenue",
  "boulevard",
  "place",
  "route",
  "chemin",
  "allée",
  "allee",
  "impasse",
  "quai",
  "cours",
  "square",
  "passage",
  "faubourg",
  "rond-point",
  "esplanade",
  "parvis",
]);

const capitale = (m: string) => (m ? m[0]!.toLocaleUpperCase("fr-FR") + m.slice(1) : m);

/** Un mot en capitales remis en forme ; « D'ARC » ⇒ « d'Arc », « SAINT-JEAN » ⇒ « Saint-Jean ». */
function mot(brut: string, premier: boolean, apresVoie: boolean): string {
  if (SIGLES.has(brut)) return brut;
  const m = brut.toLocaleLowerCase("fr-FR");
  if (/^\d/.test(m)) return m; // « 3 », « 12bis »
  const elision = /^([dl])['’](.+)$/.exec(m);
  if (elision) return `${premier ? capitale(elision[1]!) : elision[1]}'${mot(elision[2]!, true, false)}`;
  if (!premier && (MINUSCULES.has(m) || (VOIES.has(m) && !apresVoie))) return m;
  return m.split("-").map(capitale).join("-");
}

/** Vrai si le nom n'a aucune lettre minuscule (au moins deux lettres) : il vient en capitales. */
function enCapitales(nom: string): boolean {
  const lettres = nom.replace(/[^\p{L}]/gu, "");
  return lettres.length >= 2 && lettres === lettres.toLocaleUpperCase("fr-FR");
}

/**
 * - mots entièrement en capitales remis en minuscules (le reste du nom n'est pas touché) ;
 * - « Saint X » ⇒ « Saint-X » (nom de commune) ;
 * - une virgule avant un numéro suivi d'un type de voie (« Vergigny 3 rue » ⇒ « Vergigny, 3 rue »).
 */
export function nomAffichable(brut: string): string {
  const nom = brut.trim().replace(/\s+/g, " ");
  if (!nom) return nom;
  const tout = enCapitales(nom);
  const mots = nom.split(" ");
  const sortie: string[] = [];
  mots.forEach((m, i) => {
    const aRemettre = tout || (m.length >= 2 && enCapitales(m) && /\p{L}{3,}/u.test(m));
    const precedent = sortie.at(-1)?.toLocaleLowerCase("fr-FR") ?? "";
    sortie.push(aRemettre ? mot(m, i === 0, VOIES.has(precedent)) : m);
  });
  let r = sortie.join(" ");
  r = r.replace(/\b(Saint|Sainte|Saints|Saintes) (?=\p{Lu})/gu, "$1-");
  r = r.replace(/(\p{L}) (\d+[a-z]{0,3} (?:rue|avenue|boulevard|place|route|chemin|allée|impasse|quai|cours)\b)/giu, "$1, $2");
  return capitale(r);
}

/** Nature d'un lieu d'étape, d'après le mode qui y passe. */
export type TypeLieu = "arret" | "gare" | "station" | "depart" | "arrivee";

/** Train ⇒ gare ; métro, tram, funiculaire ⇒ station ; bus, car, bateau, TAD ⇒ arrêt. */
export function typeLieuDuMode(mode: string): TypeLieu {
  switch (mode) {
    case "train":
    case "train_banlieue":
      return "gare";
    case "metro":
    case "tram":
    case "remontee":
      return "station";
    default:
      return "arret";
  }
}
