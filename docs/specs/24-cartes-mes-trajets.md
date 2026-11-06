# Spec 24 — Mes trajets : cartes compactes et menu « ⋮ »

- **Date** : 2026-11-06
- **État** : **approuvée** par Brainditech le 2026-11-06 (« ok ça va j'approuve vas y »). Règle : D100, révisée le même jour par D101 (§7). **Appliquée** sur `phase-5/mes-trajets-cartes`, constatée par adb (§6).
- **Branche** : `phase-5/mes-trajets-cartes`.
- **Origine** : retour de Brainditech sur la spec 22 : « j'aime pas trop l'affichage, je veux des petits rectangles stylés, et trois points qui ouvrent 3 menus, icône crayon pour modifier, yeux pour afficher et corbeille pour supprimer, et que toutes les informations utiles soient visibles directement dans le petit rectangle ».
- **Case de PLAN.md** : aucune nouvelle. La case de la phase 5 « Écran en valeurs en dur, comparé à sa maquette » se constate avec ce nouvel affichage (écart voulu avec la maquette 06, §3).
- **Invariants** : 3 (aucune heure recalculée : tout vient de la réponse enregistrée), 12 (l'horaire reste dit « prévu »), 20 (jetons du design system seulement).

## 1. But

Aujourd'hui, une carte de voyage occupe presque tout l'écran (capture `spec-22/2026-11-06-avion-05`) : on n'en voit qu'une, il faut défiler, et « Supprimer » est un lien perdu en bas. Avec plusieurs voyages, la liste devient illisible.

Chaque voyage devient un **petit rectangle** qui dit tout d'un coup d'œil. Les actions passent dans un menu « ⋮ ».

## 2. Doc lue

- React Native 0.88 : `Modal` (transparent, `onRequestClose` pour le bouton Retour d'Android), `Pressable`, `measureInWindow` pour poser le menu sous les trois points.
- expo-symbols 58 (déjà utilisé) : icônes Material `more_vert`, `visibility`, `edit`, `delete`.
- Aucun paquet nouveau et aucun build natif : ça marche avec le build actuel.

## 3. Décision D100

### 3.1 Le rectangle (un par voyage)

```
╭───────────────────────────────────────────╮
│▌ JEUDI 12/11                           ⋮  │
│▌ Domicile → Joigny                        │
│▌                                          │
│▌ Aller    06:18 → 08:04   1 h 46 · 1 chgt │
│▌ Retour   11:42 → 13:10   1 h 28 · direct │
│▌                                          │
│▌ (✓ Sans réseau) (✓ Carte) (🕓 Prévu)      │
╰───────────────────────────────────────────╯
```

- **Liseré à gauche** de 4 dp : `primaire` pour un voyage à venir, `bordure-carte` pour un voyage passé.
- **Ligne 1** : le jour (« Jeudi 12/11 », `badge` 14 sp, `texte-secondaire` ; écrit comme ailleurs dans l'app, pas en capitales, §6.1) et, à droite, le bouton « ⋮ » (48 dp de zone de toucher).
- **Ligne 2** : « Départ → Arrivée » en `titre-carte` (20 sp, 600), sur deux lignes au plus, coupé par « … » au-delà.
- **Aller** et **Retour** : heure de départ → heure d'arrivée en chiffres tabulaires et gras, puis la durée et le nombre de changements (« direct », « 1 chgt », « 2 chgt »). Ces valeurs viennent de la possibilité du verdict (D79, D80), comme « Départ 06:18 » aujourd'hui. Cas particuliers :
  - pas de retour demandé : pas de ligne Retour ;
  - retour impossible : « Retour   aucun ce jour-là », en `erreur` ;
  - nuit dehors : l'heure d'arrivée garde son jour (« ven. 07:12 »), comme le Résultat.
- **Pastilles** (puces de 14 sp) :
  - « ✓ Sans réseau » (toujours vraie pour un voyage enregistré) ;
  - « Carte » selon l'état de la spec 23 : « ✓ Carte », « Carte 42 % », « Carte absente » ou « Carte : échec » ; ces deux dernières se touchent pour lancer le téléchargement ;
  - « 🕓 Prévu » : l'horaire n'est pas suivi en direct (invariant 12). TalkBack lit « Horaire prévu, sans suivi en direct ».
- « Enregistré le 06/11 à 02:57 » quitte le rectangle : il reste dans le bandeau du Résultat rouvert (spec 22, §3.5) et dans la phrase TalkBack du rectangle.
- **Toucher le rectangle** ouvre le trajet, comme l'œil.
- Plus de bouton « Ouvrir le trajet » sous le prochain voyage : chaque rectangle s'ouvre seul, et la liste reste dense.
- Écart entre deux rectangles : `ecart-cartes` (12 dp). Rayon : `rayon-bouton` (16 dp, plus serré que les grandes cartes). Fond `fond`, bordure `bordure-carte`, `ombre-flottante`.

### 3.2 Le menu « ⋮ »

Un petit menu flottant s'ouvre sous les trois points, avec trois lignes (icône + texte, 48 dp de haut chacune) :

| Icône | Texte | Action |
|---|---|---|
| œil (`visibility`) | Afficher | ouvre le Résultat du voyage, sans réseau (comme aujourd'hui) |
| crayon (`edit`) | Modifier | ouvre le formulaire de l'onglet Chercher **pré-rempli** avec ce voyage : départ, arrivée, date, heure, sens, marge, fin du rendez-vous. On change ce qu'on veut, on relance la recherche (réseau nécessaire) ; « Enregistrer ce voyage » **remplace** alors l'ancien voyage, même si la date ou l'heure ont changé |
| corbeille (`delete`, en `erreur`) | Supprimer | même confirmation qu'aujourd'hui (« Supprimer ce trajet ? »), la carte du voyage part avec lui (D99) |

- Toucher à côté ou le bouton Retour d'Android ferme le menu.
- Le menu est lu par TalkBack comme une liste de trois boutons.

### 3.3 Ordre et sections

Inchangés (spec 22, §3.4) : à venir du plus proche au plus lointain, puis le titre « Passés ». Message de liste vide et ligne illisible inchangés.

**Écarté** :
- Garder le grand bloc de la maquette 06 : un seul voyage visible par écran.
- Les trois icônes posées directement sur le rectangle : trop de cibles de toucher côte à côte pour un débutant, et la corbeille serait touchée par erreur.
- Un menu natif Material (`@expo/ui`, Jetpack Compose) : demanderait de vérifier son API et le build ; le menu en React Native suffit et suit les jetons.
- « Modifier » qui garde l'ancien voyage à côté du nouveau : deux voyages presque identiques dans la liste, et l'ancien n'a plus de raison d'être.

## 4. Ce qui est construit

- `src/domaine/voyages.ts` (testé) : `resumeVoyage` rend aussi, pour l'aller et le retour, `{ depart, arrivee, duree, changements }` ou « aucun ce jour-là » ; `phraseTalkBack(voyage)`.
- `src/composants/MenuActions.tsx` : le menu flottant (Modal, posé sous le bouton).
- `src/composants/RectangleVoyage.tsx` : le rectangle du §3.1.
- `mes-trajets.tsx` : la liste de rectangles.
- `src/recherche.tsx` : `useModifierVoyage()` (pré-remplit la recherche et retient la clé du voyage à remplacer) ; `formulaire.tsx` lit ces valeurs au lieu des valeurs par défaut ; l'enregistrement supprime l'ancienne clé si elle diffère (et sa carte).

## 5. Critères d'acceptation

1. **Tests du domaine**, rouges avant le code : durée et changements (direct, 1, 2), retour absent, retour impossible, arrivée le lendemain, phrase TalkBack.
2. **Téléphone** (adb) : deux voyages enregistrés (un à venir, un passé si possible) tiennent ensemble à l'écran ; chaque rectangle montre jour, lieux, aller, retour, pastilles ; « ⋮ » ouvre les trois lignes ; Afficher ⇒ Résultat ; Modifier ⇒ formulaire pré-rempli, nouvelle heure, enregistrer ⇒ un seul rectangle, à la nouvelle heure ; Supprimer ⇒ confirmation puis disparition. Captures dans `docs/screenshots/spec-24/` (D93).
3. `npx expo lint`, `npx tsc --noEmit`, `npm test` verts.

## 6. Constats

### 6.1 Code (2026-11-06)

- `src/domaine/voyages.test.ts` : 4 nouveaux tests rouges avant le code (résumé, direct / 2 chgt / lendemain, retour absent ou impossible, pré-remplissage), puis verts. App : 312 tests, `npx expo lint` et `npx tsc --noEmit` verts.
- `possibiliteDuVerdict` sort de `phraseVerdict` (`src/domaine/resultat.ts`) : le rectangle et le verdict lisent la même possibilité (D80).
- Le formulaire ouvert par « Modifier » porte un bandeau : « Vous modifiez le trajet du Jeudi 12/11 · Domicile → Joigny. « Enregistrer ce voyage » remplacera l'ancien. » Sans lui, rien ne dirait que l'enregistrement remplace.
- Si la suppression de l'ancien voyage échoue après l'enregistrement du nouveau, le nouveau reste enregistré et l'ancien reste dans la liste (aucun message d'échec trompeur).
- **Classes NativeWind nouvelles ignorées par le Metro déjà lancé** (`right-1`, `top-1`, `gap-1.5`, `uppercase`, `pb-2`…), même après « Reload » : le bouton « ⋮ » se posait sur le jour (capture 01). Ces réglages passent en `style` (espacements en dp), sans dépendre d'un `--clear` de Metro. Le jour s'écrit donc sans capitales.

### 6.2 Téléphone (2026-11-06, adb, MOTIS national)

Captures `docs/screenshots/spec-24/2026-11-06-00` à `10` (non versionnées, D93 : elles montrent le domicile).

| Point du critère 2 | Constaté |
|---|---|
| Rectangle | « Jeudi 12/11 », « Domicile → Joigny », « Aller 06:18 → 08:04 1 h 46 · 1 chgt », « Retour 11:42 → 13:59 2 h 17 · 1 chgt », « Sans réseau », « Prévu », liseré indigo, « ⋮ » en haut à droite (03). Pas de pastille de carte : le build installé n'a pas le module `reseau-carte` (spec 23), comme prévu |
| « ⋮ » | Menu sous le bouton : œil « Afficher », crayon « Modifier », corbeille « Supprimer » en rouge (04) |
| Modifier | Formulaire pré-rempli : Domicile, Joigny (89300, sans nouvelle recherche), jeudi 12/11/2026, 10:00, « Arriver avant », marge 10, et le bandeau (05) ; « Partir à » puis « Chercher » ⇒ « Possible · Départ 13:16 » (06) ; « Enregistrer ce voyage » (07) ⇒ un seul rectangle, aller « 13:16 → 13:51 35 min · direct » (08) |
| Toucher le rectangle | Résultat avec « Voyage enregistré le 06/11 à 03:50. Horaires prévus, sans suivi en direct. » (09) |
| Supprimer | « Supprimer ce trajet ? », « Jeudi 12/11 · Domicile → Joigny », « Annuler » / « Supprimer » (10) ; « Annuler » ⇒ le rectangle reste |

- Deux voyages ensemble à l'écran : pas encore vu (un seul voyage enregistré) ; le rectangle fait environ un tiers de la hauteur de l'écran de la spec 22.

## 7. Révision du 2026-11-06 : un trajet par sens, disquette, corbeille

- **État** : **approuvée** par Brainditech le 2026-11-06 (« oui c'est ça vas y »), après l'essai de la première version et avant tout push. Elle remplace les §3.1 (bouton « ⋮ »), §3.2 et §4 là où ils diffèrent.
- **Origine** : « en cliquant sur le trajet il s'affiche directement, donc Afficher et Modifier ne servent plus à rien, seule une corbeille sert » ; « peut-être que ça ne m'intéresse pas d'enregistrer un retour, juste l'aller, une personne me raccompagne » ; « le gros bouton en bas, enlève-le, remplace-le par une petite disquette en haut à droite à la place du chevron : quand je veux enregistrer un trajet avec moins de marche, je clique et hop ».

### 7.1 Un trajet enregistré = un sens

- Chaque sens s'enregistre à part : l'aller est un trajet, le retour en est un autre. On supprime l'un sans l'autre.
- Un **retour enregistré seul** devient un trajet ordinaire : départ = lieu d'arrivée de l'aller, arrivée = lieu de départ de l'aller, « Partir à » la fin du rendez-vous, même date, même marge, sans retour. Sa réponse est celle du retour, telle que le serveur l'a donnée (aucune heure recalculée, invariant 3). L'adresse de son arrivée est celle connue du départ de l'aller (même règle qu'au Résultat).
- Le Résultat rouvert, la carte (D99), « Modifier » et la clé (D98, §3.3) traitent donc un retour comme n'importe quel trajet.
- **Voyages déjà enregistrés avec un retour** : coupés en deux trajets (aller, retour) à la première lecture de Mes trajets ; l'ancienne ligne et sa carte partent. Rien n'est perdu.
- **Le tri choisi est gardé** pour chaque sens (spec 21, D97). Le rectangle montre la première possibilité de ce tri. Avec « Arrivée la plus tôt » (ou si le tri ne garde aucune possibilité), il montre toujours la possibilité du verdict (D80). Le Résultat rouvert s'ouvre sur ce tri.

### 7.2 La disquette

- Le bouton « Enregistrer ce voyage » en bas du Résultat **disparaît**. Une **disquette** (`save`, 48 dp) prend la place du chevron en haut à droite de « Votre trajet ». Sur un résultat neuf, la carte « Votre trajet » ne se replie donc plus (elle reste dépliable sur un trajet rouvert, qui n'a pas de disquette).
- Sans retour demandé (ou un seul sens possible) : **un toucher enregistre** ce sens.
- Avec un retour et les deux sens possibles : un petit menu (même composant que le « ⋮ ») propose « Aller et retour », « Aller seulement », « Retour seulement ».
- Enregistré : l'icône devient une coche verte (touchée de nouveau, elle rouvre le choix et remplace). Sous « Votre trajet », la ligne « Enregistré dans Mes trajets » avec « Voir Mes trajets », puis l'état de la carte de chaque trajet enregistré (spec 23).
- Échec : « Le trajet n'a pas pu être enregistré sur le téléphone. » sous « Votre trajet ».
- « Modifier la recherche » reste en bas.

### 7.3 Le rectangle et le trajet rouvert

- Le « ⋮ » laisse place à une **corbeille** (`delete`, en `erreur`, 48 dp) en haut à droite du rectangle, avec la même confirmation.
- Le rectangle a une seule ligne d'horaires : `06:18 → 08:04   1 h 46 · 1 chgt`, précédée de « Aller » ou « Retour ». Un retour garde son titre réel (« Joigny → Domicile »).
- Toucher le rectangle ouvre le trajet. Le trajet rouvert montre le **crayon** dans « Votre trajet » : il ouvre le formulaire pré-rempli (§3.2), et l'enregistrement remplace ce trajet.
- Le bandeau du formulaire dit : « Vous modifiez le trajet du Jeudi 12/11 · Domicile → Joigny. Il sera remplacé à l'enregistrement. »

**Écarté** :
- Garder un voyage en bloc avec un choix « garder le retour » : un retour seul ne s'enregistrerait pas, et la suppression d'un seul sens resterait impossible.
- Une disquette sur chaque verdict : deux icônes de plus, et « Votre trajet » est l'endroit où l'on voit le trajet entier.
- Garder le menu « ⋮ » : « Afficher » refait le toucher du rectangle, « Modifier » est mieux sur le trajet ouvert.

### 7.4 Critères d'acceptation (en plus du §5)

1. Tests du domaine, rouges avant le code : aller seul, retour seul (lieux échangés, partir à la fin du rendez-vous, réponse du retour), les deux ; ancien voyage coupé en deux ; tri gardé et montré par le résumé ; tri vide ⇒ possibilité du verdict.
2. Téléphone (adb) : disquette ⇒ menu à trois choix avec un retour ; « Aller seulement » ⇒ un rectangle ; trier « Moins de marche » puis enregistrer ⇒ le rectangle montre ce trajet ; corbeille ⇒ confirmation ; trajet rouvert ⇒ crayon ⇒ formulaire pré-rempli. Le voyage déjà enregistré devient deux rectangles.

### 7.5 Constats (2026-11-06)

- **Code** : `src/domaine/voyages.test.ts`, 10 tests nouveaux ou réécrits, rouges avant le code (fonctions absentes), puis verts. App : 318 tests, `npx expo lint` et `npx tsc --noEmit` verts.
- Le tri est remonté du bloc de chaque sens au Résultat, qui le passe à la disquette. `MenuActions` sert aussi à la disquette : une seule action ⇒ elle part sans menu.
- **Téléphone** (adb, MOTIS national), captures `docs/screenshots/spec-24/2026-11-06-20` à `33` (non versionnées, D93) :

| Point du §7.4 | Constaté |
|---|---|
| Ancien voyage coupé en deux | « Joigny → Domicile · Retour 11:42 → 13:59 » et « Domicile → Joigny · Aller 13:16 → 13:51 », chacun avec sa corbeille (21) |
| Toucher ⇒ trajet rouvert ⇒ crayon | Bandeau « Voyage enregistré… », crayon dans « Votre trajet » (22) ; crayon ⇒ formulaire pré-rempli, bandeau « Il sera remplacé à l'enregistrement » (23) |
| Disquette | À la place du chevron, plus de bouton en bas (28) ; avec un retour, menu « Aller et retour / Aller seulement / Retour seulement » (29) |
| Aller et retour | Coche verte, « Enregistré dans Mes trajets · Voir Mes trajets » (31) ; Mes trajets : l'aller modifié remplace celui de 13:16, le nouveau retour 16:42 s'ajoute, l'ancien retour 11:42 reste (32) |
| Corbeille | « Supprimer ce trajet ? », « Jeudi 12/11 · Joigny → Domicile » ; « Annuler » ⇒ les trois restent (33) |

- **Pas vu sur le téléphone** : le tri gardé (chaque sens de cette recherche n'a qu'une possibilité, donc pas de puces) ; couvert par le test « le tri gardé choisit la possibilité montrée ». La pastille de carte attend le nouveau build (spec 23).
- Vu en passant : le retour 11:42 part avant l'arrivée de l'aller modifié (défaut du formulaire déjà signalé, pas encore ouvert dans `docs/issues/`).
