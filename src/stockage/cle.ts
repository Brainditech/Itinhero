import * as SecureStore from "expo-secure-store";

// Clé d'appareil (D64) : chiffrée par le Keystore d'Android, exclue de la sauvegarde automatique
// (plugin `expo-secure-store`, `configureAndroidBackup` par défaut). Jamais journalisée.

const NOM = "cle_appareil";

export function lireCle(): Promise<string | null> {
  return SecureStore.getItemAsync(NOM);
}

export function enregistrerCle(cle: string): Promise<void> {
  return SecureStore.setItemAsync(NOM, cle);
}

export function effacerCle(): Promise<void> {
  return SecureStore.deleteItemAsync(NOM);
}
