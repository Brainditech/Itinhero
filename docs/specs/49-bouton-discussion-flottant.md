# Spec 49 — Bouton de discussion flottant sur le Trajet

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (D119 ; demande du 2026-11-06 : « à toi de décider si ça renvoie vers l'Assistant ou bien que ça ouvre une fenêtre popup spéciale »). Règle : D130. **Appliquée** et constatée sur le téléphone le 2026-11-06 (critères 1 à 4, captures `docs/screenshots/49-*.png`, non versionnées).
- **Branche** : `fin/bugs-et-voyage-complet` (PR #61).
- **Case de PLAN.md** : aucune ; demande consignée dans `docs/ETAT.md` (« bouton de discussion flottant en bas à droite du Trajet »). Modifie la spec 45 (bouton « Discuter de ce trajet » en bas de la page).
- **Invariants** : aucun calcul ni donnée touchés ; affichage seulement.

## 1. But

Demande de Brainditech (2026-11-06) : « le chat doit être décalé en bas à droite, comme la roue crantée qui est toujours disponible sur l'app ; pas un texte « Discuter de ce trajet » tout en bas, mais décalé en bas à droite ».

Aujourd'hui (spec 45), le bouton « Discuter de ce trajet » est au bout de la page du Résultat : il faut tout faire défiler pour le trouver.

## 2. Ce qui change (D130)

1. Sur le Résultat, un **bouton rond flottant** de 56 dp, fond primaire, icône du robot de l'Assistant en blanc, posé **en bas à droite**, juste au-dessus de la barre d'onglets. Il reste à sa place quand la page défile.
2. TalkBack le lit « Discuter de ce trajet avec l'Assistant ».
3. Le toucher **ouvre l'onglet Assistant** sur une nouvelle discussion à propos du trajet en cours, comme le bouton de la spec 45 (question envoyée d'office, discussion gardée dans l'Historique, spec 48).
4. Le bouton texte « Discuter de ce trajet » du bas de la page est retiré.
5. La page garde de la place sous son dernier élément pour que le bouton ne cache jamais « Modifier la recherche ».
6. Le bouton n'apparaît que sur le Résultat d'une recherche (pas sur « Aucun trajet pour l'instant », ni sur l'Étape ou le Guidage, qui ont leurs propres boutons du bas).

## 3. Options écartées

- **Fenêtre surgissante de discussion au-dessus du Trajet** : une seconde discussion à côté de celle de l'Assistant (deux historiques, ou un seul partagé entre deux écrans), et sur un téléphone le clavier ouvert couvre de toute façon le trajet. Ouvrir l'Assistant garde un seul endroit pour discuter, avec l'Historique.
- Bouton sur chaque écran de l'onglet Trajet : l'Étape et le Guidage ont déjà des boutons en bas à droite et à gauche.

## 4. Remarque

La roue crantée grise en haut à droite visible pendant les essais est le bouton « Tools » de l'app de développement (Expo) : elle n'existe pas dans l'app finale. Le bouton flottant d'Itinhero est, lui, dans l'app finale.

## 5. Critères d'acceptation

1. **Téléphone** : Résultat d'une recherche ⇒ le bouton rond en bas à droite, au-dessus de la barre d'onglets ; il ne bouge pas quand la page défile.
2. **Téléphone** : en bas de la page, « Modifier la recherche » reste visible et touchable, sans bouton texte « Discuter de ce trajet ».
3. **Téléphone** : le toucher ouvre l'Assistant, qui répond sur ce trajet.
4. **Téléphone** : onglet Trajet sans recherche ⇒ pas de bouton.

## 6. Preuve

Captures adb `docs/screenshots/49-*.png` (non versionnées, D38), lint, types, tests.
