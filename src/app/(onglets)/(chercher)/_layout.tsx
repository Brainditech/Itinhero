import { Stack } from "expo-router";

// Ouvert par un lien profond (itinhero://formulaire), un écran de la pile a quand même l'Accueil
// dessous : le retour d'Android y revient au lieu de quitter l'app (issue 0004 ; doc Expo Router,
// « Router settings » : `anchor`, qui remplace `initialRouteName`).
export const unstable_settings = {
  anchor: "index",
};

// Pile de l'onglet Chercher (spec 02, décision 1) : Accueil, formulaire, puis Confirmation, Résultat, Détail.
// L'onglet reste actif, et le retour d'Android revient à l'écran précédent.
export default function ChercherLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
