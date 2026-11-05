import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Linking, PanResponder, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { AndroidSymbol } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CarteEtape } from "@/composants/CarteEtape";
import { CARTE } from "@/composants/carte-module";
import { Fleche } from "@/composants/Fleches";
import { iconeMode } from "@/composants/icones-mode";
import type { Etape, Point } from "@/domaine/api";
import { destinationMarche, distanceConsigne, phraseConsigne } from "@/domaine/consignes";
import {
  arretsDuTrajet,
  enteteEtape,
  hauteursPanneau,
  positionLachee,
  positionSuivante,
  type PositionPanneau,
} from "@/domaine/etape";
import { jusqua, phraseMarche, phraseTrajetVehicule } from "@/domaine/guidage";
import { formaterDuree, jetonMode, phraseReservation, phraseTaxi, vientVousChercher } from "@/domaine/resultat";
import { useRecherche } from "@/recherche";
import { couleurs, ombreFlottante } from "@/theme/jetons";

/**
 * Fenêtre d'une étape (spec 17) : la carte en fond, l'étape en bas dans un panneau à trois positions
 * (replié, à mi-hauteur, déplié ; D85), et un bouton rond en bas à droite pour lancer le guidage (D86).
 * Elle n'affiche que la réponse déjà reçue : ni position, ni appel au serveur (§7).
 */

/** Bouton rond flottant, 56 dp (cible tactile). */
function BoutonRond({
  icone,
  libelle,
  onPress,
  plein = false,
}: {
  icone: AndroidSymbol;
  libelle: string;
  onPress: () => void;
  plein?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={libelle}
      onPress={onPress}
      className={`h-14 w-14 items-center justify-center rounded-full ${plein ? "bg-primaire" : "bg-fond"}`}
      style={{ boxShadow: "0px 3px 10px rgba(20, 22, 31, 0.22)" }}
    >
      <SymbolView name={{ android: icone, web: icone }} size={26} tintColor={plein ? couleurs.fond : couleurs.texte} />
    </Pressable>
  );
}

/** Petit bouton d'icône du panneau (48 dp). */
function BoutonPanneau({ icone, libelle, onPress }: { icone: AndroidSymbol; libelle: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={libelle}
      onPress={onPress}
      hitSlop={4}
      className="h-12 w-12 items-center justify-center rounded-full bg-primaire-doux"
    >
      <SymbolView name={{ android: icone, web: icone }} size={24} tintColor={couleurs.primaire} />
    </Pressable>
  );
}

/** Consignes d'une marche (spec 11) : toucher une consigne centre la carte sur son point. */
function ListeMarche({ etape, suivante, choisi, choisir }: { etape: Etape; suivante?: Etape; choisi: number | null; choisir: (i: number, p: Point) => void }) {
  const consignes = etape.consignes ?? [];
  const destination = destinationMarche(etape, suivante);
  if (consignes.length < 2) {
    return <Text className="font-inter text-secondaire text-texte-secondaire">{phraseMarche(etape, suivante)}</Text>;
  }
  return (
    <View>
      {consignes.map((c, i) => {
        const d = distanceConsigne(c);
        const active = i === choisi;
        return (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityHint="Centre la carte sur ce point"
            onPress={() => choisir(i, c)}
            className={`min-h-14 flex-row items-center gap-3 rounded-champ px-2 py-2 ${active ? "bg-primaire-doux" : ""}`}
          >
            <Fleche manoeuvre={c.manoeuvre} taille={28} couleur={couleurs.primaire} />
            <View className="flex-1">
              <Text className="font-inter-medium text-secondaire text-texte">{phraseConsigne(c, destination)}</Text>
              {d ? <Text className="font-inter text-badge text-texte-secondaire">{d}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Frise des arrêts du trajet, de la montée à la descente, avec leur heure (spec 17, §4.2). */
function ListeVehicule({ etape, choisi, choisir }: { etape: Etape; choisi: number | null; choisir: (i: number, p: Point) => void }) {
  const couleur = couleurs[jetonMode(etape.mode)];
  const arrets = arretsDuTrajet(etape);
  const reservation = phraseReservation(etape) ?? phraseTaxi(etape);
  const taxi = vientVousChercher(etape);
  const descente = arrets.find((a) => a.role === "descente");
  return (
    <View className="gap-3">
      {taxi ? (
        <Text className="font-inter text-secondaire text-texte">{phraseTrajetVehicule(etape, formaterDuree(etape.duree_minutes))}</Text>
      ) : (
        <View>
          {arrets.map((a, i) => {
            const bout = a.role !== "intermediaire";
            const premier = i === 0;
            const dernier = i === arrets.length - 1;
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`${a.heure ?? ""} ${a.nom}${a.role === "montee" ? ", montée" : a.role === "descente" ? ", descente" : ""}`}
                accessibilityHint="Centre la carte sur cet arrêt"
                onPress={() => choisir(i, a)}
                className={`min-h-12 flex-row items-stretch gap-3 rounded-champ px-2 ${i === choisi ? "bg-primaire-doux" : ""}`}
              >
                <Text
                  className={`w-14 py-3 ${bout ? "font-inter-semibold text-secondaire text-texte" : "font-inter text-badge text-texte-secondaire"}`}
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {a.heure ?? ""}
                </Text>
                <View className="w-5 items-center">
                  <View className="w-1 flex-1" style={{ backgroundColor: premier ? "transparent" : couleur }} />
                  <View
                    style={{
                      width: bout ? 18 : 12,
                      height: bout ? 18 : 12,
                      borderRadius: 9,
                      backgroundColor: couleurs.fond,
                      borderWidth: bout ? 4 : 3,
                      borderColor: couleur,
                    }}
                  />
                  <View className="w-1 flex-1" style={{ backgroundColor: dernier ? "transparent" : couleur }} />
                </View>
                <Text className={`flex-1 py-3 ${bout ? "font-inter-semibold text-secondaire text-texte" : "font-inter text-badge text-texte"}`}>
                  {a.nom}
                </Text>
              </Pressable>
            );
          })}
          {arrets.length === 2 && descente ? (
            <Text className="mt-1 font-inter text-badge text-texte-secondaire">{`Sans arrêt j${jusqua(descente.nom).slice(1)}`}</Text>
          ) : null}
        </View>
      )}
      {etape.exploitant ? <Text className="font-inter text-badge text-texte-secondaire">{etape.exploitant}</Text> : null}
      {reservation ? (
        <View className="flex-row items-center gap-2">
          <SymbolView name={{ android: "call", web: "call" }} size={18} tintColor={couleurs.avertissement} />
          <Text className="flex-1 font-inter-semibold text-badge" style={{ color: couleurs.avertissement }}>
            {reservation}
          </Text>
        </View>
      ) : null}
      {etape.mode === "taxi" ? null : (
        // Invariant 12 : aucune position du véhicule « en direct » sans flux temps réel.
        <View className="flex-row items-center gap-1 self-start rounded-full px-2 py-0.5" style={{ backgroundColor: couleurs["prevu-teinte"] }}>
          <SymbolView name={{ android: "schedule", web: "schedule" }} size={14} tintColor={couleurs["prevu-texte"]} />
          <Text className="font-inter text-badge" style={{ color: couleurs["prevu-texte"] }}>
            Horaire prévu, sans suivi en direct
          </Text>
        </View>
      )}
    </View>
  );
}

export default function FenetreEtape() {
  const insets = useSafeAreaInsets();
  const { height: hauteurEcran } = useWindowDimensions();
  const params = useLocalSearchParams<{ i?: string; e?: string }>();
  const { recherche } = useRecherche();
  // Figée à l'ouverture, comme le guidage : une nouvelle réponse ne change pas la fenêtre ouverte.
  const [possibilite] = useState(() => recherche?.reponse?.possibilites[Number(params.i ?? 0)]);
  const rang = Number(params.e ?? 0);
  const etape = possibilite?.etapes[rang];

  const [hauteurEntete, setHauteurEntete] = useState(140);
  const h = useMemo(() => hauteursPanneau(hauteurEcran, hauteurEntete + insets.bottom), [hauteurEcran, hauteurEntete, insets.bottom]);
  const [position, setPosition] = useState<PositionPanneau>("milieu");
  const [choisi, setChoisi] = useState<{ i: number; point: Point } | null>(null);
  const [recentrer, setRecentrer] = useState(0);

  // Hauteur visible du panneau, animée ; le panneau fait toujours la hauteur dépliée et glisse vers le bas.
  const [visible] = useState(() => new Animated.Value(h.milieu));
  // Ce que lit le geste (hauteurs, position) : recopié après chaque rendu, jamais lu pendant le rendu.
  const geste = useRef({ h, position, depart: 0, aller: (_: PositionPanneau) => {} });
  const allerA = (p: PositionPanneau) => {
    setPosition(p);
    Animated.spring(visible, { toValue: h[p], useNativeDriver: true, bounciness: 0, speed: 16 }).start();
  };
  useEffect(() => {
    geste.current.h = h;
    geste.current.position = position;
    geste.current.aller = (p) => {
      setPosition(p);
      Animated.spring(visible, { toValue: h[p], useNativeDriver: true, bounciness: 0, speed: 16 }).start();
    };
  });
  // L'en-tête mesuré change les hauteurs : le panneau se recale sur sa position.
  useEffect(() => {
    visible.setValue(h[geste.current.position]);
  }, [h, visible]);

  // Les refs ne sont lues que dans les rappels du geste, jamais pendant le rendu.
  // eslint-disable-next-line react-hooks/refs -- PanResponder.create ne fait que ranger les rappels
  const [glisser] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        geste.current.depart = geste.current.h[geste.current.position];
        visible.stopAnimation();
      },
      onPanResponderMove: (_, g) => {
        const { repliee, depliee } = geste.current.h;
        visible.setValue(Math.min(depliee, Math.max(repliee, geste.current.depart - g.dy)));
      },
      onPanResponderRelease: (_, g) => {
        geste.current.aller(positionLachee(geste.current.depart - g.dy, g.vy * 1000, geste.current.h));
      },
      onPanResponderTerminate: () => geste.current.aller(geste.current.position),
    }),
  );

  if (!possibilite || !etape || !recherche) return <Redirect href="/resultat" />;

  const suivante = possibilite.etapes[rang + 1];
  const entete = enteteEtape(etape);
  const marche = etape.mode === "marche";
  const couleur = marche ? couleurs.primaire : couleurs[jetonMode(etape.mode)];
  const choisir = (i: number, point: Point) => {
    setChoisi({ i, point });
    if (position === "depliee") allerA("milieu");
  };
  const fermer = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/resultat");
  };
  const guider = () => router.push({ pathname: "/guidage", params: { i: String(params.i ?? 0), e: String(rang) } });
  const translation = Animated.subtract(h.depliee, visible);
  const boutonsY = Animated.multiply(visible, -1);

  return (
    <View className="flex-1 bg-surface">
      <CarteEtape
        possibilite={possibilite}
        rang={rang}
        choisi={choisi?.point ?? null}
        // Déplié, la bande de carte est trop basse pour cadrer l'étape : on garde le cadrage de la mi-hauteur.
        margeBas={h[position === "depliee" ? "milieu" : position]}
        margeHaut={insets.top + 56}
        recentrer={recentrer}
      />
      <View className="absolute left-4" style={{ top: insets.top + 12 }}>
        <BoutonRond icone="arrow_back" libelle="Retour au trajet" onPress={fermer} />
      </View>
      {/* Boutons ronds posés sur le bord haut du panneau, qui le suivent (D86). */}
      <Animated.View
        className="absolute bottom-0 left-4 right-4 flex-row items-end gap-3"
        style={{ transform: [{ translateY: boutonsY }], paddingBottom: 16 }}
        pointerEvents="box-none"
      >
        <View className="flex-1 items-start" pointerEvents="box-none">
          {CARTE ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => Linking.openURL("https://www.openstreetmap.org/copyright")}
              className="rounded-champ bg-fond/80 px-2 py-0.5"
            >
              <Text className="font-inter text-xs text-texte-secondaire">© OpenMapTiles © OpenStreetMap</Text>
            </Pressable>
          ) : null}
        </View>
        <BoutonRond
          icone="center_focus_strong"
          libelle="Recentrer la carte sur l'étape"
          onPress={() => {
            setChoisi(null);
            setRecentrer((n) => n + 1);
          }}
        />
        <BoutonRond icone="navigation" libelle="Me guider à partir de cette étape" onPress={guider} plein />
      </Animated.View>

      <Animated.View
        className="absolute bottom-0 left-0 right-0 rounded-t-carte bg-fond"
        style={{ height: h.depliee, transform: [{ translateY: translation }], boxShadow: ombreFlottante }}
      >
        <View {...glisser.panHandlers} onLayout={(e) => setHauteurEntete(e.nativeEvent.layout.height)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Poignée du panneau"
            accessibilityHint="Change la taille du panneau"
            onPress={() => allerA(positionSuivante(position))}
            className="h-8 items-center justify-center"
          >
            <View className="h-1.5 w-12 rounded-full" style={{ backgroundColor: couleurs["bordure-champ"] }} />
          </Pressable>
          <View className="flex-row items-center gap-3 px-5 pb-4">
            <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: couleur }}>
              <SymbolView name={{ android: iconeMode(etape.mode), web: iconeMode(etape.mode) }} size={24} tintColor={couleurs.fond} />
            </View>
            <View className="flex-1">
              <Text className="font-inter-bold text-titre-carte text-texte">
                {entete.titre}
                {entete.direction ? <Text className="font-inter text-secondaire text-texte-secondaire">{` ${entete.direction}`}</Text> : null}
              </Text>
              <Text className="font-inter text-secondaire text-texte-secondaire" style={{ fontVariant: ["tabular-nums"] }}>
                {entete.horaire}
              </Text>
            </View>
            {position !== "repliee" ? (
              <BoutonPanneau icone="expand_more" libelle="Agrandir la carte" onPress={() => allerA("repliee")} />
            ) : null}
            {position !== "depliee" ? (
              <BoutonPanneau icone="expand_less" libelle="Déplier les étapes" onPress={() => allerA("depliee")} />
            ) : null}
          </View>
          <View className="h-px bg-bordure-carte" />
        </View>
        <ScrollView
          className="flex-1"
          // Replié, seul l'en-tête se voit : la liste ne dépasse pas sous la barre de navigation.
          style={{ opacity: position === "repliee" ? 0 : 1 }}
          pointerEvents={position === "repliee" ? "none" : "auto"}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: h.depliee - h[position] + insets.bottom + 24 }}
        >
          {marche ? (
            <ListeMarche etape={etape} suivante={suivante} choisi={choisi?.i ?? null} choisir={choisir} />
          ) : (
            <ListeVehicule etape={etape} choisi={choisi?.i ?? null} choisir={choisir} />
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
