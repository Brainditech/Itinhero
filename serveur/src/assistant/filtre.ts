/**
 * Filtre du texte de l'Assistant (spec 39 §5, D117, invariant 3) : avant d'envoyer un morceau à l'app, le serveur
 * remplace toute heure, tout prix et tout numéro de téléphone, et retire toute coordonnée. Une durée (« 20 minutes
 * de marge », « 1 h 30 de trajet ») reste permise. En cas de doute, un « N h » est traité comme une heure : mieux
 * vaut masquer une durée que laisser passer un horaire inventé. Fonctions pures.
 */

export const REMPLACEMENTS = {
  heure: "(voir l'horaire dans l'app)",
  prix: "(voir le prix dans l'app)",
  numero: "(voir le numéro dans l'app)",
} as const;

/** Numéro de téléphone : français (10 chiffres, séparés ou non) ou international (+33…). */
const NUMERO = /(?:\+\d{2,3}[\s.-]?(?:\(0\)[\s.-]?)?\d(?:[\s.-]?\d){7,11}|\b0[1-9](?:[\s.-]?\d{2}){4}\b)/g;

/** Coordonnées : deux nombres à décimales séparés par une virgule (« 47.98, 3.39 »). */
const COORDONNEES = /-?\b\d{1,3}\.\d{2,}\s*[,;]\s*-?\d{1,3}\.\d{2,}\b/g;

/** Prix : « 12 € », « 12,50 euros », « €12 », « 3 EUR ». */
const PRIX = /(?:\b\d+(?:[.,]\d{1,2})?\s?(?:€|(?:euros?|eur)\b)|€\s?\d+(?:[.,]\d{1,2})?)/gi;

/** Heure d'horloge « 14:48 » : toujours une heure. */
const HEURE_DEUX_POINTS = /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g;

/** « 14h48 », « 14 h 48 », « 9h », « 14 h », « 14 heures » : une heure, sauf contexte de durée. */
const HEURE_H = /\b(?:[01]?\d|2[0-3])\s?(?:h|heures?)(?:\s?[0-5]\d)?(?![\p{L}\d])/giu;

/** Juste avant : une heure d'horloge, quoi qui suive (« à 9 h », « vers 14 h », « avant 9 h »). */
const AVANT_HEURE = /(?:\bà|\bvers|\bdès|\bjusqu'à|\bavant|\baprès|\bentre)\s*$/i;
/** Juste avant : une durée (« en 1 h », « plus de 2 h », « comptez 1 h 30 »). */
const AVANT_DUREE =
  /(?:\ben|\bpendant|\bdurant|\benviron|\bdans|\bplus de|\bmoins de|\bprès de|\bd'environ|\bau moins|\bau plus|\bdure|\bdurer|\bprend|\bprendre|\bcomptez|\bcompter|\bfaut|\bfaudra|\bune bonne|\bbien)\s*$/i;
/** Juste après : une durée (« 1 h 30 de trajet », « 2 h d'attente », « 1 h plus tôt »). */
const APRES_DUREE =
  /^\s*(?:de (?:trajet|marche|route|voyage|car|train|bus|attente|correspondance|marge|retard|plus|moins|battement)|d'(?:attente|avance|écart)|à pied|plus (?:tôt|tard)|en tout|au total|environ)/i;

/** Mots regardés autour d'un « N h » pour savoir si c'est une durée. */
const CONTEXTE = 30;

function remplacerHeuresH(texte: string, avantTexte: string): string {
  const tout = avantTexte + texte;
  return texte.replace(HEURE_H, (m: string, decalage: number) => {
    const ici = avantTexte.length + decalage;
    const avant = tout.slice(Math.max(0, ici - CONTEXTE), ici);
    const apres = tout.slice(ici + m.length, ici + m.length + CONTEXTE);
    if (AVANT_HEURE.test(avant)) return REMPLACEMENTS.heure;
    if (AVANT_DUREE.test(avant) || APRES_DUREE.test(apres)) return m;
    return REMPLACEMENTS.heure;
  });
}

/**
 * Filtre d'un texte. Ordre : numéros, coordonnées, prix, heures (un numéro n'est jamais lu comme une heure).
 * `avant` : le texte déjà envoyé juste avant (filtre en flux), pour lire le contexte d'un « N h » en début de morceau.
 */
export function filtrerTexte(texte: string, avant = ""): string {
  const t = texte
    .replace(NUMERO, REMPLACEMENTS.numero)
    .replace(COORDONNEES, "")
    .replace(PRIX, REMPLACEMENTS.prix)
    .replace(HEURE_DEUX_POINTS, REMPLACEMENTS.heure)
    // Gras Markdown : l'app affiche du texte brut (les consignes l'interdisent déjà ; ceci rattrape un oubli).
    .replace(/\*\*/g, "");
  return remplacerHeuresH(t, avant);
}

/** Caractères gardés en attente au bout du texte reçu : plus que tout ce que le filtre reconnaît, contexte compris. */
export const RETENUE = 80;

/** Une zone chiffrée : un nombre et ce qui peut le prolonger (séparateurs, h, €, euros…). */
const ZONE = /[+€]?\d[\d\s.,:;()+\-hH€]*(?:\s?(?:heures?|euros?|EUR))?/g;

/**
 * Position jusqu'où le texte en attente peut partir sans rien couper : au plus `longueur - RETENUE`, au début d'un
 * mot, et à plus de `CONTEXTE + 2` caractères de la fin de toute zone chiffrée (son contexte suivant part avec elle).
 */
function coupeSure(texte: string): number {
  let coupe = texte.length - RETENUE;
  if (coupe <= 0) return 0;
  for (;;) {
    while (coupe > 0 && !/\s/.test(texte[coupe - 1]!)) coupe--;
    let deplacee = false;
    for (const z of texte.matchAll(ZONE)) {
      const debut = z.index;
      const fin = debut + z[0].length;
      if (debut < coupe && coupe <= fin + CONTEXTE + 2) {
        coupe = debut;
        deplacee = true;
      }
    }
    if (!deplacee || coupe === 0) return coupe;
  }
}

/**
 * Filtre en flux : `pousser` reçoit chaque morceau de Claude et rend ce qui peut partir, déjà filtré ; `finir` rend
 * le reste. La concaténation des sorties égale `filtrerTexte` du texte entier, quelle que soit la découpe (tests).
 */
export function filtreFlux(): { pousser: (morceau: string) => string; finir: () => string } {
  let attente = "";
  let envoye = "";
  const sortir = (brut: string) => {
    const filtre = filtrerTexte(brut, envoye);
    envoye = (envoye + brut).slice(-CONTEXTE);
    return filtre;
  };
  return {
    pousser(morceau) {
      attente += morceau;
      const coupe = coupeSure(attente);
      if (coupe === 0) return "";
      const brut = attente.slice(0, coupe);
      attente = attente.slice(coupe);
      return sortir(brut);
    },
    finir() {
      const brut = attente;
      attente = "";
      return sortir(brut);
    },
  };
}
