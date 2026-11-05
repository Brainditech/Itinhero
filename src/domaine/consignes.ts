import type { Consigne, Etape, Manoeuvre } from "./api";
import { formaterDistance, nomLieuEtape } from "./resultat";

// Phrases des consignes de marche (spec 11, §4.2). Le nom de rue vient tel quel de MOTIS (OSM) :
// aucun nom n'est inventé ; sans nom, la phrase dit « le chemin ».

/** Mots qui disent déjà ce qu'est la voie : « Tournez à droite rue Guillaume Tell ». */
const TYPES_DE_VOIE =
  /^(rue|ruelle|avenue|boulevard|place|placette|chemin|route|allée|impasse|quai|cours|cour|square|passage|promenade|faubourg|voie|sentier|esplanade|parvis|rond-point|pont|montée|côte|venelle|traverse|mail|galerie|parking|jardin|parc)(\s|$)/i;

/** « Rue Guillaume Tell » ⇒ « rue Guillaume Tell » ; « N 77 » ⇒ « la N 77 » ; autre ⇒ tel quel. */
export function designationRue(rue: string): string {
  if (TYPES_DE_VOIE.test(rue)) return rue.charAt(0).toLowerCase() + rue.slice(1);
  if (/^[ADNMC] ?\d/.test(rue)) return `la ${rue}`;
  return rue;
}

/** « rue X » (après un verbe de mouvement), « sur la N 77 », « sur le chemin » sans nom. */
function surRue(rue: string | null): string {
  if (!rue) return "sur le chemin";
  const d = designationRue(rue);
  return TYPES_DE_VOIE.test(rue) ? d : `sur ${d}`;
}

/** « vers le nord », « vers l'est ». */
function versCap(cap: NonNullable<Consigne["cap"]>): string {
  return /^[eo]/.test(cap) ? `vers l'${cap}` : `vers le ${cap}`;
}

const SENS: Partial<Record<Manoeuvre, string>> = {
  gauche: "Tournez à gauche",
  droite: "Tournez à droite",
  legerement_gauche: "Prenez légèrement à gauche",
  legerement_droite: "Prenez légèrement à droite",
};

const niveau = (c: Consigne) => (c.niveau === "monter" ? " pour monter" : c.niveau === "descendre" ? " pour descendre" : "");

/** Phrase d'une consigne. `destination` : nom du lieu d'arrivée de la marche (« arrêt Mairie »). */
export function phraseConsigne(c: Consigne, destination: string): string {
  switch (c.manoeuvre) {
    case "depart": {
      const vers = c.cap ? ` ${versCap(c.cap)}` : "";
      return c.rue ? `Partez${vers} ${surRue(c.rue)}` : `Partez${vers}`;
    }
    case "tout_droit":
      return c.rue ? `Continuez ${surRue(c.rue)}` : "Continuez tout droit";
    case "demi_tour":
      return "Faites demi-tour";
    case "escalier":
      return `Prenez l'escalier${niveau(c)}`;
    case "ascenseur":
      return `Prenez l'ascenseur${niveau(c)}`;
    case "arrivee": {
      const lieu = destination.charAt(0).toUpperCase() + destination.slice(1);
      if (c.cote_arrivee === "gauche") return `${lieu} est sur votre gauche`;
      if (c.cote_arrivee === "droite") return `${lieu} est sur votre droite`;
      return `${lieu} est devant vous`;
    }
    default:
      return `${SENS[c.manoeuvre]} ${surRue(c.rue)}`;
  }
}

/** Distance jusqu'à la consigne suivante : « 120 m » ; rien pour l'arrivée. */
export function distanceConsigne(c: Consigne): string | null {
  return c.manoeuvre === "arrivee" || c.distance_metres <= 0 ? null : formaterDistance(c.distance_metres);
}

/** Consignes à montrer pour une étape à pied (au moins un départ et une arrivée). */
export function consignesAMontrer(e: Etape): Consigne[] {
  if (e.mode !== "marche" || !e.consignes || e.consignes.length < 2) return [];
  return e.consignes;
}

/** « Voir le chemin (5 consignes) ». */
export function libelleVoirChemin(n: number): string {
  return `Voir le chemin (${n} consigne${n > 1 ? "s" : ""})`;
}

/** Nom de la destination d'une marche, pour la phrase d'arrivée. */
export function destinationMarche(e: Etape): string {
  return nomLieuEtape(e.a);
}
