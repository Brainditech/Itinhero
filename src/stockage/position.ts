import * as Location from "expo-location";

import type { Point } from "@/domaine/api";

// Position (D66) : demandée au moment de chercher, au premier plan seulement ; ni gardée, ni journalisée.

export type LecturePosition = { etat: "ok"; point: Point } | { etat: "refusee" } | { etat: "introuvable" };

export const MESSAGES_POSITION = {
  refusee: "Sans accès à votre position, choisissez Domicile.",
  introuvable: "Position introuvable. Réessayez, ou choisissez Domicile.",
} as const;

/** « Recalculer depuis ici » (spec 12, §7) : sans position, pas de repli sur le domicile à proposer. */
export const MESSAGES_POSITION_GUIDAGE = {
  refusee: "Sans accès à votre position, le recalcul est impossible : autorisez la position d'Itinhero dans les réglages d'Android.",
  introuvable: "Position introuvable : activez la localisation du téléphone, puis réessayez.",
} as const;

const DELAI_MS = 15_000;

function avecDelai<T>(promesse: Promise<T>, ms: number): Promise<T | "delai"> {
  return new Promise((ok, echec) => {
    const minuterie = setTimeout(() => ok("delai"), ms);
    promesse.then(
      (v) => {
        clearTimeout(minuterie);
        ok(v);
      },
      (e: unknown) => {
        clearTimeout(minuterie);
        echec(e);
      },
    );
  });
}

export async function lirePosition(): Promise<LecturePosition> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return { etat: "refusee" };
    const recente = await Location.getLastKnownPositionAsync({ maxAge: 120_000, requiredAccuracy: 200 });
    const lue =
      recente ?? (await avecDelai(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), DELAI_MS));
    if (lue === "delai" || lue === null) return { etat: "introuvable" };
    return { etat: "ok", point: { lat: lue.coords.latitude, lon: lue.coords.longitude } };
  } catch {
    // Localisation coupée dans Android, ou service indisponible.
    return { etat: "introuvable" };
  }
}

/**
 * Position seulement si l'accès est déjà accordé, sans rien demander (D78) : sert à classer les lieux
 * d'un texte quand aucun autre bout n'est connu. Rend null sinon.
 */
export async function lirePositionSiAccordee(): Promise<Point | null> {
  try {
    const { granted } = await Location.getForegroundPermissionsAsync();
    if (!granted) return null;
    const lue = await lirePosition();
    return lue.etat === "ok" ? lue.point : null;
  } catch {
    return null;
  }
}
