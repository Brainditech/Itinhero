import { useCallback } from "react";
import { Stack, useFocusEffect } from "expo-router";

import { appliquerRetourAccueil } from "@/composants/BarreOnglets";

// Ouvert par un lien profond (itinhero://formulaire), un écran de la pile a quand même l'Accueil
// dessous : le retour d'Android y revient au lieu de quitter l'app (issue 0004 ; doc Expo Router,
// « Router settings » : `anchor`, qui remplace `initialRouteName`).
export const unstable_settings = {
  anchor: "index",
};

// Pile de l'onglet Accueil (spec 34, D112) : la première page, puis le formulaire. Une recherche aboutie ouvre
// l'onglet Trajet. Toucher Accueil revient toujours à la première page.
export default function AccueilLayout() {
  // Onglet redevenu actif par « Accueil » (ou « Modifier ») : la pile revient à la première page.
  useFocusEffect(useCallback(() => appliquerRetourAccueil(), []));
  return <Stack screenOptions={{ headerShown: false }} />;
}
