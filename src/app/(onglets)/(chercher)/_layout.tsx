import { Stack } from "expo-router";

// Ouvert par un lien profond (itinhero://formulaire), un écran de la pile a quand même l'Accueil
// dessous : le retour d'Android y revient au lieu de quitter l'app (issue 0004 ; doc Expo Router,
// « Router settings » : `anchor`, qui remplace `initialRouteName`).
export const unstable_settings = {
  anchor: "index",
};

// Pile de l'onglet Chercher (spec 02, décision 1) : Accueil, formulaire, puis Résultat, Détail (plus de Confirmation, D91).
// L'onglet reste actif, et le retour d'Android revient à l'écran précédent.
// La recherche en cours est partagée par les écrans de la pile (spec 10) ; son fournisseur est au niveau des
// onglets, pour que Mes trajets puisse y rouvrir un voyage (spec 22, D98).
export default function ChercherLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
