import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, View, type ScrollViewInstance } from "react-native";
import { SymbolView } from "expo-symbols";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HAUTEUR_BARRE_ONGLETS } from "@/composants/BarreOnglets";
import { Lien, MotItinhero, Puce } from "@/composants/elements";
import {
  MESSAGES_DISCUSSION,
  messageIssue,
  messagesAEnvoyer,
  pucesDepart,
  resumeRecherche,
  TEXTE_MAX,
  type MessageFil,
} from "@/domaine/discussion";
import { jourCourt, possibiliteDuVerdict } from "@/domaine/resultat";
import { useRecherche, type Recherche } from "@/recherche";
import { useClient, useSession } from "@/session";
import { couleurs, rayons } from "@/theme/jetons";

// Jeton `rayon-bulle` (design system) en style : la classe `rounded-bulle` n'était pas appliquée sur le téléphone.
const RAYON_BULLE = parseInt(rayons.bulle, 10);

/**
 * Assistant en discussion (spec 39, D117 ; maquette design/assistant/09-assistant.png). Chaque message part à
 * `POST /v1/assistant/discussion` avec la discussion et le résumé de la recherche en cours (sans coordonnées) ; la
 * réponse s'écrit à mesure qu'elle arrive. La discussion ne vit que tant que l'app est ouverte : rien n'est enregistré.
 */
export default function Assistant() {
  const insets = useSafeAreaInsets();
  const clavier = useAnimatedKeyboard();
  const { recherche } = useRecherche();
  const reserveOnglets = insets.bottom + 8 + HAUTEUR_BARRE_ONGLETS + 16;
  const styleBas = useAnimatedStyle(() => ({
    paddingBottom: clavier.height.value > 0 ? clavier.height.value + 8 : reserveOnglets,
  }));
  const enCours = recherche?.reponse && recherche.depart.lieu && recherche.arrivee.lieu ? recherche : null;

  return (
    <View className="flex-1 bg-surface">
      <Animated.View className="flex-1" style={[{ paddingTop: insets.top + 16 }, styleBas]}>
        <View className="gap-2 px-4 pb-2">
          <MotItinhero />
          <Text accessibilityRole="header" className="mt-2 font-inter-bold text-titre-ecran text-texte">
            Assistant
          </Text>
          <Text className="font-inter text-secondaire text-texte-secondaire">{MESSAGES_DISCUSSION.sousTitre}</Text>
        </View>
        <Discussion recherche={enCours} />
      </Animated.View>
    </View>
  );
}

function Discussion({ recherche }: { recherche: Recherche | null }) {
  const client = useClient();
  const { oublierCle } = useSession();
  const [fil, setFil] = useState<MessageFil[]>([]);
  const [texte, setTexte] = useState("");
  const [ecrit, setEcrit] = useState(false);
  const controle = useRef<AbortController | null>(null);
  const prochainId = useRef(0);
  const defilement = useRef<ScrollViewInstance>(null);

  // L'écran quitte la mémoire (app fermée) : la réponse en cours est coupée.
  useEffect(() => () => controle.current?.abort(), []);

  const premiere = recherche?.reponse ? possibiliteDuVerdict(recherche.reponse) : undefined;
  const suivi = recherche
    ? [jourCourt(recherche.demande.date), premiere ? `départ ${premiere.depart}` : null].filter(Boolean).join(" · ")
    : "";

  function changerReponse(id: number, maj: (m: Extract<MessageFil, { role: "assistant" }>) => MessageFil | null) {
    setFil((f) => f.flatMap((m) => (m.id === id && m.role === "assistant" ? (maj(m) ?? []) : [m])));
  }

  /** Envoie la discussion `avant` (qui finit par la question) et écrit la réponse à mesure qu'elle arrive. */
  async function repondre(avant: MessageFil[]) {
    const id = prochainId.current++;
    setFil([...avant, { id, role: "assistant", texte: "", etat: "ecrit" }]);
    const c = new AbortController();
    controle.current = c;
    setEcrit(true);
    let recu = "";
    const resume = recherche
      ? resumeRecherche(
          recherche.demande,
          { bout: recherche.demande.depart, choisi: recherche.depart.lieu },
          { bout: recherche.demande.arrivee, choisi: recherche.arrivee.lieu },
          recherche.reponse,
        )
      : undefined;
    const issue = await client.discussion(
      { messages: messagesAEnvoyer(avant), ...(resume ? { recherche: resume } : {}) },
      {
        signal: c.signal,
        surTexte: (t) => {
          recu += t;
          changerReponse(id, (m) => ({ ...m, texte: m.texte + t }));
        },
      },
    );
    if (controle.current === c) {
      controle.current = null;
      setEcrit(false);
    }
    if (issue.etat === "cle_refusee") {
      await oublierCle();
      return;
    }
    const echec = messageIssue(issue, recu !== "");
    if (issue.etat === "arretee" && recu === "") return changerReponse(id, () => null);
    changerReponse(id, (m) => (echec ? { ...m, etat: "echec", ...echec } : { ...m, etat: issue.etat === "arretee" ? "arretee" : "complete" }));
  }

  function envoyer(question: string = texte) {
    const q = question.trim().slice(0, TEXTE_MAX);
    if (q === "" || controle.current) return;
    setTexte("");
    void repondre([...fil, { id: prochainId.current++, role: "personne", texte: q }]);
  }

  /** « Réessayer » : la réponse en échec est retirée, la même discussion repart. */
  function reessayer(id: number) {
    if (controle.current) return;
    void repondre(fil.filter((m) => m.id !== id));
  }

  function arreter() {
    controle.current?.abort();
  }

  function nouvelleDiscussion() {
    controle.current?.abort();
    controle.current = null;
    setEcrit(false);
    setFil([]);
  }

  const dernier = fil.at(-1);

  return (
    <>
      <ScrollView
        ref={defilement}
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-4"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => defilement.current?.scrollToEnd({ animated: true })}
      >
        {recherche ? (
          <View className="flex-row items-center gap-3 rounded-bouton border border-bordure-carte bg-fond p-4">
            <SymbolView name={{ android: "bookmark", web: "bookmark" }} size={28} tintColor={couleurs.primaire} />
            <Text className="flex-1 font-inter text-secondaire text-texte">
              {`Trajet suivi : ${suivi} · ${recherche.depart.lieu!.nom} → ${recherche.arrivee.lieu!.nom}`}
            </Text>
          </View>
        ) : null}

        {fil.length > 0 ? (
          <View className="items-end">
            <Lien libelle={MESSAGES_DISCUSSION.nouvelle} onPress={nouvelleDiscussion} />
          </View>
        ) : null}

        {fil.map((m) =>
          m.role === "personne" ? (
            <View key={m.id} className="items-end">
              <View className="bg-primaire px-4 py-3" style={{ borderRadius: RAYON_BULLE, maxWidth: "85%" }}>
                <Text selectable className="font-inter-medium text-corps text-fond">
                  {m.texte}
                </Text>
              </View>
            </View>
          ) : (
            <BulleAssistant key={m.id}>
              {m.texte === "" && m.etat === "ecrit" ? (
                <TroisPoints />
              ) : m.texte !== "" ? (
                <Text selectable className="font-inter text-corps text-texte">
                  {m.texte}
                </Text>
              ) : null}
              {m.etat === "echec" && m.erreur ? (
                <View className="flex-row items-start gap-2" accessibilityRole="alert">
                  <SymbolView name={{ android: "error", web: "error" }} size={20} tintColor={couleurs.erreur} />
                  <Text className="flex-1 font-inter-medium text-corps text-texte">{m.erreur}</Text>
                </View>
              ) : null}
              {m.etat === "echec" && m.reessayer && dernier?.id === m.id ? (
                <View className="items-start">
                  <Lien libelle="Réessayer" onPress={() => reessayer(m.id)} />
                </View>
              ) : null}
            </BulleAssistant>
          ),
        )}

        {fil.length === 0 ? (
          <View className="flex-row flex-wrap gap-3">
            {pucesDepart(recherche !== null).map((p) => (
              <Puce key={p} libelle={p} active={false} onPress={() => envoyer(p)} />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View className="px-4 pt-2">
        <View className="min-h-14 flex-row items-center gap-2 rounded-full border border-bordure-carte bg-fond pl-5 pr-2">
          <TextInput
            accessibilityLabel={MESSAGES_DISCUSSION.champ}
            placeholder={MESSAGES_DISCUSSION.champ}
            placeholderTextColor={couleurs["texte-secondaire"]}
            value={texte}
            onChangeText={setTexte}
            onSubmitEditing={() => envoyer()}
            returnKeyType="send"
            maxLength={TEXTE_MAX}
            className="flex-1 py-3 font-inter text-corps text-texte"
            cursorColor={couleurs.primaire}
            selectionColor={couleurs["primaire-doux"]}
          />
          {ecrit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Arrêter"
              onPress={arreter}
              className="h-12 flex-row items-center justify-center gap-1 rounded-full bg-primaire px-4 active:bg-primaire-presse"
            >
              <SymbolView name={{ android: "stop", web: "stop" }} size={20} tintColor={couleurs.fond} />
              <Text className="font-inter-medium text-badge text-fond">Arrêter</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Envoyer"
              onPress={() => envoyer()}
              className="h-12 w-12 items-center justify-center rounded-full bg-primaire active:bg-primaire-presse"
            >
              <SymbolView name={{ android: "send", web: "send" }} size={24} tintColor={couleurs.fond} />
            </Pressable>
          )}
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

/** Trois points animés tant que le premier mot n'est pas arrivé (spec 39 §2.4). */
function TroisPoints() {
  const [n, setN] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setN((x) => (x % 3) + 1), 400);
    return () => clearInterval(t);
  }, []);
  return (
    <Text accessibilityLabel="L'Assistant écrit" className="font-inter-bold text-corps text-texte-secondaire">
      {"•".repeat(n).padEnd(3, " ")}
    </Text>
  );
}
