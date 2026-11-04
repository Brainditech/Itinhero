import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { SymbolView, type AndroidSymbol } from "expo-symbols";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { couleurs } from "@/theme/jetons";

/** Chevron dans une pastille `primaire-doux` : il pivote d'un demi-tour quand le bloc s'ouvre ou se replie. */
export function Chevron({ ouvert }: { ouvert: boolean }) {
  const angle = useSharedValue(ouvert ? 180 : 0);
  useEffect(() => {
    angle.value = withTiming(ouvert ? 180 : 0, { duration: 220 });
  }, [ouvert, angle]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));
  return (
    <View className="h-8 w-8 items-center justify-center rounded-full bg-primaire-doux">
      <Animated.View style={style}>
        <SymbolView name={{ android: "keyboard_arrow_down", web: "keyboard_arrow_down" }} size={24} tintColor={couleurs.primaire} />
      </Animated.View>
    </View>
  );
}

/** Bouton chevron de 48 dp qui replie ou déplie un bloc ; TalkBack lit son nom et son état. */
export function BoutonRepli({ ouvert, nom, onPress }: { ouvert: boolean; nom: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={nom}
      accessibilityState={{ expanded: ouvert }}
      accessibilityHint={ouvert ? "Replie le bloc" : "Déplie le bloc"}
      onPress={onPress}
      hitSlop={4}
      style={{ minHeight: 48, minWidth: 48 }}
      className="items-center justify-center"
    >
      <Chevron ouvert={ouvert} />
    </Pressable>
  );
}

/** Bouton rond de 48 dp avec une seule icône (ex. crayon « Modifier la recherche »). */
export function BoutonIcone({ icone, nom, onPress }: { icone: AndroidSymbol; nom: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={nom}
      onPress={onPress}
      hitSlop={4}
      style={{ minHeight: 48, minWidth: 48 }}
      className="items-center justify-center rounded-full active:bg-primaire-doux"
    >
      <SymbolView name={{ android: icone, web: icone }} size={22} tintColor={couleurs.primaire} />
    </Pressable>
  );
}
