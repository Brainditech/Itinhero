import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";

import type { Etape, Possibilite } from "@/domaine/api";
import type { Trajet } from "@/domaine/demande";
import { phraseMarche, phraseTrajetVehicule } from "@/domaine/guidage";
import {
  aMarcheLongue,
  attenteApres,
  directionEtape,
  formaterAttente,
  formaterDuree,
  jetonMode,
  jourApres,
  joursEnPlus,
  libelleCorrespondances,
  libelleEtape,
  nuitDehors,
  phraseMontee,
  phraseReservation,
  phraseTaxi,
  resumePossibilite,
} from "@/domaine/resultat";
import { etapeAReserver } from "@/domaine/tri";
import { iconeMode } from "@/composants/icones-mode";
import { Chevron } from "@/composants/Repli";
import { couleurs, ombreFlottante } from "@/theme/jetons";

// Carte d'itinéraire et frise (design system, « Carte d'itinéraire » ; maquette 04 ; D67).

const icone = iconeMode;

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

/** Badge « Nuit dehors à Laroche-Migennes (7 h 51) » (spec 15, D79) : mot et triangle, jamais la couleur seule. */
function AvertissementNuit({ lieu, minutes }: { lieu: string; minutes: number }) {
  return (
    <View className="flex-row items-center gap-2">
      <SymbolView name={{ android: "bedtime", web: "bedtime" }} size={20} tintColor={couleurs.avertissement} />
      <Text className="flex-1 font-inter-semibold text-badge" style={{ color: couleurs.avertissement }}>
        {`Nuit dehors à ${lieu} (${formaterAttente(minutes)})`}
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

/**
 * Une étape dépliée : heure, arrêts, ligne, direction, et l'état « horaire prévu » (invariant 12).
 * La toucher ouvre sa fenêtre : la carte en fond, les consignes ou les arrêts en bas (spec 17, D84).
 */
function LigneEtape({ etape, suivante, ouvrir }: { etape: Etape; suivante?: Etape; ouvrir: () => void }) {
  const marche = etape.mode === "marche";
  const couleur = couleurs[jetonMode(etape.mode)];
  const direction = directionEtape(etape);
  const reservation = phraseReservation(etape) ?? phraseTaxi(etape);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${etape.depart}, ${marche ? `Marche, ${phraseMarche(etape, suivante)}` : `${libelleEtape(etape)}${direction ? ` ${direction}` : ""}`}`}
      accessibilityHint="Ouvre la carte de cette étape"
      onPress={ouvrir}
      // Pas de surbrillance au toucher : elle clignotait à chaque défilement du Résultat (retour de Brainditech).
      className="flex-row gap-3"
    >
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
          {direction ? <Text className="font-inter text-texte-secondaire">{` ${direction}`}</Text> : null}
        </Text>
        {marche ? (
          <>
            <Text className="font-inter text-badge text-texte-secondaire">
              {phraseMarche(etape, suivante)}
            </Text>
          </>
        ) : (
          <>
            <Text className="font-inter text-badge text-texte-secondaire">
              {phraseTrajetVehicule(etape, formaterDuree(etape.duree_minutes))}
            </Text>
            {etape.exploitant ? <Text className="font-inter text-badge text-texte-secondaire">{etape.exploitant}</Text> : null}
            {reservation ? (
              <View className="flex-row items-center gap-2">
                <SymbolView name={{ android: "call", web: "call" }} size={16} tintColor={couleurs.avertissement} />
                <Text className="flex-1 font-inter-semibold text-badge" style={{ color: couleurs.avertissement }}>
                  {reservation}
                </Text>
              </View>
            ) : null}
            {etape.mode === "taxi" ? null : (
              <View className="flex-row items-center gap-1 self-start rounded-full px-2 py-0.5" style={{ backgroundColor: couleurs["prevu-teinte"] }}>
                <SymbolView name={{ android: "schedule", web: "schedule" }} size={14} tintColor={couleurs["prevu-texte"]} />
                <Text className="font-inter text-badge" style={{ color: couleurs["prevu-texte"] }}>
                  Horaire prévu, sans suivi en direct
                </Text>
              </View>
            )}
          </>
        )}
      </View>
      <View className="min-h-12 w-8 items-center justify-center self-center">
        <SymbolView name={{ android: "chevron_right", web: "chevron_right" }} size={26} tintColor={couleurs.primaire} />
      </View>
    </Pressable>
  );
}

/** Ligne sans heure entre deux étapes : attente, ou arrivée à l'arrêt avant la première montée (D68). */
function LigneAttente({ texte }: { texte: string }) {
  return (
    <View className="flex-row gap-3">
      <View className="w-14" />
      <View className="items-center pt-0.5">
        <SymbolView name={{ android: "hourglass_empty", web: "hourglass_empty" }} size={18} tintColor={couleurs["texte-secondaire"]} />
      </View>
      <Text className="flex-1 pb-4 font-inter-medium text-badge text-texte-secondaire">{texte}</Text>
    </View>
  );
}

/** Carte d'une possibilité ; la toucher (ou son chevron, en haut à droite) déplie ou replie ses étapes. */
export function CartePossibilite({
  possibilite,
  index,
  trajet = "aller",
  destination,
  date,
  adresse,
}: {
  possibilite: Possibilite;
  /** Rang dans la réponse, pour ouvrir son guidage (spec 12). */
  index: number;
  /** Aller ou retour planifié (spec 19) : dit aux étapes et au guidage où trouver la possibilité. */
  trajet?: Trajet;
  destination: string;
  /** Jour demandé (« 2026-11-12 »), pour dire « vendredi » quand l'arrivée est le lendemain (spec 15). */
  date: string;
  adresse: string | null;
}) {
  const [ouverte, setOuverte] = useState(false);
  const p = possibilite;
  const premiereMontee = p.etapes.findIndex((e) => e.mode !== "marche");
  const montee = phraseMontee(p);
  // Un taxi se réserve toujours (spec 16, D48) ; même règle que le tri « Sans réservation » (spec 21, D97).
  const aReserver = etapeAReserver(p);
  const nuit = nuitDehors(p);
  const plus = joursEnPlus(p);
  const jourArrivee = plus > 0 ? jourApres(date, plus) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: ouverte }}
      accessibilityLabel={`${p.depart} à ${jourArrivee ? `${jourArrivee} ` : ""}${p.arrivee}, ${formaterDuree(p.duree_minutes)}, ${nuit ? `nuit dehors à ${nuit.lieu}, ` : ""}${resumePossibilite(p)}`}
      accessibilityHint={ouverte ? "Replie les étapes" : "Montre les étapes"}
      onPress={() => setOuverte((o) => !o)}
      className="gap-3 rounded-carte border border-bordure-carte bg-fond p-5"
      style={{ boxShadow: ombreFlottante }}
    >
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 font-inter-bold text-titre-carte text-texte" style={{ fontVariant: ["tabular-nums"] }}>
          {`${p.depart} → ${p.arrivee}`}
        </Text>
        <Text className="font-inter text-secondaire text-texte-secondaire">{formaterDuree(p.duree_minutes)}</Text>
        <Chevron ouvert={ouverte} />
      </View>
      {jourArrivee ? (
        <Text className="-mt-2 font-inter-semibold text-badge text-texte-secondaire">{`Arrivée ${jourArrivee}`}</Text>
      ) : null}
      <Frise etapes={p.etapes} />
      <Text className="font-inter text-secondaire text-texte-secondaire">{resumePossibilite(p)}</Text>
      <Text className="font-inter text-badge text-texte-secondaire">{libelleCorrespondances(p.correspondances)}</Text>
      {nuit ? <AvertissementNuit lieu={nuit.lieu} minutes={nuit.minutes} /> : null}
      {aReserver ? (
        <View className="flex-row items-center gap-2">
          <SymbolView name={{ android: "call", web: "call" }} size={20} tintColor={couleurs.avertissement} />
          <Text className="flex-1 font-inter-medium text-badge" style={{ color: couleurs.avertissement }}>
            {`${libelleEtape(aReserver)} : réservation obligatoire`}
          </Text>
        </View>
      ) : null}
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        {aMarcheLongue(p) ? <AvertissementMarche /> : <View />}
        <PrixNonPublie />
      </View>
      {ouverte ? (
        <View className="mt-2 border-t border-bordure-carte pt-4">
          {p.etapes.map((e, i) => {
            const attente = attenteApres(p.etapes, i);
            // Avant la première montée, la ligne dit l'heure d'arrivée à l'arrêt et le passage du véhicule.
            const texte = i === premiereMontee - 1 && montee ? montee : attente !== null ? `Attente ${formaterAttente(attente)}` : null;
            return (
              <View key={i}>
                <LigneEtape
                  etape={e}
                  suivante={p.etapes[i + 1]}
                  ouvrir={() => router.push({ pathname: "/etape", params: { i: String(index), e: String(i), t: trajet } })}
                />
                {texte ? <LigneAttente texte={texte} /> : null}
              </View>
            );
          })}
          <View className="flex-row gap-3">
            <Text className="w-14 font-inter-semibold text-secondaire text-texte" style={{ fontVariant: ["tabular-nums"] }}>
              {p.arrivee}
            </Text>
            <SymbolView name={{ android: "location_on", web: "location_on" }} size={20} tintColor={couleurs.primaire} />
            <View className="flex-1 gap-0.5">
              <Text className="font-inter-semibold text-secondaire text-texte">{destination}</Text>
              {adresse ? <Text className="font-inter text-badge text-texte-secondaire">{adresse}</Text> : null}
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/guidage", params: { i: String(index), t: trajet } })}
            className="mt-4 min-h-14 flex-row items-center justify-center gap-2 rounded-bouton bg-fond active:bg-primaire-doux"
            style={{ borderWidth: 1.5, borderColor: couleurs.primaire }}
          >
            <SymbolView name={{ android: "navigation", web: "navigation" }} size={22} tintColor={couleurs.primaire} />
            <Text className="font-inter-semibold text-corps text-primaire">Démarrer le guidage</Text>
          </Pressable>
          <View className="mt-4 flex-row items-center justify-center gap-2">
            <Text className="font-inter-medium text-badge text-primaire">Replier les étapes</Text>
            <Chevron ouvert />
          </View>
        </View>
      ) : (
        <Text className="font-inter-medium text-badge text-primaire">Voir les étapes</Text>
      )}
    </Pressable>
  );
}
