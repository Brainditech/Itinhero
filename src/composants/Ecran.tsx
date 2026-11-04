import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HAUTEUR_BARRE_ONGLETS } from "@/composants/BarreOnglets";
import { MotItinhero } from "@/composants/elements";

/**
 * Écran défilant sur `surface` (spec 10) : mot « Itinhero », contenu, puis le bas (bouton principal)
 * hors de la liste. `onglets` réserve la place de la barre d'onglets flottante.
 */
export function Ecran({ children, bas, onglets = true }: { children: ReactNode; bas?: ReactNode; onglets?: boolean }) {
  const insets = useSafeAreaInsets();
  const reserveBas = onglets ? insets.bottom + 8 + HAUTEUR_BARRE_ONGLETS + 16 : insets.bottom + 16;
  return (
    <View className="flex-1 bg-surface" style={{ paddingTop: insets.top + 16 }}>
      <View className="px-4 pb-4">
        <MotItinhero />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4"
        contentContainerStyle={{ paddingBottom: bas ? 16 : reserveBas }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {bas ? (
        <View className="px-4 pt-2" style={{ paddingBottom: reserveBas }}>
          {bas}
        </View>
      ) : null}
    </View>
  );
}
