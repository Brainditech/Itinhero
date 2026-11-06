import { requireOptionalNativeModule } from "expo";
import Constants, { ExecutionEnvironment } from "expo-constants";

// Style des tuiles OpenFreeMap (PLAN §3), rempli par Brainditech dans .env. Absent : carte inventée seule.
const URL_STYLE = process.env.EXPO_PUBLIC_TUILES_URL;
if (!URL_STYLE && __DEV__) {
  console.warn("EXPO_PUBLIC_TUILES_URL absente : fond de carte inventé à la place de la carte (spec 03).");
}

// MapLibre n'existe pas dans Expo Go (module natif) : l'importer y plante l'app.
// On ne le charge que dans un development build ; dans Expo Go, carte inventée seule.
const DANS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const MapLibre: typeof import("@maplibre/maplibre-react-native") | null = DANS_EXPO_GO
  ? null
  : // eslint-disable-next-line @typescript-eslint/no-require-imports -- import conditionnel voulu (Expo Go)
    require("@maplibre/maplibre-react-native");

/** MapLibre et l'URL du style, ou null (Expo Go, style absent) : partagé par toutes les cartes de l'app. */
export const CARTE = URL_STYLE && MapLibre ? { url: URL_STYLE, ...MapLibre } : null;

// Spec 23 (D99) : conditions d'OpenFreeMap pour les cartes hors ligne (4 requêtes en parallèle au plus,
// User-Agent propre à l'app), posées par le module local `modules/reseau-carte` avant la première carte.
// Absent (development build plus ancien) : aucun pack de carte n'est téléchargé.
const ReseauCarte = CARTE
  ? requireOptionalNativeModule<{ configurer(userAgent: string, requetesParServeur: number): boolean }>("ReseauCarte")
  : null;
let reseauConforme = false;
try {
  reseauConforme = ReseauCarte?.configurer(`Itinhero/${Constants.expoConfig?.version ?? "0"} (Android)`, 4) === true;
} catch {
  reseauConforme = false;
}
/** Vrai si la carte peut être téléchargée pour le hors ligne dans le respect des conditions d'OpenFreeMap. */
export const PACKS_POSSIBLES = CARTE !== null && reseauConforme;
