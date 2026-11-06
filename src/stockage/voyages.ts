import type { SQLiteDatabase } from "expo-sqlite";

import { cleVoyage, lireVoyage, separerVoyage, type Voyage } from "@/domaine/voyages";

// Voyages enregistrés (spec 22, D98), table `voyages` de la base du téléphone (migration en version 2).

/** Une ligne de la table : le voyage relu, ou null s'il ne peut plus être lu (D98, §3.7). */
export type LigneVoyage = { cle: string; voyage: Voyage | null };

const ECRIRE =
  "INSERT INTO voyages (cle, enregistre_le, contenu) VALUES (?, ?, ?) ON CONFLICT(cle) DO UPDATE SET enregistre_le = excluded.enregistre_le, contenu = excluded.contenu";

/** Enregistre le voyage ; la même recherche remplace l'ancien (D98, §3.3). Rend sa clé. */
export async function enregistrerVoyage(db: SQLiteDatabase, voyage: Voyage): Promise<string> {
  const cle = cleVoyage(voyage.demande, voyage.depart, voyage.arrivee);
  await db.runAsync(ECRIRE, cle, voyage.enregistre_le, JSON.stringify(voyage));
  return cle;
}

export async function lireVoyages(db: SQLiteDatabase): Promise<LigneVoyage[]> {
  const lignes = await db.getAllAsync<{ cle: string; contenu: string }>("SELECT cle, contenu FROM voyages");
  return lignes.map((l) => ({ cle: l.cle, voyage: lireVoyage(l.contenu) }));
}

export async function supprimerVoyage(db: SQLiteDatabase, cle: string): Promise<void> {
  await db.runAsync("DELETE FROM voyages WHERE cle = ?", cle);
}

/**
 * Voyages d'avant D101 enregistrés avec leur retour : chacun devient l'aller et le retour à part, dans une seule
 * transaction (jamais à moitié). Rend les clés des anciennes lignes, dont la carte (D99) doit partir aussi.
 */
export async function separerAnciensVoyages(db: SQLiteDatabase): Promise<string[]> {
  const lignes = await lireVoyages(db);
  const aSeparer = lignes.flatMap((l) => (l.voyage?.reponse.retour ? [{ cle: l.cle, parts: separerVoyage(l.voyage) }] : []));
  if (aSeparer.length === 0) return [];
  await db.withTransactionAsync(async () => {
    for (const { cle, parts } of aSeparer) {
      const nouvelles = new Set<string>();
      for (const v of parts) {
        const c = cleVoyage(v.demande, v.depart, v.arrivee);
        nouvelles.add(c);
        await db.runAsync(ECRIRE, c, v.enregistre_le, JSON.stringify(v));
      }
      if (!nouvelles.has(cle)) await db.runAsync("DELETE FROM voyages WHERE cle = ?", cle);
    }
  });
  return aSeparer.map((a) => a.cle);
}
