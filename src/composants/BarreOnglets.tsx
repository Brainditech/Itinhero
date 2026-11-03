import { useEffect, useState } from "react";
import { Keyboard, Pressable, Text, View } from "react-native";
import type { BottomTabBarProps } from "expo-router/tabs";
import { SymbolView } from "expo-symbols";
import type { AndroidSymbol } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { couleurs, ombreFlottante } from "@/theme/jetons";

// Hauteur de la pilule, pour que les écrans réservent la place dessous.
export const HAUTEUR_BARRE_ONGLETS = 72;

const ONGLETS: Record<string, { libelle: string; icone: AndroidSymbol }> = {
  "(chercher)": { libelle: "Chercher", icone: "search" },
  "mes-trajets": { libelle: "Mes trajets", icone: "bookmark" },
  assistant: { libelle: "Assistant", icone: "smart_toy" },
  reglages: { libelle: "Réglages", icone: "settings" },
};

/** Barre d'onglets flottante (design system : pilule blanche, 4 onglets). Masquée quand le clavier est ouvert. */
export function BarreOnglets({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [clavierOuvert, setClavierOuvert] = useState(false);

  useEffect(() => {
    const ouvert = Keyboard.addListener("keyboardDidShow", () => setClavierOuvert(true));
    const ferme = Keyboard.addListener("keyboardDidHide", () => setClavierOuvert(false));
    return () => {
      ouvert.remove();
      ferme.remove();
    };
  }, []);

  if (clavierOuvert) return null;

  return (
    <View
      className="absolute left-4 right-4 flex-row rounded-carte border border-bordure-carte bg-fond p-1"
      style={{ bottom: insets.bottom + 8, height: HAUTEUR_BARRE_ONGLETS, boxShadow: ombreFlottante }}
    >
      {state.routes.map((route, index) => {
        const onglet = ONGLETS[route.name];
        if (!onglet) return null;
        const actif = state.index === index;
        const couleur = actif ? couleurs.primaire : couleurs["texte-secondaire"];
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: actif }}
            accessibilityLabel={onglet.libelle}
            onPress={() => {
              if (!actif) navigateToTab(route.key);
            }}
            className={`flex-1 items-center justify-center rounded-carte ${actif ? "bg-primaire-doux" : ""}`}
          >
            <SymbolView name={{ android: onglet.icone, web: onglet.icone }} size={24} tintColor={couleur} />
            <Text
              className={`mt-0.5 text-badge ${actif ? "font-inter-semibold text-primaire" : "font-inter-medium text-texte-secondaire"}`}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {onglet.libelle}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
