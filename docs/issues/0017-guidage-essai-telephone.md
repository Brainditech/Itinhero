# Issue 0017 — Guidage : défauts vus à l'essai sur le téléphone

- **Date** : 2026-11-05
- **État** : **corrigée** dans la PR #20 (spec 12), sur délégation de Brainditech (« reteste tout, applique les correctifs, boucle jusqu'à un résultat impeccable ») ; tests de régression verts, revérifié sur le téléphone par `adb`.
- **Branche** : `phase-4/guidage-en-direct` (PR #20).

## 1. Reproduction

Téléphone de Brainditech, development build, Metro du PC, MOTIS national. Recherche Domicile (Brienon) → Gare de Joigny, jeudi 12/11, arriver avant 10:00, marge 10 min. Deux possibilités :

- `i=0` : marche 5 min, bus K941, marche 48 min, TER P5, marche 2 min (0 m), TER P31, marche 1 min ;
- `i=1` : taxi 12 min, TER K7 direct, marche 1 min.

Chaque état est ouvert par `adb shell am start -d "itinhero://guidage?i=…&sim=étape,mètres,écart,HH:MM"`, lu par `uiautomator dump` et capturé par `screencap` (captures non versionnées, D38). Le guidage réel sans position est essayé avec la localisation du téléphone coupée.

| # | Où | Ce que l'écran disait | Attendu |
|---|---|---|---|
| 1 | Taxi en route | « Sans arrêt jusqu'à la descente », « Descente : Laroche - Migennes », « Prochain arrêt : Laroche - Migennes » | un taxi n'a ni arrêt ni descente |
| 2 | Taxi à l'approche | « Descendez au prochain arrêt » (écran et voix) | « Vous arrivez » |
| 3 | TER direct | « Descente : Joigny » et « Prochain arrêt : Joigny » : deux fois la même chose | l'heure d'arrivée prévue |
| 4 | Attente du taxi, du TER | « Vous êtes à l'arrêt » | « au point de rendez-vous », « à la gare » |
| 5 | Après la descente | « Ensuite : 1 min à pied jusqu'à Gare de Joigny » | « jusqu'à la gare de Joigny » |
| 6 | Bandeau au point de manœuvre, ou au départ sans position | « Dans 0 m » | « Maintenant » |
| 7 | Guidage d'un trajet d'un autre jour | « En avance de 10189 min », « 169 h 49 restantes » | la date et l'heure du départ |
| 8 | Sans position | la pastille « Position introuvable : … » sort de la carte du bas à droite | dans la carte |
| 9 | Sans position | le point bleu reste dessiné comme une vraie position | un point qui dit « estimé » |
| 10 | « Recalculer depuis ici » sans localisation | « Position introuvable. Réessayez, ou choisissez Domicile. » ; il n'y a pas de choix Domicile dans le guidage | dire quoi faire |
| 11 | Détail du trajet | « 2 min, 0 m jusqu'à gare de Laroche - Migennes » | ni « 0 m », ni article manquant |

Fausse piste écartée : l'écart au chemin semblait ne jamais se déclencher en simulation. Le domaine, rejoué sous Node avec le trajet réel récupéré par `logcat`, alerte bien à 15 s ; sur le téléphone aussi, une fois le lien profond pris (environ 8 s après `am start`). Les attentes de l'essai étaient trop courtes.

## 2. Causes

- 1 à 3 : `contenuBandeau` traitait tout véhicule comme un bus ; la phrase de la descente était fixe dans `situer`. Un taxi a un seul « arrêt », la dépose, donc passait par le cas « direct ».
- 4 : texte fixe dans `CarteBas`.
- 5 : `aLieu` ne reconnaissait « gare » qu'en minuscule ; le nom d'un lieu choisi (« Gare de Joigny ») commence par une majuscule.
- 6 : le titre affichait toujours la distance, même nulle.
- 7 : `statutMarche` et `minutesEnTexte` ne prévoyaient que des minutes ou des heures.
- 8 : sur Android, un `Text` dans une rangée à largeur automatique est mesuré à la largeur du parent, sans compter l'icône ; `max-w-full` et `shrink` n'y changent rien (essayé).
- 9 : `PointPosition` n'avait qu'un style.
- 10 : le recalcul reprenait les messages de la recherche, faits pour l'Accueil.
- 11 : texte construit à la main dans `Trajet.tsx`, distance écrite même nulle.

## 3. Corrections

- `src/domaine/guidage.ts` : `estTaxi`, `textesVehicule` (taxi : « En taxi », « Jusqu'à la gare de … », « Arrivée prévue à 08:58 » ; direct : « Arrivée prévue à … »), `titreDescente` et `phraseDescente` (« Vous arrivez : … » pour un taxi), `lieuMontee` (gare, station, arrêt, point de rendez-vous), `aLieu` insensible à la casse, `phraseMarche` (sans « 0 m »), statut `a_venir` au-delà de 12 h (« Départ prévu le 12/11 à 06:17 »), `minutesEnTexte` en jours (« 7 j 01 h »), avance et retard en heures (« En avance de 1 h 15 »). Choix notés en D83.
- `guidage.tsx` : « Maintenant » à 10 m ou moins d'une manœuvre ; pastille `pleine` pour un texte de deux lignes ; pastille du statut à venir aux couleurs de « prévu ».
- `CarteGuidage.tsx` : point gris et sans faisceau quand la position est inconnue.
- `src/stockage/position.ts`, `src/recherche.tsx` : `MESSAGES_POSITION_GUIDAGE` pour le recalcul.
- `Trajet.tsx` : ligne de marche par `phraseMarche`.

- Relecture indépendante du correctif (même jour), 6 remarques vérifiées et corrigées : seuil « à venir » qui laissait « En avance de 10 h » la veille au soir (désormais : plus de 12 h, ou un autre jour à plus de 3 h) ; gare reconnue par son type et non par le début de son nom (« Paris Gare de Lyon ») ; transport à la demande sans arrêts guidé comme un taxi (`vientVousChercher`) ; lieu d'un taxi sans « arrêt » (`nomLieuVehicule`, « Montez dans le taxi à Domicile ») ; trajet à venir qui commence par un véhicule (« Taxi le 12/11 à 08:46 », carte du bas « Départ prévu le 12/11 à 08:46 » au lieu de « 7 j 03 h restantes ») ; commentaire mal placé.
- Deuxième tour de relecture, 4 remarques corrigées : en attente d'un véhicule à venir, une seule heure, celle du véhicule avec sa propre date (le bandeau disait 08:30 et la carte du bas 08:25, l'heure de départ de chez soi) ; la marche qui mène à un taxi ne dit plus « arrêt » (guidage et détail) ; la règle « réservé, donc en retard et non passé » renommée pour ne plus se confondre avec `vientVousChercher`.
- Troisième tour, 1 remarque corrigée : « Ensuite : … à pied jusqu'à … » à la descente suit la même règle que la marche vers un taxi.
- Quatrième tour, 1 remarque corrigée : la consigne d'arrivée de « Voir le chemin » (`destinationMarche`) suit aussi cette règle ; `vientVousChercher` et `nomLieuVehicule` passent dans `resultat.ts`, à côté de `nomLieuEtape`.
- Cinquième tour, 2 remarques corrigées : la ligne d'une étape en véhicule du détail prend ses articles (« De l'arrêt … à l'arrêt … », « De la gare … », et pour un taxi « De Domicile à … »), `phraseTrajetVehicule` ; documentation de `nomLieuEtape` remise à sa place.
- Vu en revérifiant : « Arrêter le guidage » ne fermait pas un guidage sans écran derrière lui (ouvert par un lien) ; il revient alors au Résultat. Les deux erreurs « multiple navigation containers » vues pendant l'essai venaient de ma manipulation (activité fermée par « Retour », puis rouverte par un lien sur le même moteur JS), pas du code ; disparues après rechargement.
- Sixième tour, 2 remarques corrigées : élision et article contracté pour un nom dit tel quel (« d'Auxerre centre », « du Creusot », « Jusqu'aux Ulis » ; pas d'élision devant « h », souvent aspiré dans les noms de lieux) ; commentaire remis sur sa ligne.
- Septième tour, 1 remarque corrigée : l'annonce vocale « Dans 150 m, arrivée à l'arrêt Mairie » prend son article (elle disait « arrivée à arrêt Mairie »).
- Huitième tour, 1 remarque corrigée : la consigne d'arrivée (bandeau, voix, « Voir le chemin ») prend son article sujet : « L'arrêt Mairie est devant vous », « La gare de Joigny est sur votre droite ».

## 4. Tests de régression

`src/domaine/guidage.test.ts`, blocs « issue 0017 » : 20 tests ; les 10 premiers échouent sur l'ancien `guidage.ts` (10 échecs constatés) et passent sur le nouveau. Suite complète : 172 tests verts ; lint et types sans erreur ; export Android réussi.

## 5. Revérifié sur le téléphone

Mêmes liens profonds après correction : taxi « En taxi / Jusqu'à la gare de Laroche - Migennes / Arrivée prévue à 08:58 », puis « Vous arrivez / Laroche - Migennes · 08:58 » ; « Vous êtes au point de rendez-vous », « Vous êtes à la gare » ; TER direct « Arrivée prévue à 09:09 » ; « Ensuite : 1 min à pied jusqu'à la gare de Joigny » ; « Maintenant / Tournez à gauche place de la Gare » ; sans position « Maintenant / Partez vers le nord », « Départ prévu le 12/11 à 06:17 », pastille dans la carte (bord droit du texte à 1269 px, carte à 1311 px), point gris ; double appui sur « Étape suivante » : une seule étape ; détail « 2 min jusqu'à la gare de Laroche - Migennes ».

## 6. Pas essayé ici (il faut Brainditech)

- Recalcul réussi : la localisation du téléphone est coupée, je ne l'ai pas activée (réglage système).
- Voix : le build installé n'a pas `expo-speech` ; nouveau development build nécessaire.
- Marche réelle avec le GPS (critère 6 de la spec 12).

## 7. Vu en passant, hors de la PR #20

- Réglages, domicile « parking brienon sur armaçon » : six candidats identiques « Parking, Brienon-sur-Armançon, 89210 », impossibles à distinguer.
- Confirmation du lieu « gare de Joigny » : un arrêt « JOIGNY-3 RUE DE LA GARE » affiché « à 5348 km » (coordonnées fausses dans un GTFS).
- Accueil : « La compréhension de phrase est indisponible » (le serveur ne comprend pas la phrase ; à vérifier côté configuration).
- À chaque ouverture du guidage avec la localisation coupée, Android redemande d'activer la précision de la localisation (fenêtre du système).
