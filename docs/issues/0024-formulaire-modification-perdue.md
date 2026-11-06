# Issue 0024 — Le formulaire rouvert perd la recherche à reprendre

- **Date** : 2026-11-06
- **État** : **corrigée** le 2026-11-06, par délégation de Brainditech (« implémente toutes les solutions, teste, capture, ne reviens que lorsque tout est nickel »).
- **Branche** : `app/assistant` (trouvée pendant l'essai de la spec 37 ; le défaut date de la spec 34).

## 1. Reproduction

1. Accueil, « jeudi 10h RDV à Joigny », « Chercher » ; dans le formulaire, choisir « Joigny, Gare », « Chercher » : l'onglet Trajet s'ouvre. Le formulaire reste ouvert dans la pile de l'onglet Accueil.
2. Dans l'onglet Trajet, toucher le crayon « Modifier la recherche ».
3. Le formulaire s'ouvre avec les valeurs par défaut (« Rendez-vous Joigny ») au lieu de « Joigny, Gare, 89300 ».

Même chose par « Relancer la recherche » de l'Assistant quand un nouveau lieu donne plusieurs choix, et par « Modifier » dans Mes trajets (même code). Non vu à l'essai de la spec 34 : l'onglet Accueil avait été touché avant, ce qui avait vidé sa pile.

## 2. Hypothèses

1. **Écartée** : la modification posée avant que la pile de l'Accueil se vide. Posée seulement après (`useOuvrirFormulaire`), le défaut restait.
2. **Vérifiée** par un journal temporaire au montage et à l'effet du formulaire (logcat, 2026-11-06 15:17) :
   - `effet 1793974657821` : l'ancien formulaire, encore monté, lit la modification et l'efface (`setModification(null)`) ;
   - `demonte` : il est fermé ensuite ;
   - `monte null, "Rendez-vous Joigny"` : le nouveau formulaire se monte 150 ms plus tard et ne trouve plus rien.

## 3. Cause racine

Le formulaire effaçait la modification dès qu'il l'avait lue (« Lue une fois »). Quand un formulaire restait ouvert dans la pile, c'est lui qui la lisait, juste avant d'être fermé par le retour à la première page de l'Accueil.

## 4. Correction

- Le formulaire n'efface plus la modification.
- Les trois chemins de l'Accueil qui ouvrent un formulaire vierge la remettent à zéro eux-mêmes (`ouvrirFormulaireVierge` : phrase trop courte, compréhension indisponible, « Remplir un formulaire à la place »). La phrase comprise pose sa propre modification, comme avant.
- `useOuvrirFormulaire` (`src/recherche.tsx`) : un seul chemin pour ouvrir le formulaire pré-rempli depuis un autre onglet (crayon du Résultat, « Modifier » de Mes trajets, Assistant).

## 5. Test de régression

Le défaut tient à l'ordre de montage des écrans d'Expo Router. Aucun test vitest ne le couvre : il faudrait des tests de composants, que le projet n'a pas. Constat par adb, refait après la correction :

- crayon avec un formulaire resté ouvert ⇒ « Joigny, Gare, 89300 » (`docs/screenshots/20261106-0024-crayon.png`) ;
- Assistant « je pars de la gare de Sens », « Relancer la recherche » ⇒ formulaire avec la liste des lieux de « gare de Sens », arrivée gardée ; gare choisie ⇒ « Gare de Sens → Joigny, départ 07:26 » ;
- « Remplir un formulaire à la place » juste après ⇒ formulaire vierge (« Rendez-vous Joigny »).
