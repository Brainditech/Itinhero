import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CarteFlottante, MotItinhero } from "@/composants/elements";

/** Écran d'attente d'un onglet pas encore construit. */
export function EcranAVenir({ titre, phase }: { titre: string; phase: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 gap-4 bg-surface px-4" style={{ paddingTop: insets.top + 16 }}>
      <MotItinhero />
      <CarteFlottante>
        <Text className="font-inter-semibold text-titre-carte text-texte">{titre}</Text>
        <Text className="mt-2 font-inter text-corps text-texte-secondaire">Cet écran arrive en phase {phase}.</Text>
      </CarteFlottante>
    </View>
  );
}
