import { useState } from "react";
import { Keyboard, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BoutonPrincipal, CarteFlottante, ChampTexte, Lien, MotItinhero } from "@/composants/elements";
import { clientApi } from "@/domaine/api";
import { MESSAGES_CLE, normaliserCle } from "@/domaine/cle";
import { useSession } from "@/session";

/**
 * Clé d'appareil (D64) : ouverte tant qu'aucune clé n'est enregistrée. La clé est vérifiée par le serveur
 * (`GET /v1/lieux?q=Paris`) avant d'être gardée ; elle n'est jamais journalisée ni réaffichée.
 */
export default function EcranCle() {
  const insets = useSafeAreaInsets();
  const { urlApi, garderCle } = useSession();
  const [saisie, setSaisie] = useState("");
  const [visible, setVisible] = useState(false);
  const [erreur, setErreur] = useState<string | undefined>();
  const [enCours, setEnCours] = useState(false);

  async function enregistrer() {
    Keyboard.dismiss();
    const lue = normaliserCle(saisie);
    if (!lue.ok) {
      setErreur(lue.message);
      return;
    }
    setEnCours(true);
    setErreur(undefined);
    const r = await clientApi({ urlApi, cle: lue.cle, fetch: (url, init) => fetch(url, init) }).lieux("Paris");
    if (r.etat === "ok") {
      try {
        await garderCle(lue.cle); // l'écran se ferme de lui-même (Stack.Protected)
      } catch {
        setErreur("La clé n'a pas pu être enregistrée sur le téléphone.");
        setEnCours(false);
      }
      return;
    }
    setEnCours(false);
    setErreur(
      r.etat === "cle_refusee"
        ? MESSAGES_CLE.refusee
        : r.etat === "injoignable"
          ? MESSAGES_CLE.injoignable
          : r.etat === "trop_de_demandes"
            ? MESSAGES_CLE.tropDeDemandes
            : MESSAGES_CLE.erreur,
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <ScrollView
        contentContainerClassName="gap-4 px-4"
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <MotItinhero />
        <Text accessibilityRole="header" className="font-inter-bold text-titre-ecran text-texte">
          Clé d&apos;appareil
        </Text>
        <CarteFlottante>
          <View className="gap-4">
            <Text className="font-inter text-corps text-texte-secondaire">
              Saisissez la clé donnée pour ce téléphone. Elle est gardée chiffrée sur le téléphone.
            </Text>
            <ChampTexte
              libelle="Clé"
              valeur={saisie}
              onChange={(t) => {
                setSaisie(t);
                setErreur(undefined);
              }}
              erreur={erreur}
              masque={!visible}
              brut
              longueurMax={100}
              onValider={enregistrer}
            />
            <View className="items-start">
              <Lien libelle={visible ? "Masquer la clé" : "Afficher la clé"} onPress={() => setVisible((v) => !v)} />
            </View>
          </View>
        </CarteFlottante>
        <BoutonPrincipal libelle={enCours ? "Vérification…" : "Enregistrer"} onPress={enregistrer} desactive={enCours} />
      </ScrollView>
    </View>
  );
}
