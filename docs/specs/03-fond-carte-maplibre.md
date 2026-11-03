# Spec 03 — Vraie carte MapLibre en fond de l'Accueil

> Rédigée le 2026-11-02. État : **approuvée par Brainditech le 2026-11-02 (« implémente »), appliquée ; critères 1 à 6 constatés le 2026-11-03.**
> Branche : `phase-1/fond-carte` (elle porte aussi D35 : fond inventé, puces en 14 sp). Une seule PR.
> Décisions liées : D9 (révisée par D36), D37 (attribution repliable, 2026-11-03), D34 (point 3 : development build), D35, A8, R8, R9, R12.

## 1. But

Derrière l'Accueil, une vraie carte claire du couloir Brienon–Saint-Florentin–Joigny, nette sur le téléphone, à la place de l'image inventée. Brainditech l'a demandé le 2026-11-02, après la capture de l'image sombre voilée (« la photo n'est pas très claire »).

Cases de PLAN.md touchées :
- Phase 0 · « Development build (`expo-dev-client`, `npx expo run:android`) » (preuve : capture de l'app en development build).
- R12, pour MapLibre : levé ou non au build.

## 2. Décisions

1. **D36 (révise D9).** La carte MapLibre sert à deux endroits : la carte du trajet (Détail, phase 4, inchangée) et un **fond qu'on manipule aux doigts** derrière l'Accueil et ses écrans de pile (formulaire). Le design system passe de « image fixe, aucune attribution » à « vraie carte, attribution visible ».
2. **Development build.** `npx expo install expo-dev-client @maplibre/maplibre-react-native` (constaté sur npm le 2026-11-02 : MapLibre RN 11.5.1, compatible `expo >= 54` et `react-native >= 0.80` ; expo-dev-client 58.0.18). Plugin `@maplibre/maplibre-react-native` ajouté à `app.json`. La doc l'écrit : « This package can't be used with "Expo Go" ».
   - **Conséquence pour Brainditech : Expo Go ne suffit plus.** Il lance `npx expo run:android` une fois (Android Studio et SDK Android nécessaires sur le PC), puis `npx expo start` comme avant ; l'app se recharge comme avec Expo Go. Claude ne lance rien (règle absolue).
   - Les dossiers `android/` et `ios/` sont générés (CNG) et restent hors de git (`.gitignore` vérifié).
3. **Tuiles et style : OpenFreeMap « Positron »** (style clair et gris), `https://tiles.openfreemap.org/styles/positron`.
   - L'URL vient de `EXPO_PUBLIC_TUILES_URL` (PLAN §3, déjà dans `.env.example`), que **Brainditech** remplit dans son `.env`. Variable absente ⇒ pas de carte, fond inventé à la place (point 6), et avertissement en développement.
   - Conditions constatées le 2026-11-02 sur openfreemap.org : pas de limite de vues ni de requêtes, usage commercial permis, « Attribution is required », « MapLibre adds it automatically ». Les conditions d'utilisation complètes sont à lire avant la fusion (R8).
   - Écarté pour cette PR : un style à nos couleurs (copie de Positron recolorée avec les jetons). Il pourra venir si Positron ne suffit pas à l'œil.
4. **Cadrage de départ, sans aucune donnée personnelle.** À l'ouverture, la carte est centrée sur le couloir (environ 47,98 N, 3,56 E), à un zoom réglé à l'œil pour voir Brienon, Saint-Florentin et Joigny. Ni Domicile, ni position, ni permission de localisation.
5. **Interactive, demandé par Brainditech le 2026-11-02** (« je veux que la map derrière puisse bouger avec les doigts ») : on la fait glisser (`dragPan`) et on zoome en pinçant (`touchZoom`). La rotation et l'inclinaison restent coupées (`touchRotate`, `touchPitch` à `false`) : un débutant perdrait le nord.
   - **Mise en page** : les éléments de l'Accueil flottent au-dessus de la carte sans la couvrir. Le contenu (mot « Itinhero », carte de saisie) ne prend que sa hauteur, en haut ; le lien « Remplir un formulaire à la place » est **dans la carte de saisie**, en bas (demandé par Brainditech le 2026-11-03 : posé sur la carte MapLibre, il se perdait parmi les noms de villages) ; le bouton « Chercher » et la barre d'onglets restent en bas. Toute la zone vide entre les deux appartient à la carte (`pointerEvents="box-none"` sur les conteneurs). Le contenu ne défile plus : il tient sur l'écran. Si le texte agrandi par le système le fait déborder, on le constate sur le téléphone et on corrige.
   - Toucher la carte ferme le clavier.
   - TalkBack ignore la carte (décorative pour une personne qui ne voit pas), sauf l'attribution.
   - Les noms exacts des props (attribution, logo, caméra) sont relus dans les types de la version installée avant d'écrire le composant.
   - Écarté : la carte fixe de la première version de cette spec (Brainditech : « on ne peut pas la faire défiler »).
6. **L'image inventée (D35) reste dessous en secours.** Hors connexion, pendant le chargement des tuiles, si `EXPO_PUBLIC_TUILES_URL` manque, ou **dans Expo Go** (ajout du 2026-11-02 : l'import de MapLibre y plantait l'app, « 'MLRNCameraModule' could not be found » ; MapLibre n'est chargé que hors Expo Go, détecté par `Constants.executionEnvironment`), on voit la carte inventée au lieu d'un fond vide. Aucun état « en direct » n'est affiché (invariant 12 non concerné).
7. **Attribution visible et touchable**, **en haut à droite**, à la hauteur du mot « Itinhero » : en bas, la barre d'onglets et le bouton la cacheraient. Elle est posée au-dessus du voile.
   - **Écart constaté à l'application (2026-11-02)** : l'attribution native de MapLibre est dessinée dans la carte, donc **sous** le voile. Elle est coupée (`attribution={false}`, `logo={false}`) et remplacée par `AttributionCarte` : « © OpenFreeMap · OpenMapTiles / © OpenStreetMap », 12 sp (exception « attribution de carte » du design system), qui ouvre `https://www.openstreetmap.org/copyright`.
   - **Repliable (D37, demandé par Brainditech le 2026-11-03)** : au lancement, « © OpenMapTiles © OpenStreetMap » (une ligne, sans OpenFreeMap) ; elle se replie en un bouton ⓘ au premier geste de l'utilisateur sur la carte (`onRegionWillChange` avec `userInteraction`, ou `onPress`) ou après 5 secondes ; toucher ⓘ la rouvre (elle se replie de nouveau après 5 secondes). Règles de l'OSMF lues le 2026-11-03 : repli permis après une interaction ou 5 secondes, ⓘ seul dès le départ interdit.
8. **Voile.** Le jeton `voile` reste ; sa valeur est réglée à l'œil sur le téléphone. On part de **0,3** : Positron est déjà clair, et une carte qu'on manipule doit rester lisible. Le voile ne bloque pas les touchers.
9. **Échec du build (R12).** Si MapLibre 11.5.1 ne compile pas ou plante avec le SDK 58, on ouvre `docs/issues/` (règle des bugs) ; l'Accueil garde le fond inventé, déjà fonctionnel.

## 3. Fichiers touchés

| Fichier | Changement |
|---|---|
| `package.json`, `package-lock.json` | `expo-dev-client`, `@maplibre/maplibre-react-native`. |
| `app.json` | Plugin `@maplibre/maplibre-react-native`. |
| `src/composants/FondCarte.tsx` | Image inventée, puis carte MapLibre (glisser, pincer), puis voile ; attribution en haut à droite. |
| `src/app/(onglets)/index.tsx` | Conteneurs en `box-none`, contenu à sa hauteur (plus de défilement plein écran), toucher la carte ferme le clavier. |
| `src/theme/jetons.js` | `voile` à 0,3, à régler à l'œil. |
| `docs/decisions/0001-cadrage-v1.md` | D36. |
| `design/design-system.md` | « Fond d'écran » : vraie carte, attribution, image inventée en secours. |
| `docs/architecture.md` | Ligne « Tuiles OpenFreeMap ◄─ app » : fond de l'Accueil en plus de la carte du Détail. |
| `PLAN.md`, `docs/ETAT.md` | Case « Development build », R12 (MapLibre), avec leur preuve. |

## 4. Source de chaque valeur affichée

| Valeur | Source |
|---|---|
| Carte | tuiles OpenFreeMap (données OpenStreetMap), style Positron |
| Centre et zoom de départ | cette spec (couloir de D1) ; ensuite, ceux que l'utilisateur choisit aux doigts |
| Attribution | texte fixe de `AttributionCarte` (D37) : OpenMapTiles et OpenStreetMap |
| Fond de secours | `assets/images/fond-carte.png` (D35) |

## 5. Sécurité et vie privée

- Les tuiles sont demandées par l'app directement à OpenFreeMap, comme le prévoit déjà le Détail (architecture). L'invariant 2 ne liste pas les tuiles.
- La zone demandée est fixe : OpenFreeMap reçoit l'adresse IP du téléphone, mais aucune information sur le trajet, le domicile ou la position.
- `EXPO_PUBLIC_TUILES_URL` n'est pas un secret. Claude ne lit ni n'écrit `.env` : Brainditech la remplit.

## 6. Critères d'acceptation

1. L'app tourne en development build sur le téléphone de Brainditech. *(capture, case phase 0)*
2. Derrière l'Accueil, la carte du couloir est nette et claire, sous le voile ; on reconnaît l'Yonne. *(capture)*
3. Glisser un doigt sur la zone vide déplace la carte ; pincer zoome ; deux doigts qui tournent ne la font pas pivoter. Le champ, les puces, le lien et « Chercher » marchent comme avant, et toucher la carte ferme le clavier. *(constat de Brainditech)*
4. Au lancement, l'attribution est lisible en haut à droite et s'ouvre au toucher ; elle se replie en ⓘ au premier geste sur la carte ou après 5 secondes ; toucher ⓘ la rouvre. *(captures dépliée et repliée)*
5. En mode avion, l'Accueil s'affiche sans erreur, avec la carte gardée en mémoire ou, à défaut, l'image de secours. *(capture)* (Corrigé le 2026-11-03 avec l'accord de Brainditech : en mode avion, MapLibre affiche les tuiles déjà vues, gardées en cache.)
6. `npx expo lint`, `npx tsc --noEmit`, `npm test` et `npx expo-doctor` sont verts.

## 7. Vérification

```bash
npx expo lint
npx tsc --noEmit
npm test
npx expo-doctor
```

Puis Brainditech remplit `EXPO_PUBLIC_TUILES_URL`, lance `npx expo run:android`, et envoie les captures des critères 1, 2, 4 et 5.
