import { useState } from "react";
import { Text, View } from "react-native";
import { SymbolView, type AndroidSymbol } from "expo-symbols";

import type { Bout, Demande } from "@/domaine/demande";
import { phraseVotreTrajet, quandDemande, type BoutRecap } from "@/domaine/resultat";
import { BoutonIcone, BoutonRepli } from "@/composants/Repli";
import { couleurs, ombreFlottante } from "@/theme/jetons";

/** Icône d'un bout : maison pour Domicile, cible pour Ma position, repère pour un lieu tapé. */
function iconeBout(bout: Bout): AndroidSymbol {
  if (bout.type === "domicile") return "home";
  if (bout.type === "position") return "my_location";
  return "location_on";
}

/** Un bout : icône à gauche, nom et adresse à droite. Le départ prolonge sous son icône le trait qui mène à l'arrivée. */
function LigneBout({ bout, recap, relie }: { bout: Bout; recap: BoutRecap; relie: boolean }) {
  return (
    <View className="flex-row gap-4">
      <View className="w-7 items-center">
        <SymbolView name={{ android: iconeBout(bout), web: iconeBout(bout) }} size={28} tintColor={couleurs.primaire} />
        {relie ? <View className="my-1 flex-1" style={{ width: 2, minHeight: 16, backgroundColor: couleurs["bordure-champ"] }} /> : null}
      </View>
      <View className={`flex-1 ${relie ? "pb-4" : ""}`}>
        <Text className="font-inter-semibold text-corps text-texte">{recap.nom}</Text>
        {recap.adresse ? <Text className="font-inter text-secondaire text-texte-secondaire">{recap.adresse}</Text> : null}
      </View>
    </View>
  );
}

/**
 * Carte « Votre trajet » en tête du Résultat (spec 14, maquette 04b) : d'où, vers où, quand.
 * Le trajet est lu d'un bloc par TalkBack ; le crayon (modifier) et le chevron (replier) sont des boutons à part.
 * Repliée, la carte ne garde que « départ → arrivée » sur une ligne. La disquette est sur chaque trajet
 * proposé, pas ici (spec 24 §8, D102).
 */
export function VotreTrajet({
  demande,
  depart,
  arrivee,
  onModifier,
}: {
  demande: Demande;
  depart: BoutRecap;
  arrivee: BoutRecap;
  /** Absent : pas de crayon. */
  onModifier?: () => void;
}) {
  const [ouverte, setOuverte] = useState(false);
  return (
    <View className="overflow-hidden rounded-carte border border-bordure-carte bg-fond" style={{ boxShadow: ombreFlottante }}>
      <View className="flex-row items-center pl-5 pr-1">
        <Text accessibilityRole="header" className="flex-1 font-inter-medium text-corps text-texte-secondaire">
          Votre trajet
        </Text>
        {onModifier ? <BoutonIcone icone="edit" nom="Modifier la recherche" onPress={onModifier} /> : null}
        <BoutonRepli ouvert={ouverte} nom="Votre trajet" onPress={() => setOuverte((o) => !o)} />
      </View>

      {ouverte ? (
        <View accessible accessibilityLabel={phraseVotreTrajet(depart, arrivee, demande)}>
          <View className="px-5 pb-4">
            <LigneBout bout={demande.depart} recap={depart} relie />
            <LigneBout bout={demande.arrivee} recap={arrivee} relie={false} />
          </View>
          <View className="flex-row items-center gap-4 border-t border-bordure-carte px-5 py-3">
            <View className="w-7 items-center">
              <SymbolView name={{ android: "event", web: "event" }} size={24} tintColor={couleurs["texte-secondaire"]} />
            </View>
            <Text className="flex-1 font-inter-medium text-secondaire text-texte-secondaire">{quandDemande(demande)}</Text>
          </View>
        </View>
      ) : (
        <View accessible accessibilityLabel={phraseVotreTrajet(depart, arrivee, demande)} className="px-5 pb-4">
          <Text numberOfLines={1} className="font-inter-semibold text-corps text-texte">
            {`${depart.nom} → ${arrivee.nom}`}
          </Text>
        </View>
      )}
    </View>
  );
}
