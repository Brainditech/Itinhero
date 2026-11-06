import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HAUTEUR_BARRE_ONGLETS } from "@/composants/BarreOnglets";
import { BoutonPrincipal, CarteFlottante, Lien, MotItinhero, Puce } from "@/composants/elements";
import { AttributionCarte, FondCarte, useAttributionCarte } from "@/composants/FondCarte";
import { champsDepuisComprehension } from "@/domaine/comprendre";
import { maintenantAParis } from "@/domaine/demande";
import { useRecherche } from "@/recherche";
import { useClient, useSession } from "@/session";
import { couleurs } from "@/theme/jetons";

type Depart = "domicile" | "position";

// Phase 1 : écran comparé à design/accueil/01-accueil.png. Derrière : la carte (D36).
// « Chercher » (spec 28, D106) : la phrase part à `POST /v1/comprendre` ; comprise ⇒ le formulaire s'ouvre
// pré-rempli, à vérifier avant de chercher ; tout échec (Claude absent, plafond, réseau) ⇒ formulaire de repli.
export default function Accueil() {
  const insets = useSafeAreaInsets();
  const client = useClient();
  const { oublierCle } = useSession();
  const { setModification } = useRecherche();
  const [enCours, setEnCours] = useState(false);
  const clavier = useAnimatedKeyboard();
  const [phrase, setPhrase] = useState("jeudi 10h RDV à Joigny");
  const [depart, setDepart] = useState<Depart>("domicile");
  const attribution = useAttributionCarte();

  async function chercher() {
    const texte = phrase.trim();
    if (texte.length < 3) {
      router.push({ pathname: "/formulaire", params: { depart } });
      return;
    }
    setEnCours(true);
    const r = await client.comprendre(texte);
    setEnCours(false);
    if (r.etat === "cle_refusee") {
      await oublierCle();
      return;
    }
    if (r.etat !== "ok") {
      router.push({ pathname: "/formulaire", params: { raison: "indisponible", depart } });
      return;
    }
    const champs = champsDepuisComprehension(r.donnees, { type: depart }, maintenantAParis(new Date()));
    setModification({ remplace: null, champs, jeton: Date.now() });
    router.push({ pathname: "/formulaire", params: { raison: "comprise", depart } });
  }

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
            {/* Spec 13, §4.2 : le départ en icône + mot, comme les icônes des champs du formulaire. */}
            <Text nativeID="libelle-depart" className="mb-2 font-inter text-secondaire text-texte-secondaire">
              Départ
            </Text>
            <View accessibilityRole="radiogroup" accessibilityLabelledBy="libelle-depart" className="flex-row flex-wrap gap-3">
              <Puce icone="home" libelle="Domicile" active={depart === "domicile"} onPress={() => setDepart("domicile")} />
              <Puce icone="my_location" libelle="Ma position" active={depart === "position"} onPress={() => setDepart("position")} />
            </View>
            {/* Dans la carte, et non sur le fond : posé sur la carte MapLibre, il se perdait parmi les noms de villages. */}
            <View className="mt-2 items-center">
              <Lien libelle="Remplir un formulaire à la place" onPress={() => router.push({ pathname: "/formulaire", params: { depart } })} />
            </View>
          </CarteFlottante>
        </View>

        <View className="flex-1" style={{ pointerEvents: "box-none" }} />

        <View className="px-4 pt-2" style={{ pointerEvents: "box-none" }}>
          <BoutonPrincipal libelle={enCours ? "Lecture de la phrase…" : "Chercher"} desactive={enCours} onPress={chercher} />
        </View>
      </Animated.View>
    </View>
  );
}
