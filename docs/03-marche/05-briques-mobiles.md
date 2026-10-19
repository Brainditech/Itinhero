# Volet E — Briques mobiles (React Native / Expo)

> Agent : kodivine-chercheur · relevé le 2026-10-19 : registre npm (licence déclarée, dernière
> version, date de publication, peer dependencies), API GitHub (dernier commit), documentation
> officielle. « Maintenu » = commit ou release dans les 90 jours précédant le 2026-10-19.

## Épreuve de l'amont

Le brief demande un guidage par photo « y compris en sous-sol SANS réseau » et cite ARCore
Geospatial / VPS. Le mensonge serait de croire que Geospatial résout ce cas : il exige internet,
l'extérieur et la couverture Street View (E3). En sous-sol hors réseau, seules restent des
briques **entièrement embarquées** : reconnaissance de texte (ML Kit, E4) et modèle de vision
local (E5). Second mensonge possible : « Expo » sans préciser la version — les deux apps
internes sont en SDK 57 alors que le SDK 58 est sorti le 2026-09-29, et Viro est épinglé à
`expo <58`.

## E1. Socle Expo / React Native

- Dernière version npm d'`expo` : **58.0.16**, publiée le 2026-10-19 ; `58.0.0` publiée le 2026-09-29, `57.0.0` le 2026-06-30 (source: https://registry.npmjs.org/expo, vérifié le 2026-10-19).
- Dernière version de `react-native` : 0.88.0, publiée le 2026-10-15 (source: https://registry.npmjs.org/react-native, vérifié le 2026-10-19).
- Les deux apps internes (Pécule, Tripagent) sont en Expo SDK 57 / React Native 0.86 (détail volet G) (source: D:\Mes Logiciels\02-Mobile-Desktop\Pecule\app\package.json ; D:\Mes Logiciels\02-Mobile-Desktop\Tripagent\package.json).

## E2. Cartes (MapLibre React Native, PMTiles, expo-maps)

- `@maplibre/maplibre-react-native` : **MIT**, version **11.5.0** du 2026-10-04, dernier commit 2026-10-15, 669 étoiles ; peer `expo >=54`, `react-native >=0.80`, `react >=19.1` (source: https://registry.npmjs.org/@maplibre/maplibre-react-native et https://api.github.com/repos/maplibre/maplibre-react-native, vérifiés le 2026-10-19).
- Le paquet « ne peut pas être utilisé avec Expo Go » ; il s'installe par `npx expo install` + plugin de configuration + rebuild natif (source: https://raw.githubusercontent.com/maplibre/maplibre-react-native/main/docs/content/setup/expo.md, vérifié le 2026-10-19).
- « From v11 onwards only the new architecture is supported » (source: https://raw.githubusercontent.com/maplibre/maplibre-react-native/main/docs/content/setup/getting-started.md, vérifié le 2026-10-19).
- Cartes hors ligne : `OfflineManager.createPack` télécharge les ressources d'une région (niveaux de zoom, style, emprise) dans une base locale (source: https://raw.githubusercontent.com/maplibre/maplibre-react-native/main/docs/content/modules/offline-manager.md, vérifié le 2026-10-19).
- PMTiles dans MapLibre Native Android : supporté **à partir de 11.7.0** ; « PMTiles sources do not support offline pack downloads or caching » ; un fichier local se lit en `pmtiles://file://<chemin absolu>` (source: https://maplibre.org/maplibre-native/android/examples/data/PMTiles/, vérifié le 2026-10-19).
- PMTiles : implémentations de référence sous **BSD-3**, spécification dans le domaine public / CC0 ; dernier commit 2026-09-16 (source: https://github.com/protomaps/PMTiles/blob/main/LICENSE et https://api.github.com/repos/protomaps/PMTiles, vérifiés le 2026-10-19).
- ⬜ NON RÉSOLU — la version de MapLibre Native embarquée par `@maplibre/maplibre-react-native` 11.5.0 est-elle ≥ 11.7.0 (prérequis PMTiles Android), et PMTiles est-il supporté côté iOS ? Où chercher : section « Native Versions » de getting-started.md, release notes 11.x.
- `expo-maps` : MIT, version 58.0.10 du 2026-10-19 (source: https://registry.npmjs.org/expo-maps, vérifié le 2026-10-19) ; Tripagent le note « encore en alpha dans SDK 57 » (source: D:\Mes Logiciels\02-Mobile-Desktop\Tripagent\PLAN.md, § Contexte).

## E3. ARCore Geospatial / VPS (et accès depuis React Native)

- Le VPS fournit une précision de position « typically better than 5 meters and often around 1 meter » (source: https://developers.google.com/ar/reference/java/com/google/ar/core/Config.GeospatialMode, mis à jour le 2024-10-31, vérifié le 2026-10-19).
- « The app must be connected to the internet, and the location must be known to the VPS » ; « For best results, run the sample app outside (not indoors) during daylight hours » (source: https://developers.google.com/ar/develop/java/geospatial/quickstart, mis à jour le 2024-10-31, vérifié le 2026-10-19).
- L'app doit être associée à un projet Google Cloud avec l'API ARCore activée, en autorisation « Keyless » ou « API Key » (source: même page, vérifiée le 2026-10-19).
- L'API permet d'attacher du contenu « to any area covered by Google Street View » ; « A small number of ARCore supported devices do not support the Geospatial API » ; plateformes : Android (Kotlin/Java, NDK), iOS, Unity, Unreal (source: https://developers.google.com/ar/develop/geospatial, mis à jour le 2026-09-04, vérifié le 2026-10-19).
- ⬜ NON RÉSOLU — quotas et coût de l'API ARCore Geospatial (page « API usage quota » liée mais non ouverte). Où chercher : https://developers.google.com/ar/develop/geospatial puis lien « API usage quota ».
- ⬜ NON RÉSOLU — couverture VPS / Street View des rues de Brienon et des abords de la gare de Laroche-Migennes. Où chercher : couverture Street View dans Google Maps, ou l'outil de disponibilité VPS de l'API.
- Depuis React Native : **aucun module officiel Google** pour ARCore Geospatial trouvé. ViroReact (`@reactvision/react-viro`) est **MIT**, version **3.0.3 du 2026-10-07**, compatible Expo, avec peer `expo >=57.0.0 <58.0.0` et `react-native >=0.86.0 <0.87.0` (source: https://registry.npmjs.org/@reactvision/react-viro et https://raw.githubusercontent.com/ReactVision/viro/main/README.md, vérifiés le 2026-10-19).
- Dans ViroReact, les « Geospatial Anchors » et le VPS sont des « Platform feature » fournies par **ReactVision Platform**, service hébergé activé par `rvApiKey` et `rvProjectId` ; compte Studio gratuit (source: https://raw.githubusercontent.com/ReactVision/viro/main/README.md, vérifié le 2026-10-19).
- ⬜ NON RÉSOLU — ReactVision Platform s'appuie-t-il sur l'API ARCore Geospatial de Google, et à quel coût au-delà du compte gratuit ? Le README ne le dit pas. Où chercher : guide « Geospatial Anchors » de la documentation ReactVision.

## E4. Reconnaissance de texte embarquée (ML Kit)

- « ML Kit's processing happens on-device » et « It also works while offline » (source: https://developers.google.com/ml-kit, vérifié le 2026-10-19).
- Text Recognition v2 reconnaît les écritures chinoise, devanagari, japonaise, coréenne et **latine** (source: https://developers.google.com/ml-kit/vision/text-recognition/v2, mis à jour le 2024-07-10, vérifié le 2026-10-19).
- `@infinitered/react-native-mlkit-text-recognition` : MIT (npm), version 5.0.1 du 2025-11-25, peer `expo: *` ; dernier commit du monorepo le 2026-08-05 ; GitHub n'expose pas de licence au niveau du dépôt (source: https://registry.npmjs.org/@infinitered/react-native-mlkit-text-recognition et https://api.github.com/repos/infinitered/react-native-mlkit, vérifiés le 2026-10-19).
- `@react-native-ml-kit/text-recognition` : MIT, version 2.0.0 du 2025-09-01, dernier commit du dépôt le 2025-09-06 — **plus d'un an sans activité** au 2026-10-19 (source: https://registry.npmjs.org/@react-native-ml-kit/text-recognition et https://api.github.com/repos/a7medev/react-native-ml-kit, vérifiés le 2026-10-19).
- ⬜ NON RÉSOLU — conditions d'utilisation et gratuité du SDK ML Kit lui-même (les wrappers sont MIT, pas le SDK Google). Où chercher : « ML Kit Terms of Service » sur developers.google.com.

## E5. Modèle de vision embarqué hors ligne

- **llama.rn** : MIT ; vision et audio via projecteur `mmproj` ; exige la New Architecture depuis v0.10 ; Android limité à arm64-v8a / x86_64 ; non supporté en simulateur iOS ; Expo via `expo-build-properties` ; images distantes HTTP non supportées (source: https://github.com/mybigday/llama.rn, vérifié le 2026-10-19).
- llama.rn : dernière release GitHub stable **v0.12.9 du 2026-08-04**, mais le tag npm `latest` pointe sur **0.13.0-rc.7** (une release candidate) publiée le 2026-10-05 ; dernier commit le 2026-10-12 (source: https://registry.npmjs.org/llama.rn et https://api.github.com/repos/mybigday/llama.rn, vérifiés le 2026-10-19).
- **Échec interne documenté** : trois tentatives d'installation de `llama.rn` ont échoué sur la machine de Brainditech (« gzip: stdin: unexpected end of file ») au 27/07/2026 (source: D:\Mes Logiciels\02-Mobile-Desktop\Pecule\app\src\app\langage\moteur-embarque.ts, en-tête).
- **react-native-executorch** (Software Mansion, runtime ExecuTorch de Meta) : MIT, version **0.10.6 du 2026-10-19** ; inférence 100 % hors ligne après téléchargement du modèle ; hooks pour LLM, vision par ordinateur, parole ; exige New Architecture, React Native 0.83+ ou Expo SDK 55+ en development build (Expo Go non supporté), iOS 17+ / Android 13+ ; les téléchargements de modèles envoient un événement de télémétrie anonyme désactivable (source: https://raw.githubusercontent.com/software-mansion/react-native-executorch/main/README.md et https://registry.npmjs.org/react-native-executorch, vérifiés le 2026-10-19).
- ⬜ NON RÉSOLU — react-native-executorch fournit-il un modèle **vision-langage** (image + question → réponse) ou un OCR prêt à l'emploi en 0.10.6 ? Les pages de documentation `useOCR` / `useLLM` testées renvoient 404 le 2026-10-19. Où chercher : https://docs.swmansion.com/react-native-executorch/ (arborescence actuelle).
- **MediaPipe LLM Inference** (Android, iOS, Web) : « now in maintenance-only mode » ; Google recommande de migrer vers **LiteRT-LM** ; l'API documente une entrée texte seulement (page mise à jour le 2026-10-01) (source: https://developers.google.com/edge/mediapipe/solutions/genai/llm_inference/index, vérifié le 2026-10-19).
- **LiteRT-LM** : Apache-2.0, release **v0.18.0 du 2026-10-06**, dernier commit le 2026-10-19 (source: https://api.github.com/repos/google-ai-edge/LiteRT-LM, vérifié le 2026-10-19).
- ⬜ NON RÉSOLU — existe-t-il un binding React Native / Expo maintenu pour LiteRT-LM avec entrée image ? Aucun trouvé (le paquet `react-native-mediapipe-llm` n'existe pas sur npm, vérifié le 2026-10-19). Construire un module natif Expo serait alors nécessaire.
- Modèles : **Gemma 4** est publié sous **Apache 2.0**, « the first in the Gemmaverse to be released under the OSI-approved Apache 2.0 license », tailles « from edge devices to 31B » (source: https://opensource.googleblog.com/2026/03/gemma-4-expanding-the-gemmaverse-with-apache-20.html, article du 02/04/2026, vérifié le 2026-10-19).
- Les Gemma antérieurs (dont Gemma 3 1B visé par Pécule et Gemma 3n) relèvent des « Gemma Terms of Use » avec politique d'usages interdits (source: https://ai.google.dev/gemma/terms, vu en résultat de recherche le 2026-10-19, page non ouverte) ; ⬜ NON RÉSOLU — texte exact applicable à Gemma 3n.
- ⬜ NON RÉSOLU — le support de l'entrée image par Gemma 4 « edge » n'est pas dit par le billet Google ; seules des sources secondaires l'affirment (ex. https://emelia.io/hub/gemma-4-open-source-guide). Où chercher : fiche modèle Gemma 4 sur ai.google.dev ou Hugging Face.

## E6. Caméra et inférence TFLite

- `react-native-vision-camera` : MIT, version 5.2.3 du 2026-08-20, peer `react-native-nitro-modules` (source: https://registry.npmjs.org/react-native-vision-camera, vérifié le 2026-10-19).
- `react-native-fast-tflite` : MIT, version 3.0.1 du 2026-04-21 (six mois sans publication au 2026-10-19), peer `react-native-nitro-modules` (source: https://registry.npmjs.org/react-native-fast-tflite, vérifié le 2026-10-19).
- `expo-image-picker` (prise de photo simple) est déjà utilisé par Pécule et Tripagent en SDK 57 (source: D:\Mes Logiciels\02-Mobile-Desktop\Pecule\app\package.json).
