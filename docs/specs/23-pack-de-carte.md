# Spec 23 — Pack de carte : la carte de la zone du trajet, gardée sans réseau

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (« fait les vérifications et teste puis implemente la phase suivante », 2026-11-06), comme les specs 19 et 22. Règle : D99.
- **Branche** : `phase-5/pack-carte`.
- **Case de PLAN.md** : phase 5, « Pack de carte de la zone du trajet ». Preuve : carte affichée en mode avion.
- **Invariants** : 6 (les zones du voyage restent sur le téléphone ; seul OpenFreeMap voit quelles tuiles sont demandées, comme quand on regarde la carte), 9 (les métadonnées relues des packs passent par un schéma Zod), 10 (aucune zone ni coordonnée dans les journaux), 20 (jetons du design system seulement).

## 1. But

D9 promet une carte « hors ligne de la zone du trajet à l'enregistrement » : un débutant doit faire 2,8 km à pied, peut-être sans réseau. Depuis la spec 22, le voyage enregistré se rouvre sans réseau, mais la carte de l'Étape et du Guidage n'affiche que les tuiles déjà vues par hasard (cache de MapLibre, constaté le 2026-11-06). Une marche jamais regardée avant le départ reste blanche.

## 2. Doc lue

- **MapLibre React Native 11.5.1** installé (`node_modules/@maplibre/maplibre-react-native/src/modules/offline/OfflineManager.ts`, `OfflinePack.ts`) : `OfflineManager.createPack({ mapStyle, bounds: [ouest, sud, est, nord], minZoom, maxZoom, metadata }, progression, erreur)`, `getPacks()`, `deletePack(id)`, `pack.status()` (`state` : `inactive` / `active` / `complete`, `percentage`, `completedResourceSize`), `pack.resume()`, `pack.pause()`. Le module natif est déjà dans le development build.
- **MapLibre Android** (`MLRNTransformRequestModule.kt`) : les tuiles passent par OkHttp ; `HttpRequestUtil.setOkHttpClient` remplace le client ; le module de React Native fixe 20 requêtes par serveur et n'offre aucun réglage JavaScript du nombre de requêtes. MapLibre Native 13.6.1, OkHttp 4.12.0 (`android/gradle.properties` du paquet).
- **Tuiles OpenFreeMap** (`https://tiles.openfreemap.org/planet`, lu le 2026-11-06) : tuiles vectorielles jusqu'au **zoom 14** ; au-delà, MapLibre agrandit celles du zoom 14.
- **Conditions d'OpenFreeMap** (`openfreemap.org/tos`, mises à jour le 2026-10-14, lues le 2026-11-06) : « Your app may let users download areas for offline use if each download is: at most 3,000 tiles or 50 MB; made with at most 4 parallel requests; sent with a unique User-Agent identifying your app. »
- **Modules natifs locaux Expo** (docs.expo.dev/modules/get-started, module-api, module-config, lus le 2026-11-06) : `npx create-expo-module@58.0.3 --local`, dossier `modules/`, relié automatiquement ; `Function("nom") { … }` en Kotlin ; un module natif demande un nouveau development build.

## 3. Décision D99

1. **Quand** : juste après « Enregistrer ce voyage » réussi, l'app télécharge la carte de la zone du voyage. Rien n'est téléchargé sans enregistrement.
2. **Quelle zone** (`src/domaine/pack-carte.ts`, testé) : tous les points du voyage (aller et retour, toutes les possibilités, tracés, arrêts, départ et arrivée).
   - **Une zone d'ensemble** : la boîte de tous les points, agrandie de 1 km, du zoom 5 au plus grand zoom (8 à 13) qui tient dans le budget.
   - **Des zones de détail** là où l'on marche et où l'on attend : chaque marche (son tracé) et chaque lieu de montée ou de descente, agrandis de 500 m, du zoom 12 au zoom 14 ; les boîtes qui se touchent sont fusionnées.
   - **Budget** : au plus **1 000 tuiles par zone** (OpenFreeMap en permet 3 000 ; la marge tient aussi les 50 Mo). Une zone de détail trop grande perd d'abord le zoom 12, puis le 13 ; si elle dépasse encore, elle est laissée (la zone d'ensemble la couvre).
   - Chaque zone est un pack MapLibre, donc un téléchargement au sens d'OpenFreeMap. Les packs se téléchargent l'un après l'autre.
3. **Conditions d'OpenFreeMap** tenues par un petit module natif local (`modules/reseau-carte`) : au lancement, le client OkHttp de MapLibre est remplacé par un client à **4 requêtes au plus par serveur**, qui envoie le User-Agent **« Itinhero/<version> (Android) »**. Taille : un pack qui dépasse 50 Mo est arrêté et supprimé (« Carte trop lourde »). Sans ce module (ancien build) ou sans carte (Expo Go, style absent), aucun pack n'est téléchargé et rien n'en parle à l'écran.
4. **Ce que voit le débutant** :
   - **Résultat**, sous « Enregistré dans Mes trajets » : « Carte : téléchargement… 42 % », puis « Carte enregistrée » (coche verte) ; en cas d'échec, « La carte n'a pas pu être enregistrée. » et le lien « Réessayer ».
   - **Mes trajets** (maquette 06), sous « Disponible sans réseau » : « Carte enregistrée » (coche verte) quand tous les packs du voyage sont complets ; « Carte : téléchargement… N % » pendant ; sinon « Carte pas encore enregistrée » avec le lien « Enregistrer la carte » (voyage enregistré sans réseau, app fermée pendant le téléchargement, échec).
5. **Un voyage, ses packs** : chaque pack porte `{ voyage: <clé du voyage>, version: 1 }`. Enregistrer de nouveau le même voyage supprime ses anciens packs avant d'en créer d'autres ; « Supprimer » le voyage supprime aussi ses packs. Les tuiles communes à plusieurs voyages ne sont téléchargées qu'une fois (base de MapLibre).
6. **Rien à régler** pour l'Étape et le Guidage : MapLibre lit d'abord sa base hors ligne ; les cartes existantes s'affichent sans réseau.

**Écarté** :
- Une seule boîte du zoom 5 au zoom 14 : Brienon → Joigny tient (environ 300 tuiles), mais un voyage Toulouse → Paris en demanderait plus de 100 000.
- Packs de toute l'Yonne ou d'un département : trop lourd, et hors de ce que permet OpenFreeMap sans accord.
- Laisser les 20 requêtes de MapLibre : contraire aux conditions d'OpenFreeMap.
- Un plugin de configuration qui réécrit `MainApplication.kt` : plus fragile qu'un module local, et les dossiers natifs ne se touchent pas à la main.
- Télécharger aussi les zooms 15 à 17 : OpenFreeMap n'en a pas ; MapLibre agrandit le zoom 14.
- Une table SQLite pour l'état de la carte : la base de MapLibre le sait déjà (`getPacks`, `status`).

## 4. Ce qui est construit

- `src/domaine/pack-carte.ts` (TypeScript pur, testé) :
  - `tuilesBoite(boite, zoom)`, `tuilesZone(zone)` : nombre de tuiles ;
  - `agrandir(boite, metres)`, `fusionner(boites)` ;
  - `zonesVoyage(voyage)` ⇒ les zones du §3.2 (`{ bornes, zoomMin, zoomMax, tuiles }`) ;
  - `lireMetaPack(metadata)` ⇒ `{ voyage, version }` ou `null` (Zod) ;
  - `etatCarte(statuts, attendus)` ⇒ `absente` / `enCours` (pourcentage) / `enregistree`.
- `modules/reseau-carte/` : module Expo local, Android seulement : `configurer(userAgent, requetesParServeur)`.
- `src/carte/packs.ts` : `cartePossible()`, `enregistrerCarte(cle, voyage, progression)`, `etatCarteVoyage(cle)`, `supprimerCarte(cle)`.
- `src/composants/carte-module.ts` : appelle `configurer` au chargement.
- `resultat.tsx`, `mes-trajets.tsx` : les lignes du §3.4.

## 5. Critères d'acceptation

1. **Tests du domaine** (`src/domaine/pack-carte.test.ts`), rouges avant le code :
   - nombre de tuiles d'une boîte connue à un zoom connu ;
   - Brienon → Joigny (exemple du dépôt) : une zone d'ensemble et des zones de détail autour des marches ; chaque zone ≤ 1 000 tuiles ; aucune zone au-delà du zoom 14 ;
   - un voyage très étendu (Brienon → Dijon) : la zone d'ensemble descend de zoom pour tenir le budget ;
   - deux marches proches ⇒ une seule zone de détail fusionnée ;
   - métadonnées illisibles ou d'une autre forme ⇒ `null` ;
   - état : aucun pack ⇒ `absente` ; un pack actif ⇒ `enCours` avec le pourcentage d'ensemble ; tous complets ⇒ `enregistree` ; un pack manquant ⇒ pas `enregistree`.
2. **Téléphone** (adb, après le nouveau development build de Brainditech) :
   - « Enregistrer ce voyage » ⇒ « Carte : téléchargement… » puis « Carte enregistrée » ; même ligne dans Mes trajets ;
   - User-Agent et 4 requêtes : le serveur de tuiles n'est pas le nôtre, ses journaux ne se lisent pas ; constat par lecture du code (`ReseauCarteModule.kt`) et par `PACKS_POSSIBLES` vrai dans l'app (le module a répondu) ;
   - mode avion, app fermée puis rouverte, cache ambiant de MapLibre vidé avant l'essai : l'Étape d'une marche jamais affichée montre sa carte (rues et noms) ;
   - « Supprimer » le voyage ⇒ ses packs disparaissent (`getPacks`).
   Captures dans `docs/screenshots/spec-23/` (D93).
3. `npx expo lint`, `npx tsc --noEmit`, `npm test` **verts** ; `npx expo export --platform android` réussi.

## 6. Constats

### 6.1 Code (2026-11-06)

- `src/domaine/pack-carte.test.ts` rouge avant `pack-carte.ts` (module absent), puis 18 tests verts. Deux attentes du test étaient fausses, pas le code : le nombre de tuiles calculé à la main (4 × 5 et non 3 × 4 : x de 8355 à 8358, y de 5693 à 5697 au zoom 14), et le voyage court qui gardait son arrivée à Dijon.
- App : 310 tests, `npx expo lint` et `npx tsc --noEmit` verts ; `npx expo export --platform android` réussi.
- `modules/reseau-carte` : `create-expo-module@58.0.3 --local` attendait une réponse au clavier ; module écrit à la main sur le modèle d'`expo-keep-awake` (`expo-module.config.json`, `build.gradle`, Kotlin). Pas de `package.json` : l'autolinking d'Expo prend un dossier de `modules/` sans lui (`expo-modules-autolinking`, `scanning.js`). Gradle le voit (`:reseau-carte`) et `./gradlew :reseau-carte:compileDebugKotlin` réussit (sans construire ni lancer l'app).
- MapLibre 11.5.1 (Android) : `createPack` lance le téléchargement ; une erreur réseau n'arrête pas le pack (MapLibre réessaie) ; le tout premier état d'un pack n'est pas envoyé. D'où, dans `src/carte/packs.ts` : écouteurs posés dès la création, état relu toutes les 1,5 s, pause du pack sur erreur (« Réessayer » le reprend).

### 6.2 Téléphone, ancien development build (2026-11-06, adb)

- Le build installé n'a pas le module : Mes trajets et le Résultat s'affichent comme avant, sans ligne « Carte » ni plantage (`docs/screenshots/spec-23/2026-11-06-01`).
- **Reste à faire** : nouveau development build par Brainditech (module natif ajouté), puis le critère 2. **Case non cochée** jusque-là.

## 7. Ce qui n'est pas fait ici

- **Rappels locaux** et appels à passer : cases suivantes de la phase 5 (`expo-notifications`).
- **Mettre à jour** une carte enregistrée (nouvelle version d'OpenFreeMap) : `invalidatePack` plus tard, si besoin.
- **iOS** : le module local est Android seulement (Android d'abord).
