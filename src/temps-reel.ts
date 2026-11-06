import { requireOptionalNativeModule } from "expo";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

import { clientApi, type ClientApi, type EtatCourse } from "@/domaine/api";
import { lireEnvironnement } from "@/domaine/environnement";
import { alertesNouvelles, etapesSuivies, type DejaDit } from "@/domaine/temps-reel";
import { possibiliteMontree, type Voyage } from "@/domaine/voyages";
import { CANAL } from "@/rappels";
import { lireCle } from "@/stockage/cle";
import { NOM_BASE } from "@/stockage/reglages";
import { lireVoyages } from "@/stockage/voyages";

/**
 * Relève du temps réel (spec 42, D123). Sans compte Expo ni Firebase, le téléphone demande lui-même l'état de ses
 * trajets du moment (`POST /v1/etat-courses`) : app ouverte à l'écran du trajet (chaque minute), et en arrière-plan
 * par `expo-background-task` (Android : 15 min au mieux). Une alerte nouvelle (D21) devient une notification locale ;
 * une suppression propose une autre solution (D51), jamais appliquée sans la personne.
 */
export const TACHE_RELEVE = "itinhero-releve-temps-reel";

/** Un trajet est suivi de 3 h avant son départ jusqu'à son arrivée. */
const AVANT_MS = 3 * 3600_000;

export function trajetEnCours(v: Voyage, maintenant: Date): boolean {
  const p = possibiliteMontree(v.reponse, v.tri);
  if (!p) return false;
  const t = maintenant.getTime();
  return t >= Date.parse(p.depart_utc) - AVANT_MS && t <= Date.parse(p.arrivee_utc);
}

const cleDejaDit = (cle: string) => `temps_reel|${cle}`;

async function lireDejaDit(db: SQLiteDatabase, cle: string): Promise<DejaDit> {
  const l = await db.getFirstAsync<{ valeur: string }>("SELECT valeur FROM reglages WHERE cle = ?", cleDejaDit(cle));
  try {
    return l ? (JSON.parse(l.valeur) as DejaDit) : {};
  } catch {
    return {};
  }
}

async function garderDejaDit(db: SQLiteDatabase, cle: string, d: DejaDit): Promise<void> {
  await db.runAsync(
    "INSERT INTO reglages (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur",
    cleDejaDit(cle),
    JSON.stringify(d),
  );
}

/** État des courses d'un trajet, puis les alertes nouvelles en notifications. Rend les états lus (ou null). */
export async function releverTrajet(db: SQLiteDatabase, client: ClientApi, cle: string, v: Voyage): Promise<EtatCourse[] | null> {
  const p = possibiliteMontree(v.reponse, v.tri);
  if (!p) return null;
  const courses = etapesSuivies(p).map((s) => s.course);
  if (courses.length === 0) return null;
  const r = await client.etatCourses(courses);
  if (r.etat !== "ok") return null;
  const { alertes, dejaDit } = alertesNouvelles(p, r.donnees, await lireDejaDit(db, cle));
  await garderDejaDit(db, cle, dejaDit);
  for (const a of alertes) {
    await Notifications.scheduleNotificationAsync({
      identifier: `temps-reel|${cle}|${a.cle}`,
      content: { title: a.titre, body: a.corps, data: { voyage: cle, course: a.course, supprime: a.supprime } },
      trigger: { channelId: CANAL },
    }).catch(() => undefined);
  }
  return r.donnees;
}

/** Tous les trajets en cours (tâche de fond). */
export async function releverTout(db: SQLiteDatabase, client: ClientApi, maintenant: Date): Promise<number> {
  let n = 0;
  for (const { cle, voyage } of await lireVoyages(db)) {
    if (!voyage || !trajetEnCours(voyage, maintenant)) continue;
    if (await releverTrajet(db, client, cle, voyage)) n++;
  }
  return n;
}

type ModulesFond = { tache: typeof import("expo-task-manager"); fond: typeof import("expo-background-task") };
let modules: ModulesFond | null | undefined;

/**
 * Modules natifs de la relève de fond, chargés seulement s'ils sont dans le build (comme `src/voix.ts`) : un
 * development build d'avant la spec 42 ne les a pas, et les importer directement ferait planter l'app.
 */
function modulesFond(): ModulesFond | null {
  if (modules === undefined) {
    if (!requireOptionalNativeModule("ExpoBackgroundTask") || !requireOptionalNativeModule("ExpoTaskManager")) {
      modules = null;
      return null;
    }
    try {
      modules = {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- chargement paresseux voulu (module natif absent)
        tache: require("expo-task-manager") as ModulesFond["tache"],
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- idem
        fond: require("expo-background-task") as ModulesFond["fond"],
      };
    } catch {
      modules = null;
    }
  }
  return modules;
}

/** Corps de la tâche de fond : tous les trajets en cours, hors de React. */
async function tacheReleve(): Promise<boolean> {
  const env = lireEnvironnement({ EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL });
  const cle = await lireCle();
  if (!env.ok || !cle) return true;
  const db = await openDatabaseAsync(NOM_BASE);
  const client = clientApi({ urlApi: env.env.urlApi, cle, fetch: (u, i) => fetch(u, i), fetchFlux: (u, i) => fetch(u, i) });
  await releverTout(db, client, new Date());
  return true;
}

// La tâche se définit au chargement du module, hors de React (doc expo-task-manager SDK 58).
const m = modulesFond();
if (m) {
  m.tache.defineTask(TACHE_RELEVE, async () => {
    try {
      return (await tacheReleve()) ? m.fond.BackgroundTaskResult.Success : m.fond.BackgroundTaskResult.Failed;
    } catch {
      return m.fond.BackgroundTaskResult.Failed;
    }
  });
}

/** Inscrit la relève de fond (15 min au mieux) ; sans le module (vieux build), rien. */
export async function inscrireReleve(): Promise<void> {
  const mod = modulesFond();
  if (!mod) return;
  try {
    if ((await mod.fond.getStatusAsync()) !== mod.fond.BackgroundTaskStatus.Available) return;
    if (!(await mod.tache.isTaskRegisteredAsync(TACHE_RELEVE))) await mod.fond.registerTaskAsync(TACHE_RELEVE, { minimumInterval: 15 });
  } catch {
    // Relève de fond refusée par le système : la relève à l'écran reste.
  }
}

/**
 * Alertes poussées (spec 42, D123) : seulement avec un projet Expo (`extra.eas.projectId`) et Firebase configurés
 * (R7) ; sans eux, aucun jeton et la relève locale reste la seule. Chaque course suivie du trajet est abonnée
 * jusqu'à J+1 ; rien d'autre ne part (ni lieu, ni heure).
 */
export async function abonnerTrajet(client: ClientApi, v: Voyage): Promise<number> {
  const p = possibiliteMontree(v.reponse, v.tri);
  if (!p) return 0;
  let jeton: string;
  try {
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!projectId) return 0;
    jeton = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return 0;
  }
  let n = 0;
  for (const { course } of etapesSuivies(p)) {
    const date = /^(\d{4})(\d{2})(\d{2})_/.exec(course);
    if (!date) continue;
    const r = await client.abonner(course, `${date[1]}-${date[2]}-${date[3]}`, jeton);
    if (r.etat === "ok") n++;
  }
  return n;
}
