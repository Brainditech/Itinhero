import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View, type ScrollViewInstance } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HAUTEUR_BARRE_ONGLETS } from "@/composants/BarreOnglets";
import { Lien, MotItinhero, Puce } from "@/composants/elements";
import { RechercheAssistant } from "@/composants/RechercheAssistant";
import {
  allegerPieces,
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
import { choisirPdf, choisirPhoto, piecesJointesDisponibles, type IssuePiece, type PieceChoisie } from "@/pieces-jointes";
import { useClient, useSession } from "@/session";
import { couleurs, rayons } from "@/theme/jetons";

// Spec 46 : le champ grandit jusqu'à 5 lignes (interligne mesuré sur le téléphone, ~22 px) plus ses marges, puis défile.
const HAUTEUR_CHAMP_MAX = 5 * 22 + 24;

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

/** Spec 45 : question envoyée d'office quand on arrive de l'onglet Trajet (« Discuter de ce trajet »). */
export const QUESTION_TRAJET = "Explique-moi ce trajet et dis-moi comment l'améliorer.";

function Discussion({ recherche }: { recherche: Recherche | null }) {
  const client = useClient();
  const { oublierCle } = useSession();
  const [fil, setFil] = useState<MessageFil[]>([]);
  const [texte, setTexte] = useState("");
  const [piece, setPiece] = useState<PieceChoisie | null>(null);
  const params = useLocalSearchParams<{ sujet?: string; jeton?: string }>();
  const sujetTraite = useRef<string | null>(null);
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
    let rechercheRecue = false;
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
        // Spec 45 : la recherche proposée s'affiche en cartes sous la réponse.
        surRecherche: (proposition) => {
          rechercheRecue = true;
          setFil((f) => [...f, { id: prochainId.current++, role: "recherche", proposition }]);
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
    // Revue : la réponse finie, les pièces envoyées ne gardent que leur nom.
    if (issue.etat === "complete" || issue.etat === "arretee") setFil((f) => allegerPieces(f));
    // Spec 45 : Claude n'a fait que proposer la recherche ⇒ pas de bulle vide au-dessus de la carte.
    if (issue.etat === "complete" && recu.trim() === "" && rechercheRecue) return changerReponse(id, () => null);
    changerReponse(id, (m) => (echec ? { ...m, etat: "echec", ...echec } : { ...m, etat: issue.etat === "arretee" ? "arretee" : "complete" }));
  }

  function envoyer(question: string = texte) {
    // Spec 45 : une pièce jointe seule part avec une question par défaut.
    const q = (question.trim() || (piece ? "Que dois-je savoir de ce document pour mon voyage ?" : "")).slice(0, TEXTE_MAX);
    if (q === "" || controle.current) return;
    setTexte("");
    const jointe = piece;
    setPiece(null);
    void repondre([...fil, { id: prochainId.current++, role: "personne", texte: q, ...(jointe ? { piece_jointe: jointe } : {}) }]);
  }

  // Spec 45 : « Discuter de ce trajet » depuis l'onglet Trajet ⇒ nouvelle discussion sur le trajet en cours.
  useEffect(() => {
    if (params.sujet !== "trajet" || !params.jeton || sujetTraite.current === params.jeton || !recherche) return;
    sujetTraite.current = params.jeton;
    controle.current?.abort();
    controle.current = null;
    // Revue : nouvelle discussion ⇒ ni pièce en attente ni texte tapé de l'ancienne.
    setPiece(null);
    setTexte("");
    void repondre([{ id: prochainId.current++, role: "personne", texte: QUESTION_TRAJET }]);
    // `repondre` change à chaque rendu ; seul le jeton compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.sujet, params.jeton, recherche]);

  async function joindre() {
    const quoi = await new Promise<"galerie" | "appareil" | "pdf" | null>((resoudre) =>
      Alert.alert("Joindre un document", "Une convocation, un billet, un courrier : l'Assistant le lit pour cette réponse seulement.", [
        { text: "Photo de la galerie", onPress: () => resoudre("galerie") },
        { text: "Prendre une photo", onPress: () => resoudre("appareil") },
        { text: "PDF", onPress: () => resoudre("pdf") },
      ], { cancelable: true, onDismiss: () => resoudre(null) }),
    );
    if (!quoi) return;
    const issue: IssuePiece = quoi === "pdf" ? await choisirPdf() : await choisirPhoto(quoi);
    if (issue.etat === "ok") setPiece(issue.piece);
    else if (issue.etat === "trop_lourd") Alert.alert("Document trop lourd", "Une photo de 1,5 Mo ou un PDF de 2 Mo au plus.");
    else if (issue.etat === "refuse") Alert.alert("Document indisponible", "Le document n'a pas pu être lu.");
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
          m.role === "recherche" ? (
            <RechercheAssistant key={m.id} proposition={m.proposition} />
          ) : m.role === "personne" ? (
            <View key={m.id} className="items-end">
              <View className="gap-2 bg-primaire px-4 py-3" style={{ borderRadius: RAYON_BULLE, maxWidth: "85%" }}>
                {m.piece_jointe ? (
                  <View className="flex-row items-center gap-2">
                    <SymbolView name={{ android: m.piece_jointe.type === "pdf" ? "description" : "image", web: "image" }} size={18} tintColor={couleurs.fond} />
                    <Text numberOfLines={1} className="flex-shrink font-inter text-badge text-fond">
                      {m.piece_jointe.nom}
                    </Text>
                  </View>
                ) : null}
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

      <View className="gap-2 px-4 pt-2">
        {piece ? (
          <View className="flex-row items-center gap-2 self-start rounded-full bg-primaire-doux pl-3 pr-1">
            <SymbolView name={{ android: piece.type === "pdf" ? "description" : "image", web: "image" }} size={18} tintColor={couleurs.primaire} />
            <Text numberOfLines={1} className="max-w-56 font-inter-medium text-badge text-primaire">
              {piece.nom}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Retirer la pièce jointe" onPress={() => setPiece(null)} className="h-10 w-10 items-center justify-center">
              <SymbolView name={{ android: "close", web: "close" }} size={18} tintColor={couleurs.primaire} />
            </Pressable>
          </View>
        ) : null}
        {/* Spec 46 (D127) : zone de texte sur plusieurs lignes ; les boutons restent en bas, à côté de la dernière ligne. */}
        <View className="min-h-14 flex-row items-end gap-2 rounded-carte border border-bordure-carte bg-fond p-1 pl-2">
          {piecesJointesDisponibles() ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Joindre une photo ou un PDF"
              onPress={() => void joindre()}
              disabled={ecrit}
              className="h-12 w-12 items-center justify-center rounded-full active:bg-surface"
            >
              <SymbolView name={{ android: "attach_file", web: "attach_file" }} size={24} tintColor={couleurs.primaire} />
            </Pressable>
          ) : (
            <View className="w-3" />
          )}
          <TextInput
            accessibilityLabel={MESSAGES_DISCUSSION.champ}
            placeholder={MESSAGES_DISCUSSION.champ}
            placeholderTextColor={couleurs["texte-secondaire"]}
            value={texte}
            onChangeText={setTexte}
            multiline
            textAlignVertical="top"
            maxLength={TEXTE_MAX}
            className="flex-1 py-3 font-inter text-corps text-texte"
            style={{ maxHeight: HAUTEUR_CHAMP_MAX }}
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
