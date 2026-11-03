# Issue 0001 — Le build Android échoue : chemin trop long pour ninja

> Ouverte le 2026-11-03. État : **analyse proposée, en attente de l'approbation de Brainditech.**
> Branche : `phase-1/fond-carte` (spec 03, premier development build).

## Reproduction

1. PC de Brainditech (Windows 11), projet dans `D:\Mes Logiciels\02-Mobile-Desktop\Itinhero`.
2. `npx expo run:android --device` (émulateur x86_64), ou directement `android\gradlew.bat app:assembleDebug -x lint -x test --configure-on-demand --build-cache -PreactNativeArchitectures=x86_64`.
3. Échec après environ 5 min :

```
Execution failed for task ':react-native-worklets:buildCMakeDebug[x86_64][worklets]'.
ninja: error: mkdir(CMakeFiles/worklets.dir/D_/Mes_Logiciels/02-Mobile-Desktop/Itinhero/node_modules/react-native-worklets/Common/cpp/worklets/SharedItems/Serializable): No such file or directory
```

Reproduit deux fois (terminal de Brainditech, puis Gradle seul lancé par Claude ; journal du 2026-11-03).

## Hypothèse (une seule)

Le dossier que ninja doit créer dépasse la limite `MAX_PATH` de Windows (260 caractères), et ninja ne sait pas la dépasser.

## Vérification

- Longueur du chemin complet : **261 caractères** (mesurée). Le chemin du projet y figure deux fois : une fois en tête, une fois recopié par CMake dans le nom du dossier objet (`D_/Mes_Logiciels/...`).
- Windows accepte les chemins longs (`LongPathsEnabled = 1`), mais le SDK Android ne fournit que CMake 3.22.1, avec **ninja 1.10.2**, qui ne s'en sert pas. Ninja ne gère les chemins longs sous Windows qu'à partir de la version 1.12.
- Le module en cause est `react-native-worklets` (dépendance de Reanimated), présent depuis la création de l'app. MapLibre n'y est pour rien : c'est le premier build natif du projet, donc le premier à compiler ce C++.

## Cause racine

Un chemin de projet long (`D:\Mes Logiciels\02-Mobile-Desktop\Itinhero`, 43 caractères), recopié deux fois, combiné à un ninja trop ancien pour les chemins longs.

## Correction proposée

**Construire depuis un lecteur virtuel court**, sans rien déplacer ni modifier dans le dépôt :

```
subst I: "D:\Mes Logiciels\02-Mobile-Desktop\Itinhero"
cd I:\
```

Le même chemin passe alors à **179 caractères** (mesuré).

- Avant le premier build depuis `I:`, supprimer les dossiers `.cxx` générés (ils mémorisent les anciens chemins). Ils sont recréés au build.
- `subst` disparaît au redémarrage du PC : à refaire avant chaque `npx expo run:android`. `npx expo start` (le JavaScript) marche aussi bien depuis `D:` que depuis `I:`.

Options écartées :
- Déplacer le projet vers un chemin court (`D:\Itinhero`) : marche aussi, mais change le dossier de travail de VS Code et de Claude Code.
- Installer une CMake récente (ninja 1.12) et l'imposer au build : demande de modifier `android/`, généré (CNG), donc un plugin de configuration ; plus lourd pour le même résultat.

## Test de régression

Pas de test automatisé possible (c'est la machine de build, pas le code). Preuve : `npx expo run:android` réussi depuis `I:\`, consigné dans ETAT. Si le build part un jour en CI (Linux), la question ne se pose pas.
