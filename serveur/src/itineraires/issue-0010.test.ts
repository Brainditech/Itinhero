import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { lireAdresseInverse } from "../lieux/ign-geocode.js";
import { appTest, ENTETE, MANIFEST_TEST } from "../outils-test.js";
import { IndexHoraires, lireHorairesJeu, type HorairesJeu } from "./horaires-gtfs.js";
import { lireReponsePlan, type DemandeRecherche } from "./motis-plan.js";
import { directionEtNumero, normaliser, type PossibiliteAffichee } from "./normaliser.js";
import { nomAffichable } from "./noms.js";
import { retenir } from "./verdict.js";

/**
 * Issue 0010 : Brienon → tribunal administratif de Dijon, samedi 14/11/2026, arriver avant 15:35,
 * marge 10 min. Réponse du MOTIS national enregistrée le 2026-11-04 (`detailedLegs=true`),
 * GTFS Mobigo de `fixtures/` pour les réservations (invariant 15).
 */
const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, "../../..");
const PLAN = path.join(ICI, "__exemples__/plan-brienon-dijon-2026-11-14-detaille.json");
const INVERSE = path.join(ICI, "../lieux/__exemples__/ign-inverse-tribunal-dijon.json");
const MOBIGO = path.join(RACINE, "fixtures/_rapatrie-2026-10-19/mobigo89.zip");

const lirePlan = async (): Promise<unknown> => JSON.parse(await readFile(PLAN, "utf8"));

let mobigo: HorairesJeu;
let samedi: PossibiliteAffichee[];

beforeAll(async () => {
  mobigo = await lireHorairesJeu(MOBIGO);
  // Le GTFS Mobigo de fixtures/ porte les mêmes trip_id que le jeu national r84072.
  const horaires = new IndexHoraires({ version: 1, jeux: { r84072: mobigo } });
  const retenues = retenir(lireReponsePlan(await lirePlan()), "2026-11-14", 15 * 60 + 25);
  samedi = normaliser(retenues, MANIFEST_TEST, {
    horaires,
    noms: { depart: "Domicile", arrivee: "Tribunal administratif de Dijon" },
    auPlusTot: new Date("2026-11-13T23:00:00Z"),
  }).possibilites;
}, 30_000);

const premiere = () => samedi[0]!;
const etape = (mode: string) => premiere().etapes.find((e) => e.mode === mode)!;

describe("A — direction d'un train SNCF", () => {
  it("« 17769 » est le numéro ; la direction est le terminus « Lyon Part Dieu »", () => {
    expect(etape("train")).toMatchObject({ ligne: "K7", numero: "17769", direction: "Lyon Part Dieu" });
  });
  it("une direction faite de lettres reste la direction, remise en forme", () => {
    expect(directionEtNumero("DIJON Valmy", "DIJON Valmy")).toEqual({ direction: "Dijon Valmy", numero: null });
    expect(directionEtNumero("Auxerre", "6 RUE PAUL DOUMER")).toEqual({ direction: "Auxerre", numero: null });
    expect(directionEtNumero(undefined, "Gare de Troyes")).toEqual({ direction: "Gare de Troyes", numero: null });
    expect(directionEtNumero("43287", undefined)).toEqual({ direction: null, numero: "43287" });
  });
});

describe("B — réservation lue dans le GTFS (D69)", () => {
  it("le 803 de 08:25 à MAIRIE est sur réservation (pickup_type=2)", () => {
    expect(mobigo.reservations["1014608-1-1"]).toContain("m:600326");
    expect(etape("bus")).toMatchObject({ ligne: "803", reservation: "appel" });
  });
  it("le train et le tram ne le sont pas", () => {
    expect(etape("train").reservation).toBeNull();
    expect(etape("tram").reservation).toBeNull();
  });
  it("sans horaires.json, la réservation est inconnue (null), jamais inventée", () => {
    const sans = normaliser(lireReponsePlanSync(), MANIFEST_TEST).possibilites;
    expect(sans.flatMap((p) => p.etapes.map((e) => e.reservation)).every((r) => r === null)).toBe(true);
  });
});

let brut: unknown;
const lireReponsePlanSync = () => lireReponsePlan(brut);
beforeAll(async () => {
  brut = await lirePlan();
});

describe("C — lieu d'arrivée nommé, adresse par l'IGN", () => {
  it("la dernière étape va au lieu choisi, la première part du domicile", () => {
    expect(premiere().etapes.at(-1)!.a).toMatchObject({ nom: "Tribunal administratif de Dijon", type: "arrivee" });
    expect(premiere().etapes[0]!.de).toMatchObject({ nom: "Domicile", type: "depart" });
  });
  it("numéro trouvé à 15 m ⇒ la rue sans numéro", async () => {
    expect(lireAdresseInverse(JSON.parse(await readFile(INVERSE, "utf8")))).toBe("Rue d'Assas, 21000 Dijon");
  });
  it("numéro à 10 m ou moins ⇒ l'adresse complète", () => {
    const exact = {
      features: [
        {
          properties: {
            type: "housenumber",
            label: "22 Rue d'Assas 21000 Dijon",
            street: "Rue d'Assas",
            postcode: "21000",
            city: "Dijon",
            distance: 4,
          },
        },
      ],
    };
    expect(lireAdresseInverse(exact)).toBe("22 Rue d'Assas, 21000 Dijon");
    expect(lireAdresseInverse({ features: [] })).toBeNull();
  });
});

describe("D — marge avant la première montée (D68)", () => {
  it("bus sur réservation : à l'arrêt 10 min avant, la marche de 1 min part à 08:14", () => {
    expect(premiere().montee).toEqual({ arriver_a: "08:15", vehicule: "08:25", marge_minutes: 10 });
    expect(premiere().depart).toBe("08:14");
    expect(premiere().etapes[0]).toMatchObject({ mode: "marche", depart: "08:14", arrivee: "08:15", duree_minutes: 1 });
    expect(etape("bus").depart).toBe("08:25"); // le bus ne bouge pas
    expect(premiere().arrivee).toBe("10:38");
  });
  it("sans réservation : 5 min", () => {
    const sans = normaliser(retenir(lireReponsePlanSync(), "2026-11-14", 15 * 60 + 25), MANIFEST_TEST).possibilites;
    expect(sans[0]!.montee).toEqual({ arriver_a: "08:20", vehicule: "08:25", marge_minutes: 5 });
  });
  it("jamais avant l'heure permise : marge raccourcie", () => {
    const limite = new Date("2026-11-14T07:22:00Z"); // 08:22
    const p = normaliser(retenir(lireReponsePlanSync(), "2026-11-14", 15 * 60 + 25), MANIFEST_TEST, { auPlusTot: limite }).possibilites[0]!;
    expect(p.depart).toBe("08:22");
    expect(p.montee).toEqual({ arriver_a: "08:23", vehicule: "08:25", marge_minutes: 2 });
  });
});

describe("F — noms et nature des lieux", () => {
  it.each([
    ["MAIRIE", "Mairie"],
    ["SAINT FLORENTIN-VERGIGNY 3 RUE DE LA GARE", "Saint-Florentin-Vergigny, 3 rue de la Gare"],
    ["DIJON Gare", "Dijon Gare"],
    ["6 RUE PAUL DOUMER", "6 rue Paul Doumer"],
    ["QUETIGNY Centre La Parenthèse", "Quetigny Centre La Parenthèse"],
    ["Saint-Florentin - Vergigny", "Saint-Florentin - Vergigny"],
    ["Godrans Les Halles", "Godrans Les Halles"],
    ["GARE SNCF", "Gare SNCF"],
    ["PLACE DE L'EGLISE", "Place de l'Eglise"],
  ])("« %s » ⇒ « %s »", (brut, attendu) => {
    expect(nomAffichable(brut)).toBe(attendu);
  });
  it("le bus arrive à un arrêt, la marche suivante mène à une gare, le tram part d'une station", () => {
    const bus = etape("bus");
    expect(bus.de).toMatchObject({ nom: "Mairie", type: "arret" });
    expect(bus.a).toMatchObject({ nom: "Saint-Florentin-Vergigny, 3 rue de la Gare", type: "arret" });
    const marche = premiere().etapes[2]!;
    expect(marche.de.type).toBe("arret");
    expect(marche.a).toMatchObject({ nom: "Saint-Florentin - Vergigny", type: "gare" });
    expect(etape("tram").de).toMatchObject({ nom: "Dijon Gare", type: "station" });
  });
});

describe("H — fin de validité des horaires", () => {
  it("Mobigo de fixtures/ : dernière date de calendar.txt et calendar_dates.txt", () => {
    expect(mobigo.fin_validite).toMatch(/^2027-0[6-8]-\d{2}$/);
    expect(etape("bus").source).toMatchObject({ type: "gtfs", fin_validite: mobigo.fin_validite });
  });
});

describe("route : noms envoyés par l'app et adresse de l'arrivée", () => {
  const moteur = {
    plan: async (_d: DemandeRecherche) => lirePlan(),
    geocoder: () => Promise.reject(new Error("inutile")),
  };
  const corps = {
    depart: { lat: 47.9918, lon: 3.617 },
    arrivee: { lat: 47.324505, lon: 5.043521 },
    date: "2026-11-14",
    heure: "15:35",
    sens: "arriver",
    marge: 10,
    noms: { depart: "Domicile", arrivee: "Tribunal administratif de Dijon" },
  };
  it("la réponse porte le nom et l'adresse de l'arrivée", async () => {
    const app = appTest({ moteur, adresseIgn: async () => "Rue d'Assas, 21000 Dijon" });
    const r = await app.inject({ method: "POST", url: "/v1/itineraires", headers: ENTETE, payload: corps });
    expect(r.statusCode).toBe(200);
    expect(r.json().arrivee).toEqual({ nom: "Tribunal administratif de Dijon", adresse: "Rue d'Assas, 21000 Dijon" });
    expect(r.json().possibilites[0].etapes.at(-1).a.nom).toBe("Tribunal administratif de Dijon");
  });
  it("une adresse en panne ne fait pas échouer la recherche", async () => {
    const app = appTest({ moteur, adresseIgn: () => Promise.reject(new Error("IGN")) });
    const r = await app.inject({ method: "POST", url: "/v1/itineraires", headers: ENTETE, payload: corps });
    expect(r.statusCode).toBe(200);
    expect(r.json().arrivee.adresse).toBeNull();
  });
  it("un nom trop long est refusé", async () => {
    const app = appTest({ moteur });
    const r = await app.inject({
      method: "POST",
      url: "/v1/itineraires",
      headers: ENTETE,
      payload: { ...corps, noms: { arrivee: "x".repeat(121) } },
    });
    expect(r.statusCode).toBe(400);
  });
});
