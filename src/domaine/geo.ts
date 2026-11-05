import type { Point } from "./api";

// Géométrie des tracés (spec 11 et 12) : pur TypeScript, testé sous Node.

/** Tracé encodé (Google, précision 6, celui de MOTIS) ⇒ points. */
export function decoderTrace(encode: string, precision = 6): Point[] {
  const facteur = 10 ** precision;
  const points: Point[] = [];
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

const RAYON_TERRE = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function distance(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAYON_TERRE * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Cap de a vers b, en degrés depuis le nord (0 à 360). */
export function cap(a: Point, b: Point): number {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Ligne avec ses distances cumulées depuis le début. */
export type Ligne = { points: Point[]; cumul: number[]; longueur: number };

export function ligne(points: Point[]): Ligne {
  const cumul = [0];
  for (let i = 1; i < points.length; i++) cumul.push(cumul[i - 1]! + distance(points[i - 1]!, points[i]!));
  return { points, cumul, longueur: cumul[cumul.length - 1] ?? 0 };
}

/** Point à `d` mètres du début (interpolé, borné aux extrémités). */
export function pointA(l: Ligne, d: number): Point {
  if (l.points.length === 0) throw new Error("ligne vide");
  if (d <= 0) return l.points[0]!;
  if (d >= l.longueur) return l.points[l.points.length - 1]!;
  let i = 1;
  while (l.cumul[i]! < d) i++;
  const a = l.points[i - 1]!;
  const b = l.points[i]!;
  const t = (d - l.cumul[i - 1]!) / (l.cumul[i]! - l.cumul[i - 1]! || 1);
  return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
}

/** Projection d'un point sur la ligne : point le plus proche, son abscisse (m depuis le début) et l'écart (m). */
export type Projection = { point: Point; abscisse: number; ecart: number };

export function projeter(l: Ligne, p: Point): Projection {
  if (l.points.length === 1) return { point: l.points[0]!, abscisse: 0, ecart: distance(l.points[0]!, p) };
  // Plan local (équirectangulaire) autour du point : assez juste à l'échelle d'une rue.
  const kx = Math.cos(rad(p.lat)) * rad(1) * RAYON_TERRE;
  const ky = rad(1) * RAYON_TERRE;
  let meilleure: Projection = { point: l.points[0]!, abscisse: 0, ecart: Infinity };
  for (let i = 1; i < l.points.length; i++) {
    const a = l.points[i - 1]!;
    const b = l.points[i]!;
    const ax = (a.lon - p.lon) * kx;
    const ay = (a.lat - p.lat) * ky;
    const bx = (b.lon - p.lon) * kx;
    const by = (b.lat - p.lat) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const n = dx * dx + dy * dy;
    const t = n === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / n));
    const x = ax + t * dx;
    const y = ay + t * dy;
    const ecart = Math.hypot(x, y);
    if (ecart < meilleure.ecart) {
      const point = { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
      meilleure = { point, abscisse: l.cumul[i - 1]! + (l.cumul[i]! - l.cumul[i - 1]!) * t, ecart };
    }
  }
  return meilleure;
}

/** Portion de la ligne entre deux abscisses. */
export function portion(l: Ligne, de: number, a: number): Point[] {
  if (l.points.length === 0 || a <= de) return [];
  const pts = [pointA(l, de)];
  for (let i = 0; i < l.points.length; i++) if (l.cumul[i]! > de && l.cumul[i]! < a) pts.push(l.points[i]!);
  pts.push(pointA(l, a));
  return pts;
}

/** Boîte englobante [ouest, sud, est, nord]. */
export function boite(points: Point[]): [number, number, number, number] {
  let o = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const p of points) {
    o = Math.min(o, p.lon);
    e = Math.max(e, p.lon);
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
  }
  return [o, s, e, n];
}
