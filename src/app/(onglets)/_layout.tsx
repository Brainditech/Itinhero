import { Tabs } from "expo-router/tabs";

import { BarreOnglets } from "@/composants/BarreOnglets";
import { FournisseurRecherche } from "@/recherche";

export default function OngletsLayout() {
  // La recherche en cours (spec 10) : écrite par l'onglet Chercher, et par Mes trajets qui rouvre un voyage (spec 22).
  return (
    <FournisseurRecherche>
      <Tabs tabBar={(props) => <BarreOnglets {...props} />} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="(chercher)" />
        <Tabs.Screen name="mes-trajets" />
        <Tabs.Screen name="assistant" />
        <Tabs.Screen name="reglages" />
      </Tabs>
    </FournisseurRecherche>
  );
}
