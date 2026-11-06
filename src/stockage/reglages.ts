import type { SQLiteDatabase } from "expo-sqlite";

import { lireDomicile, type Domicile } from "@/domaine/domicile";

// Réglages du téléphone (PLAN §4, D65) : table clé ⇒ valeur JSON, migrée par `PRAGMA user_version`
// (doc expo-sqlite du SDK 58, `SQLiteProvider` et `onInit`).

export const NOM_BASE = "itinhero.db";
const VERSION = 3;

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
  if (version === 1) {
    // Voyages enregistrés (spec 22, D98) : `contenu` est le voyage en JSON, relu par `lireVoyage`.
    await db.execAsync(`
CREATE TABLE IF NOT EXISTS voyages (cle TEXT PRIMARY KEY NOT NULL, enregistre_le TEXT NOT NULL, contenu TEXT NOT NULL);
`);
    version = 2;
  }
  if (version === 2) {
    // Historique de l'Assistant (spec 48, D129) : `contenu` est la discussion en JSON, relue par `lireDiscussion`.
    await db.execAsync(`
CREATE TABLE IF NOT EXISTS discussions (id TEXT PRIMARY KEY NOT NULL, mise_a_jour TEXT NOT NULL, contenu TEXT NOT NULL);
`);
    version = 3;
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

// ——— Cartes de réduction (spec 43, D124, invariant 7) : gardées ici seulement, jamais envoyées au serveur ———

export async function lireCartesEnBase(db: SQLiteDatabase): Promise<string[]> {
  const ligne = await db.getFirstAsync<{ valeur: string }>("SELECT valeur FROM reglages WHERE cle = ?", "cartes");
  try {
    const v: unknown = ligne ? JSON.parse(ligne.valeur) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function enregistrerCartesEnBase(db: SQLiteDatabase, cartes: string[]): Promise<void> {
  await db.runAsync(
    "INSERT INTO reglages (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur",
    "cartes",
    JSON.stringify([...new Set(cartes)]),
  );
}

/** Catalogue des cartes reçu de `GET /v1/fiches`, gardé pour les Réglages sans réseau. */
export async function lireCatalogueCartes(db: SQLiteDatabase): Promise<unknown> {
  const ligne = await db.getFirstAsync<{ valeur: string }>("SELECT valeur FROM reglages WHERE cle = ?", "catalogue_cartes");
  try {
    return ligne ? JSON.parse(ligne.valeur) : null;
  } catch {
    return null;
  }
}

export async function enregistrerCatalogueCartes(db: SQLiteDatabase, catalogue: unknown): Promise<void> {
  await db.runAsync(
    "INSERT INTO reglages (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur",
    "catalogue_cartes",
    JSON.stringify(catalogue),
  );
}
