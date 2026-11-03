import { Tabs } from "expo-router/tabs";

import { BarreOnglets } from "@/composants/BarreOnglets";

export default function OngletsLayout() {
  return (
    <Tabs tabBar={(props) => <BarreOnglets {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="(chercher)" />
      <Tabs.Screen name="mes-trajets" />
      <Tabs.Screen name="assistant" />
      <Tabs.Screen name="reglages" />
    </Tabs>
  );
}
