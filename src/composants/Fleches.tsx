import { SymbolView } from "expo-symbols";
import type { AndroidSymbol } from "expo-symbols";

import type { Manoeuvre } from "@/domaine/api";

// Flèche de chaque manœuvre (spec 11) : symboles Material d'Android déjà utilisés par l'app (expo-symbols),
// aucune bibliothèque d'icônes tierce (invariant 20).
const SYMBOLES: Record<Manoeuvre, AndroidSymbol> = {
  depart: "navigation",
  tout_droit: "straight",
  legerement_gauche: "turn_slight_left",
  gauche: "turn_left",
  demi_tour: "u_turn_left",
  legerement_droite: "turn_slight_right",
  droite: "turn_right",
  escalier: "stairs",
  ascenseur: "elevator",
  arrivee: "flag",
};

export function symboleManoeuvre(m: Manoeuvre): AndroidSymbol {
  return SYMBOLES[m];
}

export function Fleche({ manoeuvre, taille = 24, couleur }: { manoeuvre: Manoeuvre; taille?: number; couleur: string }) {
  const nom = SYMBOLES[manoeuvre];
  return <SymbolView name={{ android: nom, web: nom }} size={taille} tintColor={couleur} />;
}
