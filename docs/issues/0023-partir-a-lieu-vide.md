# Issue 0023 — « je veux partir à Flers » : Arrivée vide

- **Date** : 2026-11-06
- **État** : **analysée**, correction en attente de l'accord de Brainditech.
- **Branche** : `issue/0023-partir-a-lieu-vide`. Défaut vu une fois pendant l'essai de la spec 35 (PR #54) puis non reproduit ; reproduit le 2026-11-06 pendant les essais adb qui ont suivi.

## 1. Reproduction

1. Accueil, écrire `je veux partir a flers` (sans accent), « Chercher ».
2. Le formulaire s'ouvre avec le bandeau « Voici ce qui a été compris », Départ Domicile, **Arrivée vide**, « Partir à » l'heure actuelle, aucune liste de lieux.

Constaté par adb le 2026-11-06 vers 14:11. Juste après, la même phrase a donné une fois la bonne liste (Flers gare en tête).

## 2. Hypothèse (une seule, vérifiée)

Une Arrivée vide ne peut venir que de `lieu_texte: null` rendu par `/v1/comprendre` (`champsDepuisComprehension`, `src/domaine/comprendre.ts` : `c.lieu_texte ?? ""`). Le code de l'app ne vide jamais ce champ autrement.

Vérification : appels directs à Claude depuis le conteneur `api` (même invite, `claude-haiku-5-5`, contexte vendredi 06/11/2026 14:11) :

| Phrase | lieu_texte rendu |
|---|---|
| je veux partir à flers | « flers », 10 fois sur 10 |
| je veux partir a flers | **null** (tous les champs null), 15 fois sur 15 |
| je veux partir à sens | **null**, 3 fois sur 3 |
| je veux partir a sens | **null**, 3 fois sur 3 |
| partir a flers | « flers », 3 fois sur 3 |
| je veux aller a flers | « Flers », 3 fois sur 3 |
| rdv a joigny jeudi 10h | « Joigny », 3 fois sur 3 |
| je dois etre a auxerre demain a 9h | « Auxerre », 3 fois sur 3 |

## 3. Cause racine

« partir à » est, dans `INVITE_SYSTEME` (`serveur/src/comprendre/comprendre.ts`), le signal d'une **heure de départ** (« partir à », « départ à »), et `lieu_texte` est décrit comme « le lieu où elle doit être ». Pour « je veux partir à X », Claude ne sait pas si X est une heure, un lieu de départ ou un lieu d'arrivée, et rend tout à null. Ce n'est pas l'accent qui compte : « partir à sens » échoue aussi avec l'accent.

## 4. Correction proposée (à approuver)

1. **Invite** : dire que « partir à / aller à / me rendre à + lieu » donne `lieu_texte` (la destination), et que « partir à » ne désigne une heure de départ que suivi d'une heure. Ajouter les exemples « je veux partir à Flers » ⇒ lieu_texte « Flers », sens null.
2. **Jeu d'essai** (`serveur/src/comprendre/jeu.ts`) : ajouter « je veux partir a flers », « je veux partir à sens » ; ils doivent donner le lieu.
3. **Filet côté app** (à discuter) : si la phrase est comprise mais sans aucun lieu, ouvrir le formulaire avec la phrase entière dans l'Arrivée plutôt qu'un champ vide, ou dire « Je n'ai pas trouvé le lieu dans votre phrase ».

## 5. Test de régression

- Serveur : le jeu d'essai de §4.2, lancé contre Claude (`npm run comprendre:jeu`), 3 appels par phrase.
- App : si le filet §4.3 est retenu, test vitest de `champsDepuisComprehension` avec `lieu_texte: null`.
