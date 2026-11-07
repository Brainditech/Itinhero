# Spec 54 — Le logo à la place du mot « Itinhero » dans les écrans

- **Date** : 2026-11-07
- **État** : **demandée et approuvée par Brainditech le 2026-11-07** (« il faut remplacer ça aussi et regarder au niveau design si ça rend bien »). Règle : D139. **Appliquée** le 2026-11-07, critères 1 à 3 constatés (§5).
- **Branche** : `app/logo-ecrans`.
- **Case de PLAN.md** : aucune ; suite de la spec 53 (le logo appliqué partout).
- **Sources** : logo validé le 2026-11-02 (`design/logo/logo.png`), `design/design-system.md` § Logo (« Logo + nom : symbole suivi de « Itinhero » en Inter 600, `primaire` sur blanc »), symbole de la spec 53 (`design/logo/symbole.svg`, `scripts/generer-icones.py`).

## 1. Constat

Après la spec 53, l'icône vient du logo, mais le haut de chaque écran affiche encore « Itinhero » en texte seul (`MotItinhero`, `src/composants/elements.tsx`). Le logo validé est le symbole suivi du nom.

## 2. Ce qui change (D139)

1. `scripts/generer-icones.py` produit aussi `assets/images/symbole-primaire.png` : le symbole seul en `primaire`, fond transparent, 30 × 160 px (net jusqu'à une densité de 5 pour 32 dp). Mêmes mesures que l'icône ; les autres images restent identiques.
2. `MotItinhero` affiche le symbole (32 dp de haut) puis « Itinhero » (inchangé : `titre-ecran`, Inter 600, `primaire`), centrés verticalement, espacés de 16 dp. Proportions relevées sur le logo validé : symbole ≈ 2 fois la hauteur des majuscules, écart ≈ la moitié du symbole.
3. Accessibilité : un seul élément « Itinhero », rôle titre ; l'image n'est pas lue à part.
4. Tous les écrans qui montraient le mot (Accueil, formulaire, Mes trajets, Assistant, Réglages, clé, configuration incomplète, écrans à venir) passent par ce composant : rien d'autre ne change.

## 3. Options écartées

- Afficher `design/logo/logo.png` recadré : image générée, bords flous, fond gris (même raison que la spec 53).
- Le logo + nom entier en une seule image : le texte serait moins net, ne suivrait pas l'agrandissement du texte du système et ne serait pas lu par TalkBack.
- Ajouter `react-native-svg` pour afficher `symbole.svg` : une dépendance native de plus (nouveau build) pour une forme fixe.

## 4. Critères d'acceptation

1. Le script produit `symbole-primaire.png` en 30 × 160 et ne modifie aucune autre image.
2. Lint, types et tests verts.
3. Sur le téléphone, le haut des écrans montre le symbole suivi de « Itinhero », aux proportions du logo validé. Capture par adb ; Brainditech juge le rendu.

## 5. Constaté (2026-11-07)

1. Script relancé : `symbole-primaire.png` 30 × 160 ; `git status` ne montre aucune autre image modifiée.
2. Lint et types sans erreur, 468 tests verts.
3. Captures par adb (rechargement par Metro, sans nouveau build) : `docs/screenshots/2026-11-07-spec54-accueil-v1.png`, `-mes-trajets.png`, `-assistant.png`, `-reglages.png`. Mesuré sur l'Accueil : symbole de 110 px pour des majuscules de 60 px (1,8), écart de 59 px (0,54 du symbole), centres alignés ; logo validé : 2,0 et 0,55. Lisible sur le fond de carte de l'Accueil comme sur `surface`.
