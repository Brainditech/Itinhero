import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HAUTEUR_BARRE_ONGLETS } from "@/composants/BarreOnglets";
import { BoutonPrincipal, CarteFlottante, Lien, MotItinhero, Puce } from "@/composants/elements";
import { AttributionCarte, FondCarte, useAttributionCarte } from "@/composants/FondCarte";
import { couleurs } from "@/theme/jetons";

type Depart = "domicile" | "position";

// Phase 1, étape 1 : écran en valeurs en dur, comparé à design/accueil/01-accueil.png.
// « Chercher » ne fait encore rien ; le lien ouvre le formulaire de repli (spec 02). Derrière : la carte (D36).
export default function Accueil() {
  const insets = useSafeAreaInsets();
  const clavier = useAnimatedKeyboard();
  const [phrase, setPhrase] = useState("jeudi 10h RDV à Joigny");
  const [depart, setDepart] = useState<Depart>("domicile");
  const attribution = useAttributionCarte();

  // Clavier fermé : on laisse la place de la barre d'onglets. Ouvert : le bouton se pose sur le clavier.
  const reserveOnglets = insets.bottom + 8 + HAUTEUR_BARRE_ONGLETS + 16;
  const styleBas = useAnimatedStyle(() => ({
    paddingBottom: clavier.height.value > 0 ? clavier.height.value + 8 : reserveOnglets,
  }));

  // « box-none » : ces conteneurs ne prennent aucun toucher, seuls leurs enfants. La zone vide va à la carte.
  return (
    <View className="flex-1 bg-surface">
      <FondCarte onGeste={attribution.replier} />
      <Animated.View
        className="flex-1"
        style={[{ paddingTop: insets.top + 16, pointerEvents: "box-none" }, styleBas]}
      >
        <View className="gap-4 px-4" style={{ pointerEvents: "box-none" }}>
          <View className="flex-row items-start justify-between" style={{ pointerEvents: "box-none" }}>
            <MotItinhero />
            <AttributionCarte depliee={attribution.depliee} onDeplier={attribution.deplier} />
          </View>

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
            {/* Dans la carte, et non sur le fond : posé sur la carte MapLibre, il se perdait parmi les noms de villages. */}
            <View className="mt-2 items-center">
              <Lien libelle="Remplir un formulaire à la place" onPress={() => router.push("/formulaire")} />
            </View>
          </CarteFlottante>
        </View>

        <View className="flex-1" style={{ pointerEvents: "box-none" }} />

        <View className="px-4 pt-2" style={{ pointerEvents: "box-none" }}>
          <BoutonPrincipal libelle="Chercher" onPress={() => {}} />
        </View>
      </Animated.View>
    </View>
  );
}
