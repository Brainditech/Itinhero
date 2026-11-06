import fichier from "./fiches.json" with { type: "json" };
import { Annuaire, schemaFichierFiches, type LirePage } from "./annuaire.js";

/** Fiches versionnées avec le serveur (spec 41), validées par Zod au démarrage (invariant 9). */
export function chargerAnnuaire(lirePage?: LirePage): Annuaire {
  return new Annuaire(schemaFichierFiches.parse(fichier).fiches, lirePage);
}
