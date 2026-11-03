import { useEffect, useRef, useState } from "react";
import { Keyboard, ScrollView, View, type ScrollViewInstance } from "react-native";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useLocalSearchParams } from "expo-router";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HAUTEUR_BARRE_ONGLETS } from "@/composants/BarreOnglets";
import {
  BandeauInfo,
  BoutonPrincipal,
  CarteFlottante,
  ChampTexte,
  ChampTouchable,
  MotItinhero,
  SelecteurDeuxChoix,
} from "@/composants/elements";
import { AttributionCarte, FondCarte, useAttributionCarte } from "@/composants/FondCarte";
import {
  dateChoisie,
  formaterDate,
  heureChoisie,
  LIEU_MAX,
  validerFormulaire,
  versDateLocale,
  type ChampsFormulaire,
  type ErreursFormulaire,
  type Sens,
} from "@/domaine/demande";

// Valeurs en dur de la maquette design/accueil/02-formulaire-repli.png (règle 5), marge D17.
// Remplacées au branchement réel par la sortie de /v1/comprendre.
const VALEURS_MAQUETTE: ChampsFormulaire = {
  lieu: "Rendez-vous Joigny",
  date: "2026-11-12",
  heure: "10:00",
  sens: "arriver_avant",
  marge: "10",
};

const CHOIX_SENS = [
  { valeur: "arriver_avant", libelle: "Arriver avant" },
  { valeur: "partir_a", libelle: "Partir à" },
] as const satisfies readonly [{ valeur: Sens; libelle: string }, { valeur: Sens; libelle: string }];

/**
 * Formulaire de repli (spec 02), en valeurs en dur. Ouvert par le lien de l'Accueil ;
 * avec `raison=indisponible`, le bandeau dit pourquoi (plus tard : /v1/comprendre en panne ou au plafond, D15).
 * « Chercher » valide et affiche les erreurs ; la recherche se branche en phase 3.
 */
export default function Formulaire() {
  const insets = useSafeAreaInsets();
  const clavier = useAnimatedKeyboard();
  const attribution = useAttributionCarte();
  const { raison } = useLocalSearchParams<{ raison?: string }>();
  const defilement = useRef<ScrollViewInstance>(null);
  const margeActive = useRef(false);
  const [champs, setChamps] = useState<ChampsFormulaire>(VALEURS_MAQUETTE);
  const [erreurs, setErreurs] = useState<ErreursFormulaire>({});

  // Un champ modifié perd son message d'erreur ; les autres le gardent jusqu'au prochain « Chercher ».
  function changer<K extends keyof ChampsFormulaire>(cle: K, valeur: ChampsFormulaire[K]) {
    setChamps((c) => ({ ...c, [cle]: valeur }));
    setErreurs((e) => ({ ...e, [cle]: undefined }));
  }

  // La marge est en bas de la carte : quand le clavier s'ouvre pour elle, on la fait remonter.
  useEffect(() => {
    const abonnement = Keyboard.addListener("keyboardDidShow", () => {
      if (margeActive.current) defilement.current?.scrollToEnd({ animated: true });
    });
    return () => abonnement.remove();
  }, []);

  function ouvrirSelecteur(mode: "date" | "time") {
    Keyboard.dismiss();
    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);
    DateTimePickerAndroid.open({
      value: versDateLocale(champs.date, champs.heure),
      mode,
      is24Hour: true,
      minimumDate: mode === "date" ? aujourdhui : undefined,
      onValueChange: (_evenement, choisie) => {
        if (!choisie) return;
        if (mode === "date") changer("date", dateChoisie(choisie));
        else changer("heure", heureChoisie(choisie));
      },
    });
  }

  function chercher() {
    Keyboard.dismiss();
    const resultat = validerFormulaire(champs, new Date());
    setErreurs(resultat.ok ? {} : resultat.erreurs);
  }

  // Même mise en page que l'Accueil : place de la barre d'onglets, ou du clavier quand il est ouvert.
  const reserveOnglets = insets.bottom + 8 + HAUTEUR_BARRE_ONGLETS + 16;
  const styleBas = useAnimatedStyle(() => ({
    paddingBottom: clavier.height.value > 0 ? clavier.height.value + 8 : reserveOnglets,
  }));

  return (
    <View className="flex-1 bg-surface">
      <FondCarte onGeste={attribution.replier} />
      <Animated.View className="flex-1" style={[{ paddingTop: insets.top + 16, pointerEvents: "box-none" }, styleBas]}>
        <View className="flex-row items-start justify-between px-4 pb-4" style={{ pointerEvents: "box-none" }}>
          <MotItinhero />
          <AttributionCarte depliee={attribution.depliee} onDeplier={attribution.deplier} />
        </View>

        {/* flexGrow 0 : la zone sous le bouton reste à la carte ; avec le clavier, la liste rétrécit et défile. */}
        {/* pb-1 : l'ombre de la carte n'est pas coupée par le bord de la liste. */}
        <ScrollView
          ref={defilement}
          style={{ flexGrow: 0 }}
          contentContainerClassName="gap-3 px-4 pb-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {raison === "indisponible" ? (
            <BandeauInfo texte="La compréhension de phrase est indisponible. Remplissez ces champs." />
          ) : null}

          <CarteFlottante>
            <View className="gap-4">
              <ChampTexte
                libelle="Lieu"
                valeur={champs.lieu}
                onChange={(t) => changer("lieu", t)}
                erreur={erreurs.lieu}
                longueurMax={LIEU_MAX}
              />
              <View className="flex-row gap-3">
                <View className="flex-[1.4]">
                  <ChampTouchable
                    libelle="Date"
                    valeur={formaterDate(champs.date)}
                    onPress={() => ouvrirSelecteur("date")}
                    erreur={erreurs.date}
                  />
                </View>
                <View className="flex-1">
                  <ChampTouchable
                    libelle="Heure"
                    valeur={champs.heure}
                    onPress={() => ouvrirSelecteur("time")}
                    erreur={erreurs.heure}
                  />
                </View>
              </View>
              <SelecteurDeuxChoix choix={CHOIX_SENS} valeur={champs.sens} onChange={(s) => changer("sens", s)} />
              {/* « Partir à » : pas de rendez-vous, donc pas de marge (décision 3). */}
              {champs.sens === "arriver_avant" ? (
                <ChampTexte
                  libelle="Marge"
                  valeur={champs.marge}
                  onChange={(t) => changer("marge", t)}
                  erreur={erreurs.marge}
                  suffixe="min"
                  numerique
                  longueurMax={3}
                  onFocus={() => {
                    margeActive.current = true;
                  }}
                  onBlur={() => {
                    margeActive.current = false;
                  }}
                />
              ) : null}
            </View>
          </CarteFlottante>
        </ScrollView>

        {/* Hors de la liste (issue 0004) : sous la carte du formulaire, et posé sur le clavier quand il est ouvert. */}
        <View className="px-4 pt-3" style={{ pointerEvents: "box-none" }}>
          <BoutonPrincipal libelle="Chercher" onPress={chercher} />
        </View>

        <View className="flex-1" style={{ pointerEvents: "box-none" }} />
      </Animated.View>
    </View>
  );
}
