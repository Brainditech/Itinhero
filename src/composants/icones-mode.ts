import type { AndroidSymbol } from "expo-symbols";

// Icône de chaque mode (design system) : une seule table pour le Résultat, le guidage et sa carte.

const ICONES_MODE: Record<string, AndroidSymbol> = {
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
  taxi: "local_taxi",
};

export function iconeMode(mode: string): AndroidSymbol {
  return ICONES_MODE[mode] ?? "commute";
}
