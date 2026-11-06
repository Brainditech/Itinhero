# Issue 0028 — « 1 min, 0 m jusqu'à la gare de Sens »

- **Trouvée** le 2026-11-06 par Claude, pendant la passe adb demandée par Brainditech (« loop test capture jusqu'à ce que chaque spec soit impec », délégation D119).
- **État** : corrigée (analyse et correction par délégation, comme les issues 0023 à 0026).

## 1. Reproduction

Accueil, « jeudi 10h RDV gare de Sens » ⇒ Gare de Sens ⇒ Résultat. Premier trajet (08:46 → 09:27), « Voir les étapes » : la dernière marche dit **« 1 min, 0 m jusqu'à la gare de Sens, arrivée 09:27 »** (`docs/screenshots/passe/06-etapes-suite.png`, non versionnée, D93).

## 2. Hypothèse

MOTIS rend une marche de quelques mètres (du quai au point « Gare de Sens » choisi). `phraseMarche` n'écarte que `distance_metres === 0` (règle déjà écrite : « une correspondance dans la même gare ne dit pas 0 m ») ; `formaterDistance` arrondit à la dizaine, donc 1 à 4 m deviennent « 0 m ».

## 3. Cause racine

Confirmée en lisant le code : `src/domaine/guidage.ts` (`phraseMarche`), `src/domaine/etape.ts` (`enteteEtape`) et `src/domaine/consignes.ts` (`distanceConsigne`) testaient la distance brute, pas la distance affichée.

## 4. Correction

`distanceADire(m)` dans `src/domaine/resultat.ts` : vrai seulement si l'arrondi n'est pas « 0 m ». Les trois phrases l'utilisent. Le guidage en direct (« Dans 0 m ») n'est pas touché : il dit qu'on y est.

## 5. Test de régression

`src/domaine/guidage.test.ts` : « issue 0028 : 3 m jusqu'à la gare (arrondis à 0) ne disent pas « 0 m », 6 m disent « 10 m » ».

## 6. Constat

Même recherche sur le téléphone après rechargement : voir le journal de `docs/ETAT.md`.
