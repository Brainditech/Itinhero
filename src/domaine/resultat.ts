import type { Candidat, Etape, LieuEtape, Possibilite, ReponseItineraires, ReponseSens } from "./api";
import type { Bout, Demande, Trajet } from "./demande";
import { natureLue } from "./suggestions";

// Ce qu'affichent le formulaire et le Résultat (spec 10, §4.1). Tout vient de la réponse de l'API :
// l'app ne calcule aucune heure (invariant 3 par extension : rien d'inventé côté client).

const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

/** « 2026-11-12 » ⇒ « Jeudi 12/11 », sans fuseau (R11). */
export function jourCourt(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const jour = JOURS[new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()];
  return `${jour} ${m[3]}/${m[2]}`;
}

/** Longueur maximale d'un nom envoyé à l'API (`noms.depart`, `noms.arrivee`, issue 0010 C). */
export const NOM_MAX = 120;

/** Nom d'un bout pour l'API et l'écran : « Domicile », « Ma position », ou le nom du lieu choisi (spec 13, §4.4 ; D91). */
export function nomBout(bout: Bout, choisi: { nom: string } | null): string {
  if (bout.type === "domicile") return "Domicile";
  if (bout.type === "position") return "Ma position";
  if (bout.type === "lieu") return bout.nom.slice(0, NOM_MAX);
  return (choisi?.nom ?? bout.texte).slice(0, NOM_MAX);
}

/** « Jeudi 12/11 · arriver avant 10:00 · marge 10 min » ou « Jeudi 05/11 · partir à 17:00 » (spec 14, §4.3). */
export function quandDemande(demande: Demande): string {
  const morceaux = [jourCourt(demande.date)];
  if (demande.sens === "arriver_avant") {
    morceaux.push(`arriver avant ${demande.heure}`, demande.marge > 0 ? `marge ${demande.marge} min` : "sans marge");
  } else {
    morceaux.push(`partir à ${demande.heure}`);
  }
  if (demande.retour != null) morceaux.push(`retour après ${demande.retour}`);
  return morceaux.join(" · ");
}

/** La possibilité `i` de l'aller ou du retour (spec 19), ou undefined si elle n'existe pas. */
export function possibiliteDe(r: ReponseItineraires | null | undefined, trajet: Trajet, i: number): Possibilite | undefined {
  const sens = trajet === "retour" ? r?.retour : r;
  return sens?.possibilites[i];
}

/** Paramètre `t` d'une route (étape, guidage) ⇒ le trajet ; tout autre valeur est l'aller. */
export function trajetDuParametre(t: string | undefined): Trajet {
  return t === "retour" ? "retour" : "aller";
}

// ——— Récapitulatif « Votre trajet » (spec 14) ———

/** Ce que l'app sait d'un lieu retenu : le domicile enregistré (`libelle`, `detail`) ou le candidat choisi. */
export type SourceAdresse = {
  libelle?: string;
  detail?: string | null;
  type?: Candidat["type"];
  commune?: string | null;
  code_postal?: string | null;
};

/** « 89300 Joigny » ; le `detail` d'un domicile (« Joigny, 89300 ») est remis dans cet ordre. */
function codeEtCommune(commune: string | null | undefined, code: string | null | undefined): string {
  return [code, commune].filter((v): v is string => !!v).join(" ");
}

function detailDomicile(detail: string): string {
  const m = /^(.+), (\d{5})$/.exec(detail);
  return m ? codeEtCommune(m[1], m[2]) : detail;
}

/**
 * Adresse d'un bout connue sur le téléphone (spec 14, §4.1) : celle du domicile enregistré,
 * « Arrêt, 89300 Joigny » pour un arrêt choisi, « 89300 Joigny » pour un autre lieu ; rien pour Ma position.
 */
export function adresseBout(bout: Bout, s: SourceAdresse): string | null {
  if (bout.type === "position") return null;
  if (bout.type === "domicile") {
    const morceaux = [s.libelle, s.detail ? detailDomicile(s.detail) : null].filter((v): v is string => !!v);
    return morceaux.length > 0 ? morceaux.join(", ") : null;
  }
  const lieu = codeEtCommune(s.commune, s.code_postal);
  if (s.type === "arret") return lieu ? `Arrêt, ${lieu}` : "Arrêt";
  return lieu || null;
}

/** Adresse de l'arrivée : celle du domicile d'abord, puis l'adresse postale de l'IGN, puis celle du candidat. */
export function adresseArrivee(bout: Bout, connue: string | null, ign: string | null): string | null {
  if (bout.type === "domicile") return connue ?? ign;
  return ign ?? connue;
}

export type BoutRecap = { nom: string; adresse: string | null };

/** Phrase lue par TalkBack pour toute la carte « Votre trajet ». */
export function phraseVotreTrajet(depart: BoutRecap, arrivee: BoutRecap, demande: Demande): string {
  const lieu = (b: BoutRecap) => (b.adresse ? `${b.nom}, ${b.adresse}` : b.nom);
  return `Votre trajet : de ${lieu(depart)}, à ${lieu(arrivee)}. ${quandDemande(demande).replaceAll(" · ", ", ")}.`;
}

/** Nom comparé sans accents, casse, tirets ni apostrophes. */
const simple = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Deuxième ligne d'un candidat : ce qu'il est (« Gare », « Métro », « Adresse »… D92), commune et code postal,
 * puis la distance si le serveur la donne.
 */
export function detailCandidat(c: Candidat): string {
  // La commune n'est pas redite sous un lieu qui porte son nom (« Saint-Michel-sur-Orge » ⇒ « 91240 »).
  const commune = c.commune && simple(c.commune) !== simple(c.nom) ? c.commune : null;
  const lieu = [commune, c.code_postal].filter((v): v is string => !!v).join(", ");
  const nature = natureLue(c);
  const morceaux = [nature && lieu ? `${nature}, ${lieu}` : nature || lieu];
  if (c.distance_metres != null) morceaux.push(`à ${formaterDistance(c.distance_metres)}`);
  return morceaux.filter((m) => m !== "").join(" · ");
}

export function formaterDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  const km = metres / 1000;
  return km < 10 ? `${km.toFixed(1).replace(".", ",")} km` : `${Math.round(km)} km`;
}

// ——— Verdict ———

export type EtatVerdict = "possible" | "nuit" | "impossible";
export type PhraseVerdict = { possible: boolean; etat: EtatVerdict; titre: string; heureDepart: string | null; detail: string };

/** Comparaison de deux possibilités pour un rangement de la liste (spec 21, D97). */
export type ComparerPossibilites = (a: Possibilite, b: Possibilite) => number;

/** Minutes à pied au total : somme des étapes `marche`. */
export function minutesDeMarche(p: Possibilite): number {
  return p.etapes.reduce((n, e) => (e.mode === "marche" ? n + e.duree_minutes : n), 0);
}

/** Arrivée la plus tôt ; puis départ le plus tard ; puis moins de correspondances. */
const parHeures: ComparerPossibilites = (a, b) =>
  a.arrivee_utc.localeCompare(b.arrivee_utc) || b.depart_utc.localeCompare(a.depart_utc) || a.correspondances - b.correspondances;

/** D114 : une nuit dehors (D79) passe après toutes les autres, dans tous les tris. */
const sansNuitDAbord: ComparerPossibilites = (a, b) => Number(nuitDehors(a) !== null) - Number(nuitDehors(b) !== null);

/** « Arrivée la plus tôt » (D103, D114) : sans nuit, puis sans marche longue (D3), puis les heures. */
export const parArrivee: ComparerPossibilites = (a, b) =>
  sansNuitDAbord(a, b) || Number(aMarcheLongue(a)) - Number(aMarcheLongue(b)) || parHeures(a, b);

/** « Moins de marche » (D114) : sans nuit, puis la marche, puis les heures. */
export const parMarche: ComparerPossibilites = (a, b) => sansNuitDAbord(a, b) || minutesDeMarche(a) - minutesDeMarche(b) || parHeures(a, b);

/**
 * La possibilité du verdict (D114) : la première de « Arrivée la plus tôt », celle en tête de la liste rangée par
 * défaut ; à égalité, l'ordre du serveur. Toutes ont été retenues par le serveur : elles conviennent.
 */
export function possibiliteDuVerdict(r: ReponseSens): Possibilite | undefined {
  return r.possibilites.reduce<Possibilite | undefined>((meilleure, p) => (!meilleure || parArrivee(p, meilleure) < 0 ? p : meilleure), undefined);
}

/**
 * Verdict dit en mots (spec 10 §4.2, spec 15) : il s'appuie sur la première possibilité de la liste rangée par
 * défaut (D114), qui n'a une nuit dehors que si toutes en ont une. Une nuit dehors n'est jamais « Possible » en vert (D79) ; une arrivée le lendemain
 * est toujours dite.
 */
export function phraseVerdict(r: ReponseSens, trajet: Trajet = "aller", horairesIncomplets = false): PhraseVerdict {
  // Issue 0025 : des réseaux n'ont pas encore publié ce jour-là ; « aucun trajet » serait affirmer ce qu'on ne sait pas.
  const aucun = horairesIncomplets ? "Aucun trajet trouvé ce jour-là" : "Aucun trajet ce jour-là";
  const aucunRetour = horairesIncomplets ? "Aucun retour trouvé ce jour-là" : "Aucun retour ce jour-là";
  const suite = horairesIncomplets ? " : certains horaires de ce jour ne sont pas encore publiés." : ".";
  const choisie = possibiliteDuVerdict(r);
  if (r.verdict === "impossible" || !choisie) {
    if (trajet === "retour") {
      return {
        possible: false,
        etat: "impossible",
        titre: "Impossible",
        heureDepart: null,
        detail: `${aucunRetour} après ${r.demande.heure}${suite}`,
      };
    }
    const quand = r.demande.sens === "arriver" ? `pour arriver avant ${r.demande.limite ?? r.demande.heure}` : `au départ de ${r.demande.heure}`;
    return {
      possible: false,
      etat: "impossible",
      titre: "Impossible",
      heureDepart: null,
      detail: `${aucun} ${quand}${suite}`,
    };
  }
  const plus = joursEnPlus(choisie);
  const arrivee = plus > 0 ? `${jourApres(r.demande.date, plus)} ${choisie.arrivee}` : choisie.arrivee;
  const nuit = nuitDehors(choisie);
  if (nuit) {
    return {
      possible: false,
      etat: "nuit",
      titre: "Nuit dehors",
      heureDepart: choisie.depart,
      detail: `Arrivée ${arrivee} après ${formaterAttente(nuit.minutes)} d'attente de nuit à ${nuit.lieu}. Aucun trajet sans nuit dehors trouvé.`,
    };
  }
  let detail: string;
  if (r.demande.sens === "arriver") {
    const marge = r.demande.marge ?? 0;
    const precision = marge > 0 ? `rendez-vous ${r.demande.heure}, marge ${marge} min` : `rendez-vous ${r.demande.heure}, sans marge`;
    detail = `À faire : être sur place avant ${r.demande.limite ?? r.demande.heure} (${precision}). Arrivée prévue à ${arrivee}.`;
  } else {
    detail = `Arrivée prévue ${plus > 0 ? "" : "à "}${arrivee}.`;
  }
  if (avecTaxi(choisie)) detail += " Avec un taxi à réserver (prix non publié).";
  return { possible: true, etat: "possible", titre: "Possible", heureDepart: choisie.depart, detail };
}

// ——— Taxi comme étape (spec 16, D48) ———

export function avecTaxi(p: Possibilite): boolean {
  return p.etapes.some((e) => e.mode === "taxi");
}

/**
 * Consigne d'une étape en taxi (D48) : prise en charge, durée de route estimée, délai pour appeler.
 * Aucune fiche de taxi n'existe encore : le délai n'est pas connu et aucun numéro n'est donné (invariant 16).
 */
export function phraseTaxi(e: Etape): string | null {
  if (e.mode !== "taxi") return null;
  return `À réserver : prise en charge à ${e.depart}. ${e.duree_minutes} min de route estimée, hors attente. Délai pour appeler non connu.`;
}

// ——— Jour d'arrivée et nuit dehors (spec 15, D79) ———

const minutesDuJour = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

/** Jours entre le départ et l'arrivée : heure de départ + durée totale, sans fuseau (Hermes). */
export function joursEnPlus(p: Possibilite): number {
  return Math.floor((minutesDuJour(p.depart) + p.duree_minutes) / 1440);
}

/** « 2026-11-12 » + 1 ⇒ « vendredi ». */
export function jourApres(date: string, n: number): string {
  const [a, m, j] = date.split("-").map(Number);
  const d = new Date(Date.UTC(a!, m! - 1, j! + n));
  return JOURS[d.getUTCDay()]!.toLowerCase();
}

/** « 12 min », « 1 h », « 7 h 51 ». */
export function formaterAttente(minutes: number): string {
  return formaterDuree(minutes);
}

/** D79 : une nuit dehors est une attente d'au moins 60 min qui touche 22:00 – 05:00. */
export const NUIT_ATTENTE_MIN = 60;
const NUIT_DEBUT = 22 * 60;
const NUIT_FIN = 5 * 60;

function toucheLaNuit(debut: string, minutes: number): boolean {
  const d = minutesDuJour(debut);
  for (let t = 0; t <= minutes; t += 5) {
    const h = (d + t) % 1440;
    if (h >= NUIT_DEBUT || h < NUIT_FIN) return true;
  }
  return false;
}

/** La plus longue attente de nuit d'une possibilité (D79), avec le lieu où l'on attend ; null s'il n'y en a pas. */
export function nuitDehors(p: Possibilite): { lieu: string; minutes: number } | null {
  let meilleure: { lieu: string; minutes: number } | null = null;
  p.etapes.forEach((e, i) => {
    const n = attenteApres(p.etapes, i);
    if (n === null || n < NUIT_ATTENTE_MIN || !toucheLaNuit(e.arrivee, n)) return;
    if (!meilleure || n > meilleure.minutes) meilleure = { lieu: e.a.nom, minutes: n };
  });
  return meilleure;
}

// ——— Étapes ———

/** Couleur d'un mode (D67) : jetons du design system seulement (invariant 20). */
export type JetonMode = "mode-train" | "mode-car" | "mode-tad" | "mode-marche" | "mode-taxi";

export function jetonMode(mode: string): JetonMode {
  switch (mode) {
    case "train":
    case "train_banlieue":
    case "metro":
    case "tram":
    case "remontee":
      return "mode-train";
    case "bus":
    case "car":
      return "mode-car";
    case "transport_a_la_demande":
      return "mode-tad";
    case "marche":
      return "mode-marche";
    default:
      return "mode-taxi";
  }
}

const NOMS_MODES: Record<string, string> = {
  train: "Train",
  metro: "Métro",
  tram: "Tram",
  bus: "Bus",
  car: "Car",
  transport_a_la_demande: "Transport à la demande",
  bateau: "Bateau",
  remontee: "Funiculaire ou téléphérique",
  taxi: "Taxi",
};

/** Un train régional de la SNCF est un TER (issue 0010, A). */
function estTer(e: Etape): boolean {
  return e.mode === "train" && /^REGIONAL/.test(e.mode_motis) && !!e.exploitant && /\bSNCF\b/i.test(e.exploitant);
}

/** « Métro 14 », « RER B », « Car K941 », « TER K7 », « Marche 4 min ». */
export function libelleEtape(e: Etape): string {
  if (e.mode === "marche") return `Marche ${e.duree_minutes} min`;
  if (e.mode === "taxi") return `Taxi ${e.duree_minutes} min`;
  if (e.mode === "train_banlieue") {
    if (e.ligne && /^[A-E]$/.test(e.ligne)) return `RER ${e.ligne}`;
    return e.ligne ? `Train ${e.ligne}` : "Train de banlieue";
  }
  const nom = estTer(e) ? "TER" : (NOMS_MODES[e.mode] ?? "Transport");
  // « TER TER » : certains GTFS mettent le nom du mode comme nom de ligne (Nomad, 2026-11-05).
  const ligne = e.ligne && e.ligne.toLowerCase() !== nom.toLowerCase() ? e.ligne : null;
  return ligne && e.mode !== "transport_a_la_demande" ? `${nom} ${ligne}` : nom;
}

/** « n° 17769 vers Lyon Part Dieu », « vers Auxerre », ou null. */
export function directionEtape(e: Etape): string | null {
  const vers = e.direction ? `vers ${e.direction}` : null;
  if (e.numero) return vers ? `n° ${e.numero} ${vers}` : `n° ${e.numero}`;
  return vers;
}

/**
 * Véhicule qui vient vous prendre et vous dépose (taxi, transport à la demande sans arrêts) :
 * ni arrêt, ni « prochain arrêt » (spec 12, D83).
 */
export function vientVousChercher(e: Etape): boolean {
  return e.mode === "taxi" || (e.mode === "transport_a_la_demande" && !e.arrets?.length);
}

/**
 * Nom d'un lieu de montée ou de dépose du véhicule `e`. Pour un taxi, le serveur type par défaut le lieu en « arrêt » :
 * il est dit tel quel (« Domicile », jamais « arrêt Domicile ») ; une gare reste « gare de Laroche - Migennes ».
 */
export function nomLieuVehicule(e: Etape, l: LieuEtape): string {
  return vientVousChercher(e) && l.type === "arret" ? l.nom : nomLieuEtape(l);
}

/**
 * « arrêt Mairie », « gare de Saint-Florentin - Vergigny », « station Godrans Les Halles » (issue 0010, F).
 * Un nom qui dit déjà ce qu'il est (« Dijon Gare », « Gare de Lyon ») n'est pas répété.
 */
export function nomLieuEtape(l: LieuEtape): string {
  const dit = (mot: RegExp) => mot.test(l.nom);
  switch (l.type) {
    case "arret":
      return dit(/\barr[êe]t\b/i) ? l.nom : `arrêt ${l.nom}`;
    case "gare":
      return dit(/\bgare\b/i) ? l.nom : `gare de ${l.nom}`;
    case "station":
      return dit(/\b(station|gare)\b/i) ? l.nom : `station ${l.nom}`;
    default:
      return l.nom;
  }
}

/** Minutes de `de` à `a` (« HH:MM »), passage de minuit compris. */
export function minutesEntre(de: string, a: string): number {
  const m = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  return (m(a) - m(de) + 1440) % 1440;
}

/** Attente montrée seulement au-delà de 2 min (issue 0010, E). */
export const ATTENTE_MONTREE_MIN = 2;

/** Attente entre l'étape `i` et la suivante, ou null si elle est de 2 min ou moins. */
export function attenteApres(etapes: Etape[], i: number): number | null {
  const suivante = etapes[i + 1];
  if (!suivante) return null;
  const n = minutesEntre(etapes[i]!.arrivee, suivante.depart);
  return n > ATTENTE_MONTREE_MIN ? n : null;
}

const VEHICULES: Record<string, string> = {
  bus: "le bus",
  car: "le car",
  transport_a_la_demande: "le véhicule",
  tram: "le tram",
  metro: "le métro",
  train: "le train",
  train_banlieue: "le train",
  bateau: "le bateau",
};

/** « Arrivez à l'arrêt à 08:15, le bus passe à 08:25. » (D68) ; null sans montée. */
export function phraseMontee(p: Possibilite): string | null {
  const v = p.etapes.find((e) => e.mode !== "marche");
  if (!p.montee || !v) return null;
  const ou = v.de.type === "gare" ? "à la gare" : v.de.type === "station" ? "à la station" : "à l'arrêt";
  const quoi = VEHICULES[v.mode] ?? "le véhicule";
  const verbe = v.mode === "train" || v.mode === "train_banlieue" ? "part" : "passe";
  return `Arrivez ${ou} à ${p.montee.arriver_a}, ${quoi} ${verbe} à ${p.montee.vehicule}.`;
}

/**
 * Passage sur réservation (D69). Aucun numéro tant que la fiche de l'exploitant n'est pas validée
 * par Brainditech (invariant 16).
 */
export function phraseReservation(e: Etape): string | null {
  if (e.reservation !== "appel") return null;
  return `Réservation obligatoire : appelez ${e.exploitant ?? "le transporteur"} avant de partir.`;
}

/** Résumé d'une possibilité : « Marche 4 min · Métro 14 · Marche 3 min ». */
export function resumePossibilite(p: Possibilite): string {
  return p.etapes.map(libelleEtape).join(" · ");
}

export const MARCHE_LONGUE_MIN = 15;

/** D3 : avertir quand une marche dépasse 15 min (16 et plus). */
export function aMarcheLongue(p: Possibilite): boolean {
  return p.etapes.some((e) => e.mode === "marche" && e.duree_minutes > MARCHE_LONGUE_MIN);
}

/** Correspondances dites en mots. */
export function libelleCorrespondances(n: number): string {
  if (n === 0) return "Direct";
  return n === 1 ? "1 correspondance" : `${n} correspondances`;
}

export function formaterDuree(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/**
 * « Horaires valables jusqu'au 31/08/2027 » (issue 0010, H) : la fin de validité la plus proche parmi
 * les jeux GTFS des possibilités montrées. Aucune fin connue ⇒ null (rien à dire, plutôt qu'une date
 * de début de validité prise pour une date ancienne).
 */
export function finHoraires(possibilites: Possibilite[]): string | null {
  const fins = possibilites.flatMap((p) =>
    p.etapes.flatMap((e) => (e.source.type === "gtfs" && e.source.fin_validite ? [e.source.fin_validite] : [])),
  );
  if (fins.length === 0) return null;
  const [a, m, j] = [...fins].sort()[0]!.split("-");
  return `${j}/${m}/${a}`;
}

// ——— Date des horaires (spec 32, D110) ———

/** Au-delà de ce nombre de jours, le Résultat prévient que les horaires peuvent encore changer. */
export const JOURS_HORAIRES_SURS = 7;

/** « 21/09/2026 » : la date des horaires la plus ancienne parmi les jeux GTFS des possibilités ; null si aucune. */
export function horairesDu(possibilites: Possibilite[]): string | null {
  const dates = possibilites.flatMap((p) =>
    p.etapes.flatMap((e) => (e.source.type === "gtfs" && e.source.date_horaires ? [e.source.date_horaires] : [])),
  );
  if (dates.length === 0) return null;
  const [a, m, j] = [...dates].sort()[0]!.split("-");
  return `${j}/${m}/${a}`;
}

/**
 * Ligne sous le Résultat : « Horaires publiés le 21/09/2026, valables jusqu'au 31/08/2027 » (morceaux connus
 * seulement). Issue 0025 : « Horaires du 20/08/2026 » sur un trajet du 28/12 se lisait comme la date du trajet.
 */
export function ligneHoraires(du: string | null, jusquau: string | null): string | null {
  if (du && jusquau) return `Horaires publiés le ${du}, valables jusqu'au ${jusquau}`;
  if (du) return `Horaires publiés le ${du}`;
  return jusquau ? `Horaires valables jusqu'au ${jusquau}` : null;
}

/** Bandeau quand le jour demandé est à plus de 7 jours (le jeu peut être remplacé d'ici là, phase 8). */
export function bandeauLointain(dateDemandee: string, aujourdhui: string, du: string | null): string | null {
  const ecart = (Date.parse(dateDemandee) - Date.parse(aujourdhui)) / 86_400_000;
  if (ecart <= JOURS_HORAIRES_SURS) return null;
  const quels = du ? `Horaires publiés le ${du}` : "Horaires connus aujourd'hui";
  return `Trajet dans plus de ${JOURS_HORAIRES_SURS} jours. ${quels} : ils peuvent changer d'ici là. Revérifiez la veille.`;
}

// ——— Horaires pas encore publiés (issue 0025) ———

const dateFr = (iso: string) => {
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
};

/**
 * « Pour ce jour, les horaires de 39 réseaux ne sont pas encore publiés, dont Île-de-France Mobilités (publiés
 * jusqu'au 02/12/2026) et SNCF (jusqu'au 12/12/2026). Les trajets qui les empruntent n'apparaissent pas.
 * Revérifiez plus près de la date. »
 */
export function phraseHorairesAVenir(h: { nombre: number; reseaux: { nom: string; jusquau: string }[] }): string {
  const qui = h.nombre === 1 ? "d'un réseau" : `de ${h.nombre} réseaux`;
  const noms = h.reseaux.map((r, i) => `${r.nom} (${i === 0 ? "publiés " : ""}jusqu'au ${dateFr(r.jusquau)})`);
  const liste = noms.length <= 1 ? (noms[0] ?? "") : `${noms.slice(0, -1).join(", ")} et ${noms.at(-1)!}`;
  const dont = liste === "" ? "" : h.nombre === 1 ? ` : ${liste}` : `, dont ${liste}`;
  return (
    `Pour ce jour, les horaires ${qui} ne sont pas encore publiés${dont}. ` +
    "Les trajets qui les empruntent n'apparaissent pas. Revérifiez plus près de la date."
  );
}

/** Le bandeau se montre quand un sens est « Impossible » ou que le trajet est à plus de 7 jours (sinon : bruit). */
export function montrerHorairesAVenir(impossible: boolean, dateDemandee: string, aujourdhui: string): boolean {
  return impossible || (Date.parse(dateDemandee) - Date.parse(aujourdhui)) / 86_400_000 > JOURS_HORAIRES_SURS;
}
