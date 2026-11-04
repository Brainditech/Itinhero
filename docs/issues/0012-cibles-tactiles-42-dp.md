# Issue 0012 — Les cibles tactiles « 48 dp » mesurent 42 dp sur le téléphone

- **Date** : 2026-11-04
- **État** : cause racine vérifiée ; **correction à approuver par Brainditech** (elle change toutes les tailles de l'app).

## 1. Reproduction

Téléphone de Brainditech (1440 × 3200, densité 560, soit 3,5 px par dp), development build de la spec 13. `adb shell uiautomator dump` sur le formulaire :

- icônes « Mettre Domicile en départ » et « Mettre Ma position en départ » : 147 × 147 px, soit **42 dp** ;
- bouton ⇅ « Échanger le départ et l'arrivée » : 146 × 147 px, soit **42 dp**.

La spec 13 (§4.1) demande « 48 dp au moins », et le design system fixe le bouton principal à 56 dp.

## 2. Cause racine (vérifiée)

Ces éléments utilisent `h-12 w-12` (et `min-h-12`, `min-h-14`). En Tailwind, `h-12` vaut `3rem`. NativeWind 4 convertit `rem` avec `inlineRem`, qui vaut **14 par défaut** (`node_modules/nativewind/dist/metro/index.js`, ligne 14 : `inlineRem = 14`). `metro.config.js` ne le change pas. Donc :

- `h-12` = 3 × 14 = **42 dp** (attendu 48) ;
- `min-h-14` = 3,5 × 14 = **49 dp** (attendu 56, bouton principal) ;
- tous les espacements en `rem` (`p-4`, `gap-3`, etc.) font 14/16 de la valeur du design system.

Les tailles de texte, les rayons et les couleurs viennent de `src/theme/jetons.js` en `px` : ils ne sont pas touchés.

## 3. Corrections possibles (à trancher)

1. **`inlineRem: 16` dans `metro.config.js`** (recommandé) : toutes les classes reprennent la valeur du design system (`h-12` = 48 dp, `min-h-14` = 56 dp, `p-4` = 16 dp). Effet : tous les écrans prennent environ 14 % d'espace en plus. Il faut revoir à l'œil l'Accueil, le formulaire, la Confirmation et le Résultat contre les maquettes. Le cache Metro doit être vidé une fois (`npx expo start --clear`, lancé par Brainditech).
2. Corriger seulement les cibles tactiles en valeurs explicites (`h-[48px] w-[48px]`, `min-h-[56px]`). C'est local, mais le reste des espacements reste à 14/16 et l'écart reviendra à chaque nouvelle classe.

## 4. Test de régression prévu

Pas de test vitest possible (rendu natif). Contrôle à chaque PR d'écran : `adb shell uiautomator dump`, puis largeur et hauteur en px ÷ 3,5 ≥ 48 pour chaque élément cliquable. Le contrôle est écrit dans la spec de l'écran.
