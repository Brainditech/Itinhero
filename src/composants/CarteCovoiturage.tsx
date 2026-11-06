import { Linking, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";

import { Lien } from "@/composants/elements";
import type { Possibilite } from "@/domaine/api";
import { communeDuLieu, lienBlaBlaCar, phraseCovoiturage, type LieuCovoiturage } from "@/domaine/covoiturage";
import { couleurs, ombreFlottante } from "@/theme/jetons";

/**
 * Covoiturage (spec 47, D128, D50) : en tête d'un sens quand aucun transport public n'y arrive, en option après
 * ses trajets sinon. Lien BlaBlaCar pré-rempli ; jamais de prix ni de place (invariant 5).
 */
export function CarteCovoiturage({
  de,
  a,
  date,
  possibilites,
}: {
  de: LieuCovoiturage;
  a: LieuCovoiturage;
  date: string;
  possibilites: readonly Possibilite[];
}) {
  const trajet = `${communeDuLieu(de)} → ${communeDuLieu(a)}`;
  const phrase = phraseCovoiturage(possibilites);
  return (
    <View
      className="gap-2 rounded-bouton border border-bordure-carte bg-fond p-4"
      style={{ boxShadow: ombreFlottante }}
      accessibilityLabel={`Covoiturage, ${trajet}. ${phrase} Prix et places sur BlaBlaCar.`}
    >
      <View className="flex-row items-center gap-2">
        <SymbolView name={{ android: "directions_car", web: "directions_car" }} size={22} tintColor={couleurs.primaire} />
        <Text className="font-inter-semibold text-titre-carte text-texte">Covoiturage</Text>
      </View>
      <Text className="font-inter-semibold text-corps text-texte">{trajet}</Text>
      <Text className="font-inter text-secondaire text-texte">{phrase}</Text>
      <Text className="font-inter text-secondaire text-texte-secondaire">Prix et places sur BlaBlaCar.</Text>
      <View className="items-start">
        <Lien libelle="Chercher sur BlaBlaCar" onPress={() => void Linking.openURL(lienBlaBlaCar(de, a, date)).catch(() => undefined)} />
      </View>
    </View>
  );
}
