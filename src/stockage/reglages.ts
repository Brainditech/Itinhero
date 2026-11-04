import type { SQLiteDatabase } from "expo-sqlite";

import { lireDomicile, type Domicile } from "@/domaine/domicile";

// Réglages du téléphone (PLAN §4, D65) : table clé ⇒ valeur JSON, migrée par `PRAGMA user_version`
// (doc expo-sqlite du SDK 58, `SQLiteProvider` et `onInit`).

export const NOM_BASE = "itinhero.db";
const VERSION = 1;

export async function migrer(db: SQLiteDatabase): Promise<void> {
  const ligne = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  let version = ligne?.user_version ?? 0;
  if (version >= VERSION) return;
  if (version === 0) {
    await db.execAsync(`
PRAGMA journal_mode = 'wal';
CREATE TABLE IF NOT EXISTS reglages (cle TEXT PRIMARY KEY NOT NULL, valeur TEXT NOT NULL);
`);
    version = 1;
  }
  await db.execAsync(`PRAGMA user_version = ${VERSION}`);
}

export async function lireDomicileEnBase(db: SQLiteDatabase): Promise<Domicile | null> {
  const ligne = await db.getFirstAsync<{ valeur: string }>("SELECT valeur FROM reglages WHERE cle = ?", "domicile");
  return lireDomicile(ligne?.valeur);
}

export async function enregistrerDomicileEnBase(db: SQLiteDatabase, domicile: Domicile): Promise<void> {
  await db.runAsync(
    "INSERT INTO reglages (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur",
    "domicile",
    JSON.stringify(domicile),
  );
}
