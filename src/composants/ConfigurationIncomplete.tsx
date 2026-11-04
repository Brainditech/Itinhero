import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CarteFlottante, MotItinhero } from "@/composants/elements";

/** Remplace l'app quand une variable de build manque ou est mal formée (spec 10, §4.3). */
export function ConfigurationIncomplete({ message }: { message: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 gap-4 bg-surface px-4" style={{ paddingTop: insets.top + 16 }}>
      <MotItinhero />
      <CarteFlottante>
        <Text accessibilityRole="header" className="font-inter-semibold text-titre-carte text-texte">
          Configuration incomplète
        </Text>
        <Text className="mt-2 font-inter text-corps text-texte-secondaire">{message}</Text>
        <Text className="mt-2 font-inter text-secondaire text-texte-secondaire">
          Ajoutez-la au fichier .env du PC, puis reconstruisez l&apos;app.
        </Text>
      </CarteFlottante>
    </View>
  );
}
