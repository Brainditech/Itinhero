# Spec 46 — Champ de l'Assistant sur plusieurs lignes, onglets sans surbrillance

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (D119 : « plan et implémente tout ça »). Règle : D127. **Appliquée** et constatée sur le téléphone le 2026-11-06 (critères 1 à 5, captures `docs/screenshots/46-*.png`, non versionnées).
- **Branche** : `fin/bugs-et-voyage-complet` (PR #61).
- **Case de PLAN.md** : aucune ; demande consignée dans `docs/ETAT.md` (« champ de l'Assistant sur plusieurs lignes, onglets sans surbrillance bleue »).
- **Invariants** : aucun calcul ni donnée touchés ; affichage seulement.

## 1. But

Demande de Brainditech (2026-11-06) :

1. « La zone de texte doit être non pas sur une ligne mais une vraie zone de texte pour l'Assistant : ça doit descendre à la ligne à chaque fois. »
2. Barre d'onglets, d'Accueil à Réglages : « pas de zone bleue » ; l'onglet choisi n'a pas de surbrillance bleue qui dépasse, seule son **icône est colorée**. Précisé le 2026-11-06 en voyant la première version : « icône et le texte en surbrillance, pas juste l'icône ».

## 2. Ce qui change

### 2.1 Champ de l'Assistant

1. Le champ passe à la ligne tout seul quand le texte dépasse la largeur, et la touche Entrée du clavier ajoute une ligne (elle n'envoie plus).
2. Il grandit avec le texte jusqu'à **5 lignes** (hauteur bornée), puis défile à l'intérieur.
3. On envoie avec le bouton « Envoyer » seulement.
4. La pilule devient un rectangle aux coins arrondis (`rounded-carte`) ; le trombone et le bouton restent **en bas** du champ, à côté de la dernière ligne.
5. Limite de 1 000 caractères inchangée.

### 2.2 Barre d'onglets

1. L'onglet choisi n'a plus de fond (`bg-primaire-doux` retiré) : rien ne dépasse autour de lui.
2. Son icône **et** son libellé sont en couleur primaire, le libellé en demi-gras (précision de Brainditech du 2026-11-06).
3. Les onglets non choisis : icône et libellé en `texte-secondaire`, comme avant.

## 3. Ce qui ne change pas

Ordre, icônes et libellés des onglets, comportement des appuis (spec 34), barre masquée quand le clavier est ouvert, envoi, arrêt, pièces jointes (spec 45).

## 4. Critères d'acceptation

1. Assistant : un texte plus long qu'une ligne s'affiche sur plusieurs lignes dans le champ.
2. Entrée ajoute une ligne ; le message n'est pas envoyé.
3. Au-delà de 5 lignes, le champ ne grandit plus.
4. Le bouton « Envoyer » envoie le texte, sauts de ligne compris.
5. Barre d'onglets : l'onglet choisi n'a aucun fond coloré ; son icône et son libellé sont colorés.

## 5. Preuve

Captures adb dans `docs/screenshots/46-*.png` (non versionnées, D38), puis lint, types et tests.
