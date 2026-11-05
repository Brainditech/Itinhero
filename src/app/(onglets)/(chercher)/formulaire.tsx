import { useEffect, useRef, useState } from "react";
import { Keyboard, ScrollView, View, type ScrollViewInstance } from "react-native";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HAUTEUR_BARRE_ONGLETS } from "@/composants/BarreOnglets";
import {
  BandeauInfo,
  BoutonEchange,
  BoutonPrincipal,
  CarteErreur,
  CarteFlottante,
  ChampLieu,
  ChampTexte,
  ChampTouchable,
  Lien,
  MotItinhero,
  SelecteurDeuxChoix,
} from "@/composants/elements";
import { AttributionCarte, FondCarte, useAttributionCarte } from "@/composants/FondCarte";
import { useSuggestionsLieu } from "@/composants/useSuggestionsLieu";
import type { Candidat } from "@/domaine/api";
import {
  dateChoisie,
  echangerBouts,
  formaterDate,
  heureChoisie,
  LIEU_MAX,
  maintenantAParis,
  validerFormulaire,
  versDateLocale,
  type Bout,
  type ChampsFormulaire,
  type CoteBout,
  type ErreursFormulaire,
  type Sens,
} from "@/domaine/demande";
import { detailCandidat } from "@/domaine/resultat";
import { boutDuCandidat, candidatDuBout, reporterLieu, type EtatSuggestions } from "@/domaine/suggestions";
import { DOMICILE_ABSENT, useDeroulerRecherche } from "@/recherche";

// Valeurs en dur de la maquette design/accueil/02-formulaire-repli.png (règle 5), marge D17.
// Remplacées au branchement réel par la sortie de /v1/comprendre.
const VALEURS_MAQUETTE: ChampsFormulaire = {
  depart: { type: "domicile" },
  arrivee: { type: "texte", texte: "Rendez-vous Joigny" },
  date: "2026-11-12",
  heure: "10:00",
  sens: "arriver_avant",
  marge: "10",
};

/** Départ choisi sur l'Accueil (`depart=domicile|position`), Domicile sinon. */
function departDeLAccueil(param: string | undefined): Bout {
  return param === "position" ? { type: "position" } : { type: "domicile" };
}

/** Valeurs de départ : celles de la maquette, sans jamais proposer une date passée. */
function valeursInitiales(departParam: string | undefined): ChampsFormulaire {
  const aujourdhui = maintenantAParis(new Date()).date;
  const valeurs = { ...VALEURS_MAQUETTE, depart: departDeLAccueil(departParam) };
  return valeurs.date < aujourdhui ? { ...valeurs, date: aujourdhui } : valeurs;
}

const CHOIX_SENS = [
  { valeur: "arriver_avant", libelle: "Arriver avant" },
  { valeur: "partir_a", libelle: "Partir à" },
] as const satisfies readonly [{ valeur: Sens; libelle: string }, { valeur: Sens; libelle: string }];

/**
 * Formulaire de repli (spec 02). Ouvert par le lien de l'Accueil, ou par son « Chercher » avec
 * `raison=indisponible` (D15 : /v1/comprendre n'existe pas encore), et le départ choisi (`depart`).
 * Départ et Arrivée (spec 13) : texte tapé, Domicile ou Ma position, échangés par ⇅.
 * Pendant la frappe, les lieux suggérés s'affichent sous le champ (spec 18, D89) ; un lieu touché s'y écrit (D90).
 * « Chercher » : validation, puis la recherche dans l'ordre de D78 (`useDeroulerRecherche`) ; un texte tapé
 * qui donne un seul lieu s'écrit dans son champ, plusieurs ⇒ la liste s'ouvre sous ce champ, aucun ⇒ message.
 */
export default function Formulaire() {
  const insets = useSafeAreaInsets();
  const clavier = useAnimatedKeyboard();
  const attribution = useAttributionCarte();
  const { raison, depart: departParam } = useLocalSearchParams<{ raison?: string; depart?: string }>();
  const defilement = useRef<ScrollViewInstance>(null);
  const margeActive = useRef(false);
  const [champs, setChamps] = useState<ChampsFormulaire>(() => valeursInitiales(departParam));
  const [erreurs, setErreurs] = useState<ErreursFormulaire>({});
  const [erreurRecherche, setErreurRecherche] = useState<string | undefined>();
  const [enCours, setEnCours] = useState(false);
  const { demarrer } = useDeroulerRecherche();
  // Champ de lieu qui a le clavier, et lieux à choisir laissés par « Chercher » sous un champ (D90).
  const [actif, setActif] = useState<CoteBout | null>(null);
  const [aChoisir, setAChoisir] = useState<Partial<Record<CoteBout, Candidat[]>>>({});
  const suggereDepart = useSuggestionsLieu(champs.depart, champs.arrivee, actif === "depart");
  const suggereArrivee = useSuggestionsLieu(champs.arrivee, champs.depart, actif === "arrivee");
  const listeDe = (cote: CoteBout): EtatSuggestions => {
    const imposes = aChoisir[cote];
    if (imposes) return { etat: "ok", candidats: imposes };
    return cote === "depart" ? suggereDepart : suggereArrivee;
  };

  // Un champ modifié perd son message d'erreur ; les autres le gardent jusqu'au prochain « Chercher ».
  function changer<K extends keyof ChampsFormulaire>(cle: K, valeur: ChampsFormulaire[K]) {
    setChamps((c) => ({ ...c, [cle]: valeur }));
    setErreurs((e) => ({ ...e, [cle]: undefined }));
    if (cle === "depart" || cle === "arrivee") setAChoisir((a) => ({ ...a, [cle]: undefined }));
  }

  // Lieu touché dans la liste : il s'écrit dans le champ, la liste et le clavier se ferment (spec 18, §4.1).
  function choisir(cote: CoteBout, c: Candidat) {
    changer(cote, boutDuCandidat(c));
    Keyboard.dismiss();
  }

  // Le champ qui prend le clavier devient actif ; celui qui le perd ne l'est plus (s'il l'était encore).
  function activer(cote: CoteBout, a: boolean) {
    setActif((x) => (a ? cote : x === cote ? null : x));
  }

  // Le départ choisi sur l'Accueil suit quand on revient au formulaire déjà ouvert
  // (état ajusté pendant le rendu, sans effet : doc React, « You might not need an effect »).
  const [departVu, setDepartVu] = useState(departParam);
  if (departParam !== departVu) {
    setDepartVu(departParam);
    if (departParam === "position" || departParam === "domicile") changer("depart", departDeLAccueil(departParam));
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

  // ⇅ : l'aller devient le retour ; les messages des deux champs sont effacés (spec 13, §4.1).
  function echanger() {
    setChamps(echangerBouts);
    setErreurs((e) => ({ ...e, depart: undefined, arrivee: undefined }));
    setAChoisir({});
  }

  async function chercher() {
    if (enCours) return;
    Keyboard.dismiss();
    setErreurRecherche(undefined);
    setAChoisir({});
    const resultat = validerFormulaire(champs, new Date());
    setErreurs(resultat.ok ? {} : resultat.erreurs);
    if (!resultat.ok) return;
    setEnCours(true);
    try {
      // Un texte qui donne un seul lieu s'écrit dans son champ (D90), s'il n'a pas changé entre-temps.
      const echec = await demarrer(resultat.demande, (cote, texte, lieu) => setChamps((c) => reporterLieu(c, cote, texte, lieu)));
      if (echec?.champ) {
        setErreurs({ [echec.champ]: echec.message });
        if (echec.candidats) setAChoisir({ [echec.champ]: echec.candidats });
      } else if (echec) setErreurRecherche(echec.message);
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
              {/* Écart voulu à la maquette (spec 13, §4) : Départ et Arrivée à la place de « Lieu » et des puces du départ. */}
              <View>
                <ChampLieuDuFormulaire
                  cote="depart"
                  champs={champs}
                  erreurs={erreurs}
                  onChange={changer}
                  suggestions={listeDe("depart")}
                  onChoisir={(c) => choisir("depart", c)}
                  onActif={(a) => activer("depart", a)}
                />
                {/* Entre les deux champs, à droite ; -my-2 : sans trop les écarter ; zIndex : au-dessus du libellé
                    « Arrivée » qu'il chevauche, pour le dessin comme pour le toucher. Sous une liste ouverte, il ne
                    la chevauche pas : il cacherait la fin de sa dernière ligne. */}
                <View
                  className={`${listeDe("depart").etat === "ferme" ? "-my-2" : "-mb-2 mt-1"} items-end`}
                  style={{ pointerEvents: "box-none", zIndex: 1 }}
                >
                  <BoutonEchange onPress={echanger} />
                </View>
                <ChampLieuDuFormulaire
                  cote="arrivee"
                  champs={champs}
                  erreurs={erreurs}
                  onChange={changer}
                  suggestions={listeDe("arrivee")}
                  onChoisir={(c) => choisir("arrivee", c)}
                  onActif={(a) => activer("arrivee", a)}
                />
              </View>
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

/** Départ ou Arrivée, avec ses lieux suggérés, et le lien vers Réglages quand le domicile manque. */
function ChampLieuDuFormulaire({
  cote,
  champs,
  erreurs,
  onChange,
  suggestions,
  onChoisir,
  onActif,
}: {
  cote: CoteBout;
  champs: ChampsFormulaire;
  erreurs: ErreursFormulaire;
  onChange: (cle: CoteBout, bout: Bout) => void;
  suggestions: EtatSuggestions;
  onChoisir: (c: Candidat) => void;
  onActif: (actif: boolean) => void;
}) {
  const erreur = erreurs[cote];
  const bout = champs[cote];
  return (
    <View>
      <ChampLieu
        libelle={cote === "depart" ? "Départ" : "Arrivée"}
        nomCourt={cote === "depart" ? "départ" : "arrivée"}
        bout={bout}
        onChange={(b) => onChange(cote, b)}
        erreur={erreur}
        longueurMax={LIEU_MAX}
        detail={bout.type === "lieu" ? detailCandidat(candidatDuBout(bout)) : undefined}
        suggestions={suggestions}
        onChoisir={onChoisir}
        onActif={onActif}
      />
      {erreur === DOMICILE_ABSENT ? (
        <View className="items-start">
          <Lien libelle="Ouvrir Réglages" onPress={() => router.navigate("/reglages")} />
        </View>
      ) : null}
    </View>
  );
}
