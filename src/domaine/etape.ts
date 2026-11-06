import type { ArretCourse, Etape, Point } from "./api";
import { decoderTrace, distance } from "./geo";
import { directionEtape, distanceADire, formaterDistance, formaterDuree, libelleEtape, nomLieuEtape, nomLieuVehicule, vientVousChercher } from "./resultat";

// Fenêtre d'une étape (spec 17) : en-tête, arrêts du trajet, positions du panneau du bas.

/** En-tête du panneau : « Marche 5 min » / « Bus K941 », la direction, puis « 06:17 → 06:22 · 5 min · 310 m ». */
export function enteteEtape(e: Etape): { titre: string; direction: string | null; horaire: string } {
  const marche = e.mode === "marche";
  const distance = marche && distanceADire(e.distance_metres) ? ` · ${formaterDistance(e.distance_metres)}` : "";
  return {
    titre: marche ? "Marche" : libelleEtape(e).replace(/ \d+ min$/, ""),
    direction: marche ? null : directionEtape(e),
    horaire: `${e.depart} → ${e.arrivee} · ${formaterDuree(e.duree_minutes)}${distance}`,
  };
}

export type ArretTrajet = Point & {
  nom: string;
  heure: string | null;
  role: "montee" | "intermediaire" | "descente";
};

/** Un point à 0,0 est un arrêt sans coordonnées (issue 0019) : jamais posé sur la carte. */
const place = (p: Point) => !(p.lat === 0 && p.lon === 0);

/**
 * Arrêts d'une étape en véhicule, de la montée à la descente, chacun avec son heure (spec 17, §4.2).
 * Rien pour la marche, ni pour un taxi qui vient vous chercher (il n'a pas d'arrêts).
 */
export function arretsDuTrajet(e: Etape): ArretTrajet[] {
  if (e.mode === "marche" || vientVousChercher(e)) return [];
  const intermediaires: ArretTrajet[] = (e.arrets ?? [])
    .filter(place)
    .map((a) => ({ lat: a.lat, lon: a.lon, nom: a.nom, heure: a.passage, role: "intermediaire" }));
  return [
    { lat: e.de.lat, lon: e.de.lon, nom: nomLieuVehicule(e, e.de), heure: e.depart, role: "montee" as const },
    ...intermediaires,
    { lat: e.a.lat, lon: e.a.lon, nom: nomLieuVehicule(e, e.a), heure: e.arrivee, role: "descente" as const },
  ].filter(place);
}

/** Points à cadrer sur la carte : le tracé, sinon le départ et l'arrivée (sans les 0,0). */
export function pointsEtape(e: Etape): Point[] {
  const trace = e.trace ? decoderTrace(e.trace) : [];
  if (trace.length >= 2) return trace;
  return [e.de, e.a].filter(place).map((p) => ({ lat: p.lat, lon: p.lon }));
}

/** Nom du lieu où mène une marche (« arrêt Mairie ») : pour l'étiquette de la carte. */
export function finMarche(e: Etape, suivante?: Etape): string {
  return suivante ? nomLieuVehicule(suivante, e.a) : nomLieuEtape(e.a);
}

export type PositionPanneau = "repliee" | "milieu" | "depliee";

/**
 * Hauteur visible du panneau dans chaque position (dp) : replié, seul l'en-tête reste ;
 * à mi-hauteur, 45 % de l'écran ; déplié, 85 % (D85).
 */
export function hauteursPanneau(hauteurEcran: number, hauteurEntete: number): Record<PositionPanneau, number> {
  const repliee = Math.round(hauteurEntete);
  const milieu = Math.max(repliee + 120, Math.round(hauteurEcran * 0.45));
  const depliee = Math.max(milieu + 80, Math.round(hauteurEcran * 0.85));
  return { repliee, milieu, depliee };
}

/** Toucher la poignée : replié ⇒ milieu ⇒ déplié ⇒ replié. */
export function positionSuivante(p: PositionPanneau): PositionPanneau {
  return p === "repliee" ? "milieu" : p === "milieu" ? "depliee" : "repliee";
}

/** Vitesse (dp/s) au-delà de laquelle un glissement va à la position suivante dans son sens. */
const LANCER = 800;

/**
 * Position où se pose le panneau lâché à la hauteur `visible` avec la vitesse `vy`
 * (positive vers le bas, comme le doigt) : un geste vif va dans son sens, sinon la plus proche.
 */
export function positionLachee(visible: number, vy: number, h: Record<PositionPanneau, number>): PositionPanneau {
  const ordre: PositionPanneau[] = ["repliee", "milieu", "depliee"];
  if (Math.abs(vy) > LANCER) {
    if (vy < 0) return ordre.find((p) => h[p] > visible + 1) ?? "depliee";
    return [...ordre].reverse().find((p) => h[p] < visible - 1) ?? "repliee";
  }
  return ordre.reduce((a, b) => (Math.abs(h[b] - visible) < Math.abs(h[a] - visible) ? b : a));
}

export type ArretDeLaCourse = Point & {
  nom: string;
  heure: string | null;
  /** Avant la montée, sur le trajet (montée, intermédiaire, descente), ou après la descente. */
  role: "avant" | ArretTrajet["role"] | "apres";
};

/** Un arrêt de la course est celui de l'étape s'il est à moins de 300 m (quais d'une même gare). */
const MEME_ARRET_METRES = 300;

/**
 * Tous les arrêts de la course (spec 17, D87), avec la montée et la descente de l'étape repérées :
 * la montée est l'arrêt le plus proche du départ de l'étape, la descente le plus proche de son arrivée, après elle.
 * Sans montée ou descente reconnue (course d'un autre jour, arrêts manquants) ⇒ null : on garde les arrêts de l'étape.
 */
export function arretsDeLaCourse(e: Etape, course: ArretCourse[]): ArretDeLaCourse[] | null {
  const plusProche = (cible: Point, depuis: number) => {
    let meilleur = -1;
    let d = MEME_ARRET_METRES;
    course.forEach((a, i) => {
      if (i < depuis) return;
      const x = distance(a, cible);
      if (x <= d) {
        d = x;
        meilleur = i;
      }
    });
    return meilleur;
  };
  const m = plusProche(e.de, 0);
  if (m < 0) return null;
  const d = plusProche(e.a, m + 1);
  if (d < 0) return null;
  return course.map((a, i) => ({
    lat: a.lat,
    lon: a.lon,
    // La montée et la descente gardent le nom et l'heure de l'étape : les mêmes que dans le Résultat.
    nom: i === m ? nomLieuVehicule(e, e.de) : i === d ? nomLieuVehicule(e, e.a) : a.nom,
    heure: i === m ? e.depart : i === d ? e.arrivee : a.passage,
    role: i < m ? "avant" : i === m ? "montee" : i < d ? "intermediaire" : i === d ? "descente" : "apres",
  }));
}
