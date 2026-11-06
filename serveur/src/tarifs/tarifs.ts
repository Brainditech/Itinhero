import { z } from "zod";
import type { IndexHoraires } from "../itineraires/horaires-gtfs.js";
import type { PossibiliteAffichee } from "../itineraires/normaliser.js";
import fichier from "./tarifs.json" with { type: "json" };

/**
 * Tarifs (spec 43, D124, invariant 5) : fiches versionnées, chacune avec son URL et sa date de lecture. Seules les
 * fiches **validées par Brainditech** (`valide_le`) s'appliquent : sans elle, « prix non publié ». Aucun prix n'est
 * calculé ni estimé : un tarif s'applique tel quel à une étape dont le réseau (producteur du jeu GTFS) et le mode
 * correspondent ; les réductions sont appliquées par l'app, avec les cartes cochées sur le téléphone (invariant 7).
 */
const MODES = ["bus", "car", "transport_a_la_demande", "tram", "metro", "train", "rer", "bateau", "remontee"] as const;

export const schemaTarif = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    reseau: z.string().min(1).max(80),
    produit: z.string().min(1).max(120),
    montant_eur: z.number().positive().max(500),
    correspondance: z
      .object({
        producteurs: z.array(z.string().min(1)).min(1),
        exploitant: z.string().min(1).optional(),
        modes: z.array(z.enum(MODES)).min(1),
      })
      .strict(),
    reductions: z.array(
      z
        .object({
          carte: z.string().regex(/^[a-z0-9-]+$/),
          nom: z.string().min(1).max(80),
          pourcentage: z.number().int().min(1).max(100),
          conditions: z.string().max(300).nullable(),
        })
        .strict(),
    ),
    canal_vente: z.string().min(1).max(200).nullable(),
    url: z.url(),
    lu_le: z.iso.date(),
    valide_le: z.iso.date().nullable(),
  })
  .strict();
export type Tarif = z.infer<typeof schemaTarif>;
export const schemaFichierTarifs = z.object({ note: z.string(), tarifs: z.array(schemaTarif) }).strict();

/** Ce que reçoit l'app pour une étape : le tarif tel que publié, ses réductions possibles et sa source. */
export type TarifEtape = {
  id: string;
  reseau: string;
  produit: string;
  montant_eur: number;
  reductions: { carte: string; nom: string; pourcentage: number }[];
  canal_vente: string | null;
  url: string;
  lu_le: string;
};

export function chargerTarifs(): Tarif[] {
  return schemaFichierTarifs.parse(fichier).tarifs;
}

/** Cartes de réduction connues (Réglages) : une par identifiant, tirées des tarifs validés. */
export function cartesConnues(tarifs: Tarif[]): { carte: string; nom: string; reseaux: string[]; pourcentage: number; conditions: string | null }[] {
  const cartes = new Map<string, { carte: string; nom: string; reseaux: string[]; pourcentage: number; conditions: string | null }>();
  for (const t of tarifs.filter((x) => x.valide_le !== null)) {
    for (const r of t.reductions) {
      const c = cartes.get(r.carte) ?? { carte: r.carte, nom: r.nom, reseaux: [], pourcentage: r.pourcentage, conditions: r.conditions };
      if (!c.reseaux.includes(t.reseau)) c.reseaux.push(t.reseau);
      cartes.set(r.carte, c);
    }
  }
  return [...cartes.values()];
}

/** Le tarif validé qui s'applique à une étape, ou null (« prix non publié »). */
export function tarifDeLEtape(
  tarifs: Tarif[],
  etape: { mode: string; exploitant: string | null; source: { type: string; jeu?: string } },
  horaires: IndexHoraires | undefined,
): TarifEtape | null {
  if (etape.source.type !== "gtfs" || !etape.source.jeu) return null;
  const producteur = horaires?.nomDuJeu(etape.source.jeu) ?? null;
  if (!producteur) return null;
  const t = tarifs.find(
    (x) =>
      x.valide_le !== null &&
      x.correspondance.producteurs.includes(producteur) &&
      (x.correspondance.modes as string[]).includes(etape.mode) &&
      (!x.correspondance.exploitant || new RegExp(x.correspondance.exploitant, "i").test(etape.exploitant ?? "")),
  );
  if (!t) return null;
  return {
    id: t.id,
    reseau: t.reseau,
    produit: t.produit,
    montant_eur: t.montant_eur,
    reductions: t.reductions.map(({ carte, nom, pourcentage }) => ({ carte, nom, pourcentage })),
    canal_vente: t.canal_vente,
    url: t.url,
    lu_le: t.lu_le,
  };
}

/** Chaque étape reçoit `tarif` (ou null). */
export function ajouterTarifs<P extends PossibiliteAffichee>(
  possibilites: P[],
  tarifs: Tarif[],
  horaires: IndexHoraires | undefined,
): (Omit<P, "etapes"> & { etapes: (P["etapes"][number] & { tarif: TarifEtape | null })[] })[] {
  return possibilites.map((p) => ({
    ...p,
    etapes: p.etapes.map((e) => ({ ...e, tarif: tarifDeLEtape(tarifs, e, horaires) })),
  }));
}
