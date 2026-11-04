import { z } from "zod";

/**
 * Entrées du scénario Joigny (spec 05, §4). AUCUNE valeur attendue ici :
 * heures, courses et jours de circulation sont tirés des fixtures par l'oracle (invariant 15).
 */
const schemaArret = z.object({ jeu: z.enum(["sncf", "mobigo"]), id: z.string().min(1) });

const schemaScenario = z.object({
  origine: schemaArret, // coordonnées tirées de stops.txt par l'oracle
  destination: z.object({
    nom: z.string().min(1),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  rendezVousMinutes: z.number().int().min(0).max(1439),
  margeMinutes: z.number().int().min(0),
  jours: z.object({ reference: z.iso.date(), ferie: z.iso.date(), dimanche: z.iso.date() }),
  marcheMaxMinutes: z.number().int().positive(),
  arrets: z.object({
    carDepart: schemaArret,
    carArrivee: schemaArret,
    trainDepart: schemaArret,
    trainArrivee: schemaArret,
    busDepart: schemaArret,
    busArrivee: schemaArret,
  }),
});

export type Scenario = z.infer<typeof schemaScenario>;

export const scenario: Scenario = schemaScenario.parse({
  origine: { jeu: "sncf", id: "StopPoint:OCECar TER-87117994" }, // Brienon-sur-Armançon Mairie
  // Lieu de rendez-vous, 19 route de Chamvres, Joigny (constat viamobigo.fr du 2026-10-19,
  // docs/04-dissection/captures/SOURCES.md). Lieu public.
  destination: { nom: "Lieu de rendez-vous à Joigny", lat: 47.974911, lon: 3.385793 },
  rendezVousMinutes: 10 * 60, // 10:00
  margeMinutes: 10, // D17
  jours: { reference: "2026-11-12", ferie: "2026-11-11", dimanche: "2026-11-15" },
  marcheMaxMinutes: 50, // D42
  arrets: {
    carDepart: { jeu: "sncf", id: "StopPoint:OCECar TER-87117994" }, // Brienon Mairie
    carArrivee: { jeu: "sncf", id: "StopPoint:OCECar TER-87683334" }, // Saint-Florentin-Ville
    trainDepart: { jeu: "sncf", id: "StopPoint:OCETrain TER-87683318" }, // Saint-Florentin-Vergigny
    trainArrivee: { jeu: "sncf", id: "StopPoint:OCETrain TER-87683243" }, // Joigny
    busDepart: { jeu: "mobigo", id: "600326" }, // Brienon, Mairie
    busArrivee: { jeu: "mobigo", id: "3103848" }, // Saint-Florentin-Vergigny 3 rue de la gare
  },
});

/** Identifiant d'arrêt tel que MOTIS le rend : `<jeu>_<stop_id>` (spec 04). */
export function idMotis(a: { jeu: string; id: string }): string {
  return `${a.jeu}_${a.id}`;
}
