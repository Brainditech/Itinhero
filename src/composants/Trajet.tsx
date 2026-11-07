import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";

import type { Etape, Possibilite } from "@/domaine/api";
import type { Trajet } from "@/domaine/demande";
import { lignesFrise, type LigneFrise } from "@/domaine/frise";
import { GLOSSAIRE } from "@/domaine/glossaire";
import {
  aMarcheLongue,
  formaterAttente,
  formaterDuree,
  jetonMode,
  jourApres,
  joursEnPlus,
  libelleCorrespondances,
  libelleEtape,
  nuitDehors,
  resumePossibilite,
} from "@/domaine/resultat";
import { etapeAReserver } from "@/domaine/tri";
import { iconeMode } from "@/composants/icones-mode";
import { Chevron } from "@/composants/Repli";
import { useCartes } from "@/cartes";
import { prixTrajet, textePrix } from "@/domaine/prix";
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

/**
 * Badge du prix (spec 43, invariant 5) : « Prix : 4,55 € » quand chaque véhicule a un tarif validé, la part connue
 * avec « + prix non publié (…) » sinon, ou « Prix non publié ». Les cartes cochées réduisent le prix (invariant 7).
 */
function BadgePrix({ possibilite, trajet }: { possibilite: Possibilite; trajet: Trajet }) {
  const { cartes } = useCartes();
  const prix = prixTrajet(possibilite, cartes, trajet);
  if (prix.etat === "non_publie") return <PrixNonPublie />;
  return (
    <View className="flex-row items-center gap-1 rounded-full px-3 py-1" style={{ backgroundColor: couleurs.surface }}>
      <SymbolView name={{ android: "euro", web: "euro" }} size={16} tintColor={couleurs.texte} />
      <Text className="font-inter-semibold text-badge text-texte">{textePrix(prix)}</Text>
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

type LigneEtapeFrise = Extract<LigneFrise, { type: "etape" }>;

/**
 * Titre d'une étape : un mot du glossaire à sa première occurrence est souligné en pointillé ; le toucher montre son
 * explication sous le titre (spec 51, D134).
 */
function TitreEtape({ ligne, explication, basculer }: { ligne: LigneEtapeFrise; explication: string | null; basculer: (terme: string) => void }) {
  return (
    <>
      <Text className="font-inter-semibold text-secondaire text-texte">
        {ligne.glossaire.map((m, k) =>
          m.terme ? (
            <Text
              key={k}
              accessibilityRole="button"
              accessibilityLabel={`${m.terme}, explication disponible`}
              onPress={() => basculer(m.terme as string)}
              className="font-inter-semibold text-primaire"
              style={{ textDecorationLine: "underline", textDecorationStyle: "dotted", textDecorationColor: couleurs.primaire }}
            >
              {m.texte}
            </Text>
          ) : (
            <Text key={k}>{m.texte}</Text>
          ),
        )}
        {ligne.direction ? <Text className="font-inter text-texte-secondaire">{` ${ligne.direction}`}</Text> : null}
      </Text>
      {explication ? (
        <View className="flex-row gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: couleurs["primaire-doux"] }}>
          <SymbolView name={{ android: "info", web: "info" }} size={16} tintColor={couleurs.primaire} />
          <Text className="flex-1 font-inter text-badge text-texte">{explication}</Text>
        </View>
      ) : null}
    </>
  );
}

/**
 * Une étape dépliée : heure, arrêts, ligne, direction, et l'état d'horaire (invariant 12), tels que `lignesFrise` les
 * donne (spec 51). La toucher ouvre sa fenêtre : la carte en fond, les consignes ou les arrêts en bas (spec 17, D84).
 */
function LigneEtape({ ligne, ouvrir }: { ligne: LigneEtapeFrise; ouvrir: () => void }) {
  const [terme, setTerme] = useState<string | null>(null);
  const marche = ligne.mode === "marche";
  const couleur = couleurs[jetonMode(ligne.mode)];
  const explication = terme ? (GLOSSAIRE[terme] ?? null) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${ligne.heure}, ${marche ? `Marche, ${ligne.phrase}` : `${ligne.titre}${ligne.direction ? ` ${ligne.direction}` : ""}`}`}
      accessibilityHint="Ouvre la carte de cette étape"
      onPress={ouvrir}
      // Pas de surbrillance au toucher : elle clignotait à chaque défilement du Résultat (retour de Brainditech).
      className="flex-row gap-3"
    >
      <Text className="w-14 font-inter-semibold text-secondaire text-texte" style={{ fontVariant: ["tabular-nums"] }}>
        {ligne.heure}
      </Text>
      <View className="items-center pt-1">
        <SymbolView name={{ android: icone(ligne.mode), web: icone(ligne.mode) }} size={20} tintColor={couleur} />
        <View className="mt-1 w-0.5 flex-1" style={{ backgroundColor: marche ? couleurs["bordure-carte"] : couleur }} />
      </View>
      <View className="flex-1 gap-1 pb-4">
        <TitreEtape ligne={ligne} explication={explication} basculer={(t) => setTerme((x) => (x === t ? null : t))} />
        <Text className="font-inter text-badge text-texte-secondaire">{ligne.phrase}</Text>
        {ligne.exploitant ? <Text className="font-inter text-badge text-texte-secondaire">{ligne.exploitant}</Text> : null}
        {ligne.reservation ? (
          <View className="flex-row items-center gap-2">
            <SymbolView name={{ android: "call", web: "call" }} size={16} tintColor={couleurs.avertissement} />
            <Text className="flex-1 font-inter-semibold text-badge" style={{ color: couleurs.avertissement }}>
              {ligne.reservation}
            </Text>
          </View>
        ) : null}
        {ligne.horaire ? (
          <View className="flex-row items-center gap-1 self-start rounded-full px-2 py-0.5" style={{ backgroundColor: couleurs["prevu-teinte"] }}>
            <SymbolView name={{ android: "schedule", web: "schedule" }} size={14} tintColor={couleurs["prevu-texte"]} />
            <Text className="font-inter text-badge" style={{ color: couleurs["prevu-texte"] }}>
              {ligne.horaire.texte}
            </Text>
          </View>
        ) : null}
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

/**
 * Carte d'une possibilité ; la toucher déplie ou replie ses étapes. En haut à droite, son chevron, ou `action`
 * (la disquette qui enregistre cette possibilité seule, spec 24 §8, D102) ; `pied` s'affiche sous le résumé.
 */
export function CartePossibilite({
  possibilite,
  index,
  trajet = "aller",
  destination,
  date,
  adresse,
  action,
  pied,
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
  action?: ReactNode;
  pied?: ReactNode;
}) {
  const [ouverte, setOuverte] = useState(false);
  const p = possibilite;
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
        {action ? <View className="-my-2 -mr-2">{action}</View> : <Chevron ouvert={ouverte} />}
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
        <BadgePrix possibilite={p} trajet={trajet} />
      </View>
      {pied}
      {ouverte ? (
        <View className="mt-2 border-t border-bordure-carte pt-4">
          {lignesFrise(p).map((l, k) =>
            l.type === "etape" ? (
              <LigneEtape
                key={k}
                ligne={l}
                ouvrir={() => router.push({ pathname: "/etape", params: { i: String(index), e: String(l.index), t: trajet } })}
              />
            ) : l.type === "attente" ? (
              <LigneAttente key={k} texte={l.texte} />
            ) : null,
          )}
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
