import type { SQLiteDatabase } from "expo-sqlite";

import { cleVoyage, lireVoyage, type Voyage } from "@/domaine/voyages";

// Voyages enregistrés (spec 22, D98), table `voyages` de la base du téléphone (migration en version 2).

/** Une ligne de la table : le voyage relu, ou null s'il ne peut plus être lu (D98, §3.7). */
export type LigneVoyage = { cle: string; voyage: Voyage | null };

/** Enregistre le voyage ; la même recherche remplace l'ancien (D98, §3.3). Rend sa clé. */
export async function enregistrerVoyage(db: SQLiteDatabase, voyage: Voyage): Promise<string> {
  const cle = cleVoyage(voyage.demande, voyage.depart, voyage.arrivee);
  await db.runAsync(
    "INSERT INTO voyages (cle, enregistre_le, contenu) VALUES (?, ?, ?) ON CONFLICT(cle) DO UPDATE SET enregistre_le = excluded.enregistre_le, contenu = excluded.contenu",
    cle,
    voyage.enregistre_le,
    JSON.stringify(voyage),
  );
  return cle;
}

export async function lireVoyages(db: SQLiteDatabase): Promise<LigneVoyage[]> {
  const lignes = await db.getAllAsync<{ cle: string; contenu: string }>("SELECT cle, contenu FROM voyages");
  return lignes.map((l) => ({ cle: l.cle, voyage: lireVoyage(l.contenu) }));
}

export async function supprimerVoyage(db: SQLiteDatabase, cle: string): Promise<void> {
  await db.runAsync("DELETE FROM voyages WHERE cle = ?", cle);
}
