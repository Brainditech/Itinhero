import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { SymbolView } from "expo-symbols";

import { Ecran } from "@/composants/Ecran";
import { CarteFlottante } from "@/composants/elements";
import type { Domicile } from "@/domaine/domicile";
import { useCartes } from "@/cartes";
import { schemaCatalogueCartes, type CatalogueCartes } from "@/domaine/api";
import { useSession } from "@/session";
import { enregistrerCatalogueCartes, lireCatalogueCartes, lireDomicileEnBase } from "@/stockage/reglages";
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
 * Spec 43 (D124) : cartes de réduction, cochées sur le téléphone seulement (invariant 7).
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
      <CartesReduction />
      <View className="flex-row gap-3 px-2">
        <SymbolView name={{ android: "lock", web: "lock" }} size={22} tintColor={couleurs["texte-secondaire"]} />
        <Text className="flex-1 font-inter text-secondaire text-texte-secondaire">
          Vos réglages sont gardés sur ce téléphone. Le serveur ne garde ni votre domicile, ni vos recherches.
        </Text>
      </View>
    </Ecran>
  );
}

/**
 * Cartes de réduction (spec 43, D124, maquette 07) : la liste vient des tarifs validés (`GET /v1/fiches`), gardée
 * pour s'afficher sans réseau ; la case cochée reste sur le téléphone et réduit les prix du Résultat.
 */
function CartesReduction() {
  const db = useSQLiteContext();
  const { client } = useSession();
  const { cartes, basculer } = useCartes();
  const [catalogue, setCatalogue] = useState<CatalogueCartes["cartes"] | null>(null);
  useEffect(() => {
    let actif = true;
    // Revue : la liste du serveur, si elle arrive, l'emporte sur celle gardée, même lue après.
    let fraiche = false;
    void lireCatalogueCartes(db).then((brut) => {
      const lu = schemaCatalogueCartes.safeParse(brut);
      if (actif && !fraiche && lu.success) setCatalogue(lu.data.cartes);
    });
    void client?.fiches().then((r) => {
      if (!actif || r.etat !== "ok") return;
      fraiche = true;
      setCatalogue(r.donnees.cartes);
      void enregistrerCatalogueCartes(db, r.donnees).catch(() => undefined);
    });
    return () => {
      actif = false;
    };
  }, [db, client]);
  return (
    <CarteFlottante>
      <View className="gap-3">
        <Text accessibilityRole="header" className="font-inter-semibold text-titre-carte text-texte">
          Cartes de réduction
        </Text>
        {catalogue === null ? (
          <Text className="font-inter text-secondaire text-texte-secondaire">Liste indisponible sans connexion au serveur.</Text>
        ) : catalogue.length === 0 ? (
          <Text className="font-inter text-secondaire text-texte-secondaire">Aucune carte : aucun tarif n&apos;est encore validé.</Text>
        ) : (
          catalogue.map((c) => {
            const cochee = cartes.includes(c.carte);
            return (
              <Pressable
                key={c.carte}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: cochee }}
                accessibilityLabel={`${c.nom}, moins ${c.pourcentage} %, ${c.reseaux.join(", ")}`}
                onPress={() => basculer(c.carte)}
                className="min-h-12 flex-row items-center gap-3 active:opacity-70"
              >
                <SymbolView
                  name={{ android: cochee ? "check_box" : "check_box_outline_blank", web: "check_box" }}
                  size={26}
                  tintColor={couleurs.primaire}
                />
                <View className="flex-1">
                  <Text className="font-inter-medium text-corps text-texte">{`${c.nom} (−${c.pourcentage} %)`}</Text>
                  <Text className="font-inter text-secondaire text-texte-secondaire">
                    {[c.reseaux.join(", "), c.conditions].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </View>
    </CarteFlottante>
  );
}
