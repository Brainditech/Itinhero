import { Vibration } from "react-native";
import { requireOptionalNativeModule } from "expo";

// Voix du guidage (D74) : synthèse vocale d'Android par expo-speech, sans réseau ni service extérieur.
// Le module natif n'existe qu'après un nouveau development build : sans lui, le guidage reste muet au lieu de planter.

type Speech = typeof import("expo-speech");

let speech: Speech | null | undefined;

function module(): Speech | null {
  if (speech === undefined) {
    // Sans module natif, charger expo-speech lève une erreur que Metro affiche même rattrapée.
    if (!requireOptionalNativeModule("ExpoSpeech")) {
      speech = null;
      return null;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- chargement paresseux voulu (module natif absent)
      speech = require("expo-speech") as Speech;
    } catch {
      speech = null;
    }
  }
  return speech;
}

/** Dit la phrase en français ; coupe la phrase en cours. */
export function dire(phrase: string): void {
  const s = module();
  if (!s) return;
  try {
    void s.stop();
    s.speak(phrase, { language: "fr-FR" });
  } catch {
    // Synthèse indisponible : le texte reste à l'écran.
  }
}

export function taire(): void {
  try {
    void module()?.stop();
  } catch {
    // rien à taire
  }
}

/** Vibration de la descente imminente (§4.3). */
export function vibrer(): void {
  Vibration.vibrate([0, 400, 200, 400]);
}
