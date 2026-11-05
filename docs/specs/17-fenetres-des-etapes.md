# Spec 17 — Une fenêtre par étape : la carte en fond, les étapes en bas

- **Date** : 2026-11-05
- **État** : **approuvée le 2026-11-05 par Brainditech** (« implemente tout ça »), avec deux changements : la navigation dans un bouton rond en bas à droite (D86), et les arrêts marqués sur la carte (D84). Appliquée ; Brainditech l'essaie (§9).
- **Branche** : `phase-4/fenetres-etapes`
- **Remplace** : le dépliant « Voir le chemin (N consignes) » de la spec 11, §4.2 (`src/composants/CheminAPied.tsx`).
- **Invariants** : 4 (chaque arrêt et chaque consigne viennent de la réponse sourcée), 12 (aucune position du véhicule « en direct »), 20 (rien de l'identité visuelle de la SNCF).

## 1. But

Demande de Brainditech (2026-11-05) : retirer « Voir le chemin (x consignes) ». Quand on touche une étape à pied, une **nouvelle fenêtre** s'ouvre : la carte en fond, les consignes en bas, et un bouton pour lancer le guidage. Une autre fenêtre sert aux étapes en train, en bus ou en car. Le panneau du bas se **replie** pour voir la carte en grand, et se **déplie** pour voir toutes les étapes.

## 2. Ce que fait SNCF Connect (vu par `adb` le 2026-11-05, Paris Gare de Lyon → Tour Eiffel)

Captures gardées hors du dépôt (D38).

- **Détail d'un trajet** : carte plein écran (tracé, arrêts), panneau du bas avec une poignée. Dans le panneau : le résumé (« 15 › RER C »), la durée, puis une frise verticale (heure dans une pastille, rond par arrêt, trait pointillé pour la marche, trait plein de la couleur de la ligne pour le véhicule). Chaque étape est une ligne avec un chevron : « Marche › », « RER C NORA, vers Pontoise › ».
- **Le panneau a trois positions** : replié (carte plein écran, seul le résumé reste), à mi-hauteur (à l'ouverture), déplié (la carte réduite à une bande en haut). On le tire par la poignée.
- **« Marche › »** : la carte reste en fond, le panneau liste les consignes (« Marchez vers le sud vers Rue de Bercy », « Tournez à droite Rue de Bercy »…), la consigne en cours en surbrillance. Sans la position du téléphone, l'app refuse d'ouvrir cette vue.
- **« RER C › »** : une page plein écran sans carte : la liste de **tous** les arrêts de la ligne, l'heure, la voie, « 1 min d'arrêt », les arrêts du trajet en jaune, un arrêt supprimé barré, et la position du train en direct.

Ce qu'Itinhero reprend : la carte en fond, le panneau à trois positions, une ligne par étape avec un chevron, la liste des consignes, la liste des arrêts. Ce qu'il ne reprend pas : la position du train et les arrêts barrés (il faudrait du GTFS-RT, invariant 12), la voie (absente de la réponse), les couleurs de la SNCF (invariant 20). Et la fenêtre « Marche » s'ouvre **sans** la position : c'est une carte à lire avant de partir, la position n'est demandée qu'au guidage.

## 3. Décisions proposées

- **D84 — Une fenêtre par étape, ouverte depuis le Résultat.** Dans une carte de possibilité dépliée, chaque étape devient une ligne touchable avec un chevron (cible de 48 dp au moins). Elle ouvre l'écran `etape` (pile de l'onglet Chercher) avec le rang de la possibilité et celui de l'étape. Le dépliant « Voir le chemin » disparaît, `CheminAPied.tsx` aussi ; la phrase de l'étape (« 5 min, 310 m jusqu'à l'arrêt … ») reste dans la ligne.
  - Sur la carte, **les arrêts sont marqués** (demande de Brainditech : jusqu'ici seules les marches y étaient) : montée et descente avec leur nom, arrêts intermédiaires en ronds, et en gris clair le reste du trajet avec ses arrêts.
  - Option écartée : garder le dépliant et ajouter la fenêtre (deux façons de voir la même chose ; la carte du dépliant fait 224 dp de haut, trop petite pour lire un carrefour).
- **D85 — Panneau du bas à trois positions, sans nouvelle dépendance.** Replié (seul l'en-tête de l'étape, la carte occupe l'écran), à mi-hauteur (à l'ouverture, environ 45 % de l'écran), déplié (environ 85 %). Construit avec `PanResponder` et `Animated` de React Native : `react-native-gesture-handler` 3.3 n'est branché nulle part (pas de `GestureHandlerRootView` à la racine), l'ajouter pour un seul écran n'en vaut pas la peine. Toucher la poignée passe à la position suivante. **Pas de chevrons** dans l'en-tête (retour de Brainditech, 2026-11-05 : on glisse le panneau d'instinct) ; pour qui ne peut pas glisser, TalkBack propose sur la poignée les actions « Agrandir la carte » et « Déplier les étapes ».
  - Option écartée : `@gorhom/bottom-sheet` (une dépendance de plus pour trois positions ; sa compatibilité avec Reanimated 4.7 serait à vérifier).
- **D87 — Tous les arrêts de la course, à la demande.** Dans la fenêtre d'un véhicule, « Voir tous les arrêts du TER P31 » demande au serveur la course entière (`GET /v1/course?id=…`, qui lit `/api/v6/trip` de MOTIS v2.11.4) : les arrêts d'avant la montée et d'après la descente s'ajoutent en gris, ceux du trajet restent en couleur, et la liste défile jusqu'à la montée. Chaque étape de `POST /v1/itineraires` porte l'identifiant MOTIS de sa course (`course`). La montée et la descente sont reconnues à 300 m au plus du départ et de l'arrivée de l'étape ; sinon, message et liste du trajet seule. La carte reste cadrée sur l'étape ; les autres arrêts de la course y sont des ronds gris.
  - Raison : demande de Brainditech (« je dois pouvoir voir les arrêts entre eux ») : un TER direct Laroche-Migennes → Joigny ne montrait que ses deux arrêts, sans les autres gares de la ligne. Constaté : MOTIS ne donne aucun arrêt intermédiaire pour ce trajet (il n'y en a pas), mais la course va de Clamecy à Paris Bercy.
  - Options écartées : charger la course avec la réponse des itinéraires (une requête MOTIS de plus par étape, pour une liste que peu ouvriront) ; cadrer la carte sur toute la course (essayé : vus de loin, les noms de la montée et de la descente se chevauchent).
- **D86 — Bouton rond de navigation, qui démarre le guidage à cette étape.** Un bouton rond plein, en bas à droite, posé sur le bord du panneau qu'il suit (« Me guider à partir de cette étape » pour TalkBack), ouvre l'écran de guidage de la spec 12 avec l'étape choisie comme étape en cours (au lieu de la première). « Démarrer le guidage » du Résultat reste et part de la première étape.

## 4. Ce qui est construit

### 4.1 Le Résultat (`src/composants/Trajet.tsx`)

Chaque `LigneEtape` devient un `Pressable` avec un chevron à droite et `accessibilityHint` « Ouvre la carte de cette étape », **sans surbrillance au toucher** (elle clignotait à chaque défilement du Résultat). Les lignes d'attente (sablier) ne s'ouvrent pas. Le reste de la carte de possibilité ne change pas.

### 4.2 L'écran `src/app/(onglets)/(chercher)/etape.tsx`

Paramètres : `i` (rang de la possibilité), `e` (rang de l'étape). Il lit la réponse en mémoire comme le guidage ; sans elle, il revient au Résultat. La barre d'onglets est masquée, comme pour le guidage.

- **Carte plein écran** (MapLibre, style de la carte de fond) : le tracé de l'étape (pointillé pour la marche, trait plein de la couleur du mode pour un véhicule), un rond au départ et à l'arrivée, un petit rond par consigne ou par arrêt. Elle cadre toute l'étape, en tenant compte de la hauteur du panneau. Bouton rond « Recentrer » au-dessus du panneau. Bouton « Retour » rond en haut à gauche. Attribution « © OpenMapTiles © OpenStreetMap ».
- **En-tête du panneau** (visible dans les trois positions) : icône du mode, titre (« Marche » ou « Bus K941 »), la direction pour un véhicule, puis « 06:17 → 06:22 · 5 min · 310 m ».
- **Étape à pied** : la liste des consignes (flèche, phrase, distance) de la spec 11, comme dans le dépliant d'aujourd'hui. Toucher une consigne centre la carte sur son point (zoom 18) et la met en surbrillance ; le panneau descend à mi-hauteur s'il était déplié.
- **Étape en véhicule** : une frise verticale des arrêts **du trajet seulement** (de la montée à la descente) : la montée et la descente en gras avec leur heure, chaque arrêt intermédiaire avec son heure de passage (`arrets` de la spec 12). Toucher un arrêt centre la carte dessus. Sous la frise : l'exploitant, la réservation ou le taxi s'il y en a, et « Horaire prévu, sans suivi en direct » (invariant 12). Sans arrêt intermédiaire : « Sans arrêt jusqu'à <descente> ».
- **Taxi** : de → à, « Arrivée prévue à HH:MM », la phrase de réservation de la spec 16. Pas de frise.
- **Boutons ronds** posés sur le bord haut du panneau, qui le suivent : « Recentrer », puis le bouton plein de navigation ⇒ `/guidage?i=…&e=…` (D86). La mention « © OpenMapTiles © OpenStreetMap » est à leur gauche.

### 4.3 Le guidage (`src/app/(onglets)/(chercher)/guidage.tsx`)

Nouveau paramètre `e` facultatif : l'état de départ du moteur devient `{ ...ETAT_INITIAL, etape: e }`. Sans `e`, rien ne change.

### 4.4 Domaine, testé sous Node

- `src/domaine/etape.ts` : `enteteEtape(etape)` (titre, direction, ligne horaire), `arretsDuTrajet(etape)` (montée, intermédiaires, descente, chacun avec son heure ; jamais un arrêt à 0,0, issue 0019), `hauteursPanneau`, `positionSuivante` et `positionLachee` (les trois hauteurs, la poignée, où se pose le panneau lâché).
- `etatDepart(e, nombreEtapes)` dans `src/domaine/guidage.ts` : rang hors bornes ⇒ première étape.

### 4.5 Serveur

- `GET /v1/course?id=<course>` (`serveur/src/routes/course.ts`) : clé d'appareil exigée, `id` validé par Zod (motif `AAAAMMJJ_HH:MM_<jeu>_<trip_id>`, 300 caractères au plus), réponse `{ arrets: [{ nom, lat, lon, passage }] }` dans l'ordre, sans arrêt à 0,0. MOTIS en panne ⇒ 503, hors schéma ⇒ 502.
- Champ `course` de chaque étape (`normaliser.ts`) : l'identifiant MOTIS, ou null. L'identifiant ne porte ni lieu ni coordonnée de la personne (invariants 6 et 10).

## 5. Dépendances

Aucune. Doc lue avant le code : types de `@maplibre/maplibre-react-native` 11.5.1 installé (`Camera` : `initialViewState`, `ref` avec `fitBounds` et `easeTo`) ; `PanResponder` et `Animated` de React Native 0.88.

## 6. Critères d'acceptation

1. Dans une possibilité dépliée, « Voir le chemin » n'existe plus ; chaque étape à pied ou en véhicule a un chevron et ouvre sa fenêtre (capture `adb`).
2. Fenêtre « Marche » : la carte cadre le tracé, le panneau à mi-hauteur liste les consignes ; toucher une consigne centre la carte dessus (captures).
3. Le panneau se replie (carte en grand, seul l'en-tête reste) et se déplie (toutes les consignes), par la poignée et par les deux boutons ; TalkBack lit « Agrandir la carte » et « Déplier les étapes » (captures).
4. Fenêtre « Bus » ou « TER » : la frise montre la montée, les arrêts intermédiaires avec leur heure et la descente, les mêmes que la réponse de l'API ; « Horaire prévu, sans suivi en direct » est affiché (capture et test).
5. « Me guider » depuis la deuxième marche ouvre le guidage sur cette marche, pas sur la première (capture, lien `sim` de la spec 12).
6. La fenêtre « Marche » s'ouvre sans demander la position.
7. `npx expo lint`, `npx tsc --noEmit`, `npm test` verts ; tests de `enteteEtape`, `arretsDuTrajet`, `hauteursPanneau`, `positionLachee`, `etatDepart`.

## 7. Sécurité et vie privée

La fenêtre ne lit pas la position et n'appelle pas le serveur : elle n'affiche que la réponse déjà reçue. Aucune capture versionnée (D38) : celles du domicile montrent l'adresse.

## 8. Ce qui n'est pas fait ici

- La voie ou le quai (absents du GTFS chargé pour la plupart des jeux).
- La position du véhicule en direct et les arrêts supprimés (phase 7, GTFS-RT).
- Le même panneau pour l'écran de guidage (il garde sa carte du bas de la spec 12).

## 9. Résultats (2026-11-05)

### Ce qui est construit

- `src/app/(onglets)/(chercher)/etape.tsx` (la fenêtre, le panneau), `src/composants/CarteEtape.tsx` (la carte et ses repères), `src/domaine/etape.ts` et ses 12 tests, `etatDepart` dans `src/domaine/guidage.ts` (1 test), le paramètre `e` du guidage, la barre d'onglets masquée sur la fenêtre.
- `Trajet.tsx` : chaque étape est un bouton avec un chevron ; `CheminAPied.tsx`, `consignesAMontrer` et `libelleVoirChemin` retirés.
- Une seule exception de lint, commentée : `react-hooks/refs` sur `PanResponder.create`, qui ne lit les refs que dans les rappels du geste.

### Essai sur le téléphone (captures `adb`, Domicile → gare de Joigny, jeudi 12/11)

- Critère 1 : « Voir le chemin » absent ; chaque étape a son chevron.
- Critère 2 : marche de 48 min vers la gare de Saint-Florentin - Vergigny : tracé cadré, « arrêt Saint-Florentin-Ville » et la gare marqués avec leur nom ; « Tournez à gauche chemin des Martineaux » touché ⇒ carte centrée sur ce virage, ligne en surbrillance.
- Critère 3 : replié (en-tête seul, carte en grand), à mi-hauteur, déplié, par la poignée et le glissement.
- Critère 4 : car K941 et TER P5 : montée et descente avec leur heure, « Sans arrêt jusqu'à la gare de Laroche - Migennes », « Horaire prévu, sans suivi en direct ». Ces deux courses n'ont pas d'arrêt intermédiaire dans la réponse de MOTIS (le serveur transmet `intermediateStops` tel quel) : la frise avec arrêts intermédiaires reste à voir sur un trajet qui en a.
- Critère 5 : le bouton rond depuis le TER ouvre le guidage sur « Attendez le TER P5 direction Auxerre Saint-Gervais », pas sur la première marche.
- Critère 6 : la fenêtre s'ouvre sans demander la position.

Corrigé pendant l'essai : pastilles de nom coupées au bord de l'écran (marges de 110 dp à gauche et à droite) ; « jusqu'à arrêt » sans article ; ronds des consignes trop gros ; liste visible sous la barre de navigation une fois replié ; boutons ronds empilés qui débordaient sur la barre d'état une fois déplié (mis côte à côte) ; carte qui reculait jusqu'à la France entière une fois dépliée (elle garde le cadrage de la mi-hauteur).

### Retours de Brainditech (2026-11-05) et deuxième essai

1. **Surbrillance au défilement** du Résultat : retirée des lignes d'étape.
2. **Tous les arrêts du train** (D87) : TER P31 Laroche-Migennes → Joigny, « Voir tous les arrêts du TER P31 » ⇒ toute la course, de Clamecy à Paris Bercy ; la liste s'ouvre sur Auxerre Saint-Gervais (gris), gare de Laroche - Migennes 08:03 et gare de Joigny 08:11 (en gras, trait bleu), Sens et Paris Bercy (gris) ; « Montrer seulement mon trajet » revient aux deux arrêts. API reconstruite (`up -d --build api`, `/health` 200, `/v1/course` sans clé ⇒ 401).
3. **Chevrons de l'en-tête** retirés ; actions TalkBack sur la poignée.

Tests : serveur 203 (6 de `course.test.ts`, sur une réponse de MOTIS enregistrée), app 189 (4 de `arretsDeLaCourse`).
