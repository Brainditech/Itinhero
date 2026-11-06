import type { SQLiteDatabase } from "expo-sqlite";

import { HISTORIQUE_MAX, lireDiscussion, type DiscussionGardee } from "@/domaine/historique";

// Historique de l'Assistant (spec 48, D129), table `discussions` de la base du téléphone (migration en version 3).

/** Enregistre (ou met à jour) la discussion, puis ne garde que les 30 plus récentes. */
export async function enregistrerDiscussion(db: SQLiteDatabase, d: DiscussionGardee): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "INSERT INTO discussions (id, mise_a_jour, contenu) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET mise_a_jour = excluded.mise_a_jour, contenu = excluded.contenu",
      d.id,
      d.mise_a_jour,
      JSON.stringify(d),
    );
    await db.runAsync(
      "DELETE FROM discussions WHERE id NOT IN (SELECT id FROM discussions ORDER BY mise_a_jour DESC LIMIT ?)",
      HISTORIQUE_MAX,
    );
  });
}

/** Les discussions gardées, la plus récente d'abord ; une ligne illisible est laissée de côté. */
export async function lireDiscussions(db: SQLiteDatabase): Promise<DiscussionGardee[]> {
  const lignes = await db.getAllAsync<{ contenu: string }>("SELECT contenu FROM discussions ORDER BY mise_a_jour DESC");
  return lignes.flatMap((l) => {
    const d = lireDiscussion(l.contenu);
    return d ? [d] : [];
  });
}

export async function supprimerDiscussion(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync("DELETE FROM discussions WHERE id = ?", id);
}
