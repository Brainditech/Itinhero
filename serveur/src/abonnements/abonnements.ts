import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { instantParis } from "../temps.js";

/**
 * `abonnements_alerte` (spec 29, D107, A20, A21) : la seule table persistante du serveur (invariant 6).
 * Une ligne = « prévenir ce téléphone si cette course de ce jour change » : identifiant de course, jour de
 * service, jeton push, expiration. Ni lieu, ni coordonnées, ni texte de demande, ni clé d'appareil.
 * Expiration : la fin du lendemain du jour de service (J+1, 24:00 à Paris) ; purgée ensuite.
 */
export const COLONNES = ["id", "trip_id", "date_service", "jeton_push", "expiration"] as const;
/** Plafond de lignes : au-delà, refus (503) plutôt qu'une table qui grossit sans fin. */
export const MAX_ABONNEMENTS = 5000;

export type Abonnement = { id: string; trip_id: string; date_service: string; jeton_push: string; expiration: string };

/** Fin de J+1 à Paris = minuit de J+2. */
export function expirationDe(dateService: string): Date {
  return instantParis(dateService, 2 * 24 * 60);
}

export class Abonnements {
  private readonly db: DatabaseSync;

  /** `chemin` : fichier SQLite sur un volume Docker ; absent ⇒ en mémoire (tests, développement hors compose). */
  constructor(chemin = ":memory:") {
    this.db = new DatabaseSync(chemin);
    this.db.exec(`CREATE TABLE IF NOT EXISTS abonnements_alerte (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      date_service TEXT NOT NULL,
      jeton_push TEXT NOT NULL,
      expiration TEXT NOT NULL
    ) STRICT`);
    this.db.exec("CREATE INDEX IF NOT EXISTS abonnements_expiration ON abonnements_alerte (expiration)");
  }

  /** Nouvel abonnement ; null si le plafond de lignes est atteint. L'identifiant (128 bits) ne se devine pas. */
  ajouter(tripId: string, dateService: string, jetonPush: string): Abonnement | null {
    const { n } = this.db.prepare("SELECT COUNT(*) AS n FROM abonnements_alerte").get() as { n: number };
    if (n >= MAX_ABONNEMENTS) return null;
    const a: Abonnement = {
      id: randomBytes(16).toString("hex"),
      trip_id: tripId,
      date_service: dateService,
      jeton_push: jetonPush,
      expiration: expirationDe(dateService).toISOString(),
    };
    this.db
      .prepare("INSERT INTO abonnements_alerte (id, trip_id, date_service, jeton_push, expiration) VALUES (?, ?, ?, ?, ?)")
      .run(a.id, a.trip_id, a.date_service, a.jeton_push, a.expiration);
    return a;
  }

  /** Vrai si l'abonnement existait. */
  retirer(id: string): boolean {
    return Number(this.db.prepare("DELETE FROM abonnements_alerte WHERE id = ?").run(id).changes) > 0;
  }

  /** Supprime les abonnements expirés ; rend leur nombre. */
  purger(maintenant: Date): number {
    return Number(this.db.prepare("DELETE FROM abonnements_alerte WHERE expiration <= ?").run(maintenant.toISOString()).changes);
  }

  /** Abonnements encore actifs (pour `suivi-retards`, phase 7). */
  actifs(maintenant: Date): Abonnement[] {
    return this.db
      .prepare("SELECT id, trip_id, date_service, jeton_push, expiration FROM abonnements_alerte WHERE expiration > ? ORDER BY id")
      .all(maintenant.toISOString()) as Abonnement[];
  }

  /** Colonnes réelles de la table (test : aucun champ personnel). */
  colonnes(): string[] {
    return (this.db.prepare("PRAGMA table_info(abonnements_alerte)").all() as { name: string }[]).map((c) => c.name);
  }

  fermer(): void {
    this.db.close();
  }
}
