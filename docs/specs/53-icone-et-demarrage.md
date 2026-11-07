# Spec 53 — Icône de l'app et écran de démarrage tirés du logo

- **Date** : 2026-11-07
- **État** : **approuvée par Brainditech le 2026-11-07** (« vas-y et intègre-le », après le constat que le logo n'était appliqué nulle part). Règle : D138.
- **Branche** : `app/icone-logo`.
- **Case de PLAN.md** : phase 0 · « Icône de l'app et écran de démarrage tirés du logo » (nouvelle case ; preuve : capture de l'icône sur l'écran d'accueil du téléphone).
- **Sources** : logo validé le 2026-11-02 (`design/logo/logo.png`), `design/design-system.md` § Logo et jeton `primaire` (`#3730A3`). Doc Expo lue le 2026-11-07 : « Splash screen and app icon » (docs.expo.dev, modifiée le 2026-11-02), référence de `app.json` v58.0.0 (`icon`, `android.adaptiveIcon`), `expo-splash-screen` ~58.0.13 (options du plugin) ; recommandations Android sur les icônes adaptatives (canevas 108 dp, zone sûre ronde de 66 dp).

## 1. Constat

Le logo est validé depuis le 2026-11-02, mais rien dans l'app ne l'utilise. `app.json` pointe encore vers les images du modèle Expo : le « A » bleu d'Expo comme icône, l'icône adaptative Android sur fond `#E6F4FE`, l'écran de démarrage sur fond `#208AEF`, le favicon, et le dossier Icon Composer `assets/expo.icon` pour iOS.

Cause : la spec 00 (§1) rangeait « icône 1024 px tirée du logo » dans une spec 02 « Development build et NativeWind ». Le numéro 02 a servi au formulaire de repli, et la tâche n'a été reportée ni dans une autre spec ni dans une case de PLAN.md.

## 2. Ce qui change (D138)

1. **Symbole redessiné en vectoriel**, `design/logo/symbole.svg`, au lieu de recadrer l'image générée (bords flous, gris du fond). Ses proportions sont mesurées sur le logo validé, avec une hauteur de 275 unités :
   - rond de départ : diamètre 51, centre à 26 ;
   - trait plein : 18 de large, bouts arrondis, de 26 à 112 ;
   - deux points de diamètre 18, centres à 132 et 161 ;
   - trait plein : de 181 au rond d'arrivée ;
   - rond d'arrivée : diamètre 51, centre à 249.

   Le design system dit « point d'arrivée plus gros », mais sur le logo validé les deux ronds mesurent 51 px. On suit l'image validée.
2. **`scripts/generer-icones.py`** (Pillow, comme `generer-fond-carte.py`) dessine les images à partir de ces mêmes mesures. Le rendu se fait en 4x, puis l'image est réduite pour lisser les bords. Le même script refait toujours les mêmes images.
3. **Les images produites**, toutes en PNG :

   | Fichier | Taille | Contenu |
   |---|---|---|
   | `assets/images/icon.png` | 1024 | carré `primaire` plein, sans transparence ; symbole blanc à 79 % de la hauteur, comme sur le logo |
   | `assets/images/android-icon-foreground.png` | 1024 | fond transparent, symbole blanc de 531 px de haut (56 dp sur 108) : il reste dans la zone sûre de 66 dp quel que soit le masque |
   | `assets/images/android-icon-background.png` | 1024 | `primaire` plein |
   | `assets/images/android-icon-monochrome.png` | 1024 | même dessin que l'avant-plan : icône thématique d'Android 13 et plus |
   | `assets/images/splash-icon.png` | 1024 | fond transparent, symbole blanc sur toute la hauteur |
   | `assets/images/favicon.png` | 48 | petite icône : carré arrondi `primaire`, symbole blanc |

4. **`app.json`** :
   - `android.adaptiveIcon.backgroundColor` passe à `#3730A3` ;
   - écran de démarrage : `backgroundColor` passe à `#3730A3` et `imageWidth` à 100. Le symbole blanc fait alors 100 dp de haut, au centre de l'écran : blanc sur `primaire`, comme l'icône, en mode clair comme en mode sombre ;
   - la clé `ios.icon` et le dossier `assets/expo.icon` (icône Expo) sont retirés : iOS reprend `icon.png`. Android d'abord, mais aucune trace d'Expo ne doit rester.
5. Rien d'autre ne change : nom de l'app, paquet, écrans, mot « Itinhero ».

## 3. Options écartées

- Recadrer `design/logo/logo.png` : l'image est générée, avec des bords flous et un fond gris, et elle n'est pas assez grande pour une icône de 1024 px nette.
- Un écran de démarrage blanc avec le symbole en `primaire` : en mode sombre, Android peut assombrir le fond, et le symbole serait mal contrasté. Blanc sur `primaire` reste lisible partout et reprend l'icône.
- Le logo avec le nom sur l'écran de démarrage : l'API d'Android 12 n'affiche qu'une icône centrée, et un texte y serait rogné.
- Une dépendance de rendu SVG (sharp, resvg) : les formes sont simples, et Pillow sert déjà au fond de carte.

## 4. Critères d'acceptation

1. Le script produit les six images aux tailles du tableau. `icon.png` n'a aucun pixel transparent ; le symbole de l'avant-plan reste dans le disque de 66/108 du canevas (vérifié par le script).
2. `app.json` ne pointe plus vers aucune image du modèle Expo, et `assets/expo.icon` n'existe plus.
3. Lint, types et tests sont verts, et `npx expo-doctor` ne signale aucune erreur sur les icônes.
4. Sur le téléphone, après un nouveau build (`npx expo prebuild --platform android --clean` puis `npx expo run:android`, lancés par Brainditech) : l'icône de l'écran d'accueil montre le symbole blanc sur `primaire`, sans « A » d'Expo. Capture par adb dans `docs/screenshots/`. Brainditech juge le rendu.
5. L'écran de démarrage n'est visible fidèlement que sur un build de release (doc Expo). Il sera constaté avec la phase 11 ; d'ici là, seule l'icône prouve la case.
