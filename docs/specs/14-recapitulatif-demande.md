# Spec 14 — Récapitulatif de la demande en tête du Résultat

- **Date** : 2026-11-04
- **État** : **approuvée par Brainditech le 2026-11-04 avec la maquette 04b (« vasy implemente ») et appliquée.** Critères 1 à 4 et 6 constatés ; 5 (TalkBack) à constater par Brainditech.
- **Branche** : `app/depart-arrivee` (suite directe de la spec 13, même PR).
- **Maquettes** : `design/resultat/04b-resultat.png` (carte « Votre trajet », générée par Brainditech le 2026-11-04), `design/resultat/04-resultat.png` pour le reste. Écarts en §10.
- **Demande de Brainditech (2026-11-04)** : « avant de mettre tes possibles, un récap : pas juste « jeudi 05/11 · Joigny », mais le détail de ce que j'ai demandé, par exemple Domicile → Joigny (France Travail ou bien l'adresse), les heures, départ → arrivée ».
- **Invariants** : 3 (rien d'inventé : chaque texte vient de la demande, du domicile enregistré, du candidat choisi ou de la réponse de l'API), 6 (rien de neuf n'est envoyé au serveur).

## 1. But

Avant le verdict et les possibilités, l'écran Résultat rappelle **toute la demande** pour qu'un débutant vérifie d'un coup d'œil qu'on a cherché le bon trajet :

- **d'où** : nom et adresse du départ ;
- **vers où** : nom et adresse de l'arrivée ;
- **quand** : le jour, « arriver avant 10:00 · marge 10 min » ou « partir à 17:00 ».

Aujourd'hui, la carte du verdict n'en dit qu'une ligne : « Jeudi 05/11 · Joigny » (`resultat.tsx`, l. 34). Le départ n'apparaît pas, l'adresse non plus, ni l'heure demandée.

## 2. Ce qui est constaté (2026-11-04)

- Le nom de chaque bout est déjà connu dans l'app (`LieuChoisi.nom`, spec 13) ; son adresse **ne l'est pas** : `lieuChoisi()` ne garde que le point et le nom.
- Les sources d'une adresse existent déjà :
  - Domicile : `libelle` et `detail` enregistrés sur le téléphone (D65), par exemple le numéro et la rue, puis « Brienon-sur-Armançon, 89210 » ;
  - lieu tapé et confirmé : `commune` et `code_postal` du candidat (`GET /v1/lieux`) ;
  - arrivée : `reponse.arrivee.adresse`, l'adresse postale trouvée par l'IGN (issue 0010 C), par exemple « Rue d'Assas, 21000 Dijon ».
- « Ma position » n'a pas d'adresse, et en chercher une enverrait la position à un service de plus : on ne le fait pas (invariant 6).
- `sousTitreDemande()` (Confirmation) sait déjà écrire « Jeudi 12/11 · arriver avant 10:00 · marge 10 min ».

**Aucun changement côté serveur.**

## 3. Décisions

Aucune nouvelle décision : c'est un affichage de valeurs déjà connues. L'écart à la maquette est décrit en §4.

## 4. Ce qui est construit

### 4.1 Carte « Votre trajet » (nouvelle, en tête du Résultat)

```
Votre trajet                           Modifier
⌂  Domicile
   22 rue Exemple, Brienon-sur-Armançon, 89210
│
◉  France Travail
   19 Route de Chamvres, 89300 Joigny
Jeudi 12/11 · arriver avant 10:00 · marge 10 min
```

- Fond blanc, bordure `bordure-carte`, coins `rounded-carte`, comme la carte du verdict. Titre « Votre trajet » en `texte-secondaire`.
- **Départ** puis **arrivée**, chacun sur deux lignes : le nom en `font-inter-semibold text-corps`, l'adresse en `text-secondaire text-texte-secondaire`. Icônes : `home` pour Domicile, `my_location` pour Ma position, `place` pour un lieu tapé. Un trait vertical relie les deux icônes.
- Adresse affichée, la première disponible :
  1. arrivée : `reponse.arrivee.adresse` (IGN) ;
  2. Domicile : `libelle`, puis `detail` s'il existe, séparés par « , » (rien n'est répété si le nom vaut déjà le libellé) ;
  3. lieu tapé : le type, la commune et le code postal du candidat retenu (comme `detailCandidat`, **sans** la distance) ;
  4. Ma position : aucune ligne d'adresse ;
  5. sinon : aucune ligne.
- Dernière ligne : `quandDemande(demande)` = « Jeudi 12/11 · arriver avant 10:00 · marge 10 min », ou « Jeudi 05/11 · partir à 17:00 ».
- « Modifier », lien à droite du titre (48 dp de haut au moins), fait la même chose que « Modifier la recherche » en bas (`router.dismissTo("/formulaire")`). Le lien du bas reste.
- TalkBack lit la carte d'un bloc : « Votre trajet : de Domicile, 22 rue Exemple, Brienon-sur-Armançon, à France Travail, 19 Route de Chamvres, Joigny. Jeudi 12/11, arriver avant 10:00, marge 10 min. »

### 4.2 Carte du verdict

- Sa première ligne (« Jeudi 05/11 · Joigny ») **disparaît** : elle est dans la carte au-dessus. Le reste ne change pas (« Possible », « Départ 06:27 », la phrase « À faire : … » ou « Arrivée prévue à … »).
- Écart voulu à la maquette 04 : la maquette n'a pas de carte « Votre trajet », et sa carte du verdict commence par « Jeudi 12/11 ». La demande de Brainditech prime.

### 4.3 Domaine (`src/domaine/resultat.ts`, testé sous Node)

- `quandDemande(demande)` : la partie « jour · sens · marge » de `sousTitreDemande`, que `sousTitreDemande` réutilise (son texte ne change pas).
- `adresseBout(...)` : règles du §4.1, renvoie une chaîne ou `null`.
- `LieuChoisi` (`src/recherche.tsx`) gagne `adresse: string | null`, rempli par `lieuChoisi()` depuis le domicile ou le candidat. Rien de plus n'est envoyé à l'API.

## 5. Fichiers touchés

`src/domaine/resultat.ts` (+ tests), `src/recherche.tsx`, `src/app/(onglets)/(chercher)/resultat.tsx`, un composant `CarteTrajetDemande` dans `src/composants/elements.tsx` ou `Trajet.tsx`.

## 6. Sécurité et vie privée

L'adresse du domicile s'affiche sur le téléphone de son propriétaire, déjà enregistrée en local (D65) ; elle n'est ni envoyée, ni journalisée, ni mise dans Sentry. Aucune capture de cet écran n'est versionnée (D38).

## 7. Critères d'acceptation

1. Tests : `quandDemande` pour « arriver avant » avec marge, sans marge, et « partir à » ; `sousTitreDemande` inchangée (tests actuels verts).
2. Tests : `adresseBout` pour Domicile (avec et sans `detail`), Ma position (`null`), un lieu tapé (commune et code postal, sans distance), une arrivée avec adresse IGN (prioritaire), une arrivée sans adresse IGN (repli sur le candidat).
3. Sur le téléphone : Domicile → « France Travail Joigny », jeudi 12/11, arriver avant 10:00, marge 10 min ⇒ la carte « Votre trajet » montre les deux noms, les deux adresses et « Jeudi 12/11 · arriver avant 10:00 · marge 10 min », **avant** « Possible ».
4. Sur le téléphone : après ⇅ (France Travail → Domicile, partir à 17:00), la carte montre le départ et l'arrivée inversés et « partir à 17:00 ».
5. TalkBack lit la carte d'un bloc ; « Modifier » ramène au formulaire avec les champs remplis.
6. `npx expo lint`, `npx tsc --noEmit`, `npm test` verts.

## 8. Ce qui n'est pas fait ici

- Le verdict qui signale un changement de jour ou une nuit sur place (issue 0011 A, B) : spec 15.
- Le taxi comme étape (issue 0011 C, D48) : spec 16.
- La taille des cibles tactiles (issue 0012).

## 9. Précisions apportées en appliquant (2026-11-04)

- Ordre de l'adresse d'arrivée : **le domicile enregistré d'abord** (il est plus juste que l'adresse la plus proche trouvée par l'IGN), puis l'IGN, puis le candidat. Pour les autres bouts, comme en §4.1.
- Lieu tapé : « 89300 Joigny » (code postal puis commune, comme une adresse postale) ; « Arrêt, 89300 Joigny » pour un arrêt ; pas de préfixe « Adresse ». Le `detail` du domicile (« Brienon-sur-Armançon, 89210 ») est remis dans le même ordre.
- La carte « Votre trajet » est faite de deux zones pour TalkBack : le titre et « Modifier » (lien de 48 dp, en valeur explicite, issue 0012), puis le trajet et la date, lus d'un bloc.
- Fichiers : `src/domaine/resultat.ts` (`quandDemande`, `adresseBout`, `adresseArrivee`, `phraseVotreTrajet`), `src/recherche.tsx` (`LieuChoisi.adresse`), `src/composants/VotreTrajet.tsx`, `src/app/(onglets)/(chercher)/resultat.tsx`. Tests : `src/domaine/resultat.test.ts` (5 tests).

## 10. Constaté sur le téléphone (2026-11-04, captures `adb` hors dépôt, D38)

- **Critère 3 — rempli.** Domicile → « France Travail Joigny » (confirmé : Agence France travail), jeudi 12/11, arriver avant 10:00, marge 10 min ⇒ « Votre trajet » : ⌂ Domicile et son adresse enregistrée ; ◉ Agence France travail, « Route de Chamvres, 89300 Joigny » (IGN) ; « Jeudi 12/11 · arriver avant 10:00 · marge 10 min » ; puis « Possible », « Départ 06:17 ».
- **Critère 4 — rempli.** « Modifier » ⇒ formulaire rempli ; ⇅, partir à 17:00 ⇒ « Agence France travail, 89300 Joigny » → « Domicile » et « Jeudi 12/11 · partir à 17:00 ». (Ce retour donne départ 23:12 → 06:32 le lendemain, « Possible » : même défaut que l'issue 0011.)
- **Critère 6 — rempli** : 102 tests, `tsc`, lint et `expo export --platform android` verts.
- **Écarts à la maquette 04b** : icônes au trait au lieu de pleines (`expo-symbols` n'offre pas la variante pleine sur Android) ; la date passe sur deux lignes quand la marge est donnée ; le lien « Voir les étapes » à droite et la barre d'onglets de la 04b ne font pas partie de cette spec.

## 11. Crayon et chevrons (demande de Brainditech, 2026-11-04)

Demande : « mets une icône crayon pour modifier Votre trajet au lieu d'écrire MODIFIER, et des chevrons pour rapetisser chaque bloc, pour éviter de défiler à chaque fois jusqu'en bas ».

- **Votre trajet** : le lien « Modifier » devient un **crayon** (`edit`, bouton rond de 48 dp, TalkBack : « Modifier la recherche »). À sa droite, un **chevron** replie la carte : repliée, elle ne garde que « Domicile → Agence France travail » sur une ligne. **Repliée au départ** (Brainditech, 2026-11-04).
- **Verdict** : un chevron replie la carte sur une ligne, « ✓ Possible · Départ 06:17 ». **Repliée au départ**.
- **Possibilités** : un chevron en haut à droite (à côté de la durée) montre si les étapes sont ouvertes ; toucher la carte les ouvre ou les ferme, comme avant. Ouvertes, elles finissent par « Replier les étapes » et un chevron vers le haut, pour fermer sans remonter. Fermées, « Voir les étapes » reste.
- **Chevron** : flèche `keyboard_arrow_down` dans une pastille ronde `primaire-doux`, qui pivote d'un demi-tour en 220 ms à l'ouverture (react-native-reanimated, déjà installé). Composants : `src/composants/Repli.tsx` (`Chevron`, `BoutonRepli`, `BoutonIcone`).
- L'état replié n'est pas gardé : chaque nouveau Résultat s'ouvre avec tous les blocs repliés.
- Critère 7 (téléphone) : le crayon ramène au formulaire rempli ; chaque chevron replie et rouvre son bloc ; TalkBack lit « Votre trajet, bouton, développé » puis « réduit ».
- Lint, `tsc` et 102 tests verts le 2026-11-04.
