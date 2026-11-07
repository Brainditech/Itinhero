# Issue 0032 — La carte d'une marche de quelques mètres est vide

- **Trouvée** le 2026-11-07 par Claude, en constatant le pack de carte d'un voyage national en mode avion (phase 2 bis, R17), à la demande de Brainditech (D133).
- **État** : corrigée (analyse et correction par délégation, D133).

## 1. Reproduction

Voyage enregistré Domicile → Gare de Flers (jeudi 12/11), étape « Marche 1 min jusqu'à la gare de Flers » (10:01 → 10:02). L'écran Étape montre le repère « Gare de Flers » et le tracé du train sur un fond gris uni : aucune rue, aucun nom. En mode avion **et en ligne**.

## 2. Hypothèses, une à la fois

1. Les tuiles de Flers manquent au pack. **Écartée** : la base `mbgl-offline.db` du téléphone contient la zone de détail de Flers (zooms 12 à 14) et la tuile z14 8166/5644 qui couvre la gare ; et la carte est vide aussi en ligne.
2. La caméra cadre une boîte de quelques mètres (`fitBounds` sur les deux points de la marche, sans zoom maximal) : elle zoome bien au-delà du zoom 14 des tuiles, sur une surface sans rien à dessiner. **Confirmée** : la boîte élargie, les rues apparaissent.

## 3. Cause racine

`src/composants/CarteEtape.tsx` cadrait `boite(points)` de l'étape. Pour une marche d'une minute, la boîte fait quelques mètres de côté.

## 4. Correction

`boiteAuMoins(points, 200)` (`src/domaine/geo.ts`) : la boîte de l'étape, élargie autour de son centre jusqu'à 200 m de chaque sens au moins ; une étape plus grande garde sa boîte. `CarteEtape` cadre cette boîte.

## 5. Test de régression

`src/domaine/geo.test.ts` : deux points à quelques mètres ⇒ 200 m et même centre ; un point ⇒ 200 m ; une étape plus grande inchangée.

## 6. Constat

2026-11-07 par adb, après rechargement : Rue Nationale, Rue de la Gare, Rue Schnetz, voies ferrées autour de la gare de Flers, en ligne (`fl-08b-marche-flers-8083.png`) puis en mode avion, app fermée et rouverte (`fl-10-marche-flers-avion-rues.png`), captures non versionnées dans `docs/screenshots/fin-impl/`.
