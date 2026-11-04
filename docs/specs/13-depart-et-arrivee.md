# Spec 13 — Départ et arrivée libres, échangeables

- **Date** : 2026-11-04
- **État** : **approuvée par Brainditech le 2026-11-04 (« implemente ») et appliquée.** Critères 1 à 3 et 7 constatés ; 4 à 6 à constater sur le téléphone.
- **Branche** : `app/depart-arrivee`
- **Maquettes** : `design/accueil/01-accueil.png`, `design/accueil/02-formulaire-repli.png`. Écart voulu, décrit en §4 (comme la spec 10, §4.2).
- **Choix de Brainditech (2026-11-04)** : « deux champs Départ et Arrivée qu'on peut intervertir », avec des icônes maison et position à la place des puces « Depuis : Domicile » et « Depuis ma position ».
- **Décisions** : D77, D78 (acceptées le 2026-11-04). **Invariants** : 6, 9, 10.

## 1. But

Pouvoir chercher **n'importe quel trajet**, et plus seulement « depuis chez moi » ou « depuis ma position » :
- départ **et** arrivée tapés au clavier (une adresse, une gare, un lieu) ;
- un toucher pour mettre **Domicile** (icône maison) ou **Ma position** (icône cible) dans l'un ou l'autre champ ;
- un bouton **⇅** qui échange les deux : l'aller devient le retour (par exemple, arrivée = Domicile).

Aujourd'hui, le formulaire n'a qu'un champ « Lieu » (l'arrivée) et deux puces pour le départ (`formulaire.tsx`, l. 266-271). On ne peut ni partir d'une autre adresse ni rentrer chez soi.

## 2. Ce qui est constaté (2026-11-04)

- Le serveur ne connaît que des coordonnées : `POST /v1/itineraires` reçoit `depart` et `arrivee` en `{ lat, lon }`, et `noms.depart`, `noms.arrivee` pour l'affichage (spec 09 §4.5, issue 0010 C). **Aucun changement côté serveur.**
- `GET /v1/lieux?q=&proche=` sert déjà à trouver l'arrivée ; il sert aussi pour un départ tapé.
- Les icônes viennent déjà de `expo-symbols` (`SymbolView`, symboles Material) : Confirmation, Résultat, Réglages. Symboles prévus : `home`, `my_location`, `swap_vert`. Aucune dépendance ajoutée.

## 3. Décisions proposées

- **D77 — Départ et arrivée ont la même forme.** Chaque bout est l'un de : `domicile`, `position`, ou un texte à chercher. Le schéma Zod de la demande (invariant 9) remplace `lieu_texte` par `depart` et `arrivee` de cette forme. `/v1/comprendre` (phase 1) produira la même forme : « depuis la gare d'Auxerre » devient un départ tapé.
  - Options écartées : un troisième choix « autre adresse » à côté des deux icônes du départ (pas d'échange possible, pas de retour vers le domicile) ; deux formulaires, un pour l'aller, un pour le retour.
- **D78 — Ordre de recherche des lieux.** On résout d'abord les bouts sans texte (domicile, position), puis chaque texte par `GET /v1/lieux`, avec `proche` = l'autre bout s'il est déjà connu, sinon la position si elle est déjà accordée, sinon rien. Si les deux bouts sont tapés et ambigus, la Confirmation demande **le départ d'abord, puis l'arrivée**.

## 4. Ce qui est construit

### 4.1 Formulaire (`formulaire.tsx`)

```
Départ   [ ⌂ Domicile                  ⌂  ◎ ]
                                              ⇅
Arrivée  [ Tribunal administratif Dijon ⌂  ◎ ]
Date [jeudi 12/11/2026]   Heure [10:00]
( Arriver avant ) ( Partir à )
Marge [10] min
```

- Le champ « Lieu » devient **Arrivée** ; un champ **Départ** est ajouté au-dessus. Les puces du bas disparaissent.
- Dans chaque champ, à droite : deux boutons icônes, **maison** (Domicile) et **cible** (Ma position), de 48 dp au moins chacun, avec un libellé lu par TalkBack (« Mettre Domicile en départ »).
- Un bout choisi par icône s'affiche comme une étiquette dans le champ (« ⌂ Domicile », « ◎ Ma position »). Toucher le texte l'efface et ouvre le clavier.
- **⇅**, entre les deux champs, à droite : échange tout (texte ou choix). Les messages d'erreur des deux champs sont effacés.
- Valeurs de départ : Départ = Domicile (ou Ma position si l'Accueil l'a choisi, comme aujourd'hui), Arrivée = la valeur de la maquette.
- Erreurs (sous le champ concerné) :
  - vide : « Indiquez le départ. » / « Indiquez l'arrivée. » ;
  - moins de 2 caractères : « Indiquez au moins 2 caractères. » ;
  - même choix des deux côtés (Domicile → Domicile, position → position) : « Le départ et l'arrivée sont le même lieu. » ;
  - domicile absent : « Indiquez votre domicile dans Réglages. » + lien, comme aujourd'hui ;
  - position refusée ou introuvable : messages actuels de `MESSAGES_POSITION`.
- Aucun texte tapé n'aboutit à un lieu : « Aucun lieu trouvé pour « … ». Essayez avec la commune. » sous le champ concerné.

### 4.2 Accueil (`index.tsx`)

La phrase reste (D15, `/v1/comprendre` pas encore construit). Les deux puces deviennent deux boutons icône + mot, **⌂ Domicile** et **◎ Ma position**, sous le titre « Départ ». Le choix passe au formulaire comme aujourd'hui (`depart=domicile|position`).

### 4.3 Confirmation (`confirmation.tsx`)

- Titre « D'où partez-vous ? » pour le départ, « Quel lieu ? » pour l'arrivée (inchangé).
- Deux bouts ambigus : départ confirmé, puis l'écran passe à l'arrivée. Retour arrière : de l'arrivée au départ, puis au formulaire.
- Sous-titre : « Jeudi 12/11 · arriver avant 10:00 · marge 10 min · depuis Domicile » ; pour un départ tapé et confirmé : « depuis Gare d'Auxerre ». Pendant la confirmation du départ : « depuis un lieu à confirmer ».

### 4.4 Domaine, testé sous Node

- `src/domaine/demande.ts` : type `Bout = { type: "domicile" } | { type: "position" } | { type: "texte"; texte: string }` ; `ChampsFormulaire.depart`, `ChampsFormulaire.arrivee` ; `validerFormulaire` (règles de §4.1) ; `echangerBouts`.
- `src/domaine/resultat.ts` : `sousTitreDemande` et le nom envoyé à l'API (`noms.depart`, `noms.arrivee`) d'après le bout : « Domicile », « Ma position », ou le nom du lieu choisi.
- `src/recherche.tsx` : la recherche garde, pour chaque bout, son point, son nom et ses candidats.

## 5. Fichiers touchés

`src/domaine/demande.ts` (+ tests), `src/domaine/resultat.ts` (+ tests), `src/recherche.tsx`, `src/app/(onglets)/(chercher)/formulaire.tsx`, `index.tsx`, `confirmation.tsx`, `src/composants/elements.tsx` (champ de lieu avec icônes, bouton d'échange) ; `PLAN.md`, `docs/ETAT.md`, `docs/decisions/0001-cadrage-v1.md` (D77, D78).

## 6. Sécurité et vie privée

Rien de nouveau n'est envoyé : un départ tapé part vers `GET /v1/lieux` comme l'arrivée aujourd'hui. Le serveur ne garde ni le texte ni les coordonnées (invariant 6) et ne les journalise pas (invariant 10). La recherche reste en mémoire dans l'app (`recherche.tsx`).

## 7. Critères d'acceptation

1. Tests : `validerFormulaire` refuse un bout vide, un texte de 1 caractère, Domicile → Domicile, position → position ; accepte texte → Domicile, Domicile → texte, position → texte, texte → texte.
2. Tests : `echangerBouts` échange texte et choix ; deux échanges rendent l'état de départ.
3. Tests : les noms envoyés à l'API et le sous-titre pour chaque forme de bout.
4. Sur le téléphone : Brienon (Domicile) → tribunal administratif de Dijon, puis **⇅** ⇒ tribunal → Domicile, recherche réussie (le retour).
5. Sur le téléphone : départ tapé « gare d'Auxerre » ⇒ arrivée « Joigny » : Confirmation du départ puis de l'arrivée si les deux sont ambigus, puis Résultat.
6. Sur le téléphone : icônes maison et cible dans les deux champs, TalkBack lit leur rôle ; capture côte à côte avec la maquette 02, écart accepté par Brainditech.
7. `npx expo lint`, `npx tsc --noEmit`, `npm test` verts.

## 8. Ce qui n'est pas fait ici

La phrase de l'Accueil comprise par Claude (phase 1) ; l'aller et le retour planifiés ensemble (D47, phase 3) : ici, le retour se cherche à part, avec ⇅ ; les lieux favoris ou récents ; le choix d'un point sur la carte.

## 9. Étapes de vérification

`npm test`, `npx expo lint`, `npx tsc --noEmit` ; puis Brainditech refait les critères 4 à 6 sur le téléphone (development build actuel : aucun module natif ajouté, un rechargement suffit).

## 10. Ce qui a été appliqué (2026-11-04)

- `src/domaine/demande.ts` : `schemaBout`, `Bout`, `CoteBout`, `ChampsFormulaire.depart` et `.arrivee`, `validerFormulaire` (règles de §4.1, « même lieu » sous l'Arrivée), `echangerBouts`. `lieu_texte` disparaît du schéma de la demande (D77).
- `src/domaine/resultat.ts` : `nomBout` (« Domicile », « Ma position », nom du candidat, 120 caractères au plus) et `sousTitreDemande(demande, departChoisi)` ; le type `Depart` est retiré.
- `src/recherche.tsx` : `useDeroulerRecherche` (`demarrer`, `confirmer`) déroule D78 ; chaque bout garde son lieu retenu et ses candidats. Un départ confirmé à nouveau (retour arrière) relance la recherche d'une arrivée tapée près de lui.
- `src/stockage/position.ts` : `lirePositionSiAccordee`, sans demande d'accès (D78, « si elle est déjà accordée »).
- Écrans : `ChampLieu` et `BoutonEchange` (`elements.tsx`), `Puce` avec icône ; Accueil (« Départ », ⌂ Domicile, ◎ Ma position) ; Confirmation par bout (`bout=depart|arrivee`) ; « Saisir l'adresse moi-même » revient au formulaire, même depuis la confirmation de l'arrivée.
- Vérifié : `npm test` (97 tests), `npx tsc --noEmit`, `npx expo lint`, `npx expo export --platform android` verts.

## 11. Constaté sur le téléphone (2026-11-04, captures `adb` hors dépôt, D38)

- **Critère 4 — rempli.** Aller : Domicile → tribunal administratif de Dijon, jeudi 05/11 à 08:00 ⇒ « Possible », 08:10 → 10:41 (bus 803 sur réservation, TER K7, tram T2), et trois autres possibilités. ⇅ ⇒ Départ « tribunal administratif dijon », Arrivée « ⌂ Domicile » ; retour à 17:00 ⇒ recherche réussie (« Jeudi 05/11 · Domicile »). Le contenu du retour (nuit à Laroche-Migennes affichée « Possible », taxi du soir absent) est un autre sujet : issue 0011.
- **Critère 5 — rempli.** « gare d'Auxerre » → « Joigny », jeudi 05/11, partir à 17:00 ⇒ « D'où partez-vous ? » (Gare d'Auxerre-Saint-Gervais présélectionnée), puis « Quel lieu ? … depuis Gare d'Auxerre-Saint-Gervais » (Joigny à 24 km, cherché près du départ, D78), puis Résultat : TER P25 17:40 → 18:24, direct. Le retour arrière depuis la confirmation passe bien par la confirmation du départ, puis par le formulaire. Toucher l'étiquette « Ma position » l'efface et ouvre le clavier.
- **Critère 6 — en partie.** Libellés lus par l'accessibilité (`uiautomator`) : « Mettre Domicile en départ », « Mettre Ma position en départ », « Mettre Domicile en arrivée », « Mettre Ma position en arrivée », « Échanger le départ et l'arrivée », « Arrivée : Domicile ». **Écart** : les icônes et ⇅ mesurent 42 dp au lieu de 48 (issue 0012, cause commune à toute l'app). Restent : écoute avec TalkBack et capture côte à côte avec la maquette 02, par Brainditech.
- Autres constats :
  - le bouton ⇅ chevauche le bas du champ Départ, juste sous l'icône ◎ ; il reste lisible mais proche de ◎ (à juger avec la maquette 02) ;
  - sur la Confirmation, le lien « Saisir l'adresse moi-même » est à moitié caché par le bouton « C'est ce lieu » quand la liste remplit l'écran ;
  - une lecture `uiautomator` a donné « opération en cours » sur « Chercher » et « C'est ce lieu » alors que l'écran les montrait actifs. React Native n'ajoute ce texte que si `busy` vaut `true` (`BaseViewManager.java`) : à revoir avec TalkBack avant d'ouvrir une issue.
