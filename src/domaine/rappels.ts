import type { Etape, Possibilite } from "./api";
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

export function rappelsDuTrajet(p: Possibilite, nomArrivee: string, maintenant: Date): Rappel[] {
  const depart = new Date(p.depart_utc);
  const veille = veilleDe(jourDeParis(depart));
  const transport = premierTransport(p);
  const suite = transport ? `${libelleEtape(transport)} à ${transport.depart}` : `à pied`;
  const rappels: Rappel[] = [
    {
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
        cle: `taxi-${i}`,
        type: "taxi",
        instant: new Date(new Date(e.depart_utc ?? p.depart_utc).getTime() - AVANCE_TAXI_MIN * MINUTE),
        titre: "Appelez le taxi maintenant",
        corps: `Prise en charge à ${e.depart}, ${e.de.nom}. Délai pour appeler non connu.`,
      });
    } else if (e.reservation === "appel") {
      rappels.push({
        cle: `reserver-${i}`,
        type: "reserver",
        instant: instantDeParis(veille, HEURE_RESERVATION),
        titre: `À réserver : ${libelleEtape(e)} de ${e.depart}`,
        corps: `Passage sur réservation à ${e.de.nom}. Délai non connu : réservez au plus tôt.`,
      });
    }
  });
  rappels.push({
    cle: "partir",
    type: "partir",
    instant: new Date(depart.getTime() - AVANCE_DEPART_MIN * MINUTE),
    titre: `Partez dans ${AVANCE_DEPART_MIN} min`,
    corps: `Départ ${p.depart} vers ${nomArrivee} : ${suite}.`,
  });
  return rappels
    .filter((r) => r.instant.getTime() > maintenant.getTime() && r.instant.getTime() < depart.getTime())
    .sort((a, b) => a.instant.getTime() - b.instant.getTime());
}

/** Rappels du trajet que montre le voyage enregistré (D101, D102) ; aucun si le sens n'a pas de possibilité. */
export function rappelsDuVoyage(v: Voyage, maintenant: Date): Rappel[] {
  const p = possibiliteMontree(v.reponse, v.tri);
  return p ? rappelsDuTrajet(p, v.arrivee.nom, maintenant) : [];
}
