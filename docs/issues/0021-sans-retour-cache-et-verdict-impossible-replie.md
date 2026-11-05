# Issue 0021 — « Sans retour » sous « Chercher », verdict « Impossible » replié sans sa raison

- **Date** : 2026-11-05
- **État** : **corrigée** le 2026-11-05 (Brainditech : « corrige tout ce qui a à corriger […] jusqu'à ce que tout fonctionne parfaitement »).
- **Branche** : `phase-3/retour-planifie` (spec 19, PR #29), constatée par adb pendant le critère 4.

## A. « Sans retour » caché sous « Chercher »

### Reproduction

1. Formulaire, Arrivée Gifi Joigny 2 (avec sa ligne de détail), « Fin du rendez-vous (retour) » réglée à 23:30.
2. Le lien « Sans retour », sous le champ, est sous le bord de la liste, derrière « Chercher » (posé hors de la liste, issue 0004) : il faut faire défiler pour le voir.
3. Toucher à l'endroit du lien lance la recherche au lieu de vider le champ (capture `2026-11-05-r19-14-sans-retour-avant.png`).

### Hypothèse (une seule, vérifiée)

Le lien est le dernier élément de la liste qui défile (`ScrollView` à `flexGrow: 0`) : quand la carte du formulaire est plus haute que la place au-dessus de « Chercher », c'est lui qui passe sous le bord. Le champ, lui, reste visible : rien ne dit qu'il y a un lien dessous.

### Correction

- « Sans retour » est un bouton texte **dans** le champ, à droite de l'heure (`ChampTouchable`, prop `effacer`, 48 dp de haut) : visible dès que l'heure est visible. Le lien sous le champ est supprimé.
- L'heure choisie, la liste défile jusqu'en bas : le champ remonte en entier au-dessus de « Chercher ».
- Écart à la spec 19 §3 (« un lien "Sans retour" le vide ») : même mot, même effet, posé dans le champ.

### Constat (adb, 2026-11-05)

- Fin 16:00 choisie ⇒ la liste remonte, « 16:00 … Sans retour » dans le champ, au-dessus de « Chercher » (`2026-11-05-r19-23-fin-16h-sans-retour-visible.png`).
- « Sans retour » touché ⇒ « Aucune, pas de retour », aucune recherche lancée (`2026-11-05-r19-24-apres-sans-retour.png`).

## B. Verdict « Impossible » replié : la raison n'apparaît qu'en le dépliant

### Reproduction

Fin 23:30 ⇒ « Retour vers Domicile », verdict « Impossible » replié, et aucune carte de possibilité dessous : « Aucun retour ce jour-là après 23:30. » n'apparaît qu'après le chevron (captures `r19-12` et `r19-13`). Même chose pour un aller impossible.

### Hypothèse (une seule, vérifiée)

La spec 14 replie le verdict au départ parce que les cartes dessous montrent les trajets. Sans possibilité, il n'y a rien dessous : replié, le verdict ne dit pas pourquoi.

### Correction

`BlocVerdict` (`resultat.tsx`) s'ouvre au départ quand le verdict est « Impossible » ; « Possible » et « Nuit dehors » restent repliés (spec 14). Écart à la spec 14 §4 (« Repliée au départ ») pour ce seul cas.

### Constat (adb, 2026-11-05)

- Fin 23:30 ⇒ « Impossible » ouvert, « Aucun retour ce jour-là après 23:30. » sans toucher (`2026-11-05-r19-26-retour-impossible-deplie.png`).
- Fin 16:00 ⇒ le verdict du retour reste replié : « Possible · Départ 16:23 » (`2026-11-05-r19-31-retour-1600-replie.png`).

## Test de régression

Mise en page et état initial d'un composant natif : pas de test vitest (le domaine ne change pas, `phraseVerdict` est déjà testé). Preuve : les captures adb ci-dessus.
