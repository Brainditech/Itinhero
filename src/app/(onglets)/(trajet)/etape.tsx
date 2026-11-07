import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Linking, PanResponder, Pressable, ScrollView, Text, useWindowDimensions, View, type ScrollViewInstance } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { AndroidSymbol } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Boussole } from "@/composants/Boussole";
import { CarteEtape } from "@/composants/CarteEtape";
import { CARTE } from "@/composants/carte-module";
import { Fleche } from "@/composants/Fleches";
import { iconeMode } from "@/composants/icones-mode";
import { messageEchec, type Etape, type Point } from "@/domaine/api";
import { Numero, NumerosPres } from "@/composants/AFaire";
import { destinationMarche, distanceConsigne, phraseConsigne } from "@/domaine/consignes";
import {
  arretsDeLaCourse,
  arretsDuTrajet,
  type ArretDeLaCourse,
  enteteEtape,
  hauteursPanneau,
  positionLachee,
  positionSuivante,
  type PositionPanneau,
} from "@/domaine/etape";
import { jusqua, phraseMarche, phraseTrajetVehicule, vehiculeMinuscule } from "@/domaine/guidage";
import {
  estMarcheLongue,
  formaterDuree,
  jetonMode,
  phraseReservation,
  phraseTaxi,
  possibiliteDe,
  trajetDuParametre,
  vientVousChercher,
} from "@/domaine/resultat";
import { Lien } from "@/composants/elements";
import { lienUber } from "@/domaine/uber";
import { texteBillet } from "@/domaine/prix";
import { useCartes } from "@/cartes";
import { useRecherche } from "@/recherche";
import { useClient } from "@/session";
import { couleurs, ombreFlottante } from "@/theme/jetons";

/**
 * Fenêtre d'une étape (spec 17) : la carte en fond, l'étape en bas dans un panneau à trois positions
 * (replié, à mi-hauteur, déplié ; D85), et un bouton rond en bas à droite pour lancer le guidage (D86).
 * Elle n'affiche que la réponse déjà reçue : ni position, ni appel au serveur (§7) ; la boussole lit seulement
 * l'orientation du téléphone (D88).
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

/** Consignes d'une marche (spec 11) : toucher une consigne centre la carte sur son point. */
function ListeMarche({ etape, suivante, choisi, choisir }: { etape: Etape; suivante?: Etape; choisi: number | null; choisir: (i: number, p: Point) => void }) {
  const consignes = etape.consignes ?? [];
  const destination = destinationMarche(etape, suivante);
  // Issue 0029 : l'avertissement de la marche longue vit ici, en tête de la liste d'une marche.
  const taxi = estMarcheLongue(etape) ? <TaxiPourLaMarche etape={etape} /> : null;
  if (consignes.length < 2) {
    return (
      <View className="gap-4">
        {taxi}
        <Text className="font-inter text-secondaire text-texte-secondaire">{phraseMarche(etape, suivante)}</Text>
      </View>
    );
  }
  return (
    <View>
      {taxi ? <View className="pb-4">{taxi}</View> : null}
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

/** État des arrêts de toute la course (D87) : demandés au serveur seulement quand on touche « Voir tous les arrêts ». */
export type EtatCourse =
  | { etat: "repos" }
  | { etat: "chargement" }
  | { etat: "ok"; arrets: ArretDeLaCourse[] }
  | { etat: "echec"; message: string };

/**
 * Frise des arrêts (spec 17, §4.2) : ceux du trajet, de la montée à la descente, avec leur heure ;
 * « Voir tous les arrêts du TER P5 » ajoute en gris ceux d'avant la montée et d'après la descente (D87).
 */
function ListeVehicule({
  etape,
  choisi,
  choisir,
  course,
  voirCourse,
  masquerCourse,
  reperer,
  trajet,
}: {
  etape: Etape;
  /** Aller ou retour (spec 19) : une réduction « aller seulement » ne vaut pas au retour. */
  trajet: "aller" | "retour";
  choisi: number | null;
  choisir: (i: number, p: Point) => void;
  course: EtatCourse;
  voirCourse: () => void;
  masquerCourse: () => void;
  /** Position de la ligne de montée dans la liste, pour y faire défiler quand toute la course s'affiche. */
  reperer: (y: number) => void;
}) {
  const couleur = couleurs[jetonMode(etape.mode)];
  const gris = couleurs["bordure-carte"];
  const duTrajet = arretsDuTrajet(etape);
  const arrets: ArretDeLaCourse[] = course.etat === "ok" ? course.arrets : duTrajet;
  const reservation = phraseReservation(etape) ?? phraseTaxi(etape);
  const uber = lienUber(etape);
  const taxi = vientVousChercher(etape);
  const { cartes } = useCartes();
  const billet = texteBillet(etape, cartes, trajet);
  const descente = duTrajet.find((a) => a.role === "descente");
  const m = arrets.findIndex((a) => a.role === "montee");
  const d = arrets.findIndex((a) => a.role === "descente");
  return (
    <View className="gap-3">
      {taxi ? (
        <Text className="font-inter text-secondaire text-texte">{phraseTrajetVehicule(etape, formaterDuree(etape.duree_minutes))}</Text>
      ) : (
        <View>
          {arrets.map((a, i) => {
            const bout = a.role === "montee" || a.role === "descente";
            const dehors = a.role === "avant" || a.role === "apres";
            // Trait du haut et du bas : en couleur entre la montée et la descente, en gris ailleurs sur la course.
            const haut = i === 0 ? "transparent" : i > m && i <= d ? couleur : gris;
            const bas = i === arrets.length - 1 ? "transparent" : i >= m && i < d ? couleur : gris;
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`${a.heure ?? ""} ${a.nom}${a.role === "montee" ? ", montée" : a.role === "descente" ? ", descente" : ""}`}
                accessibilityHint="Centre la carte sur cet arrêt"
                onPress={() => choisir(i, a)}
                onLayout={a.role === "montee" ? (e) => reperer(e.nativeEvent.layout.y) : undefined}
                className={`min-h-12 flex-row items-stretch gap-3 rounded-champ px-2 ${i === choisi ? "bg-primaire-doux" : ""}`}
              >
                <Text
                  className={`w-14 py-3 ${bout ? "font-inter-semibold text-secondaire text-texte" : "font-inter text-badge text-texte-secondaire"}`}
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {a.heure ?? ""}
                </Text>
                <View className="w-5 items-center">
                  <View className="w-1 flex-1" style={{ backgroundColor: haut }} />
                  <View
                    style={{
                      width: bout ? 18 : 12,
                      height: bout ? 18 : 12,
                      borderRadius: 9,
                      backgroundColor: couleurs.fond,
                      borderWidth: bout ? 4 : 3,
                      borderColor: dehors ? gris : couleur,
                    }}
                  />
                  <View className="w-1 flex-1" style={{ backgroundColor: bas }} />
                </View>
                <Text
                  className={`flex-1 py-3 ${bout ? "font-inter-semibold text-secondaire text-texte" : `font-inter text-badge ${dehors ? "text-texte-secondaire" : "text-texte"}`}`}
                >
                  {a.nom}
                </Text>
              </Pressable>
            );
          })}
          {course.etat !== "ok" && duTrajet.length === 2 && descente ? (
            <Text className="mt-1 font-inter text-badge text-texte-secondaire">{`Sans arrêt j${jusqua(descente.nom).slice(1)}`}</Text>
          ) : null}
          {etape.course ? (
            <Pressable
              accessibilityRole="button"
              onPress={course.etat === "ok" ? masquerCourse : voirCourse}
              disabled={course.etat === "chargement"}
              hitSlop={8}
              className="mt-2 min-h-12 flex-row items-center gap-2 self-start"
            >
              <SymbolView
                name={{ android: course.etat === "ok" ? "unfold_less" : "unfold_more", web: course.etat === "ok" ? "unfold_less" : "unfold_more" }}
                size={20}
                tintColor={couleurs.primaire}
              />
              <Text className="font-inter-semibold text-secondaire text-primaire">
                {course.etat === "chargement"
                  ? "Recherche des arrêts…"
                  : course.etat === "ok"
                    ? "Montrer seulement mon trajet"
                    : `Voir tous les arrêts du ${vehiculeMinuscule(etape)}`}
              </Text>
            </Pressable>
          ) : null}
          {course.etat === "echec" ? <Text className="font-inter text-badge text-erreur">{course.message}</Text> : null}
        </View>
      )}
      {etape.exploitant ? <Text className="font-inter text-badge text-texte-secondaire">{etape.exploitant}</Text> : null}
      {/* Critère de fin de v1 : le tarif validé avec sa source (réseau, site, date du relevé), invariant 5. */}
      {billet ? (
        <View className="flex-row gap-2">
          <SymbolView name={{ android: "euro", web: "euro" }} size={18} tintColor={couleurs["texte-secondaire"]} />
          <View className="flex-1 gap-0.5">
            <Text className="font-inter-semibold text-badge text-texte">{billet.billet}</Text>
            {billet.source ? <Text className="font-inter text-badge text-texte-secondaire">{billet.source}</Text> : null}
          </View>
        </View>
      ) : null}
      {reservation ? (
        <View className="flex-row items-center gap-2">
          <SymbolView name={{ android: "call", web: "call" }} size={18} tintColor={couleurs.avertissement} />
          <Text className="flex-1 font-inter-semibold text-badge" style={{ color: couleurs.avertissement }}>
            {reservation}
          </Text>
        </View>
      ) : null}
      {/* Spec 41 (D122) : le numéro à appeler, toujours avec sa source (invariant 16). */}
      {etape.mode === "taxi" || etape.reservation === "appel" ? <Numero contact={etape.contact} /> : null}
      {/* Spec 31 (D109) : Uber ouvert avec la prise en charge et la dépose de l'étape ; prix et attente chez Uber. */}
      {uber ? (
        <View className="items-start">
          <Lien libelle="Commander un Uber pour cette étape" onPress={() => void Linking.openURL(uber).catch(() => undefined)} />
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
  const params = useLocalSearchParams<{ i?: string; e?: string; t?: string }>();
  const { recherche } = useRecherche();
  // Figée à l'ouverture, comme le guidage : une nouvelle réponse ne change pas la fenêtre ouverte.
  // `t=retour` : une étape du retour planifié (spec 19).
  const [possibilite] = useState(() => possibiliteDe(recherche?.reponse, trajetDuParametre(params.t), Number(params.i ?? 0)));
  const rang = Number(params.e ?? 0);
  const etape = possibilite?.etapes[rang];

  const [hauteurEntete, setHauteurEntete] = useState(140);
  const h = useMemo(() => hauteursPanneau(hauteurEcran, hauteurEntete + insets.bottom), [hauteurEcran, hauteurEntete, insets.bottom]);
  const [position, setPosition] = useState<PositionPanneau>("milieu");
  const [choisi, setChoisi] = useState<{ i: number; point: Point } | null>(null);
  const client = useClient();
  const [course, setCourse] = useState<EtatCourse>({ etat: "repos" });
  const defilement = useRef<ScrollViewInstance>(null);
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
  // Tous les arrêts de la course (D87), demandés au serveur à la demande seulement.
  const voirCourse = async () => {
    if (!etape.course) return;
    setCourse({ etat: "chargement" });
    const r = await client.course(etape.course);
    if (r.etat !== "ok") {
      const message = r.etat === "cle_refusee" ? "La clé de l'appareil est refusée." : messageEchec(r);
      setCourse({ etat: "echec", message: `Arrêts indisponibles. ${message}` });
      return;
    }
    const arrets = arretsDeLaCourse(etape, r.donnees);
    setChoisi(null);
    setCourse(arrets ? { etat: "ok", arrets } : { etat: "echec", message: "Les arrêts de cette course ne correspondent pas au trajet." });
  };
  const masquerCourse = () => {
    setChoisi(null);
    setCourse({ etat: "repos" });
  };
  const guider = () => router.push({ pathname: "/guidage", params: { i: String(params.i ?? 0), e: String(rang), t: trajetDuParametre(params.t) } });
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
        course={course.etat === "ok" ? course.arrets : null}
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
        <Boussole
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
            // Sans les deux chevrons (on glisse le panneau), TalkBack garde ces deux gestes (D85).
            accessibilityActions={[
              { name: "repliee", label: "Agrandir la carte" },
              { name: "depliee", label: "Déplier les étapes" },
            ]}
            onAccessibilityAction={(e) => allerA(e.nativeEvent.actionName as PositionPanneau)}
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
          </View>
          <View className="h-px bg-bordure-carte" />
        </View>
        <ScrollView
          ref={defilement}
          className="flex-1"
          // Replié, seul l'en-tête se voit : la liste ne dépasse pas sous la barre de navigation.
          style={{ opacity: position === "repliee" ? 0 : 1 }}
          pointerEvents={position === "repliee" ? "none" : "auto"}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: h.depliee - h[position] + insets.bottom + 24 }}
        >
          {marche ? (
            <ListeMarche etape={etape} suivante={suivante} choisi={choisi?.i ?? null} choisir={choisir} />
          ) : (
            <ListeVehicule
              etape={etape}
              trajet={trajetDuParametre(params.t)}
              choisi={choisi?.i ?? null}
              choisir={choisir}
              course={course}
              voirCourse={voirCourse}
              masquerCourse={masquerCourse}
              reperer={(y) => {
                // Toute la course : la liste s'ouvre sur l'arrêt d'avant la montée, pas sur le premier de la ligne.
                if (course.etat === "ok") defilement.current?.scrollTo({ y: Math.max(0, y - 40), animated: true });
              }}
            />
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

/**
 * Spec 41 (D122, D3) : une marche de plus de 15 min peut se faire en taxi. Les numéros près du départ viennent de
 * `POST /v1/numeros` (fiches validées ou pages publiques vérifiées) ; sans réseau, l'Uber reste proposé.
 */
function TaxiPourLaMarche({ etape }: { etape: Etape }) {
  const uber = lienUber(etape);
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <SymbolView name={{ android: "warning", web: "warning" }} size={18} tintColor={couleurs.avertissement} />
        <Text className="flex-1 font-inter-semibold text-badge" style={{ color: couleurs.avertissement }}>
          {`Marche de ${formaterDuree(etape.duree_minutes)} : un taxi peut faire cette étape.`}
        </Text>
      </View>
      {uber ? (
        <View className="items-start">
          <Lien libelle="Commander un Uber pour cette étape" onPress={() => void Linking.openURL(uber).catch(() => undefined)} />
        </View>
      ) : null}
      <NumerosPres point={{ lat: etape.de.lat, lon: etape.de.lon }} />
    </View>
  );
}
