# Issue 0022 — Guidage : « Vous y êtes » à 17 km du chemin

- **Date** : 2026-11-05
- **État** : **corrigée** le 2026-11-05 (Brainditech : « corrige tout ce qui a à corriger […] jusqu'à ce que tout fonctionne parfaitement »).
- **Branche** : `issue/0022-guidage-loin-du-chemin`. Trouvée pendant le critère 4 de la spec 19 (PR #29), mais elle vient du guidage de la spec 12.

## 1. Reproduction

1. Téléphone à Brienon. Résultat Domicile → Gifi Joigny 2 (avec ou sans retour), une possibilité qui finit par une marche dans Joigny.
2. Ouvrir l'étape de marche, « Me guider à partir de cette étape ».
3. Pendant une vingtaine de secondes, le bandeau dit « Vous y êtes » ; ensuite « Vous vous éloignez du chemin — Le chemin est à 17 km » (constaté par adb sur le guidage du retour, 2026-11-05).

## 2. Hypothèse (une seule, vérifiée)

Dans `situer` (`src/domaine/guidage.ts`), l'avancée le long de la marche est prise de la projection de la position sur le tracé, **même quand la position est loin du tracé**. `etat.abscisse` ne retient la projection qu'à moins de 3 × `ECART_METRES` (120 m), mais l'affichage lisait `proj.abscisse` directement. À 17 km, le point du tracé le plus proche est souvent son bout : la prochaine consigne est l'arrivée, à 0 m ⇒ « Vous y êtes ». Au bout de 15 s (D75), l'écart prend le bandeau, d'où les « vingt secondes ».

Vérification : position simulée à 17 km de côté du début et du milieu de la marche gare de Dijon → tribunal (fixture de la spec 12) ⇒ `abscisse` 1 403 m (le bout), consigne « arrivee » à 0 m.

## 3. Correction

L'avancée affichée est `etat.abscisse`, qui ne prend la projection que près du tracé. Loin du chemin, le guidage reste où il en était (au début d'une marche qu'on n'a pas commencée), et l'écart arrive au bout de 15 s comme avant (D75).

## 4. Test de régression

`src/domaine/guidage.test.ts`, « issue 0022 » : à 17 km de côté du début, du milieu et du bout de la marche, des deux côtés, pendant 15 s ⇒ l'avancée reste 0, la prochaine consigne est à plus de 15 m, aucune annonce d'arrivée ; après 15 s, l'écart est signalé (> 10 km). Rouge avant la correction (4 cas sur 5, plus l'annonce), vert après ; les 229 autres tests restent verts.

## 5. Constat (adb, 2026-11-05)

Aller de 08:46, étape « Marche 21 min » jusqu'à Gifi Joigny 2, « Me guider à partir de cette étape », téléphone à Brienon : « Dans 40 m — Tournez à droite sur le chemin » au départ (`docs/screenshots/2026-11-05-r19-29-guidage-reel-2.png`), puis « Vous vous éloignez du chemin — Le chemin est à 17 km » et « Recalculer depuis ici » (`2026-11-05-r19-30-guidage-reel-ecart.png`). Plus de « Vous y êtes ».
