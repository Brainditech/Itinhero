import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HAUTEUR_BARRE_ONGLETS } from "@/composants/BarreOnglets";
import { BoutonPrincipal, CarteFlottante, Lien, MotItinhero, Puce } from "@/composants/elements";
import { couleurs } from "@/theme/jetons";

type Depart = "domicile" | "position";

// Phase 1, étape 1 : écran en valeurs en dur, comparé à design/accueil/01-accueil.png.
// Rien n'est branché : « Chercher » et le lien ne font encore rien.
export default function Accueil() {
  const insets = useSafeAreaInsets();
  const clavier = useAnimatedKeyboard();
  const [phrase, setPhrase] = useState("jeudi 10h RDV à Joigny");
  const [depart, setDepart] = useState<Depart>("domicile");

  // Clavier fermé : on laisse la place de la barre d'onglets. Ouvert : le bouton se pose sur le clavier.
  const reserveOnglets = insets.bottom + 8 + HAUTEUR_BARRE_ONGLETS + 16;
  const styleBas = useAnimatedStyle(() => ({
    paddingBottom: clavier.height.value > 0 ? clavier.height.value + 8 : reserveOnglets,
  }));

  return (
    <Animated.View className="flex-1 bg-surface" style={[{ paddingTop: insets.top + 16 }, styleBas]}>
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4" keyboardShouldPersistTaps="handled">
        <MotItinhero />

        <CarteFlottante>
          <Text nativeID="libelle-phrase" className="font-inter text-corps text-texte-secondaire">
            Où devez-vous être, et quand ?
          </Text>
          <TextInput
            accessibilityLabelledBy="libelle-phrase"
            value={phrase}
            onChangeText={setPhrase}
            multiline
            className="mt-3 min-h-16 p-0 font-inter text-titre-carte text-texte"
            cursorColor={couleurs.primaire}
            selectionColor={couleurs["primaire-doux"]}
            textAlignVertical="top"
          />
          <View className="my-4 h-px bg-bordure-carte" />
          <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-3">
            <Puce libelle="Depuis : Domicile" active={depart === "domicile"} onPress={() => setDepart("domicile")} />
            <Puce libelle="Depuis ma position" active={depart === "position"} onPress={() => setDepart("position")} />
          </View>
        </CarteFlottante>

        <Lien libelle="Remplir un formulaire à la place" onPress={() => {}} />
      </ScrollView>

      <View className="px-4 pt-2">
        <BoutonPrincipal libelle="Chercher" onPress={() => {}} />
      </View>
    </Animated.View>
  );
}
