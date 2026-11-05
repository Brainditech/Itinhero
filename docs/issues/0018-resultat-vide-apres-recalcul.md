# Issue 0018 — Résultat vide après « Recalculer depuis ici »

- **Date** : 2026-11-05
- **État** : **corrigé** (branche `issue/0018-resultat-vide`), cause prouvée et correction revérifiée sur le téléphone le 2026-11-05. Analyse approuvée par Brainditech le 2026-11-05.
- **Branche** : `issue/0018-0019-essai-recalcul` (analyse), `issue/0018-resultat-vide` (preuve et correction).

## 1. Reproduction

Téléphone de Brainditech, development build, MOTIS national, position simulée par Appium Settings v8.2.1 (`io.appium.settings/.LocationService` piloté par `adb`).

1. Recherche Domicile → Gare de Joigny, jeudi 12/11, arriver avant 10:00, marge 10 min.
2. Résultat : toucher « Voir les étapes » sur la première possibilité, faire défiler jusqu'en bas de la carte dépliée, toucher « Démarrer le guidage ».
3. Pendant la marche, placer la position à 60 m du chemin pendant plus de 15 s : « Vous vous éloignez du chemin, le chemin est à 60 m » et le bouton « Recalculer depuis ici » apparaissent.
4. Toucher « Recalculer depuis ici ».

**Constaté** : le guidage se ferme et le Résultat revient, mais l'écran est vide entre le mot « Itinhero » et la barre d'onglets. `uiautomator dump` ne montre que « Horaires valables jusqu'au 30/04/2027 » et « Modifier la recherche », le bas de la page. Après un défilement vers le haut, la nouvelle réponse est bien là (« Ma position → Gare de Joigny », départ 06:16), avec toutes les cartes repliées.

**Attendu** : le Résultat s'affiche en haut de page, sur « Votre trajet » et le verdict.

Le recalcul lui-même fonctionne : nouvelle réponse correcte, et le guidage ne reste pas ouvert derrière (un « Retour » mène à « Quel lieu ? »).

## 2. Hypothèse (une seule, à vérifier)

1. `recalculer` appelle `avancer(…, "revenir")`, qui fait `router.dismissTo("/resultat")` ([src/recherche.tsx](../../src/recherche.tsx)) : le Résultat déjà monté sous le guidage est réutilisé, donc son `ScrollView` ([src/composants/Ecran.tsx](../../src/composants/Ecran.tsx)) garde son décalage de défilement. Ce décalage était tout en bas de la carte dépliée, là où se trouve « Démarrer le guidage ».
2. Chaque carte a pour clé `${p.depart_utc}-${p.arrivee_utc}-${i}` ([resultat.tsx](../../src/app/(onglets)/(chercher)/resultat.tsx)). La nouvelle réponse part à 06:16 au lieu de 06:17 : la clé change, la carte est remontée, et son état `ouverte` ([Trajet.tsx](../../src/composants/Trajet.tsx)) repart à `false`. La page devient beaucoup plus courte.
3. Android ne ramène pas le décalage dans les limites du nouveau contenu : la vue reste défilée sous la fin de la page, donc elle paraît vide.

Ce qui va dans ce sens : après « Arrêter le guidage » (retour simple, même réponse, mêmes clés), le Résultat revient à la même hauteur, avec la carte toujours dépliée (« Démarrer le guidage » visible en haut de l'écran).

Ce qui reste à prouver avant de corriger : refaire la reproduction en relevant le décalage du `ScrollView` (`onScroll`) avant et après le recalcul, et vérifier que la hauteur du contenu diminue.

## 3. Correction proposée (après approbation)

Quand le Résultat reçoit une nouvelle réponse, remonter son `ScrollView` en haut (`scrollTo({ y: 0 })` sur changement de `recherche.reponse`), ce qui veut dire faire passer une référence par `Ecran`. Option écartée : clé sur l'écran entier pour tout remonter, ce qui referait aussi « Votre trajet » et le verdict sans raison.

## 4. Test de régression prévu

La logique est dans un composant React Native, que vitest (TypeScript pur sous Node) ne monte pas. Le test sera donc la reproduction ci-dessus sur le téléphone, captures avant et après. Si la décision « remonter en haut quand la réponse change » sort dans une fonction du domaine, elle aura son test vitest.

## 5. Preuve de la cause (2026-11-05)

Relevé temporaire (`onScroll`, `onContentSizeChange` sur le `ScrollView` d'`Ecran`, lus par `adb logcat`, retiré avant le commit). Guidage ouvert par lien profond en simulation (`sim=0,50,-80,06:18` : écart de 80 m, « Recalculer depuis ici » après 15 s) depuis le Résultat défilé jusqu'à « Démarrer le guidage ».

1. **Recalcul réel, même départ 06:17** : clés inchangées, carte toujours dépliée, contenu 2790 avant et après, défilement gardé (y ≈ 1666 avant, 1615 relevé après). L'écran montre le milieu de la carte, pas le haut. Confirme le point 1 de l'hypothèse : le Résultat est réutilisé avec son défilement.
2. **Même essai, clé des cartes forcée à changer à chaque réponse** (essai temporaire, pour reproduire le passage de 06:17 à 06:16 du §1) : contenu 2790 → 1393 pour une vue de 821, défilement à y ≈ 1552, au-delà de la fin du contenu ; aucun `onScroll` émis. L'écran est vide entre « Itinhero » et la barre d'onglets (`uiautomator dump` : rien d'autre). Au premier glissement, Android ramène y à 572 (= 1393 − 821) et le contenu réapparaît. Confirme les points 2 et 3.

## 6. Correction (2026-11-05)

- `Ecran` reçoit une `ref` (React 19 : `ref` est une prop), passée au `ScrollView`.
- `resultat.tsx` : `useEffect` sur `recherche.reponse` ⇒ `scrollTo({ y: 0, animated: false })`. « Arrêter le guidage » ne change pas la réponse : le Résultat garde alors sa position, comme avant.
- Revérifié sur le téléphone, essai 2 du §5 refait avec la correction : le Résultat s'affiche en haut (« Votre trajet », « Ma position → Gare de Joigny », Possible, départ 06:17).
- Test de régression : la logique tient dans un `useEffect` d'écran, que vitest ne monte pas (§4) ; le test est la reproduction du §5 sur le téléphone. Lint, types et 172 tests de l'app verts.
