import type { IndexHoraires } from "../itineraires/horaires-gtfs.js";
import type { PossibiliteAffichee } from "../itineraires/normaliser.js";
import type { Manifest } from "../manifest.js";
import type { Annuaire, Contact } from "./annuaire.js";

/**
 * Spec 41 (D122) : le numéro à appeler de chaque étape qui en demande un, toujours avec sa source (invariant 16).
 * - taxi : la fiche la plus proche du lieu de prise en charge ;
 * - passage sur réservation : le téléphone de l'exploitant dans son GTFS (`agency.txt`, « non vérifié » : c'est
 *   un fichier public lu par le serveur, pas une fiche validée), sinon la fiche de transport à la demande la plus proche.
 * Les autres étapes : null.
 */
export function ajouterContacts<P extends PossibiliteAffichee>(
  possibilites: P[],
  manifest: Manifest,
  annuaire: Annuaire | undefined,
  horaires: IndexHoraires | undefined,
): (Omit<P, "etapes"> & { etapes: (P["etapes"][number] & { contact: Contact | null })[] })[] {
  const jeux = new Map(manifest.fichiers.map((f) => [f.jeu, f]));
  return possibilites.map((p) => ({
    ...p,
    etapes: p.etapes.map((e) => {
      let contact: Contact | null = null;
      if (e.mode === "taxi") {
        contact = annuaire?.contactsPres(e.de, "taxi")[0] ?? null;
      } else if (e.reservation === "appel") {
        const tel = e.source.type === "gtfs" ? (horaires?.telephone(e.source.jeu, e.exploitant) ?? null) : null;
        const jeu = e.source.type === "gtfs" ? jeux.get(e.source.jeu) : undefined;
        contact =
          tel && e.exploitant
            ? { nom: e.exploitant, numero: tel, source: "gtfs", url: jeu?.url_source ?? null, lu_le: jeu?.date_telechargement ?? null, verifie: false, delai: null }
            : (annuaire?.contactsPres(e.de, "tad")[0] ?? null);
      }
      return { ...e, contact };
    }),
  }));
}
