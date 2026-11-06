# Spec 24 — Mes trajets : cartes compactes et menu « ⋮ »

- **Date** : 2026-11-06
- **État** : **approuvée** par Brainditech le 2026-11-06 (« ok ça va j'approuve vas y »). Règle : D100. **Appliquée** sur `phase-5/mes-trajets-cartes`, constatée par adb (§6).
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
