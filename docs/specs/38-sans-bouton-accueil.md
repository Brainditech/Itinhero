# Spec 38 — Plus de bouton « Aller à l'Accueil »

- **Date** : 2026-11-06
- **État** : **approuvée** par Brainditech (« ok vas y implemente tout ça », 2026-11-06). Règle : D116.
- **Branche** : `app/sans-bouton-accueil`.
- **Case de PLAN.md** : aucune ; demande consignée dans `docs/ETAT.md` (« vire les gros boutons Aller à l'Accueil »).
- **Invariants** : aucun calcul ni donnée touchés ; affichage seulement.

## 1. But

Demande de Brainditech (2026-11-06) : « vire les gros boutons Aller à l'Accueil, que ce soit sur Trajet ou bien dans Assistant ».

Aujourd'hui, sans recherche en cours, deux écrans montrent un gros bouton « Aller à l'Accueil » :

- onglet **Trajet** (spec 34 §3.4, D112) : « Aucun trajet pour l'instant. », « Écrivez sur l'Accueil où vous devez être, et quand. », puis le bouton ;
- onglet **Assistant** (spec 37 §3.2, D115) : « Aucune recherche en cours. Faites d'abord une recherche depuis l'Accueil. », puis le bouton.

L'onglet Accueil (maison) est toujours visible en bas de l'écran et fait déjà la même chose ; le bouton fait doublon.

## 2. Ce qui change

1. Trajet sans recherche : la carte garde ses deux phrases, sans bouton.
2. Assistant sans recherche : la carte garde sa phrase, sans bouton.
3. La fonction `allerALAccueil` reste : la barre d'onglets et « Modifier la recherche » s'en servent.
4. Spec 34 (critère 5) et spec 37 (§3.2) sont annotées « bouton retiré par la spec 38 » ; D112 et D115 renvoient à la nouvelle décision D116.

## 3. Ce qui ne change pas

L'onglet Accueil de la barre, « Modifier la recherche », les écrans avec une recherche en cours.

## 4. Critères d'acceptation

1. App ouverte sans recherche, onglet Trajet : « Aucun trajet pour l'instant. » et la phrase, aucun bouton.
2. Même chose dans l'onglet Assistant : la phrase, aucun bouton.
3. Toucher l'onglet Accueil depuis l'un ou l'autre ramène à la première page.

## 5. Preuve

Captures adb des deux écrans dans `docs/screenshots/`, puis lint, types et tests.
