# Spec 34 — Onglets Accueil et Trajet

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech : idée approuvée le 2026-11-06 (« vas-y j'approuve »), puis « bah qu'est-ce que t'attends » le même jour. Règle : D112. **Appliquée** sur `app/onglets-accueil-trajet`.
- **Branche** : `app/onglets-accueil-trajet`.
- **Case de PLAN.md** : aucune ; demande de Brainditech consignée dans `docs/ETAT.md` (« Demandes de Brainditech en attente »).
- **Invariants** : aucun touché (navigation seule ; aucune donnée nouvelle).

## 1. But

Demande de Brainditech, 2026-11-06 : « Chercher » n'est pas précis. Une fois une recherche faite, on ne revient à la première page (« Où devez-vous être, et quand ? ») qu'en faisant Retour plusieurs fois. Il veut :

- **Accueil** (icône maison) : ramène toujours à la première page ;
- **Trajet** (icône « route » : deux points reliés par une ligne en S) : montre les résultats de la dernière recherche. La recherche lancée bascule toute seule sur cet onglet.

Mes trajets, Assistant et Réglages ne changent pas.

## 2. Doc et code lus

- Expo Router 58.0.30 (installé) : docs v58 « Navigation », « Tabs », « Nesting navigators », « Router settings ». `router.navigate` « will either push a new page onto the stack or unwind to an existing route on the stack ». L'ancre (`unstable_settings.anchor`) ne sert qu'aux liens profonds. Les docs ne disent rien de la navigation d'un onglet à l'autre : le comportement sera constaté sur le téléphone.
- Code installé : `react-navigation/native-stack/createNativeStackNavigator.js` (utilisé par le `Stack` d'Expo Router) écoute l'événement `tabPress` de l'onglet parent. Onglet déjà actif et pile plus haute qu'un écran : la pile revient à son premier écran (`StackActions.popToTop`). Notre barre d'onglets maison (`BarreOnglets`) n'émettait pas `tabPress` : elle appelait seulement `navigateToTab`.
- expo-symbols : `route` existe dans `build/android/symbols.json` (Material Symbols).

## 3. Décision D112

1. **Cinq onglets** : Accueil (`home`), Trajet (`route`), Mes trajets, Assistant, Réglages. Le groupe `(chercher)` devient deux groupes, chacun avec sa pile :
   - `(accueil)` : l'Accueil (`index`) et le formulaire ;
   - `(trajet)` : le Résultat, l'Étape et le Guidage (ancre : `resultat`).
   Les adresses ne changent pas (`/resultat`, `/etape`, `/guidage`, `/formulaire`) : les groupes n'en font pas partie.
2. **Toucher Accueil ramène toujours à la première page**, depuis n'importe quel onglet et n'importe quel écran (`allerALAccueil`, §6). Toucher l'onglet déjà actif remonte sa pile au premier écran (`tabPress` émis par la barre, comme la barre d'origine ; vaut pour tous les onglets).
3. **Une recherche aboutie ouvre l'onglet Trajet** : `router.navigate("/resultat")` (au lieu de `push`), qui revient au Résultat déjà ouvert au lieu d'en empiler un second. Mes trajets ouvre déjà un trajet ainsi (spec 22).
4. **Trajet sans recherche** (app tout juste ouverte) : « Aucun trajet pour l'instant. » et « Écrivez sur l'Accueil où vous devez être, et quand. », avec le bouton « Aller à l'Accueil ». Avant : le Résultat renvoyait au formulaire.
5. **« Modifier la recherche »** du Résultat ouvre le formulaire de l'onglet Accueil (pile remise à la première page, puis le formulaire) avec les champs de la recherche en cours, lieux déjà trouvés compris, sans bandeau « Vérifiez ». Le formulaire a pu être fermé par l'onglet Accueil entre-temps : il reçoit donc les champs (comme « Modifier » de Mes trajets, spec 24) au lieu de compter sur son état.
6. La barre d'onglets reste masquée pendant le Guidage et l'Étape (spec 12, spec 17).

## 4. Options écartées

- **Garder « Chercher » et ajouter seulement un bouton « Accueil » dans le Résultat** : ne répond pas à la demande (un onglet Trajet qui garde les résultats).
- **Trajet qui rouvre le dernier trajet enregistré** quand il n'y a pas de recherche : mélange l'onglet avec Mes trajets ; un débutant ne saurait plus d'où vient le trajet affiché.
- **Accueil qui garde le formulaire ouvert** (simple changement d'onglet) : c'est ce que Brainditech reproche ; la première page doit revenir.

## 5. Critères d'acceptation

1. La barre montre, dans l'ordre : Accueil (maison), Trajet (route), Mes trajets, Assistant, Réglages ; libellés lisibles sur le téléphone.
2. Accueil → formulaire → Chercher : l'onglet Trajet devient actif et montre le Résultat.
3. Depuis le Résultat, l'Étape fermée, ou Mes trajets : toucher Accueil montre « Où devez-vous être, et quand ? », jamais le formulaire.
4. Toucher Trajet après être allé sur l'Accueil remontre le même Résultat, sans nouvelle recherche.
5. App ouverte sans recherche : Trajet montre « Aucun trajet pour l'instant. » et « Aller à l'Accueil » y mène.
6. « Modifier la recherche » du Résultat, même après être passé par Accueil : le formulaire montre les champs de la recherche (lieux trouvés compris).
7. Mes trajets → un trajet : l'onglet Trajet est actif et montre ce trajet (spec 22 inchangée).
8. Lint, types et tests verts ; `champsDepuisRecherche` testé (`src/domaine/voyages.test.ts`).

Les critères 1 à 7 se constatent sur le téléphone, par adb.

## 6. Constats

Sur le téléphone de Brainditech, par adb, le 2026-11-06 (development build, Metro par le câble). Captures : `docs/screenshots/2026-11-06-spec34-*.png` (non versionnées).

- **Écart corrigé pendant l'essai.** Depuis l'onglet Trajet, `router.navigate("/")` empilait une nouvelle première page au-dessus du formulaire au lieu d'y revenir (Retour montrait l'ancien formulaire), et « Modifier la recherche » ouvrait un formulaire neuf aux valeurs par défaut. Un `router.dismissAll()` lancé à l'image suivante agissait encore sur la pile de l'onglet quitté. Correction : `allerALAccueil(puis?)` (`src/composants/BarreOnglets.tsx`) note la demande et change d'onglet ; la pile de l'Accueil la lit quand elle redevient active (`useFocusEffect` dans `(accueil)/_layout.tsx`), se vide (`dismissAll`), puis ouvre le formulaire si demandé. Accueil déjà actif : appliqué tout de suite.
- Critère 1 : Accueil, Trajet (icône route), Mes trajets, Assistant, Réglages, libellés entiers.
- Critère 2 : formulaire → « Gare de Joigny » → Chercher : Trajet actif, « Possible ».
- Critère 3 : depuis le Résultat, après une recherche faite par le formulaire : Accueil montre « Où devez-vous être, et quand ? » ; Retour quitte alors l'app (la pile ne contient que la première page). Depuis le formulaire, Accueil (déjà actif) : première page.
- Critère 4 : Trajet après Accueil : même Résultat, sans nouvelle recherche.
- Critère 5 : app rechargée, Trajet : « Aucun trajet pour l'instant. » ; « Aller à l'Accueil » y mène.
- Critère 6 : Accueil puis Trajet puis « Modifier la recherche » : Accueil actif, arrivée « Gare de Joigny », pas de bandeau « Vérifiez ».
- Critère 7 : Mes trajets → Gifi Joigny 2 : Trajet actif ; son crayon ouvre le formulaire de l'Accueil avec « Vous modifiez le trajet du Samedi 07/11… ».
- Critère 8 : lint, types, 350 tests verts.

**Limite connue.** Une recherche lancée par « Modifier » d'un trajet enregistré, puis « Modifier la recherche » après être passé par Accueil : le formulaire neuf ne sait plus quel trajet remplacer ; la disquette enregistrera un nouveau trajet au lieu de remplacer l'ancien. Rare, sans perte (l'ancien reste supprimable).
