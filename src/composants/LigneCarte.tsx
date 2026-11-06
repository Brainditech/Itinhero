import { Text, View } from "react-native";
import { SymbolView, type AndroidSymbol } from "expo-symbols";

import type { EtatAffiche } from "@/carte/useCarteVoyage";
import { Lien } from "@/composants/elements";
import { couleurs } from "@/theme/jetons";

/**
 * Ligne « Carte » d'un voyage enregistré (spec 23, D99, §3.4 ; maquette 06 « Carte enregistrée »).
 * Rien quand l'app ne peut pas garder de carte (ancien build, Expo Go).
 */
export function LigneCarte({ etat, onEnregistrer }: { etat: EtatAffiche; onEnregistrer: () => void }) {
  if (!etat) return null;
  const ligne = (icone: AndroidSymbol, teinte: string, texte: string, classeTexte = "text-texte") => (
    <View className="flex-row items-center gap-3">
      <SymbolView name={{ android: icone, web: icone }} size={24} tintColor={teinte} />
      <Text accessibilityLiveRegion="polite" className={`flex-1 font-inter text-corps ${classeTexte}`}>
        {texte}
      </Text>
    </View>
  );
  switch (etat.etat) {
    case "enregistree":
      return ligne("check_circle", couleurs.possible, "Carte enregistrée");
    case "enCours":
      return ligne("downloading", couleurs.primaire, `Carte : téléchargement… ${etat.pourcentage} %`);
    case "absente":
      return (
        <View className="gap-1">
          {ligne("cloud_off", couleurs["texte-secondaire"], "Carte pas encore enregistrée")}
          <View className="items-start pl-9">
            <Lien libelle="Enregistrer la carte" onPress={onEnregistrer} />
          </View>
        </View>
      );
    case "echec":
      return (
        <View className="gap-1">
          {ligne("error", couleurs.erreur, "La carte n'a pas pu être enregistrée.", "text-erreur")}
          <View className="items-start pl-9">
            <Lien libelle="Réessayer" onPress={onEnregistrer} />
          </View>
        </View>
      );
    case "tropLourde":
      return ligne("error", couleurs.erreur, "Carte trop lourde pour être gardée.", "text-erreur");
  }
}
