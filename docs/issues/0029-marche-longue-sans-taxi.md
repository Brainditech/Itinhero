# Issue 0029 — L'écran Étape d'une marche longue ne propose pas le taxi

- **Trouvée** le 2026-11-07 par Claude, en constatant la case « Annuaire validé, avertissement ⚠ au-delà de 15 min de marche » (spec 41, critère 6), à la demande de Brainditech (« ce que tu peux faire, fais-le tout »).
- **État** : corrigée (analyse et correction par délégation, comme les issues 0023 à 0028).

## 1. Reproduction

Accueil, « jeudi 10h RDV à Joigny », Domicile ⇒ Joigny 89300 ⇒ Résultat. Premier trajet (06:18 → 08:04), carte « Marche de plus de 15 min ». « Voir les étapes », puis la marche « 48 min, 3,4 km jusqu'à la gare de Saint-Florentin - Vergigny » : l'écran Étape montre la carte et les consignes, **sans** « Marche de 48 min : un taxi peut faire cette étape. », sans Uber, sans « Numéros de taxi près du départ » (`docs/screenshots/2026-11-07-etape-marche-longue.png`, non versionnée, D93).

## 2. Hypothèse

Le bloc de la spec 41 n'est jamais rendu pour une marche.

## 3. Cause racine

Confirmée en lisant le code : dans `src/app/(onglets)/(trajet)/etape.tsx`, `TaxiPourLaMarche` et le lien Uber étaient placés dans `ListeVehicule`. Or une marche passe par `ListeMarche` (`marche ? <ListeMarche …/> : <ListeVehicule …/>`) : la condition `etape.mode === "marche"` ne pouvait jamais être vraie là où elle était.

## 4. Correction

- `estMarcheLongue(etape)` dans `src/domaine/resultat.ts` : une seule règle (marche de plus de 15 min, D3) pour la carte du Résultat (`aMarcheLongue`), le lien Uber (`lienUber`) et l'écran Étape.
- `ListeMarche` affiche `TaxiPourLaMarche` en tête de la liste (avertissement, « Commander un Uber pour cette étape », numéros près du départ), aussi quand la marche n'a pas de consignes.
- La ligne morte de `ListeVehicule` est retirée.

## 5. Test de régression

`src/domaine/resultat.test.ts` : « issue 0029 : l'écran Étape d'une marche de plus de 15 min propose le taxi (spec 41) » (48 min ⇒ oui ; 15 min ⇒ non ; métro de 48 min ⇒ non). Le rendu lui-même n'a pas de test (pas de test de rendu React Native dans le projet) : il est constaté sur le téléphone.

## 6. Constat

2026-11-07 par adb, même recherche après rechargement : l'écran de la marche de 48 min dit « Marche de 48 min : un taxi peut faire cette étape. », « Commander un Uber pour cette étape », et « Numéros de taxi près du départ » ⇒ « Aucun numéro connu. » (le seul taxi de Saint-Florentin, Azur-Abba, n'est pas validé) (`docs/screenshots/2026-11-07-issue0029-marche-longue-taxi.png`).
