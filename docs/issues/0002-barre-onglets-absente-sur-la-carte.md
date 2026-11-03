# Issue 0002 — La barre d'onglets n'apparaît plus sur l'Accueil

> Ouverte le 2026-11-03. État : **non reproduite, close le 2026-11-03.** Après un rechargement de l'app, la barre est revenue (Brainditech : « après rechargement c'est bon »), sans aucune correction.
> Branche : `phase-1/fond-carte` (spec 03, premier development build avec la carte MapLibre).

## Reproduction

1. Téléphone de Brainditech (Android), development build, `EXPO_PUBLIC_TUILES_URL` remplie (carte MapLibre affichée).
2. Ouvrir l'app sur l'Accueil.
3. Sous le bouton « Chercher », l'espace réservé à la barre d'onglets est là, mais la barre (Chercher, Mes trajets, Assistant, Réglages) n'est pas affichée. Brainditech : « le bouton en bas n'est plus là » (capture du 2026-11-03, 11:46).

Avant la carte (Expo Go, fond inventé seul), la barre s'affichait (`docs/preuves/2026-11-02-phase1-accueil-en-dur.jpg`).

## Hypothèse (une seule)

La carte est dessinée dans une `GLSurfaceView`, le mode par défaut de MapLibre sur Android (`androidView`, `@defaultValue "surface"`, types de `@maplibre/maplibre-react-native` 11.5.1). Une `SurfaceView` dessine dans une couche à part de la fenêtre. La barre d'onglets est hors de l'écran Accueil (sœur de l'écran dans le navigateur `Tabs`, en position absolue), et la couche de la carte passe par-dessus.

## Vérification proposée

- Passer `androidView="texture"` sur `CARTE.Map` (`src/composants/FondCarte.tsx`) : une `TextureView` est dessinée dans l'arbre de vues normal, donc dans l'ordre des vues React Native.
- Brainditech relance l'app (rechargement suffisant : la prop existe déjà côté natif) et envoie une capture.
- Si la barre revient : hypothèse confirmée, la prop reste, avec un commentaire.
- Si elle ne revient pas : hypothèse écartée, on retire la prop et on teste la suivante (barre masquée par l'écouteur du clavier, `keyboardDidHide` jamais reçu).

## Cause racine

Non établie : le bug a disparu au rechargement, avant le test de l'hypothèse. `androidView="texture"` n'a pas été ajouté. Si la barre disparaît de nouveau, rouvrir cette issue et tester l'hypothèse ci-dessus.

## Test de régression

Pas de test vitest possible (rendu natif). Critère ajouté à la vérification de la spec 03 : la barre d'onglets est visible sur l'Accueil avec la carte, au lancement et après la fermeture du clavier *(capture)*.
