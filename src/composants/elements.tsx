import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { ombreFlottante } from "@/theme/jetons";

/** Mot « Itinhero » en haut à gauche de chaque écran. */
export function MotItinhero() {
  return (
    <Text accessibilityRole="header" className="font-inter-semibold text-titre-ecran text-primaire">
      Itinhero
    </Text>
  );
}

/** Carte blanche flottante : coins 24, bordure fine, ombre douce. */
export function CarteFlottante({ children }: { children: ReactNode }) {
  return (
    <View className="rounded-carte border border-bordure-carte bg-fond p-5" style={{ boxShadow: ombreFlottante }}>
      {children}
    </View>
  );
}

/** Bouton principal : un seul par écran, plein indigo, 56 dp. */
export function BoutonPrincipal({ libelle, onPress }: { libelle: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-14 items-center justify-center rounded-bouton bg-primaire px-4 active:bg-primaire-presse"
    >
      <Text className="font-inter-semibold text-titre-carte text-fond">{libelle}</Text>
    </Pressable>
  );
}

/** Puce à choix : active pleine indigo, inactive blanche à contour. */
export function Puce({ libelle, active, onPress }: { libelle: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      className={`min-h-12 justify-center rounded-full border px-4 ${
        active ? "border-primaire bg-primaire" : "border-bordure-carte bg-fond"
      }`}
    >
      <Text className={`font-inter-medium text-badge ${active ? "text-fond" : "text-texte"}`}>{libelle}</Text>
    </Pressable>
  );
}

/** Lien texte indigo. */
export function Lien({ libelle, onPress }: { libelle: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} className="min-h-12 items-center justify-center">
      <Text className="font-inter-medium text-badge text-primaire">{libelle}</Text>
    </Pressable>
  );
}
