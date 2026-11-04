import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { lireReponseGeocode } from "../lieux/motis-geocode.js";
import { fusionner, lireReponseIgn, type GeocodeurIgn } from "../lieux/ign-geocode.js";
import type { Moteur } from "../motis.js";
import { comprendreCategorie, type IndexLieux } from "../lieux/categories.js";
import { distanceMetres } from "../lieux/distance.js";
import { appelMoteur, refuserEntree } from "./erreurs.js";

/**
 * `GET /v1/lieux?q=…&proche=lat,lon` (spec 09, §4.4) : candidats du géocodeur de l'IGN (adresses,
 * lieux) et de MOTIS (arrêts, lieux d'OSM), classés ensemble (D60). `proche` (facultatif) fait
 * remonter les candidats proches d'un point (le domicile ou le départ, fourni par l'app) ;
 * il n'est ni stocké ni journalisé (invariants 6 et 10).
 */
const schemaPoint = z
  .string()
  .regex(/^-?\d{1,2}(\.\d+)?,-?\d{1,3}(\.\d+)?$/)
  .transform((s) => {
    const [lat, lon] = s.split(",").map(Number) as [number, number];
    return { lat, lon };
  })
  .pipe(z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }));

export const schemaRequeteLieux = z
  .object({
    q: z.string().trim().min(2).max(200),
    proche: schemaPoint.optional(),
  })
  .strict();

export function routeLieux(app: FastifyInstance, moteur: Moteur, ign?: GeocodeurIgn, lieux?: IndexLieux): void {
  app.get("/lieux", async (requete, reponse) => {
    const entree = schemaRequeteLieux.safeParse(requete.query);
    if (!entree.success) return refuserEntree(reponse, entree.error);
    const { q, proche } = entree.data;
    // L'IGN et MOTIS en parallèle ; l'IGN en panne ou lent ⇒ MOTIS seul (D60).
    const depuisIgn = ign
      ? ign(q, proche)
          .then(lireReponseIgn)
          .catch((e: unknown) => {
            requete.log.warn({ erreur: (e as Error).name }, "géocodeur de l'IGN indisponible");
            return [];
          })
      : Promise.resolve([]);
    const candidatsMotis = await appelMoteur(reponse, async () => lireReponseGeocode(await moteur.geocoder(q, proche)));
    if (candidatsMotis === undefined) return reponse;
    const parNom = fusionner(await depuisIgn, candidatsMotis, proche, q);
    // « restaurant chinois », « pharmacie » : les plus proches de la catégorie d'abord (D61).
    const demande = lieux && proche ? comprendreCategorie(q) : null;
    const parCategorie = demande && lieux && proche ? lieux.chercher(demande, proche) : [];
    const candidats = [...parCategorie, ...parNom].slice(0, 10);
    // Distance au point de référence, quand il est donné (à vol d'oiseau, arrondie à 10 m).
    return {
      candidats: proche
        ? candidats.map((c) => ({ ...c, distance_metres: Math.round(distanceMetres(proche, c) / 10) * 10 }))
        : candidats,
    };
  });
}
