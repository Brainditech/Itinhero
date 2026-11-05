import type { Consigne, Etape, Point, Possibilite } from "./api";
import { phraseConsigne } from "./consignes";
import { cap, decoderTrace, distance, ligne, pointA, projeter, projeterEnAvancant, type Ligne } from "./geo";
import { formaterDistance, libelleEtape, nomLieuEtape } from "./resultat";

// Guidage en direct (spec 12, §4.4) : pur TypeScript, sans Expo, testé sous Node.
// La position et l'heure entrent ; l'écran à montrer et les phrases à dire sortent. Rien n'est gardé.

// ——— Seuils (D75 et §4.4) ———
/** Écart au tracé au-delà duquel on s'éloigne du chemin (D75). */
export const ECART_METRES = 40;
/** Durée de l'écart avant l'alerte (D75). */
export const ECART_DUREE_MS = 15_000;
/** Annonces d'une manœuvre de marche : à 150 m, à 40 m, et au point de manœuvre. */
export const SEUILS_ANNONCE = [150, 40, 10] as const;
/** Fin d'une marche : à moins de 15 m du bout du tracé. */
export const FIN_MARCHE_METRES = 15;
/** Descente détectée à moins de 50 m de l'arrêt (§4.3). */
export const DESCENTE_METRES = 50;
/** « Vous êtes à l'arrêt » à moins de 50 m de l'arrêt de montée. */
export const A_L_ARRET_METRES = 50;
/** Dans le véhicule dès qu'on a avancé de 80 m sur le tracé de la ligne. */
export const A_BORD_METRES = 80;
/** Vitesse de marche quand l'étape ne donne pas la sienne (m/s, 4,3 km/h). */
export const VITESSE_MARCHE = 1.2;

// ——— Préparation du parcours ———

export type ConsigneSituee = { consigne: Consigne; abscisse: number; index: number };
export type ArretSitue = { nom: string; passage: string | null; point: Point; abscisse: number; descente: boolean };

export type EtapeGuidee = {
  etape: Etape;
  ligne: Ligne;
  departMs: number;
  arriveeMs: number;
  consignes: ConsigneSituee[];
  /** Arrêts après la montée, descente comprise (véhicule seulement). */
  arrets: ArretSitue[];
};

export type Parcours = { possibilite: Possibilite; etapes: EtapeGuidee[]; arriveeMs: number };

const enMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * Instant d'une heure « HH:MM » du trajet, comptée depuis le départ de la possibilité : de 3 h avant
 * à 21 h après (un trajet qui passe minuit garde ses heures du lendemain).
 */
export function instantDuTrajet(p: Possibilite, hhmm: string): number {
  const base = Date.parse(p.depart_utc);
  const ecart = ((((enMinutes(hhmm) - enMinutes(p.depart)) % 1440) + 1440 + 180) % 1440) - 180;
  return base + ecart * 60_000;
}

/** Arrêts dans l'ordre de passage : chacun est cherché après le précédent. */
function situerArrets(l: Ligne, arrets: NonNullable<Etape["arrets"]>): ArretSitue[] {
  let depuis = 0;
  return arrets.map((a) => {
    const abscisse = projeterEnAvancant(l, a, depuis).abscisse;
    depuis = abscisse;
    return { nom: a.nom, passage: a.passage, point: { lat: a.lat, lon: a.lon }, abscisse, descente: false };
  });
}

export function preparer(p: Possibilite): Parcours {
  const etapes = p.etapes.map((e): EtapeGuidee => {
    const points = e.trace ? decoderTrace(e.trace) : [];
    const l = ligne(points.length >= 2 ? points : [{ lat: e.de.lat, lon: e.de.lon }, { lat: e.a.lat, lon: e.a.lon }]);
    const departMs = e.depart_utc ? Date.parse(e.depart_utc) : instantDuTrajet(p, e.depart);
    const arriveeMs = e.arrivee_utc ? Date.parse(e.arrivee_utc) : instantDuTrajet(p, e.arrivee);
    const consignes = (e.consignes ?? []).map((c, index) => ({
      consigne: c,
      index,
      abscisse: c.manoeuvre === "arrivee" ? l.longueur : projeter(l, c).abscisse,
    }));
    const arrets: ArretSitue[] =
      e.mode === "marche"
        ? []
        : [
            ...situerArrets(l, e.arrets ?? []),
            { nom: e.a.nom, passage: e.arrivee, point: { lat: e.a.lat, lon: e.a.lon }, abscisse: l.longueur, descente: true },
          ];
    return { etape: e, ligne: l, departMs, arriveeMs, consignes, arrets };
  });
  return { possibilite: p, etapes, arriveeMs: Date.parse(p.arrivee_utc) };
}

// ——— État ———

export type EtatGuidage = {
  /** Étape en cours. */
  etape: number;
  /** Depuis quand on est à plus de 40 m du tracé (ms), sinon null. */
  horsCheminDepuis: number | null;
  /** Annonces déjà faites (clés). */
  annonces: string[];
  /** Montée constatée dans le véhicule de l'étape en cours. */
  aBord: boolean;
  /** Dernière abscisse connue sur le tracé de l'étape (m) : la position avance le long du tracé. */
  abscisse: number;
};

export const ETAT_INITIAL: EtatGuidage = { etape: 0, horsCheminDepuis: null, annonces: [], aBord: false, abscisse: 0 };

/** Recul permis sur le tracé (m) : à pied on peut revenir sur ses pas, un véhicule non. */
const RECUL_MARCHE_METRES = 100;
const RECUL_VEHICULE_METRES = 30;

/**
 * Position ramenée sur le tracé en avançant : on cherche après la dernière abscisse (moins un recul),
 * sauf si le tracé entier passe nettement plus près (raccourci, demi-tour).
 */
function suivre(l: Ligne, p: Point, derniere: number, recul: number, tolerance: number) {
  const devant = projeterEnAvancant(l, p, Math.max(0, derniere - recul), tolerance);
  const partout = projeter(l, p);
  return partout.ecart + 20 < devant.ecart ? partout : devant;
}

/** « Je suis descendu » (§4.3) : passage à l'étape suivante. */
export function descendu(etat: EtatGuidage): EtatGuidage {
  return { ...etat, etape: etat.etape + 1, aBord: false, horsCheminDepuis: null, abscisse: 0 };
}

// ——— Ce que l'écran montre ———

export type Statut =
  | { type: "avance"; minutes: number }
  | { type: "a_l_heure" }
  | { type: "presse"; vehicule: string; minutes: number }
  | { type: "retard"; minutes: number };

export type Ecart = { metres: number; vers: Point };

export type Vue =
  | {
      type: "marche";
      prochaine: ConsigneSituee;
      distance: number;
      suivante: ConsigneSituee | null;
      restanteMetres: number;
      restanteMinutes: number;
      statut: Statut;
      destination: string;
    }
  | {
      type: "attente";
      minutes: number;
      aLArret: boolean;
      distanceArret: number | null;
    }
  | { type: "vehicule"; restants: ArretSitue[] }
  | { type: "descente"; descente: ArretSitue; ensuite: string }
  | { type: "fin" };

export type Situation = {
  etat: EtatGuidage;
  vue: Vue;
  /** Étape guidée (absente à la fin). */
  courante: EtapeGuidee | null;
  /** Position ramenée sur le tracé de l'étape (abscisse en m), ou null. */
  abscisse: number | null;
  /** Cap de la carte : sens du tracé devant la position (degrés). */
  cap: number | null;
  ecart: Ecart | null;
  /** Phrases à dire maintenant (voix, D74). */
  annonces: string[];
  /** Vibrer maintenant (descente imminente). */
  vibrer: boolean;
  /** Minutes jusqu'à l'arrivée prévue. */
  minutesRestantes: number;
};

/** « 6 min », « 1 h 05 ». */
export function minutesEnTexte(m: number): string {
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

/** « bus 803 », « TER K7 » : minuscule sauf les sigles. */
export function vehiculeMinuscule(e: Etape): string {
  const l = libelleEtape(e);
  return /^[A-Z]{2,}/.test(l) ? l : l.charAt(0).toLowerCase() + l.slice(1);
}

/** « Bus », « Car », « Train », « TER » : premier mot du libellé. */
export function vehiculeCourt(e: Etape): string {
  return libelleEtape(e).split(" ")[0]!;
}

function statutMarche(parcours: Parcours, k: number, restante: number, maintenant: number): Statut {
  const g = parcours.etapes[k]!;
  const e = g.etape;
  const vitesse = e.distance_metres && e.duree_minutes > 0 ? e.distance_metres / (e.duree_minutes * 60) : VITESSE_MARCHE;
  const marcheMs = (restante / vitesse) * 1000;
  const suivante = parcours.etapes[k + 1];
  const vehicule = suivante && suivante.etape.mode !== "marche" ? suivante : null;
  const reference = vehicule ? vehicule.departMs : g.arriveeMs;
  const marge = (reference - maintenant - marcheMs) / 60_000;
  if (marge >= 1) return { type: "avance", minutes: Math.floor(marge) };
  if (marge > -1) return { type: "a_l_heure" };
  if (vehicule) {
    return { type: "presse", vehicule: vehiculeMinuscule(vehicule.etape), minutes: Math.max(0, Math.ceil((vehicule.departMs - maintenant) / 60_000)) };
  }
  return { type: "retard", minutes: Math.ceil(-marge) };
}

function capDevant(l: Ligne, abscisse: number): number {
  const a = pointA(l, Math.max(0, Math.min(abscisse, l.longueur - 1)));
  const b = pointA(l, Math.min(l.longueur, abscisse + 25));
  return distance(a, b) < 1 ? cap(pointA(l, Math.max(0, l.longueur - 25)), pointA(l, l.longueur)) : cap(a, b);
}

/** « Ensuite : 7 min à pied jusqu'au tribunal », après une descente. */
function phraseEnsuite(parcours: Parcours, k: number): string {
  const suivante = parcours.etapes[k + 1]?.etape;
  if (!suivante) return "Ensuite : vous êtes arrivé";
  if (suivante.mode === "marche") return `Ensuite : ${suivante.duree_minutes} min à pied jusqu'${aLieu(nomLieuEtape(suivante.a))}`;
  return `Ensuite : ${vehiculeMinuscule(suivante)} à ${suivante.depart}`;
}

/** Phrase d'annonce d'une manœuvre selon la distance. */
export function phraseAnnonce(c: Consigne, metres: number, destination: string): string {
  const p = phraseConsigne(c, destination);
  if (metres <= SEUILS_ANNONCE[2]) return p;
  if (c.manoeuvre === "arrivee") return `Dans ${formaterDistance(metres)}, arrivée à ${destination}`;
  return `Dans ${formaterDistance(metres)}, ${p.charAt(0).toLowerCase()}${p.slice(1)}`;
}

/**
 * Situation du guidage à l'instant `maintenant`, à la position donnée (null : position inconnue).
 * Avance d'étape toute seule : fin de marche, montée puis descente du véhicule.
 */
export function situer(parcours: Parcours, etat0: EtatGuidage, position: Point | null, maintenant: number): Situation {
  let etat = { ...etat0, annonces: [...etat0.annonces] };
  const annonces: string[] = [];
  let vibrer = false;
  const minutesRestantes = Math.max(0, Math.ceil((parcours.arriveeMs - maintenant) / 60_000));
  const dire = (cle: string, phrase: string) => {
    if (etat.annonces.includes(cle)) return;
    etat.annonces.push(cle);
    annonces.push(phrase);
  };

  // Au plus une étape franchie par appel et par étape : on boucle tant que l'étape change.
  for (let garde = 0; garde < parcours.etapes.length + 1; garde++) {
    const k = etat.etape;
    const g = parcours.etapes[k];
    if (!g) {
      dire("fin", "Vous êtes arrivé");
      return { etat, vue: { type: "fin" }, courante: null, abscisse: null, cap: null, ecart: null, annonces, vibrer, minutesRestantes };
    }
    const recul = g.etape.mode === "marche" ? RECUL_MARCHE_METRES : RECUL_VEHICULE_METRES;
    // Un véhicule repasse parfois par la même rue (aller-retour à un arrêt) : on reste sur l'aller.
    const tolerance = g.etape.mode === "marche" ? 3 : 15;
    const proj = position ? suivre(g.ligne, position, etat.abscisse, recul, tolerance) : null;
    if (proj && proj.ecart <= ECART_METRES * 3) etat = { ...etat, abscisse: proj.abscisse };
    const e = g.etape;

    if (e.mode === "marche") {
      const abscisse = proj?.abscisse ?? 0;
      const restante = Math.max(0, g.ligne.longueur - abscisse);
      if (proj && restante < FIN_MARCHE_METRES) {
        const derniere = g.consignes[g.consignes.length - 1];
        if (derniere) dire(`${k}:${derniere.index}:arrivee`, phraseConsigne(derniere.consigne, nomLieuEtape(e.a)));
        etat = { ...etat, etape: k + 1, aBord: false, horsCheminDepuis: null, abscisse: 0 };
        continue;
      }
      // Écart au chemin (D75).
      let ecart: Ecart | null = null;
      if (proj && proj.ecart > ECART_METRES) {
        const depuis = etat.horsCheminDepuis ?? maintenant;
        etat = { ...etat, horsCheminDepuis: depuis };
        if (maintenant - depuis >= ECART_DUREE_MS) {
          ecart = { metres: proj.ecart, vers: proj.point };
          dire(`${k}:ecart:${depuis}`, "Vous vous éloignez du chemin");
        }
      } else if (etat.horsCheminDepuis !== null) {
        etat = { ...etat, horsCheminDepuis: null };
      }
      const destination = nomLieuEtape(e.a);
      const apres = g.consignes.filter((c) => c.consigne.manoeuvre !== "depart" && c.abscisse > abscisse + 3);
      const fin: ConsigneSituee = g.consignes[g.consignes.length - 1] ?? {
        consigne: { manoeuvre: "arrivee", rue: null, distance_metres: 0, lat: e.a.lat, lon: e.a.lon, cote_arrivee: "devant" },
        abscisse: g.ligne.longueur,
        index: 0,
      };
      // Avant d'avoir bougé, la première consigne est le départ.
      const prochaine = abscisse < 3 && g.consignes[0] && !proj ? g.consignes[0] : (apres[0] ?? fin);
      const distanceProchaine = Math.max(0, prochaine.abscisse - abscisse);
      if (proj && !ecart) {
        // Seul le plus petit seuil franchi est annoncé ; les plus grands sont réputés faits.
        const franchis = SEUILS_ANNONCE.filter((s) => distanceProchaine <= s);
        const plusPetit = franchis[franchis.length - 1];
        if (plusPetit !== undefined) {
          for (const s of franchis.slice(0, -1)) {
            const cle = `${k}:${prochaine.index}:${s}`;
            if (!etat.annonces.includes(cle)) etat.annonces.push(cle);
          }
          if (prochaine.consigne.manoeuvre !== "arrivee" || plusPetit > SEUILS_ANNONCE[2]) {
            dire(`${k}:${prochaine.index}:${plusPetit}`, phraseAnnonce(prochaine.consigne, distanceProchaine, destination));
          }
        }
      }
      const suivante = apres.find((c) => c.abscisse > prochaine.abscisse) ?? null;
      const vitesse = e.distance_metres && e.duree_minutes > 0 ? e.distance_metres / (e.duree_minutes * 60) : VITESSE_MARCHE;
      return {
        etat,
        vue: {
          type: "marche",
          prochaine,
          distance: distanceProchaine,
          suivante: suivante && suivante.consigne.manoeuvre !== "arrivee" ? suivante : null,
          restanteMetres: restante,
          restanteMinutes: Math.max(1, Math.ceil(restante / vitesse / 60)),
          statut: statutMarche(parcours, k, restante, maintenant),
          destination,
        },
        courante: g,
        abscisse,
        cap: capDevant(g.ligne, abscisse),
        ecart,
        annonces,
        vibrer,
        minutesRestantes,
      };
    }

    // Étape en véhicule (§4.3).
    const avance = proj && proj.ecart < 150 ? proj.abscisse : 0;
    const aBord = etat.aBord || avance > A_BORD_METRES || maintenant > g.departMs + 2 * 60_000;
    if (aBord !== etat.aBord) etat = { ...etat, aBord };
    if (!aBord) {
      const distanceArret = position ? distance(position, { lat: e.de.lat, lon: e.de.lon }) : null;
      return {
        etat,
        vue: {
          type: "attente",
          minutes: Math.max(0, Math.ceil((g.departMs - maintenant) / 60_000)),
          aLArret: distanceArret !== null && distanceArret <= A_L_ARRET_METRES,
          distanceArret,
        },
        courante: g,
        abscisse: 0,
        cap: capDevant(g.ligne, 0),
        ecart: null,
        annonces,
        vibrer,
        minutesRestantes,
      };
    }
    const descente = g.arrets[g.arrets.length - 1]!;
    if (position && distance(position, descente.point) < DESCENTE_METRES && (proj?.abscisse ?? 0) > g.ligne.longueur / 2) {
      etat = { ...etat, etape: k + 1, aBord: false, horsCheminDepuis: null, abscisse: 0 };
      continue;
    }
    // Arrêts passés : d'après la position si on l'a, sinon d'après l'heure prévue.
    const restants = g.arrets.filter((a) =>
      proj ? a.abscisse > proj.abscisse + 30 || a.descente : a.descente || a.passage === null || instantDuTrajet(parcours.possibilite, a.passage) > maintenant,
    );
    const abscisse = proj?.abscisse ?? null;
    const capVehicule = capDevant(g.ligne, abscisse ?? 0);
    if (restants.length <= 1) {
      dire(`${k}:descente`, `Descendez au prochain arrêt : ${descente.nom}`);
      if (!etat0.annonces.includes(`${k}:descente`)) vibrer = true;
      return {
        etat,
        vue: { type: "descente", descente, ensuite: phraseEnsuite(parcours, k) },
        courante: g,
        abscisse,
        cap: capVehicule,
        ecart: null,
        annonces,
        vibrer,
        minutesRestantes,
      };
    }
    return { etat, vue: { type: "vehicule", restants }, courante: g, abscisse, cap: capVehicule, ecart: null, annonces, vibrer, minutesRestantes };
  }
  return { etat, vue: { type: "fin" }, courante: null, abscisse: null, cap: null, ecart: null, annonces, vibrer, minutesRestantes };
}

/** « à l'arrêt Mairie », « à la gare de Dijon », « à Tribunal administratif de Dijon ». */
export function aLieu(destination: string): string {
  const m = /^(arrêt|gare|station) /.exec(destination);
  if (!m) return `à ${destination}`;
  return m[1] === "arrêt" ? `à l'${destination}` : `à la ${destination}`;
}

/** « Jusqu'à l'arrêt Mairie », « Jusqu'à la gare de Dijon ». */
export function jusqua(destination: string): string {
  return `Jusqu'${aLieu(destination)}`;
}

/** Texte du statut horaire, en bas de l'écran (§4.2). */
export function phraseStatut(s: Statut): string {
  switch (s.type) {
    case "avance":
      return `En avance de ${s.minutes} min`;
    case "a_l_heure":
      return "À l'heure";
    case "presse":
      return s.minutes > 0 ? `Pressez le pas : ${s.vehicule} dans ${s.minutes} min` : `Pressez le pas : ${s.vehicule} maintenant`;
    case "retard":
      return `En retard de ${s.minutes} min`;
  }
}

/**
 * Position simulée (développement seulement, pour les captures et les essais) : à `metres` du début
 * du tracé de l'étape `k`, décalée de `ecart` mètres sur la droite du chemin.
 */
export function positionSimulee(parcours: Parcours, k: number, metres: number, ecart = 0): Point | null {
  const g = parcours.etapes[k];
  if (!g) return null;
  const p = pointA(g.ligne, metres);
  if (!ecart) return p;
  const c = ((capDevant(g.ligne, metres) + 90) * Math.PI) / 180;
  const dLat = (ecart * Math.cos(c)) / 111_320;
  const dLon = (ecart * Math.sin(c)) / (111_320 * Math.cos((p.lat * Math.PI) / 180));
  return { lat: p.lat + dLat, lon: p.lon + dLon };
}
