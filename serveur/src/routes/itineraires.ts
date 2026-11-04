import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Manifest } from "../manifest.js";
import type { Moteur } from "../motis.js";
import type { IndexHoraires } from "../itineraires/horaires-gtfs.js";
import { lireReponsePlan, type DemandeRecherche } from "../itineraires/motis-plan.js";
import { normaliser, taxisUtiles } from "../itineraires/normaliser.js";
import { retenir, retenirPartir, verdict } from "../itineraires/verdict.js";
import type { AdresseInverse } from "../lieux/ign-geocode.js";
import { hhmm, instantParis } from "../temps.js";
import { appelMoteur, refuserEntree } from "./erreurs.js";

/** `POST /v1/itineraires` (spec 09, §4.5) : verdict et possibilités sourcées. */
export const MAX_POSSIBILITES = 10;

const schemaPoint = z
  .object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })
  .strict();

export const schemaRequeteItineraires = z
  .object({
    depart: schemaPoint,
    arrivee: schemaPoint,
    date: z.iso.date(),
    heure: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
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
  })
  .strict()
  .refine((d) => d.sens === "partir" || minutesDe(d.heure) - d.marge >= 0, {
    path: ["marge"],
    message: "l'heure moins la marge tombe la veille",
  });

export type RequeteItineraires = z.infer<typeof schemaRequeteItineraires>;

function minutesDe(h: string): number {
  const [hh, mm] = h.split(":").map(Number) as [number, number];
  return hh * 60 + mm;
}

export function demandeMoteur(r: RequeteItineraires): DemandeRecherche {
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

export function routeItineraires(
  app: FastifyInstance,
  moteur: Moteur,
  manifest: Manifest,
  options: OptionsItineraires = {},
): void {
  app.post("/itineraires", { bodyLimit: 8 * 1024 }, async (requete, reponse) => {
    const entree = schemaRequeteItineraires.safeParse(requete.body);
    if (!entree.success) return refuserEntree(reponse, entree.error);
    const r = entree.data;
    const d = demandeMoteur(r);

    const adresse = adresseOuRien(options.adresse, r.arrivee); // demandée pendant que MOTIS cherche
    // Spec 16 (D48) : la même recherche avec un taxi permis au début et à la fin. Son échec ne fait jamais échouer la recherche.
    const avecTaxi = Promise.all(
      (["debut", "fin"] as const).map((taxi) =>
        moteur
          .plan({ ...d, taxi })
          .then(lireReponsePlan)
          .catch((e: unknown) => {
            requete.log.warn({ err: (e as Error).name, taxi }, "recherche avec taxi impossible");
            return [];
          }),
      ),
    ).then((listes) => listes.flat());
    const toutes = await appelMoteur(reponse, async () => lireReponsePlan(await moteur.plan(d)));
    if (toutes === undefined) return reponse;

    const retenir_ = (ps: Awaited<typeof avecTaxi>) =>
      d.sens === "partir" ? retenirPartir(ps, d.jour, d.depuisMinutes) : retenir(ps, d.jour, d.limiteMinutes);
    const optionsNormalisation = {
      horaires: options.horaires,
      noms: r.noms,
      // La marge avant la première montée (D68) ne fait jamais partir avant l'heure demandée, ni la veille.
      auPlusTot: d.sens === "partir" ? instantParis(d.jour, d.depuisMinutes) : instantParis(d.jour, 0),
    };
    const { possibilites: toutesAffichees, retirees } = normaliser(retenir_(toutes), manifest, optionsNormalisation);
    // Au plus 10 : les premiers départs en « partir », les derniers en « arriver » (au plus près du rendez-vous).
    const sansTaxi = r.sens === "partir" ? toutesAffichees.slice(0, MAX_POSSIBILITES) : toutesAffichees.slice(-MAX_POSSIBILITES);
    // Normalisées à part : un taxi ne retire jamais un trajet sans taxi comme « dominé » (D80).
    const taxis = taxisUtiles(normaliser(retenir_(await avecTaxi), manifest, optionsNormalisation).possibilites, sansTaxi, r.sens);
    const possibilites = [...sansTaxi, ...taxis].sort(
      (a, b) => a.depart_utc.localeCompare(b.depart_utc) || a.arrivee_utc.localeCompare(b.arrivee_utc),
    );
    if (retirees > 0) requete.log.warn({ retirees }, "possibilités sans source retirées");

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
    };
  });
}
