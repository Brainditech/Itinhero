import { useEffect, useRef, useState } from "react";
import { Keyboard, ScrollView, Text, View, type ScrollViewInstance } from "react-native";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HAUTEUR_BARRE_ONGLETS } from "@/composants/BarreOnglets";
import {
  BandeauInfo,
  BoutonPrincipal,
  CarteErreur,
  CarteFlottante,
  ChampTexte,
  ChampTouchable,
  Lien,
  MotItinhero,
  Puce,
  SelecteurDeuxChoix,
} from "@/composants/elements";
import { AttributionCarte, FondCarte, useAttributionCarte } from "@/composants/FondCarte";
import {
  dateChoisie,
  formaterDate,
  heureChoisie,
  LIEU_MAX,
  maintenantAParis,
  validerFormulaire,
  versDateLocale,
  type ChampsFormulaire,
  type ErreursFormulaire,
  type Sens,
} from "@/domaine/demande";
import { messageEchec, type Point } from "@/domaine/api";
import type { Depart } from "@/domaine/resultat";
import { useChercherItineraires, useRecherche } from "@/recherche";
import { useClient, useSession } from "@/session";
import { MESSAGES_POSITION, lirePosition } from "@/stockage/position";
import { lireDomicileEnBase } from "@/stockage/reglages";

// Valeurs en dur de la maquette design/accueil/02-formulaire-repli.png (règle 5), marge D17.
// Remplacées au branchement réel par la sortie de /v1/comprendre.
const VALEURS_MAQUETTE: ChampsFormulaire = {
  lieu: "Rendez-vous Joigny",
  date: "2026-11-12",
  heure: "10:00",
  sens: "arriver_avant",
  marge: "10",
};

/** Valeurs de départ : celles de la maquette, sans jamais proposer une date passée. */
function valeursInitiales(): ChampsFormulaire {
  const aujourdhui = maintenantAParis(new Date()).date;
  return VALEURS_MAQUETTE.date < aujourdhui ? { ...VALEURS_MAQUETTE, date: aujourdhui } : VALEURS_MAQUETTE;
}

const DOMICILE_ABSENT = "Indiquez votre domicile dans Réglages.";

const CHOIX_SENS = [
  { valeur: "arriver_avant", libelle: "Arriver avant" },
  { valeur: "partir_a", libelle: "Partir à" },
] as const satisfies readonly [{ valeur: Sens; libelle: string }, { valeur: Sens; libelle: string }];

/**
 * Formulaire de repli (spec 02). Ouvert par le lien de l'Accueil, ou par son « Chercher » avec
 * `raison=indisponible` (D15 : /v1/comprendre n'existe pas encore), et le départ choisi (`depart`).
 * « Chercher » (spec 10) : validation, point de départ (domicile ou position), puis `GET /v1/lieux` ;
 * plusieurs candidats ⇒ Confirmation, un seul ⇒ Résultat directement, aucun ⇒ message sur le champ Lieu.
 */
export default function Formulaire() {
  const insets = useSafeAreaInsets();
  const clavier = useAnimatedKeyboard();
  const attribution = useAttributionCarte();
  const { raison, depart: departParam } = useLocalSearchParams<{ raison?: string; depart?: string }>();
  const defilement = useRef<ScrollViewInstance>(null);
  const margeActive = useRef(false);
  const [champs, setChamps] = useState<ChampsFormulaire>(valeursInitiales);
  const [erreurs, setErreurs] = useState<ErreursFormulaire>({});
  const [depart, setDepart] = useState<Depart>(departParam === "position" ? "position" : "domicile");
  const [erreurDepart, setErreurDepart] = useState<string | undefined>();
  const [erreurRecherche, setErreurRecherche] = useState<string | undefined>();
  const [enCours, setEnCours] = useState(false);
  const db = useSQLiteContext();
  const client = useClient();
  const { oublierCle } = useSession();
  const { setRecherche } = useRecherche();
  const chercherItineraires = useChercherItineraires();

  // Le départ choisi sur l'Accueil suit quand on revient au formulaire déjà ouvert
  // (état ajusté pendant le rendu, sans effet : doc React, « You might not need an effect »).
  const [departVu, setDepartVu] = useState(departParam);
  if (departParam !== departVu) {
    setDepartVu(departParam);
    if (departParam === "position" || departParam === "domicile") setDepart(departParam);
  }

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

  function choisirDepart(d: Depart) {
    setDepart(d);
    setErreurDepart(undefined);
  }

  async function pointDepart(): Promise<Point | null> {
    if (depart === "domicile") {
      const domicile = await lireDomicileEnBase(db);
      if (!domicile) setErreurDepart(DOMICILE_ABSENT);
      return domicile;
    }
    const lue = await lirePosition();
    if (lue.etat !== "ok") {
      setErreurDepart(MESSAGES_POSITION[lue.etat]);
      return null;
    }
    return lue.point;
  }

  async function chercher() {
    if (enCours) return;
    Keyboard.dismiss();
    setErreurRecherche(undefined);
    setErreurDepart(undefined);
    const resultat = validerFormulaire(champs, new Date());
    setErreurs(resultat.ok ? {} : resultat.erreurs);
    if (!resultat.ok) return;
    const demande = resultat.demande;
    setEnCours(true);
    try {
      const point = await pointDepart();
      if (!point) return;
      const r = await client.lieux(demande.lieu_texte, point);
      if (r.etat === "cle_refusee") {
        await oublierCle();
        return;
      }
      if (r.etat !== "ok") {
        setErreurRecherche(messageEchec(r));
        return;
      }
      const candidats = r.donnees.slice(0, 5);
      if (candidats.length === 0) {
        setErreurs({ lieu: `Aucun lieu trouvé pour « ${demande.lieu_texte} ». Essayez avec la commune.` });
        return;
      }
      const base = { demande, depart, pointDepart: point, candidats };
      // Un seul candidat : rien à confirmer (phase 2, « confirmation quand il y a plusieurs candidats »).
      if (candidats.length === 1) {
        const echec = await chercherItineraires(base, candidats[0]!);
        if (echec) setErreurRecherche(echec);
        return;
      }
      setRecherche({ ...base, arrivee: null, reponse: null });
      router.push("/confirmation");
    } catch {
      setErreurRecherche("La recherche a échoué.");
    } finally {
      setEnCours(false);
    }
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
              {/* Écart voulu à la maquette (spec 10, §4.2) : sans ces puces, le formulaire ne dit pas d'où l'on part. */}
              <View className="gap-2">
                <Text className="font-inter text-secondaire text-texte-secondaire">Départ</Text>
                <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-3">
                  <Puce libelle="Depuis : Domicile" active={depart === "domicile"} onPress={() => choisirDepart("domicile")} />
                  <Puce libelle="Depuis ma position" active={depart === "position"} onPress={() => choisirDepart("position")} />
                </View>
                {erreurDepart ? (
                  <View className="items-start">
                    <Text accessibilityLiveRegion="polite" className="font-inter-medium text-badge text-erreur">
                      {erreurDepart}
                    </Text>
                    {erreurDepart === DOMICILE_ABSENT ? (
                      <Lien libelle="Ouvrir Réglages" onPress={() => router.navigate("/reglages")} />
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>
          </CarteFlottante>
          {erreurRecherche ? <CarteErreur message={erreurRecherche} onReessayer={chercher} /> : null}
        </ScrollView>

        {/* Hors de la liste (issue 0004) : sous la carte du formulaire, et posé sur le clavier quand il est ouvert. */}
        <View className="px-4 pt-3" style={{ pointerEvents: "box-none" }}>
          <BoutonPrincipal libelle={enCours ? "Recherche en cours…" : "Chercher"} onPress={chercher} desactive={enCours} />
        </View>

        <View className="flex-1" style={{ pointerEvents: "box-none" }} />
      </Animated.View>
    </View>
  );
}
