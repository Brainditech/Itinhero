import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HAUTEUR_BARRE_ONGLETS } from "@/composants/BarreOnglets";
import { BoutonPrincipal, CarteErreur, CarteFlottante, Lien, MotItinhero, Puce } from "@/composants/elements";
import { messageEchec } from "@/domaine/api";
import {
  appliquerChangements,
  MESSAGES_ASSISTANT,
  pucesReglages,
  reglagesDepuisChamps,
  remplirConseil,
  SUGGESTIONS_ASSISTANT,
  type ReponseAssistant,
} from "@/domaine/assistant";
import { maintenantAParis, validerFormulaire, type ChampsFormulaire } from "@/domaine/demande";
import { jourCourt, possibiliteDuVerdict } from "@/domaine/resultat";
import { champsDepuisRecherche } from "@/domaine/voyages";
import { useDeroulerRecherche, useOuvrirFormulaire, useRecherche, type Modification, type Recherche } from "@/recherche";
import { useClient, useSession } from "@/session";
import { couleurs, rayons } from "@/theme/jetons";

// Jeton `rayon-bulle` (design system) en style : la classe `rounded-bulle` n'était pas appliquée sur le téléphone.
const RAYON_BULLE = parseInt(rayons.bulle, 10);

/**
 * Assistant (phase 6 bis, spec 37, D31, D115 ; maquette design/assistant/09-assistant.png). La demande et les réglages
 * de la recherche en cours partent à `POST /v1/assistant` (sans coordonnées ni historique) ; la réponse est montrée,
 * et rien n'est relancé ni rangé sans « Relancer la recherche » ou « Voir les trajets ».
 */
export default function Assistant() {
  const insets = useSafeAreaInsets();
  const clavier = useAnimatedKeyboard();
  const { recherche } = useRecherche();
  const reserveOnglets = insets.bottom + 8 + HAUTEUR_BARRE_ONGLETS + 16;
  const styleBas = useAnimatedStyle(() => ({
    paddingBottom: clavier.height.value > 0 ? clavier.height.value + 8 : reserveOnglets,
  }));

  return (
    <View className="flex-1 bg-surface">
      <Animated.View className="flex-1" style={[{ paddingTop: insets.top + 16 }, styleBas]}>
        <View className="gap-2 px-4 pb-2">
          <MotItinhero />
          <Text accessibilityRole="header" className="mt-2 font-inter-bold text-titre-ecran text-texte">
            Assistant
          </Text>
          <Text className="font-inter text-secondaire text-texte-secondaire">{MESSAGES_ASSISTANT.sousTitre}</Text>
        </View>
        {recherche?.reponse && recherche.depart.lieu && recherche.arrivee.lieu ? (
          <Conversation recherche={recherche} />
        ) : (
          <View className="px-4 pt-2">
            <CarteFlottante>
              <Text className="font-inter text-corps text-texte">{MESSAGES_ASSISTANT.aucuneRecherche}</Text>
            </CarteFlottante>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

type Echange =
  | { etat: "attente"; phrase: string }
  | { etat: "reponse"; phrase: string; reponse: ReponseAssistant }
  | { etat: "echec"; phrase: string; message: string };

function Conversation({ recherche }: { recherche: Recherche }) {
  const client = useClient();
  const { oublierCle } = useSession();
  const { setRecherche } = useRecherche();
  const ouvrirFormulaireAccueil = useOuvrirFormulaire();
  const { demarrer } = useDeroulerRecherche();
  const [texte, setTexte] = useState("");
  const [echange, setEchange] = useState<Echange | null>(null);
  const [relance, setRelance] = useState<{ enCours: boolean; erreur?: string }>({ enCours: false });

  const depart = recherche.depart.lieu!;
  const arrivee = recherche.arrivee.lieu!;
  const aujourdhui = maintenantAParis(new Date()).date;
  const champs: ChampsFormulaire = champsDepuisRecherche(recherche.demande, depart, arrivee, aujourdhui);
  const premiere = recherche.reponse ? possibiliteDuVerdict(recherche.reponse) : undefined;
  const suivi = [jourCourt(recherche.demande.date), premiere ? `départ ${premiere.depart}` : null].filter(Boolean).join(" · ");

  async function envoyer() {
    const phrase = texte.trim();
    if (phrase.length < 3 || echange?.etat === "attente") return;
    setEchange({ etat: "attente", phrase });
    setRelance({ enCours: false });
    const r = await client.assistant(phrase, reglagesDepuisChamps(champs));
    if (r.etat === "cle_refusee") {
      await oublierCle();
      return;
    }
    if (r.etat === "ok") {
      setEchange({ etat: "reponse", phrase, reponse: r.donnees });
      setTexte("");
    } else setEchange({ etat: "echec", phrase, message: r.etat === "erreur_serveur" ? MESSAGES_ASSISTANT.indisponible : messageEchec(r) });
  }

  // « Modifier la recherche » (spec 34) : le formulaire de l'Accueil reprend la recherche en cours.
  function ouvrirFormulaire(c: ChampsFormulaire = champs, extra: Pick<Modification, "aChoisir" | "erreurs"> = {}) {
    ouvrirFormulaireAccueil({ remplace: null, champs: c, reprise: true, ...extra });
  }

  /** « Relancer la recherche » : les réglages proposés, validés comme au formulaire, puis la recherche (D78). */
  async function relancer(nouveaux: ChampsFormulaire) {
    const v = validerFormulaire(nouveaux, new Date());
    if (!v.ok) {
      setRelance({ enCours: false, erreur: Object.values(v.erreurs)[0] });
      return;
    }
    setRelance({ enCours: true });
    const remplace = recherche.remplace ?? recherche.rouvert?.cle;
    const echec = await demarrer(v.demande, undefined, remplace);
    if (!echec) {
      setEchange(null);
      setRelance({ enCours: false });
      return;
    }
    // Plusieurs lieux pour un nouveau texte (D91) : le formulaire s'ouvre avec la liste sous le champ.
    if (echec.champ && echec.candidats) {
      setRelance({ enCours: false });
      ouvrirFormulaire(nouveaux, { aChoisir: { [echec.champ]: echec.candidats }, erreurs: { [echec.champ]: echec.message } });
      return;
    }
    setRelance({ enCours: false, erreur: echec.message });
  }

  function voirTri(tri: Extract<ReponseAssistant, { action: "trier" }>["tri"]) {
    if (!recherche.reponse) return;
    // Une copie de la réponse : le Résultat oublie le tri touché avant et part de celui-ci (D97).
    setRecherche({ ...recherche, reponse: { ...recherche.reponse }, tri });
    setEchange(null);
    router.navigate("/resultat");
  }

  return (
    <>
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-4" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center gap-3 rounded-bouton border border-bordure-carte bg-fond p-4">
          <SymbolView name={{ android: "bookmark", web: "bookmark" }} size={28} tintColor={couleurs.primaire} />
          <Text className="flex-1 font-inter text-secondaire text-texte">
            {`Trajet suivi : ${suivi} · ${depart.nom} → ${arrivee.nom}`}
          </Text>
        </View>

        {echange ? (
          <View className="items-end">
            <View className="bg-primaire px-4 py-3" style={{ borderRadius: RAYON_BULLE, maxWidth: "85%" }}>
              <Text className="font-inter-medium text-corps text-fond">{echange.phrase}</Text>
            </View>
          </View>
        ) : null}

        {echange?.etat === "attente" ? (
          <BulleAssistant>
            <Text className="font-inter text-corps text-texte">{MESSAGES_ASSISTANT.enCours}</Text>
          </BulleAssistant>
        ) : null}

        {echange?.etat === "echec" ? (
          <>
            <CarteErreur message={echange.message} />
            <Lien libelle="Modifier la recherche" onPress={() => ouvrirFormulaire()} />
          </>
        ) : null}

        {echange?.etat === "reponse" ? (
          <ReponseVue
            reponse={echange.reponse}
            champs={champs}
            valeurs={{ arrivee: arrivee.nom, depart: depart.nom, heure_depart: premiere?.depart }}
            relance={relance}
            onRelancer={relancer}
            onTrier={voirTri}
            onAnnuler={() => {
              setEchange(null);
              setRelance({ enCours: false });
            }}
          />
        ) : null}
      </ScrollView>

      <View className="gap-3 px-4 pt-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
          {SUGGESTIONS_ASSISTANT.map((s) => (
            <Puce key={s.libelle} libelle={s.libelle} active={false} onPress={() => setTexte(s.texte)} />
          ))}
        </ScrollView>
        <View className="min-h-14 flex-row items-center gap-2 rounded-full border border-bordure-carte bg-fond pl-5 pr-2">
          <TextInput
            accessibilityLabel="Écrivez votre demande"
            placeholder="Écrivez votre demande"
            placeholderTextColor={couleurs["texte-secondaire"]}
            value={texte}
            onChangeText={setTexte}
            onSubmitEditing={envoyer}
            returnKeyType="send"
            className="flex-1 py-3 font-inter text-corps text-texte"
            cursorColor={couleurs.primaire}
            selectionColor={couleurs["primaire-doux"]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Envoyer"
            disabled={echange?.etat === "attente"}
            onPress={envoyer}
            className="h-12 w-12 items-center justify-center rounded-full bg-primaire active:bg-primaire-presse"
          >
            <SymbolView name={{ android: "send", web: "send" }} size={24} tintColor={couleurs.fond} />
          </Pressable>
        </View>
      </View>
    </>
  );
}

function BulleAssistant({ children }: { children: ReactNode }) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="h-12 w-12 items-center justify-center rounded-bouton bg-primaire">
        <SymbolView name={{ android: "smart_toy", web: "smart_toy" }} size={28} tintColor={couleurs.fond} />
      </View>
      <View className="flex-1 gap-3 border border-bordure-carte bg-fond p-4" style={{ borderRadius: RAYON_BULLE }} accessibilityLiveRegion="polite">
        {children}
      </View>
    </View>
  );
}

function ReponseVue({
  reponse,
  champs,
  valeurs,
  relance,
  onRelancer,
  onTrier,
  onAnnuler,
}: {
  reponse: ReponseAssistant;
  champs: ChampsFormulaire;
  valeurs: Record<string, string | undefined>;
  relance: { enCours: boolean; erreur?: string };
  onRelancer: (c: ChampsFormulaire) => void;
  onTrier: (tri: Extract<ReponseAssistant, { action: "trier" }>["tri"]) => void;
  onAnnuler: () => void;
}) {
  if (reponse.action === "relancer") {
    const nouveaux = appliquerChangements(champs, reponse.changements);
    return (
      <>
        <BulleAssistant>
          <Text className="font-inter-medium text-corps text-texte">{MESSAGES_ASSISTANT.relancer}</Text>
          <View className="flex-row flex-wrap gap-2">
            {pucesReglages(nouveaux, reponse.changements).map((p) => (
              <View
                key={p.cle}
                accessibilityLabel={p.change ? `${p.libelle}, changé` : p.libelle}
                className={`rounded-full px-4 py-2 ${p.change ? "bg-primaire-doux" : "bg-surface"}`}
                style={p.change ? { borderWidth: 1.5, borderColor: couleurs.primaire } : undefined}
              >
                <Text className={`font-inter-medium text-badge ${p.change ? "text-primaire" : "text-texte"}`}>
                  {p.libelle}
                </Text>
              </View>
            ))}
          </View>
        </BulleAssistant>
        {relance.erreur ? <CarteErreur message={relance.erreur} /> : null}
        <BoutonPrincipal
          libelle={relance.enCours ? "Recherche…" : "Relancer la recherche"}
          desactive={relance.enCours}
          onPress={() => onRelancer(nouveaux)}
        />
        <Lien libelle="Annuler" onPress={onAnnuler} />
      </>
    );
  }
  if (reponse.action === "trier") {
    return (
      <>
        <BulleAssistant>
          <Text className="font-inter-medium text-corps text-texte">{MESSAGES_ASSISTANT.trier(reponse.tri)}</Text>
        </BulleAssistant>
        <BoutonPrincipal libelle="Voir les trajets" onPress={() => onTrier(reponse.tri)} />
        <Lien libelle="Annuler" onPress={onAnnuler} />
      </>
    );
  }
  if (reponse.action === "conseil") {
    return (
      <BulleAssistant>
        <Text accessibilityRole="header" className="font-inter-semibold text-corps text-texte">
          {reponse.conseil.titre}
        </Text>
        <Text className="font-inter text-corps text-texte">{remplirConseil(reponse.conseil.texte, valeurs)}</Text>
      </BulleAssistant>
    );
  }
  return (
    <BulleAssistant>
      <Text className="font-inter text-corps text-texte">{MESSAGES_ASSISTANT.incompris}</Text>
    </BulleAssistant>
  );
}
