# Spec 12 — Guidage en direct sur la carte, de porte à porte

- **Date** : 2026-11-04
- **État** : **approuvée le 2026-11-05 par Brainditech (« implemente »)** : D72 à D75 et les cinq maquettes de `design/guidage/`. D76 (carte hors réseau) reste à trancher. Appliquée sur `phase-4/guidage-en-direct`, empilée sur la spec 11.
- **Branche prévue** : `phase-4/guidage-en-direct`
- **Prérequis** : issue 0010 et spec 11 fusionnées (le guidage lit les consignes et le tracé de la spec 11).

## 1. But

Pendant le trajet, l'app **conduit** la personne comme une application de navigation routière : la carte suit sa position et son orientation, un bandeau en haut montre la prochaine manœuvre en grand (flèche, distance, rue), et l'app passe toute seule à l'étape suivante. Pour un débutant, le guidage ne s'arrête pas à la marche : il dit aussi **quand monter, dans quoi, et quand descendre**.

Demande de Brainditech (2026-11-04) : « une conduite dans la carte […] pour diriger la personne exactement le chemin ».

## 2. Ce qui change dans le plan

- **D72 — Le guidage pas à pas en cours de trajet entre dans la v1.** Révise PLAN.md §8, qui le classait hors v1. Une case est ajoutée en phase 4. Le **guidage photo** (sous-sol, sans réseau) reste hors v1.
  - Raison : D45 (« une seule application qui remplace toutes les autres », pour un débutant). Sans guidage, il faut une autre application pour marcher jusqu'à l'arrêt.
  - Option écartée : un bouton « ouvrir dans Google Maps » pour la marche (on dépend d'une autre application, et le trajet n'est plus le même que celui d'Itinhero).

## 3. Décisions proposées

- **D73 — Position au premier plan seulement, écran allumé.** L'écran de guidage garde l'écran allumé (`expo-keep-awake`) et lit la position avec `expo-location` au premier plan, comme la spec 10. Pas de position en arrière-plan en v1 : cela demande une permission Android de plus et une notification permanente. La position ne quitte jamais le téléphone, sauf pour un recalcul demandé (§4.4).
- **D74 — Voix en option, sur le téléphone.** Les consignes sont lues par la synthèse vocale d'Android (`expo-speech`), qui marche sans réseau. Désactivable d'un geste sur l'écran de guidage. Pas de voix enregistrée ni de service extérieur.
- **D75 — Écart au chemin.** À plus de 40 m du tracé pendant plus de 15 s : « Vous vous éloignez du chemin ». Avec du réseau, l'app propose « Recalculer depuis ici » (nouvelle recherche, même rendez-vous, même marge). Sans réseau, elle montre une flèche vers le prochain point du tracé et la distance à vol d'oiseau, **sans inventer de chemin**. Seuils à ajuster sur le terrain (critère 6).
- **D76 — Carte hors réseau : à trancher dans cette spec avant le code.** Le guidage hors réseau a besoin des tuiles du trajet sur le téléphone (packs hors ligne de MapLibre). Il faut d'abord vérifier que le fournisseur des tuiles (`EXPO_PUBLIC_TUILES_URL`, spec 03) permet ce téléchargement. Sinon, les consignes et la flèche marchent quand même, sur un fond sans détail.

## 4. Ce qui est construit

### 4.1 Maquette d'abord

`design/guidage/` : écran de guidage en marche, à l'arrêt en attente du bus, dans le bus, descente imminente, écart au chemin. Tirée de `design/design-system.md`. Approuvée par Brainditech avant le code (même règle que les autres écrans).

### 4.2 Écran de guidage (`src/app/(onglets)/(chercher)/guidage.tsx`)

Ouvert depuis le Résultat (« Démarrer le guidage ») et, plus tard, depuis Mes trajets (phase 5).

- **Carte** : suit la position, tournée dans le sens de la marche (cap de la boussole à l'arrêt, cap du déplacement en marche), tracé restant en couleur, tracé fait en gris.
- **Bandeau du haut** : grande flèche de la manœuvre (spec 11), « Dans 120 m », « Tournez à droite rue Guillaume-Tell ». En dessous, en petit, la manœuvre d'après.
- **Bas de l'écran** : heure d'arrivée prévue, temps et distance restants, et l'état par rapport à l'horaire : « En avance de 4 min » ou « Pressez le pas : bus dans 3 min ».

### 4.3 Les étapes en véhicule

- **À l'arrêt** : « Attendez le bus 803 direction Auxerre, il passe à 08:25 (dans 6 min) », avec « Horaire prévu, sans suivi en direct » (invariant 12). Si l'étape est sur réservation (issue 0010, B) : « Vous avez réservé ? » en tête.
- **Dans le véhicule** : la position avance sur le tracé de la ligne, avec la liste des arrêts restants (`intermediateStops` de MOTIS). « Descendez au prochain arrêt » une fois l'avant-dernier arrêt passé, avec une vibration et la voix.
- **Correspondance** : passage automatique à la marche suivante dès la descente détectée (position à moins de 50 m de l'arrêt de descente), ou par le bouton « Je suis descendu ».

### 4.4 Domaine, testé sous Node (`src/domaine/guidage.ts`)

Pur TypeScript, sans dépendance à Expo :

- position la plus proche sur le tracé, distance restante, prochaine manœuvre ;
- détection de l'écart au chemin (D75) ;
- étape en cours et passage à la suivante ;
- moment des annonces vocales : à 150 m, à 40 m et au point de manœuvre pour la marche ; à l'avant-dernier arrêt pour la descente.

## 5. Dépendances à ajouter (doc de la version installée lue avant)

`expo-keep-awake`, `expo-speech`, éventuellement `expo-haptics` : par `npx expo install`. Nouveau development build nécessaire.

## 6. Critères d'acceptation

1. Tests du domaine : position simulée le long de la marche gare de Dijon → tribunal (réponse enregistrée de la spec 11) ⇒ les annonces tombent aux bonnes distances, l'arrivée est détectée, aucun écart signalé.
2. Position simulée à 60 m du tracé pendant 20 s ⇒ « Vous vous éloignez du chemin » ; à 30 m ⇒ rien.
3. Étape en bus simulée ⇒ « Descendez au prochain arrêt » à l'avant-dernier arrêt.
4. Sur le téléphone, maquette respectée : capture de chaque état de §4.1.
5. Hors réseau (mode avion après l'ouverture du guidage) : les consignes, la flèche et la voix continuent.
6. **Essai sur le terrain par Brainditech** : une vraie marche d'au moins 500 m avec 3 virages, comparée à Google Maps. Seuils de D75 ajustés d'après l'essai.

## 7. Sécurité et vie privée

La position n'est ni envoyée au serveur pendant le guidage, ni gardée après. Elle est envoyée seulement pour un recalcul demandé, comme une recherche « depuis ma position » (spec 10). Jamais dans un journal ni dans Sentry (invariant 10).

## 8. Ce qui n'est pas fait ici

Guidage photo et guidage en sous-sol (hors v1) ; guidage écran éteint (D73) ; temps réel des véhicules (phase 7) : l'avance et le retard sont mesurés par rapport à l'horaire prévu, jamais au passage réel du véhicule.

## 9. Résultats (2026-11-05)

### Ce qui est construit

- Serveur : chaque étape porte `depart_utc`, `arrivee_utc` et, en véhicule, `arrets` (arrêts intermédiaires de MOTIS avec leur heure prévue).
- `src/domaine/guidage.ts` (16 tests) : position suivie le long du tracé **en avançant** (une ligne de car qui fait l'aller-retour par la même rue, comme le 803 à Saint-Florentin, ne fait pas sauter la position), annonces à 150 m, 40 m et au point de manœuvre, écart de D75, attente, arrêts restants, descente imminente, statut horaire (« En avance de 4 min », « Pressez le pas : TER K7 dans 2 min »).
- Écran `guidage.tsx`, ouvert par « Démarrer le guidage » dans une carte du Résultat dépliée ; barre d'onglets masquée ; écran allumé (`expo-keep-awake`) ; voix (`expo-speech`, lue seulement si le module natif est dans le build) ; vibration de la descente (`Vibration` de React Native, permission déjà présente).
- En développement seulement, le paramètre `sim=étape,mètres,écart,HH:MM` simule la position et l'heure, pour capturer chaque état sans marcher (`adb shell am start -d "itinhero://guidage?i=1&sim=4,377,0,09:30"`).

### Comparaison aux maquettes (captures `adb`, 2026-11-05, Domicile → tribunal administratif de Dijon, jeudi 12/11)

| État | Maquette | Écarts restants |
|---|---|---|
| Marche | 01 | aucun (« Jusqu'à Tribunal administratif » au lieu de « Jusqu'au » : le nom vient de la recherche, sans article connu) |
| Attente à l'arrêt | 02 | aucun |
| Dans le véhicule | 03 | « Descendez dans 4 arrêts » passe sur deux lignes à 24 sp sur 411 dp de large (le texte passe à la ligne, jamais coupé) |
| Descente imminente | 04 | le drapeau n'a pas les ondes de vibration |
| Écart au chemin | 05 | aucun |

Écarts des maquettes corrigés dans le code, comme annoncé : carte du bas flottante avec marges (écrans 1 à 3) ; couleurs du mode prises dans les jetons (car violet `mode-car`, train bleu `mode-train`) ; arrêts restants d'après la donnée ; tracé arrêté au drapeau.

### Choix faits en appliquant

- La carte est tournée dans le sens du tracé devant la position, à la marche comme à l'arrêt (pas de boussole magnétique à l'arrêt : un cap qui tremble quand on attend) ; le bouton boussole met le nord en haut.
- Dans le véhicule, la carte cadre la position en bas et l'arrêt visé en haut (troisième arrêt restant, ou la descente), comme la maquette 03.
- « Recalculer depuis ici » refait la recherche avec « Ma position » au départ, même rendez-vous et même marge ; il est montré même sans réseau, et dit l'échec s'il n'y en a pas.

### Corrections de la relecture de la PR #20 (2026-11-05, D82)

- « Recalculer depuis ici » garde l'arrivée déjà trouvée, cherche depuis la position lue maintenant et, en « partir à », à partir de l'heure actuelle (`demandeRecalcul`) ; réussi, il revient au Résultat (`router.dismissTo`), ce qui ferme le guidage : jamais deux guidages, ni voix sous le Résultat.
- Train direct : « Descendez au prochain arrêt » à 1 km de la descente (2 min avant l'arrivée prévue sans position), plus à la montée ; le bandeau dit « Sans arrêt jusqu'à la descente ».
- Arrivée de la marche seulement à 40 m au plus du tracé ; plus loin, c'est l'écart de D75.
- Bus raté : encore à l'arrêt 2 min après le départ prévu, l'écran reste à l'attente (« Le bus est peut-être passé ») avec « Recalculer depuis ici ».
- Position : un relevé par seconde même immobile (`distanceInterval: 0`) ; un relevé de plus de 10 s (signal perdu sous terre) ou moins précis que 100 m ne compte pas, et la marche garde sa dernière abscisse (pas de retour au début). Sans position depuis 10 s pendant une marche : « Position introuvable » et le bouton « Étape suivante » ; hors du chemin à 150 m au plus de la fin (GPS décalé dans un hall), un bouton discret « Je suis arrivé, étape suivante ». Un double appui ne saute qu'une étape.
- Le trajet guidé est figé à l'ouverture de l'écran ; taxi ou transport à la demande en retard : « n'est pas encore là ? » au lieu de « peut-être passé ».
- Les phrases d'un même instant sont dites ensemble, dans l'ordre (plus de phrase perdue).
- Carte : tracé recoupé au changement d'étape ou tous les 5 m, plus chaque seconde ; une seule table d'icônes de mode (`src/composants/icones-mode.ts`) ; vitesse de marche en un seul endroit ; « Attendez le taxi », sans sa durée.
- Un test de régression par défaut du calcul, qui échoue sur l'ancien code (`guidage.test.ts`, « PR #20 » ; `demande.test.ts`, `demandeRecalcul`).

### Essai sur le téléphone (2026-11-05, issue 0017, D83)

Domicile → gare de Joigny, jeudi 12/11 : chaque état ouvert par `sim`, plus le guidage réel avec la localisation coupée. Corrigé : taxi guidé comme un taxi (« En taxi », « Vous arrivez », « au point de rendez-vous »), train direct sans « Prochain arrêt » répété, « Vous êtes à la gare », « jusqu'à la gare de Joigny », « Maintenant » au lieu de « Dans 0 m », « Départ prévu le 12/11 à 06:17 » pour un trajet d'un autre jour, pastille « Position introuvable » dans la carte, point gris sans position, message du recalcul sans « choisissez Domicile », détail sans « 0 m ».

### Reste
- Recalcul réussi sur le téléphone : la localisation était coupée pendant l'essai.

- Critère 5 (mode avion) et critère 6 (essai sur le terrain, seuils de D75) : par Brainditech.
- Voix : nouveau development build nécessaire (`expo-speech` ajouté).
- D76 (carte hors réseau).

