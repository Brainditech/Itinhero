import { useCallback, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { SymbolView } from "expo-symbols";

import { Ecran } from "@/composants/Ecran";
import { CarteFlottante } from "@/composants/elements";
import type { Domicile } from "@/domaine/domicile";
import { useSession } from "@/session";
import { lireDomicileEnBase } from "@/stockage/reglages";
import { couleurs } from "@/theme/jetons";

/** Lien d'action à droite d'une ligne (« Modifier »). */
function Action({ libelle, onPress }: { libelle: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="min-h-12 justify-center pl-2">
      <Text className="font-inter-medium text-corps text-primaire">{libelle}</Text>
    </Pressable>
  );
}

/**
 * Réglages (spec 10, une partie de la maquette 07) : domicile (D65) et clé d'appareil (D64).
 * Cartes de réduction et interrupteur de position : plus tard (phase 6 ; D66 pour la position).
 */
export default function Reglages() {
  const db = useSQLiteContext();
  const { oublierCle } = useSession();
  const [domicile, setDomicile] = useState<Domicile | null | undefined>(undefined);

  // Relu à chaque retour sur l'onglet, après le choix du domicile.
  useFocusEffect(
    useCallback(() => {
      let actif = true;
      lireDomicileEnBase(db).then(
        (d) => actif && setDomicile(d),
        () => actif && setDomicile(null),
      );
      return () => {
        actif = false;
      };
    }, [db]),
  );

  return (
    <Ecran>
      <Text accessibilityRole="header" className="font-inter-bold text-titre-ecran text-texte">
        Réglages
      </Text>
      <CarteFlottante>
        <View className="gap-2">
          <Text className="font-inter text-secondaire text-texte-secondaire">Domicile</Text>
          <View className="flex-row items-center gap-3">
            <SymbolView name={{ android: "home", web: "home" }} size={28} tintColor={couleurs.primaire} />
            <View className="flex-1">
              <Text className="font-inter-medium text-corps text-texte">
                {domicile === undefined ? "…" : domicile ? domicile.libelle : "Pas encore indiqué"}
              </Text>
              {domicile?.detail ? (
                <Text className="font-inter text-secondaire text-texte-secondaire">{domicile.detail}</Text>
              ) : null}
            </View>
            <Action libelle={domicile ? "Modifier" : "Indiquer"} onPress={() => router.push("/domicile")} />
          </View>
        </View>
        <View className="my-4 h-px bg-bordure-carte" />
        <View className="gap-2">
          <Text className="font-inter text-secondaire text-texte-secondaire">Clé d&apos;appareil</Text>
          <View className="flex-row items-center gap-3">
            <SymbolView name={{ android: "key", web: "key" }} size={28} tintColor={couleurs.primaire} />
            <Text className="flex-1 font-inter-medium text-corps text-texte">Clé enregistrée</Text>
            <Action
              libelle="Remplacer"
              onPress={() =>
                Alert.alert("Remplacer la clé ?", "La clé actuelle sera effacée de ce téléphone. Il faudra saisir la nouvelle.", [
                  { text: "Annuler", style: "cancel" },
                  { text: "Remplacer", style: "destructive", onPress: () => void oublierCle() },
                ])
              }
            />
          </View>
        </View>
      </CarteFlottante>
      <View className="flex-row gap-3 px-2">
        <SymbolView name={{ android: "lock", web: "lock" }} size={22} tintColor={couleurs["texte-secondaire"]} />
        <Text className="flex-1 font-inter text-secondaire text-texte-secondaire">
          Vos réglages sont gardés sur ce téléphone. Le serveur ne garde ni votre domicile, ni vos recherches.
        </Text>
      </View>
    </Ecran>
  );
}
