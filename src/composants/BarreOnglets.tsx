import { useEffect, useState } from "react";
import { Keyboard, Pressable, Text, View } from "react-native";
import { router, useSegments } from "expo-router";
import type { BottomTabBarProps } from "expo-router/tabs";
import { SymbolView } from "expo-symbols";
import type { AndroidSymbol } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { couleurs, ombreFlottante } from "@/theme/jetons";

/**
 * Aller à l'Accueil (spec 34, D112) depuis n'importe quel onglet : l'onglet Accueil devient actif, sa pile revient à la
 * première page, puis `puis` (ouvrir le formulaire) s'exécute. Constaté le 2026-11-06 : depuis un autre onglet,
 * `router.navigate("/")` empile une nouvelle première page au-dessus du formulaire au lieu d'y revenir, et un
 * `dismissAll` lancé à l'image suivante agit encore sur la pile de l'onglet quitté. La pile de l'Accueil se vide donc
 * elle-même quand elle redevient active (`useRetourAccueil`, dans son `_layout`).
 */
let versAccueil: (() => void) | null = null;
let retourDemande: { puis?: () => void } | null = null;

export function allerALAccueil(puis?: () => void): void {
  retourDemande = { puis };
  if (versAccueil) versAccueil();
  else router.navigate("/");
}

/** Pour la pile de l'Accueil, quand elle devient active : vide-la si un retour a été demandé, puis ouvre la suite. */
export function appliquerRetourAccueil(): void {
  const demande = retourDemande;
  retourDemande = null;
  if (!demande) return;
  if (router.canDismiss()) router.dismissAll();
  demande.puis?.();
}

// Hauteur de la pilule, pour que les écrans réservent la place dessous.
export const HAUTEUR_BARRE_ONGLETS = 72;

const ONGLETS: Record<string, { libelle: string; icone: AndroidSymbol }> = {
  "(accueil)": { libelle: "Accueil", icone: "home" },
  "(trajet)": { libelle: "Trajet", icone: "route" },
  "mes-trajets": { libelle: "Mes trajets", icone: "bookmark" },
  assistant: { libelle: "Assistant", icone: "smart_toy" },
  reglages: { libelle: "Réglages", icone: "settings" },
};

/**
 * Barre d'onglets flottante (design system : pilule blanche ; 5 onglets depuis la spec 34). Masquée quand le clavier est ouvert.
 * Spec 34 (D112) : `tabPress` est émis comme par la barre d'origine, pour que la pile d'un onglet déjà actif revienne
 * à son premier écran ; Accueil ramène toujours à la première page, depuis n'importe quel onglet.
 */
export function BarreOnglets({ state, navigateToTab, emitter }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [clavierOuvert, setClavierOuvert] = useState(false);
  const segments = useSegments();
  const cleAccueil = state.routes.find((r) => r.name === "(accueil)")?.key;

  const accueilActif = state.routes[state.index]?.name === "(accueil)";

  useEffect(() => {
    if (!cleAccueil) return;
    // Accueil déjà actif : aucun changement d'onglet, donc le retour s'applique tout de suite.
    versAccueil = () => (accueilActif ? appliquerRetourAccueil() : navigateToTab(cleAccueil));
    return () => {
      versAccueil = null;
    };
  }, [accueilActif, cleAccueil, navigateToTab]);

  useEffect(() => {
    const ouvert = Keyboard.addListener("keyboardDidShow", () => setClavierOuvert(true));
    const ferme = Keyboard.addListener("keyboardDidHide", () => setClavierOuvert(false));
    return () => {
      ouvert.remove();
      ferme.remove();
    };
  }, []);

  // Le guidage et la fenêtre d'une étape occupent tout l'écran (spec 12, spec 17).
  if (clavierOuvert || segments.includes("guidage" as never) || segments.includes("etape" as never)) return null;

  return (
    <View
      className="absolute left-4 right-4 flex-row rounded-carte border border-bordure-carte bg-fond p-1"
      style={{ bottom: insets.bottom + 8, height: HAUTEUR_BARRE_ONGLETS, boxShadow: ombreFlottante }}
    >
      {state.routes.map((route, index) => {
        const onglet = ONGLETS[route.name];
        if (!onglet) return null;
        const actif = state.index === index;
        // Spec 46 (D127) : l'onglet choisi n'a pas de fond ; son icône et son libellé sont colorés.
        const couleur = actif ? couleurs.primaire : couleurs["texte-secondaire"];
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: actif }}
            accessibilityLabel={onglet.libelle}
            onPress={() => {
              const evenement = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (actif || evenement.defaultPrevented) return;
              if (route.name === "(accueil)") allerALAccueil();
              else navigateToTab(route.key);
            }}
            className="flex-1 items-center justify-center"
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
