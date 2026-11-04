import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { chercherPlan, type Etape, type Possibilite } from "../itineraires/motis-plan.js";
import { retenir, verdict } from "../itineraires/verdict.js";
import { sondeMotis } from "../motis.js";
import type { Course } from "../oracle/courses.js";
import { Oracle, type Arret } from "../oracle/oracle.js";
import { hhmm, minutesDepuis } from "../temps.js";
import { idMotis, scenario as s } from "./scenario.js";

/**
 * Test Joigny (spec 05, §8, critères 4 à 8). Interroge le vrai MOTIS chargé avec les fixtures.
 * Les valeurs attendues viennent de l'oracle, jamais de ce fichier (invariant 15).
 * MOTIS injoignable ⇒ échec explicite, jamais un test sauté.
 */
const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures");
const MOTIS_URL = process.env.MOTIS_URL ?? "http://127.0.0.1:8080";
const LIMITE = s.rendezVousMinutes - s.margeMinutes; // H − M
const { reference: J, ferie: FERIE, dimanche: DIMANCHE } = s.jours;
const A = s.arrets;

let oracle: Oracle;
let origine: Arret;
const reponses = new Map<string, Promise<Possibilite[]>>();

/** Recherche D44 pour un jour, une seule fois par jour. */
function chercher(jour: string): Promise<Possibilite[]> {
  let r = reponses.get(jour);
  if (!r) {
    r = chercherPlan(MOTIS_URL, {
      depart: { lat: origine.lat, lon: origine.lon },
      arrivee: { lat: s.destination.lat, lon: s.destination.lon },
      jour,
      limiteMinutes: LIMITE,
    });
    reponses.set(jour, r);
  }
  return r;
}

/** L'étape de MOTIS est-elle cette course de l'oracle, heures identiques à la minute près ? */
function estLaCourse(e: Etape, jeu: string, c: Course, jour: string): boolean {
  return (
    e.tripId?.endsWith(`${jeu}_${c.tripId}`) === true &&
    minutesDepuis(jour, e.depart) === c.depart &&
    minutesDepuis(jour, e.arrivee) === c.arrivee
  );
}

const decrire = (p: Possibilite, jour: string) =>
  p.etapes
    .map((e) => `${e.mode}${e.ligne ? " " + e.ligne : ""} ${hhmm(minutesDepuis(jour, e.depart))}`)
    .join(" / ");

/** Raison pour laquelle `p` n'est pas la voie de référence, ou null si elle l'est (critère 4). */
function ecartVoieReference(p: Possibilite, cars: Course[], trains: Course[]): string | null {
  const e = p.etapes[0]?.mode === "WALK" ? p.etapes.slice(1) : p.etapes; // marche facultative
  if (e.length !== 4) return `${e.length} étapes au lieu de car, marche, train, marche`;
  const [car, marche, train, fin] = e as [Etape, Etape, Etape, Etape];
  if (car.de.arret !== idMotis(A.carDepart) || car.a.arret !== idMotis(A.carArrivee)) return "car : arrêts";
  if (!cars.some((c) => c.routeType === 3 && estLaCourse(car, "sncf", c, J))) return "car : pas une course de l'oracle";
  if (marche.mode !== "WALK") return "2e étape : pas une marche";
  if (marche.de.arret !== idMotis(A.carArrivee) || marche.a.arret !== idMotis(A.trainDepart)) return "marche : arrêts";
  if (marche.dureeSecondes > s.marcheMaxMinutes * 60) return `marche de ${marche.dureeSecondes / 60} min (D42)`;
  if (train.depart.getTime() < marche.arrivee.getTime()) return "train parti avant la fin de la marche";
  if (train.de.arret !== idMotis(A.trainDepart) || train.a.arret !== idMotis(A.trainArrivee)) return "train : arrêts";
  if (!trains.some((c) => c.routeType === 2 && estLaCourse(train, "sncf", c, J))) return "train : pas une course de l'oracle";
  if (fin.mode !== "WALK") return "dernière étape : pas une marche";
  return null;
}

// Préparation attendue par chaque test (pas un beforeAll : vitest marquerait les tests « skipped »).
let preparation: Promise<void> | undefined;
function preparer(): Promise<void> {
  preparation ??= (async () => {
    if (!(await sondeMotis(MOTIS_URL, 5000)())) {
      throw new Error(
        `MOTIS injoignable à ${MOTIS_URL}. Lancer « docker compose up -d » à la racine. ` +
          "Le test Joigny échoue au lieu d'être sauté (spec 05).",
      );
    }
    oracle = await Oracle.ouvrir(FIXTURES); // sha256 vérifié contre le manifeste (invariant 14)
    origine = await oracle.arret(s.origine.jeu, s.origine.id);
  })();
  return preparation;
}
beforeEach(preparer);

describe("test Joigny", () => {
  it(`${J} : voie car → marche → train → marche retrouvée, verdict « possible » (critère 4)`, async () => {
    const cars = await oracle.courses("sncf", A.carDepart.id, A.carArrivee.id, J);
    const trains = await oracle.courses("sncf", A.trainDepart.id, A.trainArrivee.id, J);
    expect(cars.length, "l'oracle ne trouve aucun car ce jour-là").toBeGreaterThan(0);
    expect(trains.length, "l'oracle ne trouve aucun train ce jour-là").toBeGreaterThan(0);

    const retenues = retenir(await chercher(J), J, LIMITE);
    expect(verdict(retenues)).toBe("possible");
    for (const p of retenues) {
      expect(minutesDepuis(J, p.arrivee)).toBeLessThanOrEqual(LIMITE);
      expect(minutesDepuis(J, p.depart)).toBeGreaterThanOrEqual(0);
    }
    const ecarts = retenues.map((p) => `${decrire(p, J)} ⇒ ${ecartVoieReference(p, cars, trains) ?? "voie de référence"}`);
    expect(
      retenues.some((p) => ecartVoieReference(p, cars, trains) === null),
      `aucune possibilité retenue n'est la voie de référence :\n${ecarts.join("\n")}`,
    ).toBe(true);
  });

  it(`${FERIE} (férié) : le car ne circule pas, verdict « impossible » (critère 5)`, async () => {
    const carsReference = await oracle.courses("sncf", A.carDepart.id, A.carArrivee.id, J);
    for (const c of carsReference) {
      expect(await oracle.circule("sncf", c.serviceId, FERIE), `${c.tripId} circule le ${FERIE}`).toBe(false);
    }
    const departs = (await oracle.departs("sncf", A.carDepart.id, FERIE)).filter((d) => d.depart < s.rendezVousMinutes);
    expect(departs, "un car SNCF part de Brienon Mairie avant le rendez-vous").toEqual([]);

    const toutes = await chercher(FERIE);
    const retenues = retenir(toutes, FERIE, LIMITE);
    expect(retenues.map((p) => decrire(p, FERIE))).toEqual([]);
    expect(verdict(retenues)).toBe("impossible");
  });

  it(`${DIMANCHE} (dimanche) : ni car ni bus, verdict « impossible » (critère 6)`, async () => {
    const carsReference = await oracle.courses("sncf", A.carDepart.id, A.carArrivee.id, J);
    for (const c of carsReference) {
      expect(await oracle.circule("sncf", c.serviceId, DIMANCHE), `${c.tripId} circule le ${DIMANCHE}`).toBe(false);
    }
    const cars = (await oracle.departs("sncf", A.carDepart.id, DIMANCHE)).filter((d) => d.depart < s.rendezVousMinutes);
    expect(cars, "un car SNCF part de Brienon Mairie avant le rendez-vous").toEqual([]);
    const bus = (await oracle.departs("mobigo", A.busDepart.id, DIMANCHE)).filter((d) => d.depart < s.rendezVousMinutes);
    expect(bus, "un bus Mobigo part de Brienon Mairie avant le rendez-vous").toEqual([]);

    const retenues = retenir(await chercher(DIMANCHE), DIMANCHE, LIMITE);
    expect(retenues.map((p) => decrire(p, DIMANCHE))).toEqual([]);
    expect(verdict(retenues)).toBe("impossible");
  });

  it(`${J} : correspondance de 0 min bus Mobigo → train exclue (critère 7)`, async () => {
    const bus = await oracle.courses("mobigo", A.busDepart.id, A.busArrivee.id, J);
    const trains = await oracle.courses("sncf", A.trainDepart.id, A.trainArrivee.id, J);
    const paires = bus.flatMap((b) => trains.filter((t) => t.depart === b.arrivee).map((t) => [b, t] as const));
    expect(paires.length, "l'oracle ne constate plus de correspondance nulle : relire la spec").toBeGreaterThan(0);

    for (const p of await chercher(J)) {
      const iBus = p.etapes.findIndex((e) => paires.some(([b]) => e.tripId?.endsWith(`mobigo_${b.tripId}`)));
      if (iBus < 0) continue;
      const busPris = paires.filter(([b]) => p.etapes[iBus]!.tripId!.endsWith(`mobigo_${b.tripId}`));
      const enchaine = p.etapes
        .slice(iBus + 1)
        .some((e) => busPris.some(([, t]) => e.tripId?.endsWith(`sncf_${t.tripId}`)));
      expect(enchaine, `MOTIS enchaîne le bus et le train en 0 min : ${decrire(p, J)}`).toBe(false);
    }
  });
});
