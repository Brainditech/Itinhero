# Design system — jetons d'Itinhero

> Rédigé le 2026-11-02 à partir de D30 (`docs/decisions/0001-cadrage-v1.md`), de `design/prompt.md` et des maquettes validées par Brainditech le 2026-11-02 (`design/*/0N-*.png`, `design/design-system/design-system.png`).
> Source unique des jetons que NativeWind lira en phase 0 (D28). Toute valeur changée ici passe par une décision écrite.
> Contrastes calculés le 2026-11-02 (formule WCAG 2.x). Ombre, voile et rayons : valeurs relevées sur les maquettes, à ajuster à l'œil en phase 0 sans changer leur rôle.

## Principes

1. Ce qui se lit en premier sur chaque écran : le verdict et l'heure de départ.
2. Une seule action principale par écran : un bouton plein, en bas du contenu.
3. Mode clair d'abord. Contraste AA partout : 4,5:1 pour le texte, 3:1 pour les icônes et les bordures.
4. La couleur n'est jamais le seul signal : chaque mode et chaque état a une icône et un mot.
5. Le texte suit la taille choisie dans Android, jusqu'à 200 % (A2) : les libellés passent à la ligne, jamais coupés.
6. Aucune valeur inventée : ce que la donnée ne donne pas s'affiche « — », « prix non publié » ou « horaire prévu, sans suivi en direct ».

## Couleurs

### Base

| Jeton | Valeur | Rôle | Contraste |
|---|---|---|---|
| `fond` | `#FFFFFF` | fond des cartes et des écrans sans carte | — |
| `surface` | `#F4F5F8` | champs, zones groupées, bandeau d'info | — |
| `texte` | `#14161F` | texte principal | 18,0:1 sur blanc |
| `texte-secondaire` | `#4A5063` | texte secondaire, libellés | 8,0:1 sur blanc, 7,4:1 sur `surface` |
| `bordure-champ` | `#8A90A0` | contour des champs, pointillé « prix non publié » | 3,2:1 sur blanc |
| `bordure-carte` | `#D5D8E0` | contour des cartes, séparateurs (décoratif) | — |
| `primaire` | `#3730A3` | bouton principal, liens, onglet actif, mot « Itinhero » | 9,9:1 (texte blanc dessus) |
| `primaire-presse` | `#2A2480` | bouton principal pressé | 12,6:1 |
| `primaire-doux` | `#ECEBFA` | pastille de l'onglet actif | — |
| `sombre` | `#1F2937` | bandeau hors connexion, fond de l'écran verrouillé | 14,7:1 (texte blanc dessus) |

### Modes de transport

Fond plein des blocs de la frise (texte blanc dessus) et couleur d'icône sur blanc.

| Jeton | Valeur | Mode | Contraste avec blanc | Forme |
|---|---|---|---|---|
| `mode-train` | `#1F5FA8` | train | 6,4:1 | bloc plein |
| `mode-car` | `#7B3FA0` | car (car TER) | 6,9:1 | bloc plein |
| `mode-tad` | `#0E7472` | transport à la demande | 5,6:1 | bloc plein, avec « Réserver avant … » |
| `mode-marche` | `#5B6170` | marche | 6,2:1 | ligne pointillée, jamais un bloc |
| `mode-taxi` | `#2E2E38` | taxi | 13,4:1 | bloc plein, avec bouton « Appeler » |

### États

Badge en pastille : texte foncé sur teinte claire, avec icône. Variante « texte seul » sur blanc.

| État | Texte | Teinte | Contraste | Variante sur blanc | Icône |
|---|---|---|---|---|---|
| À l'heure (en direct) | `#166534` | `#DCFCE7` | 6,5:1 | `#15803D` (5,0:1) | ondes |
| Retard | `#92400E` | `#FEF3C7` | 6,4:1 | `#B45309` (5,0:1) | horloge « + » |
| Supprimé | `#991B1B` | `#FEE2E2` | 6,8:1 | `#B91C1C` (6,5:1) | cercle barré |
| Horaire prévu, sans suivi en direct | `#3F4654` | `#EEF0F3` | 8,3:1 | — | horloge vide, sans ondes |
| Prix non publié | `#374151` | transparent, bordure pointillée 1,5 dp `#8A90A0` | 10,3:1 | — | euro |
| Avertissement (marche > 15 min) | `#B45309` | — | 5,0:1 | — | triangle |

Les mêmes couleurs servent aux icônes des notifications (supprimé, retard, correspondance menacée).

## Typographie

- Une seule famille : **Inter** (400, 500, 600, 700).
- Heures et durées en **chiffres tabulaires** (`tnum`), format 24 h « 06:27 ».
- Casse de phrase partout, jamais de libellé tout en majuscules.

| Jeton | Taille | Graisse | Usage |
|---|---|---|---|
| `heure-depart` | 40 sp | 700 | « Départ 06:27 », « Partez à 06:27 » : le plus gros texte de l'écran |
| `verdict` | 24 sp | 600 | « Possible » |
| `titre-ecran` | 22 sp | 600 | titre d'écran, mot « Itinhero » |
| `titre-carte` | 20 sp | 600 | titre de carte, saisie de l'Accueil |
| `corps` | 18 sp | 400 | texte courant (minimum pour le corps) |
| `secondaire` | 16 sp | 400 | texte secondaire, libellés de champ |
| `badge` | 14 sp | 500 | badges, onglets (aucun texte plus petit, sauf barre d'état et attribution de carte) |

## Espacements, rayons, ombre

| Jeton | Valeur | Usage |
|---|---|---|
| `grille` | 8 dp | toutes les marges et tous les écarts sont des multiples de 8 (4 dp pour un ajustement fin) |
| `marge-ecran` | 16 dp | marges latérales |
| `ecart-cartes` | 12 dp | entre deux cartes empilées |
| `rayon-carte` | 24 dp | cartes flottantes, barre d'onglets, bulles de notification |
| `rayon-bouton` | 16 dp | boutons, blocs de la frise, bandeaux |
| `rayon-champ` | 12 dp | champs de saisie |
| `rayon-bulle` | 20 dp | bulles de conversation de l'Assistant |
| `rayon-puce` | pilule (complet) | puces, badges |
| `hauteur-bouton` | 56 dp | bouton principal |
| `cible-tactile` | 48 dp minimum | tout élément touchable |
| `ombre-flottante` | flou 12 px, décalage vertical 4 px, `#14161F` à 8 % | cartes flottantes, barre d'onglets |
| `bordure-selection` | 2 dp `primaire` | carte ou champ sélectionné |

## Fond d'écran

- Accueil et sa pile (D36) : **vraie carte MapLibre** (OpenFreeMap Positron) qu'on déplace et zoome aux doigts, sans rotation ni inclinaison, sous un voile blanc (jeton `voile`, 0,3, laisse passer les touchers) ; attribution « © OpenMapTiles © OpenStreetMap » en haut à droite, au-dessus du voile, repliée en bouton ⓘ au premier geste sur la carte ou après 5 secondes (D37). L'image inventée ci-dessous reste dessous en secours (hors connexion, chargement, style absent).
- Autres écrans de l'app, et secours : image fixe d'une carte rurale claire et sans libellé (terre `#EEF0F3`, routes blanches, rivières bleu-gris pâle, limites de communes gris pâle), sous un **voile blanc à 70 %**. Image inventée par `scripts/generer-fond-carte.py` (`assets/images/fond-carte.png`, D35), sans point de position. Purement décoratif : ce n'est pas une carte interactive (D9 inchangée), aucune attribution, aucun bouton.
- Écran Détail : la vraie carte du trajet (MapLibre, D9) occupe le haut de l'écran, avec l'attribution « © OpenStreetMap ».
- Écran verrouillé (notifications) : même motif en version sombre sur `sombre`.

## Composants

| Composant | Règle | Maquette |
|---|---|---|
| Mot « Itinhero » | `titre-ecran`, `primaire`, en haut à gauche de chaque écran de l'app | toutes |
| Carte flottante | `fond`, `rayon-carte`, bordure `bordure-carte`, `ombre-flottante` | toutes |
| Bouton principal | plein `primaire`, texte blanc 20 sp 600, pleine largeur moins `marge-ecran`, `hauteur-bouton`, `rayon-bouton` ; un seul par écran | toutes |
| Bouton secondaire | contour 1,5 dp `primaire`, texte `primaire` | design system |
| Lien | texte `primaire`, 18 sp 500 | 01, 03 |
| Bouton désactivé | fond `#E4E6EC`, texte `#8A90A0` | design system |
| Champ | fond `surface`, contour 1 dp `bordure-champ`, `rayon-champ` ; actif : 2 dp `primaire` ; erreur : 2 dp `#B91C1C` et message dessous en `#B91C1C` | 02, design system |
| Sélecteur à deux choix | « Arriver avant » / « Partir à », choix actif plein `primaire` | 02 |
| Puce | pilule, texte `badge` 14 sp 500, marge interne 16 dp (D35) ; active : pleine `primaire`, texte blanc ; inactive : blanche, contour `bordure-carte` | 01, 04 |
| Carte d'itinéraire | heures en `titre-carte` tabulaires, bande horizontale des modes, ligne des modes, avertissement, badge prix | 04 |
| Bloc de frise | un par mode (voir Modes), heure de montée dans la colonne de gauche, descente en bas du bloc, badges blancs dans le bloc | 05 |
| Barre d'onglets | pilule blanche flottante, 4 onglets icône au-dessus du libellé : Chercher, Mes trajets, Assistant, Réglages ; onglet actif : icône et libellé `primaire` sur `primaire-doux` | 02 à 07, 09 |
| Bandeau hors connexion | fond `sombre`, texte blanc, icône nuage barré, `rayon-bouton` | 06 |
| Bulle de l'utilisateur | pleine `primaire`, texte blanc, `rayon-bulle`, à droite | 09 |
| Bulle de l'Assistant | carte flottante, avatar robot `primaire`, à gauche ; contient les réglages proposés en puces, le réglage changé entouré de `primaire` | 09 |
| Barre de message | pilule blanche, « Écrivez votre demande », bouton rond `primaire` avec flèche ; pas d'icône micro | 09 |
| Feuille modale | poignée, titre, texte, bouton principal | design system |
| États | vide (icône, texte, lien), chargement (cartes squelettes, « Recherche en cours… »), erreur (icône, texte, bouton secondaire « Réessayer ») | design system |

## Icônes

Contour arrondi, 24 dp, un seul jeu : car, train, marche, taxi, minibus (transport à la demande), téléphone, horloge, triangle, épingle de carte, maison, flèche de position, engrenage, marque-page, cloche, nuage barré, robot, flèche d'envoi, loupe, valise.

## Logo

- Symbole : le « I » d'Itinhero dessiné comme une frise (point de départ, trait plein, pointillé, trait plein, point d'arrivée plus gros), traits épais arrondis. Monochrome : blanc sur `primaire` pour l'icône, `primaire` sur blanc pour le logo + nom. Pas de couleur de mode dans le logo.
- Logo + nom : symbole suivi de « Itinhero » en Inter 600, en `primaire` sur blanc ou en blanc sur `primaire`.
- Icône Android : symbole blanc dans la zone sûre d'un carré `primaire`. Fichier de présentation : `design/logo/logo.png` ; le fichier d'icône 1024 px (symbole seul, fond transparent) est à produire en phase 0 pour `app.json`.

## Défauts connus des maquettes

Les textes de référence sont ceux de `design/prompt.md`, pas ceux des images.

- `design/notifications/08-notifications.png` : « possibilitès » au lieu de « possibilités ».
- `design/design-system/design-system.png` : « Aucun trajet enregistté » au lieu de « Aucun trajet enregistré ».
- `design/resultat/04-resultat.png` : « Horaires du 18/10 » en indigo comme un lien ; il doit être en `texte-secondaire`.
- Orange des avertissements plus clair que `#B45309` sur plusieurs images : le code utilise `#B45309`.
- Écrans 02 et 03 : écart vide entre le bouton principal et la barre d'onglets, accepté par Brainditech.
