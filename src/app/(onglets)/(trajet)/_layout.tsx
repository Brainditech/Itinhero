import { Stack } from "expo-router";

// Ouvert par un lien profond (itinhero://guidage?…), l'Étape ou le Guidage a le Résultat dessous.
export const unstable_settings = {
  anchor: "resultat",
};

// Pile de l'onglet Trajet (spec 34, D112) : le Résultat de la recherche en cours, puis l'Étape et le Guidage.
// Le retour d'Android revient à l'écran précédent.
export default function TrajetLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
