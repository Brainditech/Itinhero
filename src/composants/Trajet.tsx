import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";
import type { AndroidSymbol } from "expo-symbols";

import type { Etape, Possibilite } from "@/domaine/api";
import {
  aMarcheLongue,
  formaterDistance,
  formaterDuree,
  jetonMode,
  libelleCorrespondances,
  libelleEtape,
  resumePossibilite,
} from "@/domaine/resultat";
import { couleurs, ombreFlottante } from "@/theme/jetons";

// Carte d'itinéraire et frise (design system, « Carte d'itinéraire » ; maquette 04 ; D67).

const ICONES: Record<string, AndroidSymbol> = {
  marche: "directions_walk",
  bus: "directions_bus",
  car: "directions_bus",
  transport_a_la_demande: "airport_shuttle",
  tram: "tram",
  metro: "subway",
  train_banlieue: "train",
  train: "train",
  bateau: "directions_boat",
  remontee: "funicular",
};

function icone(mode: string): AndroidSymbol {
  return ICONES[mode] ?? "commute";
}

/** Bande des modes : un bloc plein par transport, la marche en pointillé (jamais un bloc). */
export function Frise({ etapes }: { etapes: Etape[] }) {
  return (
    <View className="h-8 flex-row items-center gap-1" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {etapes.map((e, i) =>
        e.mode === "marche" ? (
          <View
            key={i}
            style={{
              flexGrow: Math.max(e.duree_minutes, 3),
              flexBasis: 0,
              height: 0,
              borderTopWidth: 3,
              borderStyle: "dotted",
              borderColor: couleurs["mode-marche"],
            }}
          />
        ) : (
          <View
            key={i}
            className="h-8 items-center justify-center rounded-full"
            style={{ flexGrow: Math.max(e.duree_minutes, 8), flexBasis: 0, backgroundColor: couleurs[jetonMode(e.mode)] }}
          >
            <SymbolView name={{ android: icone(e.mode), web: icone(e.mode) }} size={18} tintColor={couleurs.fond} />
          </View>
        ),
      )}
    </View>
  );
}

/** Avertissement « Marche de plus de 15 min » (D3). */
function AvertissementMarche() {
  return (
    <View className="flex-row items-center gap-2">
      <SymbolView name={{ android: "warning", web: "warning" }} size={20} tintColor={couleurs.avertissement} />
      <Text className="font-inter-medium text-badge" style={{ color: couleurs.avertissement }}>
        Marche de plus de 15 min
      </Text>
    </View>
  );
}

/** Badge « Prix non publié » : aucun prix sans fiche (invariant 5). */
function PrixNonPublie() {
  return (
    <View
      className="flex-row items-center gap-1 rounded-full px-3 py-1"
      style={{ borderWidth: 1.5, borderStyle: "dashed", borderColor: couleurs["bordure-champ"] }}
    >
      <SymbolView name={{ android: "euro", web: "euro" }} size={16} tintColor={couleurs["prix-texte"]} />
      <Text className="font-inter-medium text-badge" style={{ color: couleurs["prix-texte"] }}>
        Prix non publié
      </Text>
    </View>
  );
}

/** Une étape dépliée : heure, arrêts, ligne, direction, et l'état « horaire prévu » (invariant 12). */
function LigneEtape({ etape }: { etape: Etape }) {
  const marche = etape.mode === "marche";
  const couleur = couleurs[jetonMode(etape.mode)];
  return (
    <View className="flex-row gap-3">
      <Text className="w-14 font-inter-semibold text-secondaire text-texte" style={{ fontVariant: ["tabular-nums"] }}>
        {etape.depart}
      </Text>
      <View className="items-center pt-1">
        <SymbolView name={{ android: icone(etape.mode), web: icone(etape.mode) }} size={20} tintColor={couleur} />
        <View className="mt-1 w-0.5 flex-1" style={{ backgroundColor: marche ? couleurs["bordure-carte"] : couleur }} />
      </View>
      <View className="flex-1 gap-1 pb-4">
        <Text className="font-inter-semibold text-secondaire text-texte">
          {marche ? "Marche" : libelleEtape(etape)}
          {etape.direction ? <Text className="font-inter text-texte-secondaire">{` vers ${etape.direction}`}</Text> : null}
        </Text>
        {marche ? (
          <Text className="font-inter text-badge text-texte-secondaire">
            {`${etape.duree_minutes} min${etape.distance_metres != null ? `, ${formaterDistance(etape.distance_metres)}` : ""} jusqu'à ${etape.a.nom}`}
          </Text>
        ) : (
          <>
            <Text className="font-inter text-badge text-texte-secondaire">
              {`De ${etape.de.nom} à ${etape.a.nom}, arrivée ${etape.arrivee} (${formaterDuree(etape.duree_minutes)})`}
            </Text>
            {etape.exploitant ? <Text className="font-inter text-badge text-texte-secondaire">{etape.exploitant}</Text> : null}
            <View className="flex-row items-center gap-1 self-start rounded-full px-2 py-0.5" style={{ backgroundColor: couleurs["prevu-teinte"] }}>
              <SymbolView name={{ android: "schedule", web: "schedule" }} size={14} tintColor={couleurs["prevu-texte"]} />
              <Text className="font-inter text-badge" style={{ color: couleurs["prevu-texte"] }}>
                Horaire prévu, sans suivi en direct
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

/** Carte d'une possibilité ; la toucher déplie ses étapes. */
export function CartePossibilite({ possibilite, destination }: { possibilite: Possibilite; destination: string }) {
  const [ouverte, setOuverte] = useState(false);
  const p = possibilite;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: ouverte }}
      accessibilityLabel={`${p.depart} à ${p.arrivee}, ${formaterDuree(p.duree_minutes)}, ${resumePossibilite(p)}`}
      accessibilityHint={ouverte ? "Replie les étapes" : "Montre les étapes"}
      onPress={() => setOuverte((o) => !o)}
      className="gap-3 rounded-carte border border-bordure-carte bg-fond p-5"
      style={{ boxShadow: ombreFlottante }}
    >
      <View className="flex-row items-baseline justify-between gap-2">
        <Text className="font-inter-bold text-titre-carte text-texte" style={{ fontVariant: ["tabular-nums"] }}>
          {`${p.depart} → ${p.arrivee}`}
        </Text>
        <Text className="font-inter text-secondaire text-texte-secondaire">{formaterDuree(p.duree_minutes)}</Text>
      </View>
      <Frise etapes={p.etapes} />
      <Text className="font-inter text-secondaire text-texte-secondaire">{resumePossibilite(p)}</Text>
      <Text className="font-inter text-badge text-texte-secondaire">{libelleCorrespondances(p.correspondances)}</Text>
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        {aMarcheLongue(p) ? <AvertissementMarche /> : <View />}
        <PrixNonPublie />
      </View>
      {ouverte ? (
        <View className="mt-2 border-t border-bordure-carte pt-4">
          {p.etapes.map((e, i) => (
            <LigneEtape key={i} etape={e} />
          ))}
          <View className="flex-row gap-3">
            <Text className="w-14 font-inter-semibold text-secondaire text-texte" style={{ fontVariant: ["tabular-nums"] }}>
              {p.arrivee}
            </Text>
            <SymbolView name={{ android: "location_on", web: "location_on" }} size={20} tintColor={couleurs.primaire} />
            <Text className="flex-1 font-inter-semibold text-secondaire text-texte">{destination}</Text>
          </View>
        </View>
      ) : (
        <Text className="font-inter-medium text-badge text-primaire">Voir les étapes</Text>
      )}
    </Pressable>
  );
}
