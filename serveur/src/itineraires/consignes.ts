/**
 * Consignes de marche virage par virage (spec 11, D70, D71).
 * MOTIS reste la seule source du chemin : rues, distances et tracé viennent de ses `steps`.
 * Itinhero ne fait que traduire le tracé en manœuvres (MOTIS v2.11.4 dit `CONTINUE` presque partout).
 * Aucun nom de rue n'est inventé : un morceau sans nom donne `rue: null`.
 */

export type Coord = { lat: number; lon: number };

export type Manoeuvre =
  | "depart"
  | "tout_droit"
  | "legerement_gauche"
  | "gauche"
  | "demi_tour"
  | "legerement_droite"
  | "droite"
  | "escalier"
  | "ascenseur"
  | "arrivee";

export type Consigne = {
  manoeuvre: Manoeuvre;
  /** Nom OSM tel que rendu par MOTIS, sinon null. */
  rue: string | null;
  /** Distance jusqu'à la consigne suivante (0 pour l'arrivée). */
  distance_metres: number;
  /** Départ : direction cardinale (« nord-est »). */
  cap?: PointCardinal;
  /** Arrivée : de quel côté est le lieu. */
  cote_arrivee?: "gauche" | "droite" | "devant";
  /** Escalier, ascenseur : sens du changement de niveau, s'il est connu. */
  niveau?: "monter" | "descendre";
  lat: number;
  lon: number;
};

export type PointCardinal = "nord" | "nord-est" | "est" | "sud-est" | "sud" | "sud-ouest" | "ouest" | "nord-ouest";

/** Un `step` de MOTIS (openapi.yaml v2.11.4, `StepInstruction`), le sous-ensemble lu. */
export type Morceau = {
  distance: number;
  streetName?: string;
  relativeDirection?: string;
  polyline: { points: string; precision?: number };
  fromLevel?: number;
  toLevel?: number;
};

// ——— Seuils de D71 ———
export const MORCEAU_COURT_METRES = 10;
export const FENETRE_CAP_METRES = 15;
export const SEUIL_TOUT_DROIT = 25;
export const SEUIL_VIRAGE = 60;
export const SEUIL_DEMI_TOUR = 150;
/** Deux manœuvres à moins de 25 m l'une de l'autre n'en font qu'une (zigzag d'un trottoir, départ suivi d'un virage). */
export const MANOEUVRES_PROCHES_METRES = 25;

// ——— Tracés (encodage Google, précision 6 chez MOTIS) ———

export function decoderTrace(encode: string, precision = 6): Coord[] {
  const facteur = 10 ** precision;
  const points: Coord[] = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  const lireNombre = () => {
    let resultat = 0;
    let decalage = 0;
    let octet: number;
    do {
      octet = encode.charCodeAt(i++) - 63;
      resultat |= (octet & 0x1f) << decalage;
      decalage += 5;
    } while (octet >= 0x20);
    return resultat & 1 ? ~(resultat >> 1) : resultat >> 1;
  };
  while (i < encode.length) {
    lat += lireNombre();
    lon += lireNombre();
    points.push({ lat: lat / facteur, lon: lon / facteur });
  }
  return points;
}

export function encoderTrace(points: Coord[], precision = 6): string {
  const facteur = 10 ** precision;
  let sortie = "";
  let latAvant = 0;
  let lonAvant = 0;
  const ecrire = (valeur: number) => {
    let v = valeur < 0 ? ~(valeur << 1) : valeur << 1;
    while (v >= 0x20) {
      sortie += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    sortie += String.fromCharCode(v + 63);
  };
  for (const p of points) {
    const lat = Math.round(p.lat * facteur);
    const lon = Math.round(p.lon * facteur);
    ecrire(lat - latAvant);
    ecrire(lon - lonAvant);
    latAvant = lat;
    lonAvant = lon;
  }
  return sortie;
}

// ——— Géométrie ———

const RAYON_TERRE = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function distance(a: Coord, b: Coord): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAYON_TERRE * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Cap de a vers b, en degrés depuis le nord, de 0 à 360. */
export function cap(a: Coord, b: Coord): number {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Écart de cap signé, de −180 (gauche) à +180 (droite). */
export function ecartCap(avant: number, apres: number): number {
  return ((apres - avant + 540) % 360) - 180;
}

/** Ligne avec distances cumulées. */
type Ligne = { points: Coord[]; cumul: number[] };

function ligne(points: Coord[]): Ligne {
  const cumul = [0];
  for (let i = 1; i < points.length; i++) cumul.push(cumul[i - 1]! + distance(points[i - 1]!, points[i]!));
  return { points, cumul };
}

/** Point situé à `d` mètres du début de la ligne (interpolé, borné aux extrémités). */
function pointA(l: Ligne, d: number): Coord {
  const total = l.cumul[l.cumul.length - 1]!;
  if (d <= 0) return l.points[0]!;
  if (d >= total) return l.points[l.points.length - 1]!;
  let i = 1;
  while (l.cumul[i]! < d) i++;
  const a = l.points[i - 1]!;
  const b = l.points[i]!;
  const t = (d - l.cumul[i - 1]!) / (l.cumul[i]! - l.cumul[i - 1]! || 1);
  return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
}

export function pointCardinal(degres: number): PointCardinal {
  const noms: PointCardinal[] = ["nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest"];
  return noms[Math.round(degres / 45) % 8]!;
}

export function manoeuvreDuVirage(ecart: number): Manoeuvre {
  const a = Math.abs(ecart);
  if (a < SEUIL_TOUT_DROIT) return "tout_droit";
  if (a > SEUIL_DEMI_TOUR) return "demi_tour";
  if (a < SEUIL_VIRAGE) return ecart < 0 ? "legerement_gauche" : "legerement_droite";
  return ecart < 0 ? "gauche" : "droite";
}

/** Numéro de route : une lettre ou un sigle (A, N, D, M, RN, RD) suivi d'un nombre (« N 77 », « D 61A », « N033 »). */
export function estNumeroDeRoute(nom: string): boolean {
  return /^(A|N|D|M|RN|RD) ?\d+ ?[A-Za-z]?$/.test(nom.trim());
}

/** « N 77 » et « Avenue du 19 Mars 1962 », dans un ordre ou dans l'autre ⇒ « N 77 (Avenue du 19 Mars 1962) » ; sinon null. */
export function nomEtNumero(a: string | null, b: string | null): string | null {
  if (!a || !b) return null;
  if (estNumeroDeRoute(a) && !estNumeroDeRoute(b)) return `${a} (${b})`;
  if (estNumeroDeRoute(b) && !estNumeroDeRoute(a)) return `${b} (${a})`;
  return null;
}

// ——— Calcul des consignes (D71) ———

type Troncon = {
  rue: string | null;
  distance: number;
  points: Coord[];
  special: "escalier" | "ascenseur" | null;
  niveau?: "monter" | "descendre";
};

function troncons(morceaux: Morceau[]): Troncon[] {
  const tous: Troncon[] = morceaux.map((m) => {
    const special = m.relativeDirection === "STAIRS" ? "escalier" : m.relativeDirection === "ELEVATOR" ? "ascenseur" : null;
    const niveau =
      m.fromLevel !== undefined && m.toLevel !== undefined && m.fromLevel !== m.toLevel
        ? m.toLevel > m.fromLevel
          ? "monter"
          : "descendre"
        : undefined;
    return {
      rue: m.streetName?.trim() || null,
      distance: m.distance,
      points: decoderTrace(m.polyline.points, m.polyline.precision ?? 6),
      special: special ?? (niveau ? "escalier" : null),
      niveau,
    };
  });
  // 1. Un morceau de moins de 10 m (ni escalier ni ascenseur) est rattaché au suivant ; le dernier, au précédent.
  //    Sauf un bout de la rue qu'on suit juste avant une autre rue nommée : il reste un tronçon de sa rue, pour que
  //    le virage vers la rue suivante soit mesuré au vrai coin (issue 0014).
  const court = (t: Troncon) => t.distance < MORCEAU_COURT_METRES && !t.special;
  const rattaches: Troncon[] = [];
  let enAttente: Troncon | null = null;
  for (const [i, t] of tous.entries()) {
    const absorbe = enAttente !== null;
    if (enAttente) {
      t.points = [...enAttente.points, ...t.points];
      t.distance += enAttente.distance;
      enAttente = null;
    }
    const precedent = rattaches[rattaches.length - 1];
    if (court(t)) {
      const ensuite = tous.slice(i + 1).find((x) => !court(x));
      const avantRueNommee = ensuite !== undefined && ensuite.rue !== null && ensuite.rue !== t.rue;
      if (!absorbe && avantRueNommee && t.rue !== null && precedent && !precedent.special && precedent.rue === t.rue) rattaches.push(t);
      else enAttente = t;
    } else rattaches.push(t);
  }
  if (enAttente) {
    const dernier = rattaches[rattaches.length - 1];
    if (dernier) {
      dernier.points = [...dernier.points, ...enAttente.points];
      dernier.distance += enAttente.distance;
    } else rattaches.push(enAttente);
  }
  return rattaches;
}

/**
 * Consignes d'une marche, à partir des `steps` de MOTIS et du lieu d'arrivée.
 * Rend [] si MOTIS n'a donné aucun morceau.
 */
export function calculerConsignes(morceaux: Morceau[], arrivee: Coord): Consigne[] {
  const ts = troncons(morceaux).filter((t) => t.points.length > 0);
  if (ts.length === 0) return [];
  const points: Coord[] = [];
  const debuts: number[] = []; // distance cumulée où commence chaque tronçon, sur la géométrie
  for (const t of ts) {
    debuts.push(points.length === 0 ? 0 : -1);
    for (const p of t.points) {
      const dernier = points[points.length - 1];
      if (!dernier || dernier.lat !== p.lat || dernier.lon !== p.lon) points.push(p);
    }
  }
  const l = ligne(points);
  // Position de chaque début de tronçon sur la ligne : on cherche son premier point.
  let curseur = 0;
  ts.forEach((t, k) => {
    const premier = t.points[0]!;
    while (curseur < points.length - 1 && (points[curseur]!.lat !== premier.lat || points[curseur]!.lon !== premier.lon)) curseur++;
    debuts[k] = l.cumul[curseur] ?? 0;
  });

  const capEntrant = (d: number) => cap(pointA(l, d - FENETRE_CAP_METRES), pointA(l, d));
  const capSortant = (d: number) => cap(pointA(l, d), pointA(l, d + FENETRE_CAP_METRES));

  type Brouillon = Omit<Consigne, "distance_metres"> & {
    metres: number /* distance MOTIS depuis le départ */;
    d: number /* position sur la géométrie */;
    /** Second virage d'une paire gardée pour ne pas fabriquer un demi-tour : jamais retiré comme répétition. */
    paire?: true;
  };
  const brouillons: Brouillon[] = [];
  const depart = points[0]!;
  brouillons.push({
    manoeuvre: "depart",
    rue: ts[0]!.rue,
    cap: pointCardinal(capSortant(0)),
    lat: depart.lat,
    lon: depart.lon,
    metres: 0,
    d: 0,
  });

  let metres = ts[0]!.distance;
  // Noms de la voie suivie : un seul, ou le numéro et le nom d'une même route (issue 0014).
  let rueCourante = new Set<string | null>([ts[0]!.rue]);
  let nomVoie = ts[0]!.rue; // nom affiché de la voie suivie
  for (let k = 1; k < ts.length; k++) {
    const t = ts[k]!;
    const d = debuts[k]!;
    const p = pointA(l, d);
    let memeVoie = rueCourante.has(t.rue);
    if (t.special) {
      brouillons.push({ manoeuvre: t.special, rue: null, niveau: t.niveau, lat: p.lat, lon: p.lon, metres, d });
    } else {
      const ecart = ecartCap(capEntrant(d), capSortant(d));
      const m = manoeuvreDuVirage(ecart);
      const virage = m === "gauche" || m === "droite" || m === "demi_tour";
      const derniere = brouillons[brouillons.length - 1]!;
      if (!memeVoie && m === "tout_droit" && rueCourante.size === 1 && derniere.rue !== null && rueCourante.has(derniere.rue)) {
        // Tout droit d'un nom à un numéro de route, ou l'inverse : même route, la consigne précédente prend les deux.
        const deuxNoms = nomEtNumero(derniere.rue, t.rue);
        if (deuxNoms) {
          derniere.rue = deuxNoms;
          nomVoie = deuxNoms;
          rueCourante.add(t.rue);
          memeVoie = true;
        }
      }
      // Même rue (ou deux morceaux sans nom) : seul un vrai virage compte. Autre rue : dès 25°,
      // et « continuez » seulement vers une rue nommée.
      const garder = memeVoie ? virage : m !== "tout_droit" || t.rue !== null;
      if (garder) brouillons.push({ manoeuvre: m, rue: memeVoie ? nomVoie : t.rue, lat: p.lat, lon: p.lon, metres, d });
    }
    if (!memeVoie) {
      nomVoie = t.rue;
      rueCourante = new Set([t.rue]);
    }
    metres += t.distance;
  }

  // Arrivée : côté du lieu d'après le dernier cap.
  const fin = points[points.length - 1]!;
  const total = l.cumul[l.cumul.length - 1]!;
  const dernierCap = capEntrant(total);
  let cote: "gauche" | "droite" | "devant" = "devant";
  if (distance(fin, arrivee) >= 3) {
    const e = ecartCap(dernierCap, cap(fin, arrivee));
    if (Math.abs(e) > 30 && Math.abs(e) < 150) cote = e < 0 ? "gauche" : "droite";
  }
  brouillons.push({ manoeuvre: "arrivee", rue: null, cote_arrivee: cote, lat: fin.lat, lon: fin.lon, metres, d: total });

  // Manœuvres trop proches : un virage juste après le départ donne le départ (rue et cap pris après lui) ;
  // deux virages à moins de 25 m n'en font qu'un, mesuré avant le premier et après le second.
  const tourne = (b: Brouillon) => b.manoeuvre !== "depart" && b.manoeuvre !== "arrivee" && b.manoeuvre !== "escalier" && b.manoeuvre !== "ascenseur";
  for (let i = 0; i < brouillons.length - 1; ) {
    const a = brouillons[i]!;
    const b = brouillons[i + 1]!;
    if (!tourne(b) || b.metres - a.metres >= MANOEUVRES_PROCHES_METRES || !(a.manoeuvre === "depart" || tourne(a))) {
      i++;
      continue;
    }
    if (a.manoeuvre === "depart") {
      a.rue = a.rue ?? b.rue;
      a.cap = pointCardinal(capSortant(b.d));
      brouillons.splice(i + 1, 1);
      continue;
    }
    const m = manoeuvreDuVirage(ecartCap(capEntrant(a.d), capSortant(b.d)));
    if (m === "demi_tour") {
      // Deux virages proches qui, fondus, feraient un demi-tour (le tour d'un pâté de maisons) : on garde les deux (issue 0014).
      b.paire = true;
      i++;
      continue;
    }
    const avant = brouillons[i - 1]!;
    if (m === "tout_droit" && (b.rue === null || b.rue === avant.rue)) {
      brouillons.splice(i, 2); // zigzag sans effet : on continue
      i = Math.max(0, i - 1);
      continue;
    }
    brouillons.splice(i, 2, { ...a, manoeuvre: m, rue: b.rue });
  }

  // Aucune consigne ne répète la précédente (même manœuvre, même rue).
  const uniques = brouillons.filter((b, i) => {
    const avant = brouillons[i - 1];
    return !avant || i === brouillons.length - 1 || b.paire || b.manoeuvre !== avant.manoeuvre || b.rue !== avant.rue || b.manoeuvre === "depart";
  });
  return uniques.map((b, i) => {
    const suivante = uniques[i + 1];
    const { metres: m, d: _d, paire: _p, ...reste } = b;
    return { ...reste, distance_metres: suivante ? Math.round(suivante.metres - m) : 0 };
  });
}
