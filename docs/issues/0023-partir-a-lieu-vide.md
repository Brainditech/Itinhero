# Issue 0023 — « je veux partir à Flers » : Arrivée vide

- **Date** : 2026-11-06
- **État** : **corrigée** le 2026-11-06 (Brainditech : « je te laisse choisir et implémente toutes les solutions », §4.1, §4.2 et §4.3 retenus).
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

## 4. Correction

1. **Invite** : dire que « partir à / aller à / me rendre à + lieu » donne `lieu_texte` (la destination), et que « partir à » ne désigne une heure de départ que suivi d'une heure. Ajouter les exemples « je veux partir à Flers » ⇒ lieu_texte « Flers », sens null.
2. **Jeu d'essai** (`serveur/src/comprendre/jeu.ts`) : ajouter « je veux partir a flers », « je veux partir à sens » ; ils doivent donner le lieu.
3. **Filet côté app** : phrase comprise sans aucun lieu ⇒ l'Arrivée reste vide avec le message « Je n'ai pas trouvé le lieu dans votre phrase. Écrivez-le ici. » (`erreursSansLieu`, `src/domaine/comprendre.ts`). La phrase entière n'est pas recopiée : la spec 35 a justement retiré la recopie.

Première version de l'invite : « partir à Flers basse normandie » mettait la région dans le lieu ; l'exemple de la zone a été ajouté à la règle « partir à ».

## 5. Test de régression

- Serveur : 5 phrases dans `regressions` de `jeu-30-phrases.json`, passées par `npm run comprendre:jeu` (toutes doivent réussir) ; `jeu.test.ts` contrôle leurs attendus. Appels directs avec la nouvelle invite (4 par phrase) : « je veux partir a flers » ⇒ flers 4/4 ; « à flers » 4/4 ; « a sens » 4/4 ; « à flers basse normandie » ⇒ flers + basse normandie 4/4 ; « aller a flers basse normandie » 4/4 ; « rdv à Saint-Denis 93 lundi 10h » ⇒ Saint-Denis + 93 4/4 ; « je veux partir à 8h » ⇒ 08:00 partir 4/4.
- App : `comprendre.test.ts`, « issue 0023 » (lieu null ⇒ message ; un lieu ⇒ aucun message). 379 tests app et 369 serveur verts.

## 6. Constat (adb, 2026-11-06, API reconstruite)

« je veux partir a flers » trois fois de suite ⇒ liste de Flers, gare en tête (`docs/screenshots/20261106-0023-flers1.png` à `flers3.png`). « demain a 10h » ⇒ Arrivée vide avec le message, samedi 07/11 10:00 « Arriver avant » (`20261106-0023-sans-lieu.png`).
