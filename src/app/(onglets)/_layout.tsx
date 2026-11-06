import { Tabs } from "expo-router/tabs";

import { BarreOnglets } from "@/composants/BarreOnglets";
import { OuvrirDepuisNotification } from "@/composants/OuvrirDepuisNotification";
import { FournisseurRecherche } from "@/recherche";

export default function OngletsLayout() {
  // La recherche en cours (spec 10) : écrite par l'Accueil (formulaire), et par Mes trajets qui rouvre un voyage (spec 22).
  // Spec 34 (D112) : Accueil (première page et formulaire) et Trajet (Résultat, Étape, Guidage) ont chacun leur pile.
  return (
    <FournisseurRecherche>
      <OuvrirDepuisNotification />
      <Tabs tabBar={(props) => <BarreOnglets {...props} />} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="(accueil)" />
        <Tabs.Screen name="(trajet)" />
        <Tabs.Screen name="mes-trajets" />
        <Tabs.Screen name="assistant" />
        <Tabs.Screen name="reglages" />
      </Tabs>
    </FournisseurRecherche>
  );
}
