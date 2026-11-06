import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { z } from "zod";
import type { Manifest } from "../manifest.js";
import type { Moteur } from "../motis.js";
import type { IndexHoraires } from "../itineraires/horaires-gtfs.js";
import { lireReponsePlan, type DemandeRecherche } from "../itineraires/motis-plan.js";
import { raccourcirCorrespondances } from "../itineraires/correspondances.js";
import { normaliser, taxisUtiles } from "../itineraires/normaliser.js";
import { retenir, retenirPartir, verdict } from "../itineraires/verdict.js";
import type { AdresseInverse } from "../lieux/ign-geocode.js";
import { heureParis, hhmm, instantParis } from "../temps.js";
import { appelMoteur, refuserEntree } from "./erreurs.js";
import { dansZoneCouverte } from "../zone/zone.js";
import type { Annuaire } from "../fiches/annuaire.js";
import { ajouterContacts } from "../fiches/contacts.js";

/** `POST /v1/itineraires` (spec 09, §4.5) : verdict et possibilités sourcées. */
export const MAX_POSSIBILITES = 10;

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const schemaPoint = z
  .object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })
  .strict();

export const schemaRequeteItineraires = z
  .object({
    depart: schemaPoint,
    arrivee: schemaPoint,
    date: z.iso.date(),
    heure: z.string().regex(HEURE),
    sens: z.enum(["arriver", "partir"]),
    marge: z.number().int().min(0).max(120).default(10), // D17
    // Noms choisis dans l'app (issue 0010, C) : remplacent « Départ » et « Arrivée ». Ni gardés ni journalisés.
    noms: z
      .object({
        depart: z.string().trim().min(1).max(120).optional(),
        arrivee: z.string().trim().min(1).max(120).optional(),
      })
      .strict()
      .optional(),
    // Spec 19 (D94) : fin du rendez-vous, le même jour ⇒ retour cherché en « partir à » depuis cette heure.
    fin_rdv: z.string().regex(HEURE).optional(),
  })
  .strict()
  .refine((d) => d.sens === "partir" || minutesDe(d.heure) - d.marge >= 0, {
    path: ["marge"],
    message: "l'heure moins la marge tombe la veille",
  })
  .refine((d) => d.fin_rdv === undefined || minutesDe(d.fin_rdv) > minutesDe(d.heure), {
    path: ["fin_rdv"],
    message: "la fin du rendez-vous n'est pas après l'heure de l'aller",
  });

export type RequeteItineraires = z.infer<typeof schemaRequeteItineraires>;

function minutesDe(h: string): number {
  const [hh, mm] = h.split(":").map(Number) as [number, number];
  return hh * 60 + mm;
}

/** Un sens du voyage : l'aller tel que demandé, ou le retour (spec 19). */
export type RequeteSens = Omit<RequeteItineraires, "fin_rdv">;

/**
 * Retour (D94) : départ et arrivée inversés, noms aussi, « partir à » la fin du rendez-vous, le même jour.
 * La marge (D17) ne sert qu'en « arriver » : elle est gardée telle quelle, sans effet.
 */
export function requeteRetour(r: RequeteItineraires & { fin_rdv: string }): RequeteSens {
  return {
    depart: r.arrivee,
    arrivee: r.depart,
    date: r.date,
    heure: r.fin_rdv,
    sens: "partir",
    marge: r.marge,
    ...(r.noms ? { noms: { depart: r.noms.arrivee, arrivee: r.noms.depart } } : {}),
  };
}

export function demandeMoteur(r: RequeteSens): DemandeRecherche {
  const commun = { depart: r.depart, arrivee: r.arrivee, jour: r.date };
  return r.sens === "partir"
    ? { ...commun, sens: "partir", depuisMinutes: minutesDe(r.heure) }
    : { ...commun, sens: "arriver", limiteMinutes: minutesDe(r.heure) - r.marge };
}

export type OptionsItineraires = {
  /** Réservations et fins de validité lues dans les GTFS (D69). */
  horaires?: IndexHoraires;
  /** Adresse postale du point d'arrivée (issue 0010, C). */
  adresse?: AdresseInverse;
  /** Spec 41 (D122) : fiches de taxis et de transport à la demande. */
  annuaire?: Annuaire;
  /** Jour de Paris d'aujourd'hui (issue 0025) ; l'horloge par défaut, fixé dans les tests. */
  aujourdhui?: () => string;
};

/** Une adresse introuvable ne fait jamais échouer la recherche. */
async function adresseOuRien(adresse: AdresseInverse | undefined, p: { lat: number; lon: number }): Promise<string | null> {
  if (!adresse) return null;
  try {
    return await adresse(p);
  } catch {
    return null;
  }
}

/**
 * Un sens du voyage, de bout en bout : recherche normale et recherches avec taxi (spec 16) en même temps,
 * correspondances raccourcies (D81), normalisation sourcée, verdict. Une panne de la recherche normale
 * est levée (l'appelant répond 503) ; celle d'une recherche avec taxi ne fait jamais échouer la recherche.
 */
async function chercherSens(
  r: RequeteSens,
  moteur: Moteur,
  manifest: Manifest,
  options: OptionsItineraires,
  log: FastifyBaseLogger,
) {
  const d = demandeMoteur(r);
  const adresse = adresseOuRien(options.adresse, r.arrivee); // demandée pendant que MOTIS cherche
  // Spec 16 (D48) : la même recherche avec un taxi permis au début et à la fin.
  const avecTaxi = Promise.all(
    (["debut", "fin"] as const).map((taxi) =>
      moteur
        .plan({ ...d, taxi })
        .then(lireReponsePlan)
        .catch((e: unknown) => {
          log.warn({ err: (e as Error).name, taxi }, "recherche avec taxi impossible");
          return [];
        }),
    ),
  ).then((listes) => listes.flat());
  // Spec 41 (D122) : la route en voiture de bout en bout, en même temps ; une panne ne fait rien échouer.
  const taxiDirect = moteur
    .plan({ ...d, taxiDirect: true })
    .then(lireReponsePlan)
    .then((ps) => taxiDeBoutEnBout(ps, d))
    .catch(() => null);
  const toutes = lireReponsePlan(await moteur.plan(d));

  const retenir_ = (ps: Awaited<typeof avecTaxi>) =>
    d.sens === "partir" ? retenirPartir(ps, d.jour, d.depuisMinutes) : retenir(ps, d.jour, d.limiteMinutes);
  const optionsNormalisation = {
    horaires: options.horaires,
    noms: r.noms,
    // La marge avant la première montée (D68) ne fait jamais partir avant l'heure demandée, ni la veille.
    auPlusTot: d.sens === "partir" ? instantParis(d.jour, d.depuisMinutes) : instantParis(d.jour, 0),
  };
  const replanifier = async (dd: DemandeRecherche) => lireReponsePlan(await moteur.plan(dd));
  // Issue 0013 (D81) : une marche de plus de 15 min entre deux transports est redemandée seule à MOTIS.
  const raccourcies = await raccourcirCorrespondances(retenir_(toutes), replanifier);
  const { possibilites: toutesAffichees, retirees } = normaliser(raccourcies, manifest, optionsNormalisation);
  // Au plus 10 : les premiers départs en « partir », les derniers en « arriver » (au plus près du rendez-vous).
  const sansTaxi = r.sens === "partir" ? toutesAffichees.slice(0, MAX_POSSIBILITES) : toutesAffichees.slice(-MAX_POSSIBILITES);
  // Normalisées à part : un taxi ne retire jamais un trajet sans taxi comme « dominé » (D80).
  const taxisRaccourcis = await raccourcirCorrespondances(retenir_(await avecTaxi), replanifier);
  const taxis = taxisUtiles(normaliser(taxisRaccourcis, manifest, optionsNormalisation).possibilites, sansTaxi, r.sens);
  const triees = [...sansTaxi, ...taxis].sort(
    (a, b) => a.depart_utc.localeCompare(b.depart_utc) || a.arrivee_utc.localeCompare(b.arrivee_utc),
  );
  if (retirees > 0) log.warn({ retirees }, "possibilités sans source retirées");
  const possibilites = ajouterContacts(triees, manifest, options.annuaire, options.horaires);

  return {
    verdict: verdict(possibilites), // jamais sur une possibilité retirée
    demande: {
      date: r.date,
      heure: r.heure,
      sens: r.sens,
      marge: r.sens === "arriver" ? r.marge : null,
      limite: d.sens === "arriver" ? hhmm(d.limiteMinutes) : null,
    },
    arrivee: { nom: r.noms?.arrivee ?? null, adresse: await adresse },
    possibilites,
    taxi_direct: await taxiDirect,
  };
}

/** Au plus 3 réseaux nommés, les plus gros d'abord (SNCF, Île-de-France Mobilités…). */
export const MAX_RESEAUX_NOMMES = 3;

/**
 * Issue 0025 : réseaux dont les horaires s'arrêtent avant le jour demandé. Sans eux, « Impossible » peut
 * venir de là (les trains ou métros d'après ne sont pas encore publiés) : l'app le dit. null si aucun.
 */
export function horairesAVenir(
  horaires: IndexHoraires | undefined,
  manifest: Manifest,
  date: string,
  aujourdhui: string,
): { nombre: number; reseaux: string[]; des_le: string } | null {
  const liste = horaires?.nonPublies(date, aujourdhui) ?? [];
  if (liste.length === 0) return null;
  const tailles = new Map(manifest.fichiers.map((f) => [f.jeu, f.taille]));
  const noms = [...liste]
    .sort((a, b) => (tailles.get(b.jeu) ?? 0) - (tailles.get(a.jeu) ?? 0))
    .flatMap((j) => (j.nom ? [j.nom] : []));
  const reseaux = [...new Set(noms)].slice(0, MAX_RESEAUX_NOMMES);
  const fin = liste.map((j) => j.fin).sort()[0]!;
  // Le premier jour sans horaires : le lendemain de la fin la plus proche.
  const [a, m, j] = fin.split("-").map(Number) as [number, number, number];
  const des_le = new Date(Date.UTC(a, m - 1, j + 1)).toISOString().slice(0, 10);
  return { nombre: liste.length, reseaux, des_le };
}

/**
 * Taxi de bout en bout (spec 41, D48) : durée de route estimée par MOTIS sur OSM (hors attente), placée pour
 * arriver à H − M (« arriver ») ou partir à H (« partir »). Jamais de prix (invariant 5).
 */
export function taxiDeBoutEnBout(
  ps: Awaited<ReturnType<typeof lireReponsePlan>>,
  d: DemandeRecherche,
): { duree_minutes: number; distance_metres: number | null; depart: string; arrivee: string; depart_utc: string; arrivee_utc: string } | null {
  const voiture = ps.find((p) => p.etapes.length === 1 && p.etapes[0]!.mode === "CAR")?.etapes[0];
  if (!voiture) return null;
  const duree = Math.max(1, Math.round(voiture.dureeSecondes / 60));
  const depart = d.sens === "partir" ? instantParis(d.jour, d.depuisMinutes) : instantParis(d.jour, d.limiteMinutes - duree);
  const arrivee = new Date(depart.getTime() + duree * 60_000);
  return {
    duree_minutes: duree,
    distance_metres: voiture.distanceMetres === undefined ? null : Math.round(voiture.distanceMetres),
    depart: heureParis(depart).hhmm,
    arrivee: heureParis(arrivee).hhmm,
    depart_utc: depart.toISOString(),
    arrivee_utc: arrivee.toISOString(),
  };
}

export function routeItineraires(
  app: FastifyInstance,
  moteur: Moteur,
  manifest: Manifest,
  options: OptionsItineraires = {},
): void {
  app.post("/itineraires", { bodyLimit: 8 * 1024 }, async (requete, reponse) => {
    const entree = schemaRequeteItineraires.safeParse(requete.body);
    if (!entree.success) return refuserEntree(reponse, entree.error);
    const { fin_rdv, ...aller } = entree.data;

    // Spec 27 (D105) : hors de l'extrait OSM chargé, aucune recherche ; le refus nomme le point, jamais ses coordonnées.
    const points = (["depart", "arrivee"] as const).filter((p) => !dansZoneCouverte(aller[p]));
    if (points.length > 0) return reponse.code(422).send({ erreur: "hors_zone", points });

    // Spec 19 (D94) : l'aller et, avec une fin de rendez-vous, le retour inversé, cherchés en même temps.
    const sens = await appelMoteur(reponse, () =>
      Promise.all([
        chercherSens(aller, moteur, manifest, options, requete.log),
        fin_rdv === undefined
          ? null
          : chercherSens(requeteRetour({ ...entree.data, fin_rdv }), moteur, manifest, options, requete.log),
      ]),
    );
    if (sens === undefined) return reponse;
    const [resultatAller, retour] = sens;
    const horaires_a_venir = horairesAVenir(
      options.horaires,
      manifest,
      aller.date,
      options.aujourdhui?.() ?? heureParis(new Date()).jour,
    );
    return { ...resultatAller, retour, horaires_a_venir };
  });
}
