import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { useSQLiteContext } from "expo-sqlite";

import { useOuvrirVoyage } from "@/recherche";
import { lireVoyages } from "@/stockage/voyages";

/**
 * Spec 42 : toucher une alerte (retard, suppression) ou un rappel rouvre le trajet enregistré, où « En direct »
 * propose une autre solution (D51). Les rappels portent leur clé dans leur identifiant (spec 30).
 */
export function OuvrirDepuisNotification() {
  const db = useSQLiteContext();
  const ouvrir = useOuvrirVoyage();
  const reponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!reponse) return;
    const data = reponse.notification.request.content.data as { voyage?: unknown; course?: unknown } | undefined;
    const id = reponse.notification.request.identifier;
    const cle = typeof data?.voyage === "string" ? data.voyage : id.startsWith("rappel|") ? id.split("|")[1] : undefined;
    // Alerte poussée par le serveur : seulement la course ; le trajet qui la contient est retrouvé ici.
    const course = typeof data?.course === "string" ? data.course : undefined;
    if (!cle && !course) return;
    void lireVoyages(db).then((lignes) => {
      const l = lignes.find(
        (x) => x.voyage && (x.cle === cle || (course && x.voyage.reponse.possibilites.some((p) => p.etapes.some((e) => e.course === course)))),
      );
      if (l?.voyage) ouvrir(l.cle, l.voyage);
    });
    void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    // `ouvrir` change à chaque rendu ; seule la nouvelle réponse compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reponse, db]);
  return null;
}
