import { Stack } from "expo-router";

// Pile de l'onglet Chercher (spec 02, décision 1) : Accueil, formulaire, puis Confirmation, Résultat, Détail.
// L'onglet reste actif, et le retour d'Android revient à l'écran précédent.
export default function ChercherLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
