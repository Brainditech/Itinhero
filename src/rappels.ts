import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";

import { livraisonDe, rappelsDuVoyage } from "@/domaine/rappels";
import type { Voyage } from "@/domaine/voyages";

/**
 * Rappels locaux (spec 30, D108), par expo-notifications (SDK 58). Pas de table `rappels_programmes` :
 * chaque notification porte l'identifiant « rappel|<clé du trajet>|<clé du rappel> », ce qui suffit pour
 * retrouver et annuler ceux d'un trajet. Issue 0026 (D120) : alarmes exactes (`USE_EXACT_ALARM` dans app.json) ;
 * « Partez » et « Appelez le taxi » en `alarmClock`, que l'économie de batterie ne décale jamais.
 */
export const CANAL = "rappels";
const PREFIXE = "rappel|";

/** Notifications affichées même app ouverte (doc SDK 58 : `shouldShowBanner`, `shouldShowList`). */
export function preparerNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/** Canal créé avant la demande d'autorisation (Android 13 ne la montre qu'après). Refus ⇒ aucun rappel, sans erreur. */
async function autorise(): Promise<boolean> {
  await Notifications.setNotificationChannelAsync(CANAL, {
    name: "Rappels de trajet",
    description: "La veille, avant de partir, pour réserver ou appeler un taxi.",
    importance: AndroidImportance.HIGH,
  });
  const actuel = await Notifications.getPermissionsAsync();
  if (actuel.granted) return true;
  if (!actuel.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function annulerRappels(cleVoyage: string): Promise<void> {
  const prevus = await Notifications.getAllScheduledNotificationsAsync();
  const prefixe = `${PREFIXE}${cleVoyage}|`;
  await Promise.all(
    prevus.filter((n) => n.identifier.startsWith(prefixe)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** Remplace les rappels du trajet par ceux de cet instant ; rend leur nombre (0 sans autorisation). */
export async function programmerRappels(cleVoyage: string, voyage: Voyage): Promise<number> {
  await annulerRappels(cleVoyage);
  const rappels = rappelsDuVoyage(voyage, new Date());
  if (rappels.length === 0 || !(await autorise())) return 0;
  await Promise.all(
    rappels.map((r) =>
      Notifications.scheduleNotificationAsync({
        identifier: `${PREFIXE}${cleVoyage}|${r.cle}`,
        content: { title: r.titre, body: r.corps },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: r.instant,
          channelId: CANAL,
          delivery: livraisonDe(r.type) === "alarme" ? "alarmClock" : "bestEffort",
        },
      }),
    ),
  );
  return rappels.length;
}
