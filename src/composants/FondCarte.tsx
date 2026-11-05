import { useEffect, useState } from "react";
import { Keyboard, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";

import { CARTE } from "@/composants/carte-module";
import { couleurs, voile } from "@/theme/jetons";

// Cadrage de départ : couloir Brienon–Saint-Florentin–Joigny (spec 03, décision 4).
const DEPART = { center: [3.56, 47.98] as [number, number], zoom: 10.3 };

// Règles de l'OSMF : l'attribution peut se replier après une interaction ou au bout de 5 secondes (D37).
const DELAI_REPLI_MS = 5000;

/**
 * Fond de l'Accueil (D36) : vraie carte qu'on déplace et zoome aux doigts,
 * sans rotation ni inclinaison, sous un voile blanc qui laisse passer les touchers.
 * La carte inventée (D35) reste dessous : hors connexion ou sans style, c'est elle qu'on voit.
 */
export function FondCarte({ onGeste }: { onGeste?: () => void }) {
  return (
    <View style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants">
      <Image source={require("../../assets/images/fond-carte.png")} contentFit="cover" style={StyleSheet.absoluteFill} />
      {CARTE ? (
        <CARTE.Map
          style={StyleSheet.absoluteFill}
          mapStyle={CARTE.url}
          touchRotate={false}
          touchPitch={false}
          attribution={false}
          logo={false}
          compass={false}
          onPress={() => {
            Keyboard.dismiss();
            onGeste?.();
          }}
          // Le cadrage de départ déclenche aussi l'événement : seul un geste de l'utilisateur replie.
          onRegionWillChange={(e) => {
            if (e.nativeEvent.userInteraction) onGeste?.();
          }}
        >
          <CARTE.Camera initialViewState={DEPART} />
        </CARTE.Map>
      ) : null}
      <View className="bg-fond" style={[StyleSheet.absoluteFill, { opacity: voile, pointerEvents: "none" }]} />
    </View>
  );
}

/** Dépliée au lancement, repliée au premier geste sur la carte ou après 5 secondes (D37). */
export function useAttributionCarte() {
  const [depliee, setDepliee] = useState(true);
  useEffect(() => {
    if (!depliee) return;
    const minuteur = setTimeout(() => setDepliee(false), DELAI_REPLI_MS);
    return () => clearTimeout(minuteur);
  }, [depliee]);
  return { depliee, replier: () => setDepliee(false), deplier: () => setDepliee(true) };
}

/**
 * Attribution des tuiles (OpenMapTiles CC-BY, OpenStreetMap ODbL), au-dessus du voile.
 * L'attribution native de MapLibre est coupée : elle serait dessinée sous le voile.
 * Repliée, il reste un bouton ⓘ qui la rouvre.
 */
export function AttributionCarte({ depliee, onDeplier }: { depliee: boolean; onDeplier: () => void }) {
  if (!CARTE) return null;
  if (!depliee) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Afficher les crédits de la carte"
        onPress={onDeplier}
        hitSlop={12}
        className="rounded-full bg-fond/80 p-1"
      >
        <SymbolView name={{ android: "info", web: "info" }} size={18} tintColor={couleurs["texte-secondaire"]} />
      </Pressable>
    );
  }
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Crédits de la carte : OpenMapTiles, OpenStreetMap"
      onPress={() => Linking.openURL("https://www.openstreetmap.org/copyright")}
      hitSlop={12}
      className="rounded-champ bg-fond/80 px-2 py-1"
    >
      <Text className="font-inter text-xs text-texte-secondaire">© OpenMapTiles © OpenStreetMap</Text>
    </Pressable>
  );
}
