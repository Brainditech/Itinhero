import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Linking, Pressable, Text, useWindowDimensions, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import { useKeepAwake } from "expo-keep-awake";
import { SymbolView } from "expo-symbols";
import type { AndroidSymbol } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CarteGuidage } from "@/composants/CarteGuidage";
import { CARTE } from "@/composants/carte-module";
import { symboleManoeuvre } from "@/composants/Fleches";
import { iconeMode } from "@/composants/icones-mode";
import type { Point } from "@/domaine/api";
import { phraseConsigne } from "@/domaine/consignes";
import {
  descendu,
  ETAT_INITIAL,
  instantDuTrajet,
  jusqua,
  aLieu,
  lieuMontee,
  minutesEnTexte,
  phraseStatut,
  positionFraiche,
  positionSimulee,
  PRECISION_MAX_METRES,
  preparer,
  SEUILS_ANNONCE,
  situer,
  textesVehicule,
  titreDescente,
  vehiculeCourt,
  vehiculeMinuscule,
  type EtatGuidage,
  type Releve,
  type Situation,
  type Statut,
} from "@/domaine/guidage";
import { formaterDistance, jetonMode, nomLieuEtape } from "@/domaine/resultat";
import { useDeroulerRecherche, useRecherche } from "@/recherche";
import { couleurs, ombreFlottante } from "@/theme/jetons";
import { dire, taire, vibrer } from "@/voix";

/**
 * Guidage en direct (spec 12, maquettes `design/guidage/01` à `05`) : la carte suit la position,
 * le bandeau du haut dit la prochaine manœuvre, le bas dit l'arrivée et l'avance sur l'horaire prévu.
 * Position au premier plan seulement, écran allumé (D73) ; voix d'Android (D74) ; écart au chemin (D75).
 * La position ne quitte jamais le téléphone, sauf pour « Recalculer depuis ici » (§7).
 */

// Paramètre `sim` (développement seulement) : « étape,mètres,écart,HH:MM » ⇒ position et heure simulées,
// pour les captures de chaque état (§6, critère 4) sans marcher.
type Simulation = { etape: number; metres: number; ecart: number; heure: string };


function lireSimulation(brut: string | undefined): Simulation | null {
  if (!__DEV__ || !brut) return null;
  const [etape, metres, ecart, heure] = brut.split(",");
  if (!heure || !/^\d\d:\d\d$/.test(heure)) return null;
  return { etape: Number(etape), metres: Number(metres), ecart: Number(ecart), heure };
}

/**
 * Position lue au premier plan, toutes les secondes, même immobile (D73) : rangée dans `ref`, jamais gardée.
 * Sans `distanceInterval`, Android envoie un relevé chaque seconde même à l'arrêt : un relevé qui vieillit
 * veut donc dire que le signal est perdu.
 */
function useSuiviPosition(active: boolean, ref: { current: Releve | null }) {
  useEffect(() => {
    if (!active) return;
    let abonnement: Location.LocationSubscription | null = null;
    let fini = false;
    (async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted || fini) return;
      abonnement = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
        (l) => {
          if (l.coords.accuracy !== null && l.coords.accuracy > PRECISION_MAX_METRES) return;
          ref.current = { point: { lat: l.coords.latitude, lon: l.coords.longitude }, recuA: Date.now() };
        },
      );
      if (fini) abonnement.remove();
    })().catch(() => {
      ref.current = null;
    });
    return () => {
      fini = true;
      abonnement?.remove();
      ref.current = null;
    };
  }, [active, ref]);
}

/** Marge entre le point suivi et le bandeau ou la carte du bas (dp). */
const AIR = 56;
/** Sans position depuis 10 s (permission refusée, pas de signal en gare) : « Étape suivante » apparaît. */
const SANS_POSITION_MS = 10_000;

export default function Guidage() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ i?: string; sim?: string }>();
  const { recherche } = useRecherche();
  const { recalculer: rechercherDepuisIci } = useDeroulerRecherche();
  // Le trajet guidé est figé à l'ouverture : la réponse d'un recalcul ne le remplace pas pendant que l'écran se ferme.
  const [possibilite] = useState(() => recherche?.reponse?.possibilites[Number(params.i ?? 0)]);
  const parcours = useMemo(() => (possibilite ? preparer(possibilite) : null), [possibilite]);
  const sim = __DEV__ ? (params.sim ?? null) : null;

  const [situation, setSituation] = useState<Situation | null>(null);
  const [position, setPosition] = useState<Point | null>(null);
  const [voix, setVoix] = useState(true);
  const [nordEnHaut, setNordEnHaut] = useState(false);
  const [recalcul, setRecalcul] = useState<string | null>(null);
  const [positionPerdue, setPositionPerdue] = useState(false);
  // Bas du bandeau et haut de la carte du bas, mesurés : la carte cadre la position entre les deux.
  const [bandeauBas, setBandeauBas] = useState(insets.top + 220);
  const [carteHaut, setCarteHaut] = useState<number | null>(null);
  const hauteur = useWindowDimensions().height;
  const positionRef = useRef<Releve | null>(null);
  const voixRef = useRef(true);
  const etatRef = useRef<EtatGuidage>(ETAT_INITIAL);
  const pasRef = useRef<() => void>(() => {});
  const enRecalculRef = useRef(false);
  useSuiviPosition(sim === null, positionRef);

  // Moteur du guidage : à chaque seconde, la position et l'heure donnent la situation ;
  // les annonces se disent et la vibration part ici, une seule fois chacune.
  useEffect(() => {
    if (!parcours || !possibilite) return;
    const simulation = lireSimulation(sim ?? undefined);
    const debut = Date.now();
    etatRef.current = { ...ETAT_INITIAL, etape: simulation?.etape ?? 0 };
    let sansPositionDepuis: number | null = null;
    const pas = () => {
      const maintenant = simulation ? instantDuTrajet(possibilite, simulation.heure) + (Date.now() - debut) : Date.now();
      const ici = simulation
        ? positionSimulee(parcours, simulation.etape, simulation.metres, simulation.ecart)
        : positionFraiche(positionRef.current, Date.now());
      const s = situer(parcours, etatRef.current, ici, maintenant);
      etatRef.current = s.etat;      // Toutes les phrases du même instant, dans l'ordre, en une seule annonce : aucune n'est coupée par la suivante.
      if (voixRef.current && s.annonces.length > 0) dire(s.annonces.join(". "));
      if (s.vibrer) vibrer();
      if (ici) sansPositionDepuis = null;
      else sansPositionDepuis ??= Date.now();
      setPositionPerdue(sansPositionDepuis !== null && Date.now() - sansPositionDepuis >= SANS_POSITION_MS);
      setPosition(ici);
      setSituation(s);
    };
    pasRef.current = pas;
    const premier = setTimeout(pas, 0);
    const id = setInterval(pas, 1000);
    return () => {
      clearTimeout(premier);
      clearInterval(id);
    };
  }, [parcours, possibilite, sim]);
  useEffect(() => () => taire(), []);

  if (!possibilite || !parcours || !recherche) return <Redirect href="/resultat" />;
  if (!situation) return <View className="flex-1 bg-surface" />;

  const arreter = () => {
    taire();
    router.back();
  };
  const recalculer = async () => {
    if (enRecalculRef.current) return;
    enRecalculRef.current = true;
    setRecalcul("Recherche en cours…");
    // Même rendez-vous, même marge, depuis la position (spec 12 §7) ; en « partir à », à partir de maintenant.
    // Réussi, le guidage se ferme et le Résultat montre la nouvelle réponse : un seul guidage à la fois.
    const echec = await rechercherDepuisIci(recherche);
    enRecalculRef.current = false;
    setRecalcul(echec ? echec.message : null);
  };

  return (
    <View className="flex-1 bg-surface">
      <CarteGuidage
        parcours={parcours}
        situation={situation}
        position={position}
        nordEnHaut={nordEnHaut}
        marges={{ haut: bandeauBas + AIR, bas: (carteHaut === null ? 420 : hauteur - carteHaut) + AIR }}
      />
      <View className="absolute left-4 right-4 gap-3" style={{ top: insets.top + 12 }}>
        <View onLayout={(e) => setBandeauBas(insets.top + 12 + e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
          <Bandeau situation={situation} />
        </View>
        <View className="flex-row items-start justify-end">
          <BoutonBoussole nordEnHaut={nordEnHaut} cap={situation.cap ?? 0} onPress={() => setNordEnHaut((n) => !n)} />
        </View>
      </View>
      <View
        className="absolute left-4 right-4 items-end gap-2"
        style={{ bottom: insets.bottom + 16 }}
        onLayout={(e) => setCarteHaut(e.nativeEvent.layout.y + 40)}
      >
        {CARTE ? <AttributionGuidage /> : null}
        <CarteBas
          situation={situation}
          arrivee={possibilite.arrivee}
          voix={voix}
          onVoix={() => {
            if (voix) taire();
            voixRef.current = !voix;
            setVoix(!voix);
          }}
          onArreter={arreter}
          onDescendu={() => {
            // Un double appui ne saute qu'une étape : seule l'étape affichée peut être passée.
            if (etatRef.current.etape !== situation.etat.etape) return;
            etatRef.current = descendu(etatRef.current);
            pasRef.current();
          }}
          onRecalculer={recalculer}
          recalcul={recalcul}
          positionPerdue={positionPerdue}
        />
      </View>
    </View>
  );
}

// ——— Bandeau du haut ———

function couleurBandeau(s: Situation): string {
  if (s.ecart) return couleurs.avertissement;
  const g = s.courante;
  if (!g || g.etape.mode === "marche") return couleurs.primaire;
  return couleurs[jetonMode(g.etape.mode)];
}

type ContenuBandeau = { icone: AndroidSymbol; titre: string; sousTitre: string | null; bande: { icone: AndroidSymbol; texte: string } | null };

function contenuBandeau(s: Situation): ContenuBandeau {
  const v = s.vue;
  const g = s.courante;
  if (s.ecart) {
    // Coupure à la place de la maquette 05 : « Vous vous éloignez / du chemin ».
    return { icone: "warning", titre: "Vous vous éloignez\ndu chemin", sousTitre: `Le chemin est à ${formaterDistance(s.ecart.metres)}`, bande: null };
  }
  if (v.type === "fin" || !g) return { icone: "flag", titre: "Vous êtes arrivé", sousTitre: null, bande: null };
  const e = g.etape;
  if (v.type === "marche") {
    const p = v.prochaine.consigne;
    // Au point de manœuvre (ou au départ, sans position), « Dans 0 m » ne veut rien dire : « Maintenant ».
    const titre =
      p.manoeuvre === "arrivee" && v.distance < 15
        ? "Vous y êtes"
        : v.distance <= SEUILS_ANNONCE[2]
          ? "Maintenant"
          : `Dans ${formaterDistance(v.distance)}`;
    return {
      icone: symboleManoeuvre(p.manoeuvre),
      titre,
      sousTitre: phraseConsigne(p, v.destination),
      bande: v.suivante
        ? { icone: symboleManoeuvre(v.suivante.consigne.manoeuvre), texte: `Puis ${minuscule(phraseConsigne(v.suivante.consigne, v.destination))}` }
        : null,
    };
  }
  const icone = iconeMode(e.mode);
  if (v.type === "attente") {
    const direction = e.direction ? ` direction ${e.direction}` : "";
    if (v.rate) {
      // Taxi et transport à la demande viennent vous chercher : ils sont en retard, pas « passés ».
      const vientVousChercher = e.mode === "taxi" || e.mode === "transport_a_la_demande";
      return {
        icone,
        titre: `${vehiculeCourt(e)} prévu à ${e.depart}`,
        sousTitre: vientVousChercher ? `Le ${vehiculeMinuscule(e)} n'est pas encore là ?` : `Le ${vehiculeMinuscule(e)} est peut-être passé`,
        bande: { icone: "refresh", texte: vientVousChercher ? "Sinon, recalculez depuis ici" : "Recalculez pour trouver le suivant" },
      };
    }
    return {
      icone,
      titre: v.minutes > 0 ? `${vehiculeCourt(e)} dans ${minutesEnTexte(v.minutes)}` : `${vehiculeCourt(e)} à ${e.depart}`,
      sousTitre: `Attendez le ${vehiculeMinuscule(e)}${direction}`,
      bande:
        e.reservation === "appel"
          ? { icone: "call", texte: `Sur réservation : vous avez réservé ? Passage à ${e.depart}` }
          : { icone: "schedule", texte: `Passage prévu à ${e.depart}` },
    };
  }
  if (v.type === "vehicule") {
    const t = textesVehicule(e, v.restants);
    return { icone, titre: t.titre, sousTitre: t.sousTitre, bande: { icone: "schedule", texte: t.bande } };
  }
  return { icone: "flag", titre: titreDescente(e), sousTitre: `${v.descente.nom} · ${e.arrivee}`, bande: null };
}

const minuscule = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

function Bandeau({ situation }: { situation: Situation }) {
  const c = contenuBandeau(situation);
  const fond = couleurBandeau(situation);
  const descente = situation.vue.type === "descente" && !situation.ecart;
  // « Dans 120 m », « Bus dans 6 min » en très grand ; les phrases plus longues un cran en dessous.
  const grandTitre = !situation.ecart && situation.vue.type !== "vehicule";
  return (
    <View
      accessibilityRole="header"
      accessibilityLiveRegion="polite"
      className="overflow-hidden rounded-bouton"
      style={{ backgroundColor: fond, boxShadow: ombreFlottante, borderWidth: descente ? 2 : 0, borderColor: couleurs.fond }}
    >
      <View className="flex-row items-center gap-3 py-4 pl-3 pr-4">
        <View className={`${grandTitre ? "w-16" : "w-14"} items-center`}>
          <SymbolView name={{ android: c.icone, web: c.icone }} size={grandTitre ? 64 : 52} tintColor={couleurs.fond} />
        </View>
        <View className="flex-1">
          <Text className="font-inter-bold text-fond" style={grandTitre ? { fontSize: 34, lineHeight: 40 } : situation.ecart ? { fontSize: 28, lineHeight: 34 } : { fontSize: 24, lineHeight: 30 }}>
            {c.titre}
          </Text>
          {c.sousTitre ? <Text className="font-inter-semibold text-corps text-fond">{c.sousTitre}</Text> : null}
        </View>
      </View>
      {c.bande ? (
        <View className="flex-row items-center gap-3 px-4 py-2.5" style={{ backgroundColor: "rgba(20, 22, 31, 0.22)" }}>
          <SymbolView name={{ android: c.bande.icone, web: c.bande.icone }} size={22} tintColor={couleurs.fond} />
          <Text className="flex-1 font-inter-medium text-secondaire text-fond">{c.bande.texte}</Text>
        </View>
      ) : null}
    </View>
  );
}

function BoutonBoussole({ nordEnHaut, cap, onPress }: { nordEnHaut: boolean; cap: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={nordEnHaut ? "Tourner la carte dans le sens de la marche" : "Mettre le nord en haut"}
      onPress={onPress}
      className="h-12 w-12 items-center justify-center rounded-full bg-fond active:bg-primaire-doux"
      style={{ boxShadow: ombreFlottante }}
    >
      <View style={{ transform: [{ rotate: `${nordEnHaut ? 0 : -cap}deg` }], alignItems: "center" }}>
        <View style={{ width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 13, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: couleurs.erreur }} />
        <View style={{ width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 13, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: couleurs["texte-secondaire"] }} />
      </View>
    </Pressable>
  );
}

function AttributionGuidage() {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Crédits de la carte : OpenMapTiles, OpenStreetMap"
      onPress={() => Linking.openURL("https://www.openstreetmap.org/copyright")}
      className="rounded-champ bg-fond/80 px-2 py-0.5"
    >
      <Text className="font-inter text-xs text-texte-secondaire">© OpenMapTiles © OpenStreetMap</Text>
    </Pressable>
  );
}

// ——— Carte du bas ———

function Pastille({ couleur, fond, icone, texte, pleine = false }: { couleur: string; fond: string; icone: AndroidSymbol; texte: string; pleine?: boolean }) {
  // `pleine` : texte de deux lignes (« Position introuvable : … »), sur toute la largeur de la carte ; sans elle,
  // Android mesure le texte à la largeur de la carte sans compter l'icône, et la pastille déborde.
  return (
    <View
      className={`flex-row items-center gap-2 px-3 ${pleine ? "self-stretch rounded-bouton py-2" : "self-start rounded-full py-1"}`}
      style={{ backgroundColor: fond }}
    >
      <SymbolView name={{ android: icone, web: icone }} size={20} tintColor={couleur} />
      <Text className={`${pleine ? "flex-1 " : ""}font-inter-semibold text-secondaire`} style={{ color: couleur }}>
        {texte}
      </Text>
    </View>
  );
}

function PastilleStatut({ statut }: { statut: Statut }) {
  if (statut.type === "a_venir") {
    return <Pastille couleur={couleurs["prevu-texte"]} fond={couleurs["prevu-teinte"]} icone="event" texte={phraseStatut(statut)} />;
  }
  const bien = statut.type === "avance" || statut.type === "a_l_heure";
  return (
    <Pastille
      couleur={couleurs.fond}
      fond={bien ? couleurs.possible : couleurs.avertissement}
      icone={bien ? "check" : statut.type === "presse" ? "directions_run" : "schedule"}
      texte={phraseStatut(statut)}
    />
  );
}

function PastillePrevu() {
  return <Pastille couleur={couleurs["prevu-texte"]} fond={couleurs["prevu-teinte"]} icone="schedule" texte="Horaire prévu, sans suivi en direct" />;
}

function Ligne({ icone, couleur, children }: { icone: AndroidSymbol; couleur: string; children: ReactNode }) {
  return (
    <View className="flex-row items-center gap-3 py-1">
      <SymbolView name={{ android: icone, web: icone }} size={24} tintColor={couleur} />
      <Text className="flex-1 font-inter-medium text-secondaire text-texte-secondaire">{children}</Text>
    </View>
  );
}

/** Arrêts restants dans le véhicule (maquette 03) : trois au plus, la descente au drapeau. */
function ArretsRestants({ situation, couleur }: { situation: Situation; couleur: string }) {
  if (situation.vue.type !== "vehicule") return null;
  const restants = situation.vue.restants;
  const montres = restants.length > 3 ? [...restants.slice(0, 2), restants[restants.length - 1]!] : restants;
  return (
    <View>
      {montres.map((a, i) => {
        const dernier = a.descente;
        return (
          <View key={`${a.nom}-${i}`} className="min-h-10 flex-row items-center gap-3">
            <View className="w-6 items-center self-stretch">
              {i > 0 ? <View style={{ position: "absolute", top: 0, height: "50%", width: 3, backgroundColor: couleur }} /> : null}
              {!dernier ? <View style={{ position: "absolute", top: "50%", bottom: 0, width: 3, backgroundColor: couleur }} /> : null}
              <View className="flex-1 justify-center">
                {dernier ? (
                  <SymbolView name={{ android: "flag", web: "flag" }} size={24} tintColor={couleur} />
                ) : (
                  <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: couleur, backgroundColor: i === 0 ? couleur : couleurs.fond }} />
                )}
              </View>
            </View>
            <Text className={`flex-1 text-secondaire ${dernier ? "font-inter-bold text-texte" : "font-inter-medium text-texte-secondaire"}`}>
              {a.nom}
            </Text>
            <Text className={`text-secondaire ${dernier ? "font-inter-bold text-texte" : "font-inter-medium text-texte-secondaire"}`} style={{ fontVariant: ["tabular-nums"] }}>
              {a.passage ?? "—"}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function CarteBas({
  situation,
  arrivee,
  voix,
  onVoix,
  onArreter,
  onDescendu,
  onRecalculer,
  recalcul,
  positionPerdue,
}: {
  situation: Situation;
  arrivee: string;
  voix: boolean;
  onVoix: () => void;
  onArreter: () => void;
  onDescendu: () => void;
  onRecalculer: () => void;
  recalcul: string | null;
  positionPerdue: boolean;
}) {
  const v = situation.vue;
  const g = situation.courante;
  const e = g?.etape;
  const couleurMode = e && e.mode !== "marche" ? couleurs[jetonMode(e.mode)] : couleurs.primaire;
  const sousTitre =
    v.type === "marche"
      ? `${v.restanteMinutes} min · ${formaterDistance(v.restanteMetres)} à pied`
      : v.type === "fin"
        ? "Bon rendez-vous"
        : `${minutesEnTexte(situation.minutesRestantes)} restantes`;
  const sansPositionLongtemps = v.type === "marche" && v.sansPosition && positionPerdue;
  // Hors du chemin près du bout de la marche (GPS décalé dans un hall de gare) : la personne peut finir l'étape
  // elle-même, par un bouton discret (un détour en route ne doit pas faire sauter la marche d'un appui par erreur).
  const finirHorsChemin = v.type === "marche" && situation.ecart !== null && v.restanteMetres <= 150 && !sansPositionLongtemps;
  const passerALaMain = sansPositionLongtemps;
  const rate = v.type === "attente" && v.rate;
  const boutonPlein = v.type === "descente" || situation.ecart !== null || passerALaMain || rate;

  return (
    <View className="gap-3 self-stretch rounded-carte border border-bordure-carte bg-fond p-5" style={{ boxShadow: ombreFlottante }}>
      <View className="flex-row items-start gap-3">
        <View className="flex-1 gap-1">
          <Text className="font-inter-bold text-texte" style={{ fontSize: 32, lineHeight: 38, fontVariant: ["tabular-nums"] }}>
            {`Arrivée ${arrivee}`}
          </Text>
          <Text className="font-inter-semibold text-texte-secondaire" style={{ fontSize: 20, lineHeight: 26 }}>
            {sousTitre}
          </Text>
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: voix }}
          accessibilityLabel="Voix"
          onPress={onVoix}
          className="h-14 w-14 items-center justify-center rounded-full bg-surface active:bg-primaire-doux"
        >
          <SymbolView name={{ android: voix ? "volume_up" : "volume_off", web: voix ? "volume_up" : "volume_off" }} size={28} tintColor={couleurs.texte} />
        </Pressable>
      </View>

      {v.type === "marche" ? <PastilleStatut statut={v.statut} /> : null}
      {sansPositionLongtemps ? (
        <Pastille pleine couleur={couleurs.fond} fond={couleurs.avertissement} icone="location_off" texte="Position introuvable : passez à l'étape suivante vous-même" />
      ) : null}
      {v.type === "attente" && e && v.aLArret ? <Pastille couleur={couleurs.fond} fond={couleurs.possible} icone="check" texte={lieuMontee(e).ici} /> : null}
      {v.type === "attente" && e && !v.aLArret && v.distanceArret !== null ? (
        <Pastille couleur={couleurs.fond} fond={couleurs.avertissement} icone="directions_walk" texte={lieuMontee(e).loin(formaterDistance(v.distanceArret))} />
      ) : null}
      {v.type === "attente" || v.type === "vehicule" || v.type === "descente" ? <PastillePrevu /> : null}

      <View className="h-px bg-bordure-carte" />

      {v.type === "marche" && e ? (
        <Ligne icone="directions_walk" couleur={couleurs["mode-marche"]}>
          {jusqua(v.destination)}
        </Ligne>
      ) : null}
      {v.type === "attente" && e ? (
        <Ligne icone={iconeMode(e.mode)} couleur={couleurMode}>
          {`Montez dans le ${vehiculeMinuscule(e)} ${aLieu(nomLieuEtape(e.de))}`}
        </Ligne>
      ) : null}
      {v.type === "vehicule" ? <ArretsRestants situation={situation} couleur={couleurMode} /> : null}
      {v.type === "descente" ? (
        <Ligne icone="directions_walk" couleur={couleurs["mode-marche"]}>
          {v.ensuite}
        </Ligne>
      ) : null}
      {v.type === "fin" ? (
        <Ligne icone="flag" couleur={couleurs.primaire}>
          Vous êtes arrivé
        </Ligne>
      ) : null}

      {recalcul ? <Text className="font-inter text-badge text-texte-secondaire">{recalcul}</Text> : null}

      {v.type === "descente" ? <BoutonPlein icone={null} libelle="Je suis descendu" onPress={onDescendu} /> : null}
      {(situation.ecart && v.type === "marche") || rate ? <BoutonPlein icone="refresh" libelle="Recalculer depuis ici" onPress={onRecalculer} /> : null}
      {passerALaMain ? <BoutonPlein icone="skip_next" libelle="Étape suivante" onPress={onDescendu} /> : null}
      {finirHorsChemin ? (
        <Pressable accessibilityRole="button" onPress={onDescendu} className="min-h-12 items-center justify-center">
          <Text className="font-inter-semibold text-primaire" style={{ fontSize: 20 }}>
            Je suis arrivé, étape suivante
          </Text>
        </Pressable>
      ) : null}

      {boutonPlein ? (
        <Pressable accessibilityRole="button" onPress={onArreter} className="min-h-12 items-center justify-center">
          <Text className="font-inter-semibold text-erreur" style={{ fontSize: 20 }}>
            Arrêter le guidage
          </Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={onArreter}
          className="min-h-14 items-center justify-center rounded-bouton bg-fond active:bg-surface"
          style={{ borderWidth: 1.5, borderColor: couleurs["bordure-carte"] }}
        >
          <Text className="font-inter-semibold text-erreur" style={{ fontSize: 20 }}>
            Arrêter le guidage
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function BoutonPlein({ icone, libelle, onPress }: { icone: AndroidSymbol | null; libelle: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="min-h-14 flex-row items-center justify-center gap-3 rounded-bouton bg-primaire active:bg-primaire-presse">
      {icone ? <SymbolView name={{ android: icone, web: icone }} size={26} tintColor={couleurs.fond} /> : null}
      <Text className="font-inter-semibold text-fond" style={{ fontSize: 20 }}>
        {libelle}
      </Text>
    </Pressable>
  );
}
