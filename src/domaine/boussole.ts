// Boussole de la fenêtre d'étape (spec 17, D88) : calculs purs, sans capteur.

/** Ramène un angle dans [0, 360). */
function normaliser(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Cap du téléphone à afficher : le nord vrai, sinon le nord magnétique (expo-location donne -1 au nord vrai
 * quand il ne peut pas le calculer), sinon null (capteur absent ou valeur invalide).
 */
export function capBoussole(lecture: { trueHeading: number; magHeading: number }): number | null {
  const { trueHeading, magHeading } = lecture;
  if (Number.isFinite(trueHeading) && trueHeading >= 0) return normaliser(trueHeading);
  if (Number.isFinite(magHeading) && magHeading >= 0) return normaliser(magHeading);
  return null;
}

/**
 * Cap tiré du capteur fusionné (gyroscope + boussole, `TYPE_ROTATION_VECTOR`) d'expo-sensors 58.0.4 :
 * `rotation.alpha` y vaut l'opposé de l'azimut, en radians, par rapport au nord magnétique. La déclinaison
 * (nord vrai − nord magnétique, ~2,6° dans l'Yonne) le ramène au nord vrai ; 0 quand on ne la connaît pas.
 */
export function capFusionne(alpha: number, declinaison = 0): number | null {
  if (!Number.isFinite(alpha)) return null;
  return normaliser((-alpha * 180) / Math.PI + declinaison);
}

/** Déclinaison lue sur un relevé d'expo-location (nord vrai − magnétique), ou 0 sans nord vrai. */
export function declinaison(lecture: { trueHeading: number; magHeading: number }): number {
  if (!(lecture.trueHeading >= 0) || !(lecture.magHeading >= 0)) return 0;
  return ecart(lecture.trueHeading, lecture.magHeading);
}

const DIRECTIONS = ["nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest"] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** Direction à laquelle on fait face, parmi huit (secteurs de 45° centrés sur chaque direction). */
export function directionCardinale(cap: number): Direction {
  return DIRECTIONS[Math.round(normaliser(cap) / 45) % 8]!;
}

/** Écart signé de `a` à `b`, dans [-180, 180). */
function ecart(a: number, b: number): number {
  return normaliser(a - b + 180) - 180;
}

/** Nombre de relevés gardés pour la médiane : écarte une pointe isolée du magnétomètre. */
export const FENETRE_MEDIANE = 7;
/** Part du nouveau relevé dans le cap lissé (0 à 1) : plus petit, plus calme mais plus lent. */
export const LISSAGE = 0.4;

export type FiltreCap = { fenetre: number[]; lisse: number | null };
export const FILTRE_VIDE: FiltreCap = { fenetre: [], lisse: null };

/** Médiane d'angles : celui dont la somme des écarts aux autres est la plus petite (sans saut à 0/360). */
export function medianeCirculaire(caps: number[]): number {
  let meilleur = caps[0]!;
  let somme = Infinity;
  for (const c of caps) {
    const s = caps.reduce((t, d) => t + Math.abs(ecart(c, d)), 0);
    if (s < somme) {
      somme = s;
      meilleur = c;
    }
  }
  return meilleur;
}

/**
 * Filtre du cap brut d'expo-location, qui tremble de ±10 à 20° téléphone immobile, avec des pointes isolées
 * (mesuré le 2026-11-05, spec 17 §9) : médiane des derniers relevés, puis lissage exponentiel sur le cercle.
 * Réglage choisi en rejouant 60 s enregistrées téléphone immobile : pire écart 3° (au lieu de 24°), un quart de
 * tour suivi à 5° près en ~1,8 s (relevés à 5 par seconde).
 */
export function filtrerCap(etat: FiltreCap, cap: number): FiltreCap {
  const fenetre = [...etat.fenetre, normaliser(cap)].slice(-FENETRE_MEDIANE);
  const mediane = medianeCirculaire(fenetre);
  const lisse = etat.lisse === null ? mediane : normaliser(etat.lisse + LISSAGE * ecart(mediane, etat.lisse));
  return { fenetre, lisse };
}

/**
 * Angle de la rose (en degrés, sens horaire) pour que son N pointe vers le nord quand le téléphone fait face à
 * `cap`. Part de l'angle précédent et prend le chemin le plus court : de 350° à 10°, la rose passe par le nord.
 * L'angle n'est pas ramené dans [0, 360) : l'animation ne fait jamais de tour complet en arrière.
 */
export function rotationSuivante(precedente: number, cap: number): number {
  const cible = -cap;
  const ecart = normaliser(cible - precedente + 180) - 180;
  return precedente + ecart;
}
