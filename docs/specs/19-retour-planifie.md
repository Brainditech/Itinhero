# Spec 19 — Retour planifié à partir de la fin du rendez-vous

- **Date** : 2026-11-05
- **État** : **approuvée par délégation** de Brainditech (« implémente les phases suivantes », 2026-11-05). Règles : D47, D94.
- **Branche** : `phase-3/retour-planifie`.
- **Case de PLAN.md** : phase 3, « Retour planifié à partir de l'heure de fin du rendez-vous (D47) ».
- **Invariants** : 3 (aucune heure inventée : le retour vient de MOTIS), 4 (chaque étape du retour a sa source), 6 (rien n'est gardé sur le serveur), 9 (une seule forme de demande), 13 (aucun changement de jour silencieux).

## 1. But

Brainditech : « il me dira à quelle heure finit mon entretien, je dois prendre à quelle heure le taxi ». Aujourd'hui il faut refaire une recherche à la main, points inversés, à partir de l'heure de fin. Itinhero cherche maintenant **l'aller et le retour d'un seul coup** : on donne l'heure de fin du rendez-vous, le Résultat montre l'aller puis le retour, chacun avec son verdict.

## 2. Doc lue

Rien de neuf côté MOTIS : le retour est une recherche `/api/v6/plan` en « partir à » (D57), la même que l'aller dans ce sens, déjà lue pour les specs 09 et 16 (`openapi.yaml` du tag v2.11.4). Sélecteur d'heure : `DateTimePickerAndroid.open` de `@react-native-community/datetimepicker`, déjà utilisé par le formulaire (spec 02).

## 3. Décision D94

- **Requête** : `POST /v1/itineraires` prend un champ facultatif `fin_rdv` (« HH:MM »). Il est le **même jour** que l'aller et **strictement après** `heure` (l'heure du rendez-vous en « arriver avant », l'heure de départ en « partir à ») ; sinon 400 sur `fin_rdv`. Un rendez-vous qui finit après minuit n'est pas pris en charge.
- **Recherche** : le retour est la même chaîne que l'aller (marge de montée D68, taxi D80, correspondances D81), avec le départ et l'arrivée **inversés** (les noms aussi), en « partir à » `fin_rdv`, le même jour. Les deux recherches partent **en même temps**. Seuls comptent les retours qui **partent** ce jour-là après `fin_rdv` ; une arrivée le lendemain est dite (« vendredi 06:32 », nuit dehors en orange, D79), jamais tue.
- **Réponse** : un champ `retour` de même forme que l'aller (`verdict`, `demande`, `arrivee`, `possibilites`), `null` sans `fin_rdv`. MOTIS en panne pour le retour ⇒ toute la recherche répond 503, comme pour l'aller.
- **App** :
  - formulaire : un champ « Fin du rendez-vous » facultatif sous l'heure, dans les deux sens, « Aucune » par défaut ; touché, il ouvre le sélecteur d'heure ; un bouton « Sans retour », dans le champ à droite de l'heure, le vide (issue 0021 : sous le champ, il passait sous « Chercher ») ; avant ou à l'heure de l'aller ⇒ « La fin du rendez-vous est après HH:MM. » ;
  - « Votre trajet » ajoute « retour après 17:00 » ;
  - Résultat : l'aller (verdict et possibilités), puis le titre « Retour », son verdict et ses possibilités (destination : le départ de l'aller). Sans retour possible : « Impossible — Aucun retour ce jour-là après 17:00. » ;
  - étapes et guidage d'un retour : mêmes écrans, paramètre `t=retour` ; « Recalculer depuis ici » pendant un retour cherche depuis la position vers le départ de l'aller, à partir de la fin du rendez-vous ou de maintenant (le plus tard), sans nouveau retour.
- **Écarté** : deux recherches à relier soi-même (D47) ; retour cherché seulement quand l'aller est possible (on veut savoir tout de suite que le retour est impossible) ; retour le lendemain proposé d'office (un débutant doit le voir écrit, pas le deviner) ; aller montré sans le retour quand MOTIS échoue au retour (le Résultat promettrait un voyage incomplet).

## 4. Ce qui est construit

- Serveur :
  - `routes/itineraires.ts` : `fin_rdv` dans le schéma Zod, refusé s'il n'est pas après `heure` ; la chaîne de l'aller sortie dans `chercherSens`, appelée pour l'aller et, avec `fin_rdv`, pour le retour inversé ; `retour` dans la réponse.
- App :
  - `domaine/demande.ts` : `retour` (« HH:MM » ou `null`) dans la demande et le formulaire, message `retourAvant`, `fin_rdv` dans la requête, `demandeRecalcul` pour l'aller (garde le retour s'il reste après la nouvelle heure) et le retour ;
  - `domaine/api.ts` : `retour` dans le schéma de la réponse ;
  - `domaine/resultat.ts` : « retour après HH:MM » dans `quandDemande`, verdict du retour, `possibiliteDe` (aller ou retour) ;
  - `formulaire.tsx`, `resultat.tsx`, `Trajet.tsx`, `etape.tsx`, `guidage.tsx`, `recherche.tsx`.
- L'enregistrement de l'aller et du retour ensemble (D47) vient avec « Mes trajets » (phase 5).

## 5. Critères d'acceptation

1. Tests serveur : `fin_rdv` mal formé, égal ou avant `heure` ⇒ 400 sur `fin_rdv` ; avec `fin_rdv`, MOTIS reçoit une seconde demande aux points inversés, en « partir à » à l'heure de fin ; `retour` de même forme, noms inversés ; sans `fin_rdv`, `retour` vaut `null` ; aucun retour après la fin ⇒ `retour.verdict` « impossible ».
2. Test Joigny aller et retour (PLAN.md) : Brienon Mairie → lieu de rendez-vous de Joigny (spec 05), arriver avant 10:00, fin 11:30, jeudi 12/11 ⇒ un retour du même jour (verdict « possible », parti après 11:30, de « Rendez-vous » à « Brienon », chaque étape sourcée) ; fin 22:30 ⇒ « impossible » ou un retour parti le jour même, jamais le lendemain. Sur le MOTIS national du PC (`serveur/src/national/joigny-retour.national.test.ts`, `npm run test:national`) : le MOTIS des fixtures ne couvre pas un retour de l'après-midi sans nouvelles fixtures.
3. Tests app : validation du champ (après l'heure, vidé par « Sans retour »), requête avec `fin_rdv`, `quandDemande`, phrase « Aucun retour ce jour-là après 17:00. », `demandeRecalcul` du retour, `possibiliteDe`.
4. Sur le téléphone (Brainditech) : Domicile → Gifi Joigny, arriver avant 10:00, fin 16:00 ⇒ l'aller puis « Retour » avec ses possibilités vers Domicile ; une étape du retour s'ouvre et se guide.
5. Lint, `tsc` app et serveur, tests verts.

## 6. Constats (2026-11-05)

- Critère 1 : 10 tests de plus dans `serveur/src/routes/itineraires.test.ts`. **Verts.**
- Critère 2 : `joigny-retour.national.test.ts`, 2 tests, sur le MOTIS national. **Verts.**
- Critère 3 : `src/domaine/demande.test.ts` et `src/domaine/resultat.test.ts`. **Verts** (242 tests de l'app).
- Critère 4 : **rempli** le 2026-11-05, par adb sur le téléphone de Brainditech (délégation, captures `docs/screenshots/2026-11-05-r19-*`). Domicile → Gifi Joigny 2, arriver avant 10:00, fin 16:00 ⇒ aller « Possible » (08:46 → 09:30, taxi puis TER K7), puis « Retour vers Domicile », « Possible · Départ 16:23 » (16:23 → 17:08 : 21 min à pied jusqu'à la gare de Joigny, TER K7 de 16:49, taxi depuis Laroche-Migennes) ; le retour de 23:07 qui arrive vendredi 06:31 est dit « nuit dehors à Laroche-Migennes ». Une étape du retour s'ouvre, « Me guider à partir de cette étape » démarre (« Arrivée 17:08 », « Départ prévu le 12/11 à 16:23 ») ; « Recalculer depuis ici » va de la position à Domicile à partir de 16:00, sans nouveau retour (§3). Fin 23:30 ⇒ « Impossible — Aucun retour ce jour-là après 23:30. » ; « Sans retour » vide le champ et le Résultat n'a plus de retour. Deux défauts trouvés et corrigés en route (issue 0021) : « Sans retour » est dans le champ (il passait sous « Chercher »), et un verdict « Impossible » s'ouvre au départ.
- Critère 5 : `npx expo lint`, `npx tsc --noEmit`, `npm test` (app), `npm run typecheck`, `npm test`, `npm run build` (serveur). **Verts.**

## 7. Ce qui n'est pas fait ici

- Enregistrer l'aller et le retour ensemble, et les rouvrir en mode avion (phase 5).
- L'heure de fin dite dans une phrase (`/v1/comprendre`, phase 6) : la forme de la demande est prête (invariant 9).
- Un retour un autre jour que l'aller.
