# Spec 02 — Formulaire de repli (phase 1)

> Rédigée le 2026-11-02. État : **approuvée par Brainditech le 2026-11-03 (« vas-y, implémente »)**, après sa mise à jour du même jour (fond de carte déjà fait par la spec 03, captures hors dépôt par D38, development build).
> Branche : `phase-1/formulaire-repli`. Une seule PR (D34 : ce qui se vérifie ensemble).
> Maquette : `design/accueil/02-formulaire-repli.png`. Décisions liées : D7, D15, D17, D34, A15, R11.

## 1. But

Construire l'écran du formulaire de repli en valeurs en dur, comparé à sa maquette, avec sa validation. On y arrive aujourd'hui par le lien « Remplir un formulaire à la place » de l'Accueil. Plus tard, on y arrivera aussi quand `/v1/comprendre` est en panne ou au plafond (D15).

Cases de PLAN.md visées : Phase 1 · « Formulaire de repli : lieu, date, heure, "arriver avant" / "partir à", marge » (preuve : test, plus capture). Le fond de carte, prévu ici à l'origine (décision 10), a été fait par la spec 03.

## 2. Décisions

1. **Navigation : une pile dans l'onglet Chercher.**
   - L'onglet devient `src/app/(onglets)/(chercher)/`, avec `_layout.tsx` (Stack, sans en-tête), `index.tsx` (l'Accueil, déplacé tel quel) et `formulaire.tsx`.
   - Pourquoi : la maquette garde l'onglet « Chercher » actif. Le bouton retour d'Android revient à l'Accueil. Les écrans 03 à 05 (Confirmation, Résultat, Détail) gardent eux aussi la barre d'onglets : ils iront dans cette pile.
   - Écarté : un écran Accueil qui bascule d'un mode à l'autre par un état (le retour d'Android quitterait l'app) ; un onglet caché (aucun onglet ne serait actif).
2. **Champs et valeurs par défaut** (valeurs en dur de la maquette, règle 5) :
   - Lieu : champ texte, « Rendez-vous Joigny ». Obligatoire, espaces retirés aux bouts, 200 caractères au plus.
   - Date : champ touchable qui ouvre le sélecteur de date d'Android ; « jeudi 12/11/2026 ». Pas de date passée.
   - Heure : champ touchable qui ouvre le sélecteur d'heure d'Android, en 24 h ; « 10:00 ».
   - Sens : sélecteur à deux choix « Arriver avant » (par défaut) / « Partir à ».
   - Marge : champ numérique, « 10 min » (D17). Entier de 0 à 120 minutes.
3. **Marge avec « Partir à » : masquée.** La marge se retire de l'heure du rendez-vous (D17, A15) ; avec « Partir à », il n'y a pas de rendez-vous. **Confirmé par Brainditech le 2026-11-03.** Avec « Partir à », la demande porte `marge: 0` (sans effet : il n'y a rien à retirer). Écarté : la laisser visible et l'ignorer.
4. **Sélecteur de date et d'heure : `@react-native-community/datetimepicker`**, inclus dans Expo Go d'après la doc SDK 58 ; version 9.2.1 constatée à l'installation le 2026-11-03. API impérative d'Android (`DateTimePickerAndroid.open`, `onValueChange`), recommandée par le README de la version installée (`onChange` y est déprécié). `npx expo install` ajoute son plugin à `app.json` : le development build (D36) est à reconstruire une fois.
   - Écarté : `@expo/ui` (présenté par la doc comme remplaçant) ; à revoir seulement si le premier pose problème.
5. **La demande a une seule forme, validée par Zod** (invariant 9) : `src/domaine/demande.ts` définit `{ lieu_texte, date: "AAAA-MM-JJ", heure: "HH:MM", sens: "arriver_avant" | "partir_a", marge }`, la forme de sortie de `/v1/comprendre` (architecture, routes). Le formulaire et, plus tard, Claude produisent le même objet.
   - Zod : `npx expo install zod`, version 4.6.7 constatée à l'installation le 2026-11-03.
6. **Validation pure, testée sous Node** : `validerFormulaire(champs, maintenant)` renvoie soit la demande, soit un message par champ en erreur :
   - « Indiquez le lieu du rendez-vous. » (lieu vide) ;
   - « Cette date est passée. » (date avant aujourd'hui) ;
   - « Cette heure est passée. » (aujourd'hui, heure déjà passée) ;
   - « La marge va de 0 à 120 minutes. » (marge vide, non entière ou hors bornes).
   
   « Aujourd'hui » et « maintenant » se lisent dans le fuseau Europe/Paris (R11), à partir de `maintenant` passé en paramètre (pas d'horloge cachée, test déterministe).
7. **Affichage de la date** : `formaterDate("2026-11-12")` ⇒ « jeudi 12/11/2026 », calculé depuis la date seule, sans fuseau. Testé.
8. **Bandeau « La compréhension de phrase est indisponible. Remplissez ces champs. »** : construit et affiché seulement si l'écran est ouvert avec le paramètre `raison=indisponible`. Le lien de l'Accueil ouvre le formulaire **sans** bandeau. Pour la capture côte à côte, Brainditech ouvre `itinhero://formulaire?raison=indisponible` par un lien profond (`adb shell am start -a android.intent.action.VIEW -d "itinhero://formulaire?raison=indisponible"`) : aucun bouton de démonstration dans l'app, donc rien à retirer au branchement réel.
9. **« Chercher »** valide le formulaire et affiche les erreurs sous les champs (style « erreur » du design system). Si tout est valide, rien ne se passe encore : la recherche se branche en phase 3.
10. **Fond de carte : déjà fait par la spec 03** (D35 à D37). Le formulaire, dans la pile de l'Accueil, reprend `FondCarte` et l'attribution repliable, sans les changer.
11. **Nouveaux composants** dans `src/composants/elements.tsx` : `Champ` (libellé, contour, état actif, message d'erreur), `SelecteurDeuxChoix`, `BandeauInfo`. Les jetons existants suffisent ; la couleur d'erreur `#B91C1C` du design system est ajoutée à `src/theme/jetons.js` si elle n'y est pas.

## 3. Fichiers touchés

| Fichier | Changement |
|---|---|
| `src/app/(onglets)/index.tsx` | Déplacé en `src/app/(onglets)/(chercher)/index.tsx` ; le lien ouvre `/formulaire`. |
| `src/app/(onglets)/(chercher)/_layout.tsx` (nouveau) | Stack sans en-tête. |
| `src/app/(onglets)/(chercher)/formulaire.tsx` (nouveau) | L'écran. |
| `src/app/(onglets)/_layout.tsx`, `src/composants/BarreOnglets.tsx` | Nom de route de l'onglet Chercher : `(chercher)`. |
| `src/composants/elements.tsx` | `Champ`, `SelecteurDeuxChoix`, `BandeauInfo`. |
| `src/theme/jetons.js` | Couleur d'erreur `#B91C1C`. |
| `src/domaine/demande.ts`, `demande.test.ts` (nouveaux) | Schéma Zod, `validerFormulaire`, `formaterDate`, et leurs tests. |
| `package.json`, `package-lock.json`, `app.json` | `zod`, `@react-native-community/datetimepicker` et son plugin. |
| `PLAN.md`, `docs/ETAT.md` | Case cochée avec sa preuve, dans le même commit. |

## 4. Source de chaque valeur affichée

| Valeur | Source |
|---|---|
| « Rendez-vous Joigny », 12/11/2026, 10:00 | valeurs en dur de la maquette (règle 5), remplacées au branchement réel par la sortie de `/v1/comprendre` |
| Jour de la semaine (« jeudi ») | calculé depuis la date par `formaterDate` |
| Marge 10 min | D17 |
| Bornes de la marge (0 à 120) | cette spec |
| Textes du bandeau et des erreurs | cette spec |
| Fond de carte | spec 03 : tuiles OpenFreeMap, ou image inventée en secours |

Aucune donnée de trajet n'est affichée.

## 5. Sécurité

- Rien n'est envoyé ni stocké : aucun appel réseau, aucune écriture locale.
- Aucun journal ne contient le lieu saisi (invariant 10).
- Aucun secret, aucune variable d'environnement.

## 6. Critères d'acceptation

1. Depuis l'Accueil, « Remplir un formulaire à la place » ouvre le formulaire ; l'onglet Chercher reste actif ; le retour d'Android revient à l'Accueil. *(capture)*
2. Le formulaire et l'Accueil ressemblent à leur maquette, fond de carte voilé compris. *(captures côte à côte)*
3. Toucher la date ou l'heure ouvre le sélecteur d'Android ; la valeur choisie s'affiche (« jeudi 12/11/2026 », « 10:00 »). *(capture)*
4. « Partir à » masque la marge ; « Arriver avant » la remontre. *(capture)*
5. `validerFormulaire` : valeurs de la maquette ⇒ demande valide ; lieu vide ou fait d'espaces ⇒ erreur ; date d'hier ⇒ erreur ; aujourd'hui à une heure passée ⇒ erreur ; marge −1, 121, 7,5 ou vide ⇒ erreur ; marge 0 et 120 ⇒ valides ; « Partir à » ⇒ marge ignorée ; minuit en heure d'été et d'hiver lu en Europe/Paris. *(tests)*
6. `formaterDate` : 12/11/2026 ⇒ « jeudi 12/11/2026 » ; 29/02/2028 ⇒ « mardi 29/02/2028 ». *(tests)*
7. La demande produite passe le schéma Zod. *(test)*

## 7. Vérification

```bash
npx expo lint
npx tsc --noEmit
npm test
```

Puis Brainditech reconstruit le development build (`npx expo run:android --device`), ouvre l'app et envoie les captures des critères 1 à 4. Les captures sont regardées puis restent hors du dépôt (D38) ; la preuve s'écrit dans PLAN et ETAT.
