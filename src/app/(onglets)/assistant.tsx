import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View, type ScrollViewInstance } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
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
import { dateDiscussion, discussionAGarder, filDeDiscussion, type DiscussionGardee } from "@/domaine/historique";
import { jourCourt, possibiliteDuVerdict } from "@/domaine/resultat";
import { useRecherche, type Recherche } from "@/recherche";
import { choisirPdf, choisirPhoto, piecesJointesDisponibles, type IssuePiece, type PieceChoisie } from "@/pieces-jointes";
import { useClient, useSession } from "@/session";
import { enregistrerDiscussion, lireDiscussions, supprimerDiscussion } from "@/stockage/discussions";
import { couleurs, rayons } from "@/theme/jetons";

// Spec 46 : le champ grandit jusqu'à 5 lignes (interligne mesuré sur le téléphone, ~22 px) plus ses marges, puis défile.
const HAUTEUR_CHAMP_MAX = 5 * 22 + 24;

// Jeton `rayon-bulle` (design system) en style : la classe `rounded-bulle` n'était pas appliquée sur le téléphone.
const RAYON_BULLE = parseInt(rayons.bulle, 10);

/**
 * Assistant en discussion (spec 39, D117 ; maquette design/assistant/09-assistant.png). Chaque message part à
 * `POST /v1/assistant/discussion` avec la discussion et le résumé de la recherche en cours (sans coordonnées) ; la
 * réponse s'écrit à mesure qu'elle arrive. Spec 48 (D129) : chaque discussion est gardée dans le téléphone
 * (Historique) et « Nouvelle discussion » repart d'une page vide ; les deux boutons sont en haut à droite.
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
  // Spec 48 (D129) : la discussion à l'écran a un identifiant dès sa première question ; gardée après chaque réponse finie.
  const db = useSQLiteContext();
  const idDiscussion = useRef<string | null>(null);
  const [reponsesFinies, setReponsesFinies] = useState(0);
  const [historique, setHistorique] = useState<DiscussionGardee[] | null>(null);

  useEffect(() => {
    if (reponsesFinies === 0 || !idDiscussion.current) return;
    const d = discussionAGarder(idDiscussion.current, fil, new Date());
    if (d) void enregistrerDiscussion(db, d).catch(() => undefined);
    // Seule une réponse finie enregistre : rouvrir une discussion ne la date pas à nouveau.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reponsesFinies]);

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
    idDiscussion.current ??= `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
    if (issue.etat === "complete" || issue.etat === "arretee") {
      setFil((f) => allegerPieces(f));
      setReponsesFinies((n) => n + 1);
    }
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
    idDiscussion.current = null;
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
    setPiece(null);
    setTexte("");
    idDiscussion.current = null;
  }

  async function ouvrirHistorique() {
    setHistorique([]);
    setHistorique(await lireDiscussions(db).catch(() => []));
  }

  /** Spec 48 : la discussion rouverte remplace celle de l'écran ; on peut la continuer. */
  function rouvrir(d: DiscussionGardee) {
    nouvelleDiscussion();
    const f = filDeDiscussion(d, prochainId.current);
    prochainId.current += f.length;
    idDiscussion.current = d.id;
    setFil(f);
    setHistorique(null);
  }

  async function supprimer(id: string) {
    await supprimerDiscussion(db, id).catch(() => undefined);
    setHistorique((h) => h?.filter((d) => d.id !== id) ?? null);
  }

  const dernier = fil.at(-1);

  return (
    <>
      <View className="gap-2 px-4 pb-2">
        <MotItinhero />
        <View className="mt-2 flex-row items-center gap-1">
          <Text accessibilityRole="header" className="flex-1 font-inter-bold text-titre-ecran text-texte">
            Assistant
          </Text>
          <BoutonEntete icone="history" libelle="Historique" onPress={() => void ouvrirHistorique()} />
          <BoutonEntete icone="add_comment" libelle={MESSAGES_DISCUSSION.nouvelle} onPress={nouvelleDiscussion} desactive={fil.length === 0} />
        </View>
        <Text className="font-inter text-secondaire text-texte-secondaire">{MESSAGES_DISCUSSION.sousTitre}</Text>
      </View>
      <Historique discussions={historique} onFermer={() => setHistorique(null)} onOuvrir={rouvrir} onSupprimer={(id) => void supprimer(id)} />
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

/** Spec 48 : bouton rond de l'en-tête, icône seule, nom lu par TalkBack. */
function BoutonEntete({
  icone,
  libelle,
  onPress,
  desactive,
}: {
  icone: "history" | "add_comment";
  libelle: string;
  onPress: () => void;
  desactive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={libelle}
      accessibilityState={{ disabled: !!desactive }}
      disabled={desactive}
      onPress={onPress}
      className="h-12 w-12 items-center justify-center rounded-full active:bg-primaire-doux"
    >
      <SymbolView name={{ android: icone, web: icone }} size={26} tintColor={desactive ? couleurs["texte-secondaire"] : couleurs.primaire} />
    </Pressable>
  );
}

/** Spec 48 §2.3 : la liste des discussions gardées, plein écran ; `discussions` nul ⇒ fermée. */
function Historique({
  discussions,
  onFermer,
  onOuvrir,
  onSupprimer,
}: {
  discussions: DiscussionGardee[] | null;
  onFermer: () => void;
  onOuvrir: (d: DiscussionGardee) => void;
  onSupprimer: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={discussions !== null} animationType="slide" onRequestClose={onFermer} statusBarTranslucent navigationBarTranslucent>
      <View className="flex-1 bg-surface" style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}>
        <View className="flex-row items-center px-4 pb-2">
          <Text accessibilityRole="header" className="flex-1 font-inter-bold text-titre-ecran text-texte">
            Historique
          </Text>
          <Lien libelle="Fermer" onPress={onFermer} />
        </View>
        <ScrollView contentContainerClassName="gap-3 px-4 pb-4">
          {discussions?.length === 0 ? (
            <Text className="font-inter text-corps text-texte-secondaire">Aucune discussion gardée pour l&apos;instant.</Text>
          ) : null}
          {discussions?.map((d) => (
            <View key={d.id} className="flex-row items-center gap-2 rounded-bouton border border-bordure-carte bg-fond pl-4">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Rouvrir : ${d.titre}, ${dateDiscussion(d.mise_a_jour)}`}
                onPress={() => onOuvrir(d)}
                className="min-h-16 flex-1 justify-center gap-1 py-3"
              >
                <Text numberOfLines={2} className="font-inter-semibold text-corps text-texte">
                  {d.titre}
                </Text>
                <Text className="font-inter text-badge text-texte-secondaire">{dateDiscussion(d.mise_a_jour)}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Supprimer : ${d.titre}`}
                onPress={() => onSupprimer(d.id)}
                className="h-12 w-12 items-center justify-center rounded-full active:bg-surface"
              >
                <SymbolView name={{ android: "delete", web: "delete" }} size={24} tintColor={couleurs["texte-secondaire"]} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
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
