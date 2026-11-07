import type { Contact, Etape, Possibilite } from "./api";
import { libelleEtape } from "./resultat";
import { possibiliteMontree, type Voyage } from "./voyages";

/**
 * Rappels locaux d'un trajet enregistré (spec 30, D108). Tout vient de la possibilité enregistrée :
 * aucune heure de trajet recalculée (invariant 3), aucun numéro (invariant 16 : aucune fiche validée encore).
 * - « veille » : la veille du départ à 19:00 (heure de Paris) ;
 * - « reserver » : une étape sur réservation (D69), la veille à 10:00, « délai non connu » ;
 * - « taxi » : une étape en taxi, 60 min avant la prise en charge ;
 * - « partir » : 15 min avant le départ de la porte.
 * Un rappel déjà passé, ou qui tomberait après le départ, n'est pas programmé.
 */
export type TypeRappel = "veille" | "reserver" | "taxi" | "partir";
export type Rappel = { cle: string; type: TypeRappel; instant: Date; titre: string; corps: string };

/**
 * Issue 0026 (D120) : « alarme » = `setAlarmClock()` d'Android, jamais décalée par l'économie de batterie (icône de
 * réveil dans la barre d'état) ; réservée aux rappels qui font partir ou appeler à la minute. Les autres sont
 * exacts aussi (permission `USE_EXACT_ALARM`) mais peuvent glisser de quelques minutes sur certains téléphones.
 */
export type Livraison = "alarme" | "exacte";
export function livraisonDe(type: TypeRappel): Livraison {
  return type === "partir" || type === "taxi" ? "alarme" : "exacte";
}

export const HEURE_VEILLE = "19:00";
export const HEURE_RESERVATION = "10:00";
export const AVANCE_TAXI_MIN = 60;
export const AVANCE_DEPART_MIN = 15;

const MINUTE = 60_000;

/** Instant de « jour à heure », heure de Paris (changements d'heure compris, par Intl). */
export function instantDeParis(jour: string, heure: string): Date {
  const [a, mo, j] = jour.split("-").map(Number) as [number, number, number];
  const [h, mi] = heure.split(":").map(Number) as [number, number];
  const naif = Date.UTC(a, mo - 1, j, h, mi);
  const decalage = (t: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Paris",
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
        .formatToParts(new Date(t))
        .map((x) => [x.type, Number(x.value)]),
    );
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - t;
  };
  let t = naif - decalage(naif);
  t = naif - decalage(t);
  return new Date(t);
}

/** Jour de Paris (« AAAA-MM-JJ ») d'un instant. */
export function jourDeParis(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

function veilleDe(jour: string): string {
  const [a, m, j] = jour.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, j - 1)).toISOString().slice(0, 10);
}

const premierTransport = (p: Possibilite): Etape | undefined => p.etapes.find((e) => e.mode !== "marche");

/** Heure de prise en charge d'une étape (son départ, ou celui du trajet sans heure UTC d'étape). */
const priseEnCharge = (p: Possibilite, i: number): Date => new Date(p.etapes[i]?.depart_utc ?? p.depart_utc);

/** Tous les rappels du trajet, passés compris, avec l'étape qui les porte (spec 40). */
function tousLesRappels(p: Possibilite, nomArrivee: string): (Rappel & { etape: number | null })[] {
  const depart = new Date(p.depart_utc);
  const veille = veilleDe(jourDeParis(depart));
  const transport = premierTransport(p);
  const suite = transport ? `${libelleEtape(transport)} à ${transport.depart}` : `à pied`;
  const rappels: (Rappel & { etape: number | null })[] = [
    {
      etape: null,
      cle: "veille",
      type: "veille",
      instant: instantDeParis(veille, HEURE_VEILLE),
      titre: `Demain : trajet vers ${nomArrivee}`,
      corps: `Départ ${p.depart}, ${suite}. Arrivée prévue ${p.arrivee}.`,
    },
  ];
  p.etapes.forEach((e, i) => {
    if (e.mode === "taxi") {
      rappels.push({
        etape: i,
        cle: `taxi-${i}`,
        type: "taxi",
        instant: new Date(priseEnCharge(p, i).getTime() - AVANCE_TAXI_MIN * MINUTE),
        titre: "Appelez le taxi maintenant",
        corps: `Prise en charge à ${e.depart}, ${e.de.nom}. Délai pour appeler non connu.`,
      });
    } else if (e.reservation === "appel") {
      rappels.push({
        etape: i,
        cle: `reserver-${i}`,
        type: "reserver",
        instant: instantDeParis(veille, HEURE_RESERVATION),
        titre: `À réserver : ${libelleEtape(e)} de ${e.depart}`,
        corps: `Passage sur réservation à ${e.de.nom}. Délai non connu : réservez au plus tôt.`,
      });
    }
  });
  rappels.push({
    etape: null,
    cle: "partir",
    type: "partir",
    instant: new Date(depart.getTime() - AVANCE_DEPART_MIN * MINUTE),
    titre: `Partez dans ${AVANCE_DEPART_MIN} min`,
    corps: `Départ ${p.depart} vers ${nomArrivee} : ${suite}.`,
  });
  // Un rappel qui tomberait après le départ de la porte n'a pas de sens (spec 30), sauf celui d'un taxi pris en
  // cours de route ou à l'arrivée (D48) : on l'appelle pendant le trajet, avant sa propre prise en charge (issue 0031).
  return rappels
    .filter((r) => r.instant.getTime() < (r.type === "taxi" && r.etape !== null ? priseEnCharge(p, r.etape) : depart).getTime())
    .sort((a, b) => a.instant.getTime() - b.instant.getTime());
}

export function rappelsDuTrajet(p: Possibilite, nomArrivee: string, maintenant: Date): Rappel[] {
  return tousLesRappels(p, nomArrivee)
    .filter((r) => r.instant.getTime() > maintenant.getTime())
    .map(({ etape: _etape, ...r }) => r);
}

// ——— « À faire » d'un trajet enregistré (spec 40, D121) ———

export type Action = {
  cle: string;
  type: "taxi" | "reserver" | "partir";
  titre: string;
  detail: string;
  /** « Rappel à 07:35 », « Rappel la veille à 10:00 ». */
  rappel: string;
  /** Rappel déjà passé : la ligne est grisée. */
  passe: boolean;
  /** Numéro sourcé de l'étape (spec 41), ou null : « Aucun numéro connu ». */
  contact: Contact | null;
  /** Délai de réservation connu par la fiche, sinon « Délai non connu » (réservation) ou null. */
  delai: string | null;
};

function texteRappel(instant: Date, depart: Date): string {
  const heure = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instant);
  const jour = jourDeParis(instant);
  const jourDepart = jourDeParis(depart);
  if (jour === jourDepart) return `Rappel à ${heure}`;
  // Taxi d'arrivée le lendemain (nuit dehors) : le jour est dit, jamais « la veille » (issue 0031).
  if (jour > jourDepart) return `Rappel le ${jour.slice(8, 10)}/${jour.slice(5, 7)} à ${heure}`;
  return `Rappel la veille à ${heure}`;
}

/**
 * Ce qu'il faut faire, dans l'ordre du temps (spec 40) : appeler le taxi, réserver, partir. Tiré de la possibilité
 * enregistrée, rien de recalculé (invariant 3) ; la veille n'est pas une action (dite par `rappelVeille`).
 */
export function actionsDuTrajet(p: Possibilite, nomArrivee: string, maintenant: Date): Action[] {
  const depart = new Date(p.depart_utc);
  return tousLesRappels(p, nomArrivee).flatMap((r): Action[] => {
    if (r.type === "veille") return [];
    const e = r.etape === null ? undefined : p.etapes[r.etape];
    const passe = r.instant.getTime() <= maintenant.getTime();
    const rappel = texteRappel(r.instant, depart);
    if (r.type === "taxi" && e) {
      return [
        {
          cle: r.cle,
          type: "taxi",
          titre: "Appeler le taxi",
          detail: `Prise en charge à ${e.depart}, ${e.de.nom}.`,
          rappel,
          passe,
          contact: e.contact ?? null,
          delai: e.contact?.delai ?? null,
        },
      ];
    }
    if (r.type === "reserver" && e) {
      return [
        {
          cle: r.cle,
          type: "reserver",
          titre: `Réserver : ${libelleEtape(e)} de ${e.depart}`,
          detail: `Passage sur réservation à ${e.de.nom}.`,
          rappel,
          passe,
          contact: e.contact ?? null,
          delai: e.contact?.delai ?? "Délai non connu",
        },
      ];
    }
    return [
      {
        cle: r.cle,
        type: "partir",
        titre: "Partir",
        detail: `Départ de la porte à ${p.depart}.`,
        rappel,
        passe,
        contact: null,
        delai: null,
      },
    ];
  });
}

/** « Rappel la veille à 19:00 » (veille du départ), ou null s'il tombe après le départ. */
export function rappelVeille(p: Possibilite, nomArrivee: string): string | null {
  const v = tousLesRappels(p, nomArrivee).find((r) => r.type === "veille");
  return v ? texteRappel(v.instant, new Date(p.depart_utc)) : null;
}

/** Appels (taxi, réservation) encore à venir : « 2 appels à passer » dans Mes trajets. */
export function appelsAVenir(p: Possibilite, nomArrivee: string, maintenant: Date): number {
  return actionsDuTrajet(p, nomArrivee, maintenant).filter((a) => a.type !== "partir" && !a.passe).length;
}

/** Rappels du trajet que montre le voyage enregistré (D101, D102) ; aucun si le sens n'a pas de possibilité. */
export function rappelsDuVoyage(v: Voyage, maintenant: Date): Rappel[] {
  const p = possibiliteMontree(v.reponse, v.tri);
  return p ? rappelsDuTrajet(p, v.arrivee.nom, maintenant) : [];
}
