# Spec 40 — Voyage complet : appels à passer et rappels, sans réseau

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (D119 : « plan et implémente tout ça pour qu'on en finisse »). Règle : D121.
- **Branche** : `phase-5/voyage-complet`.
- **Case de PLAN.md** : phase 5, « Plan de voyage complet enregistré : aller, retour, appels à passer (taxi, transport à la demande) avec leurs rappels ».
- **Invariants** : 3 (rien de recalculé : tout vient de la possibilité enregistrée), 6 (rien sur le serveur), 12 (horaire prévu), 16 (un numéro n'apparaît qu'avec sa source, spec 41).

## 1. But

Un débutant enregistre son voyage et, sans réseau, doit savoir **quoi faire et quand** : appeler le taxi, réserver le car à la demande, partir. Aujourd'hui les rappels sont programmés (spec 30) mais invisibles : rien ne dit sur l'écran qu'il faut appeler, ni quand le téléphone sonnera.

## 2. Doc lue

Aucune bibliothèque nouvelle (`expo-notifications` 58.1.8, déjà lue pour l'issue 0026 : `getAllScheduledNotificationsAsync`).

## 3. Décision D121

1. **« À faire »** en tête d'un trajet rouvert (sous le bandeau, avant « Votre trajet ») : une ligne par action, dans l'ordre du temps, tirée de la possibilité enregistrée (`actionsDuTrajet`, `src/domaine/rappels.ts`) :
   - « Appeler le taxi » : prise en charge à HH:MM, à {lieu} ; « Rappel à HH:MM » (60 min avant) ;
   - « Réserver {car 803 de 08:25} » : passage sur réservation à {arrêt} ; « Rappel la veille à 10:00 » ; « Délai non connu » ;
   - « Partir » : départ de la porte à HH:MM ; « Rappel à HH:MM » (15 min avant).
   La veille (19:00) n'est pas une action : elle est dite en bas de la liste (« Rappel la veille à 19:00 »).
2. Chaque ligne dit si son rappel est **passé** (grisée, « passé ») ; rien n'est recalculé.
3. **Numéro** : quand l'étape porte un numéro sourcé (spec 41 : agence du GTFS, fiche validée, page publique « non vérifié »), la ligne a un bouton « Appeler » (`tel:`) et la source en petit ; sinon « Aucun numéro connu ».
4. **Mes trajets** : sous la ligne d'horaires du rectangle, « 2 appels à passer » quand il y en a (taxi ou réservation à venir).
5. **Aller et retour** : chaque sens enregistré a ses actions et ses rappels (D101 garde un trajet par sens) ; rien de plus à faire.
6. Le tout vient de l'instantané SQLite : il s'affiche en mode avion.

## 4. Options écartées

- Une table `rappels_programmes` (PLAN §4) : l'identifiant de la notification suffit (D108).
- Recalculer « appeler avant » à partir d'un délai de réservation : inconnu tant qu'aucune fiche ne le dit (« délai non connu »).
- Liste « À faire » dans le Résultat avant l'enregistrement : rien n'est programmé tant que le trajet n'est pas enregistré.

## 5. Fichiers touchés

- `src/domaine/rappels.ts` : `actionsDuTrajet(p, nomArrivee, maintenant)`, `resumeActions`.
- `src/composants/AFaire.tsx` (nouveau), `src/app/(onglets)/(trajet)/resultat.tsx`, `src/composants/RectangleVoyage.tsx`, `src/domaine/voyages.ts` (`appels` dans `ResumeVoyage`).

## 6. Critères d'acceptation

1. Domaine : taxi au début ⇒ « Appeler le taxi » avec la prise en charge et le rappel 60 min avant ; étape sur réservation ⇒ « Réserver … » avec rappel la veille 10:00 et « Délai non connu » ; « Partir » 15 min avant ; ordre du temps ; rappel passé marqué (`src/domaine/rappels.test.ts`).
2. Domaine : le rectangle dit « 1 appel à passer » / « 2 appels à passer », rien sans appel, rien quand tous sont passés (`src/domaine/voyages.test.ts`).
3. Téléphone (adb) : trajet avec taxi enregistré, rouvert en mode avion ⇒ « À faire » visible ; Mes trajets ⇒ « 1 appel à passer ».

## 7. Constats

- 2026-11-06 : critères 1 et 2 verts (`npm test`, 411 tests).
- 2026-11-06, par adb : Domicile → Gare de Joigny le 12/11, trajet « Taxi 12 min · TER K7 » enregistré par sa disquette ; Mes trajets ⇒ « 1 appel à passer » (`docs/screenshots/fin/c3-spec40-mes-trajets.png`) ; rouvert ⇒ « À faire » : « Appeler le taxi, prise en charge à 08:46, Domicile, rappel à 07:46, Aucun numéro connu », « Partir, départ de la porte à 08:46, rappel à 08:31 », « Et un rappel la veille à 19:00 » (`c4-spec40-a-faire.png`) ; même écran en mode avion (`c6-spec40-mode-avion.png`). Critère 3 rempli.
