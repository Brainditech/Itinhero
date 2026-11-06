# Spec 36 — Le bandeau du Résultat dit le premier trajet de la liste

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (« je te laisse choisir et implémente toutes les solutions, teste, capture », 2026-11-06). Règle : D114.
- **Branche** : `app/bandeau-premier-trajet`.
- **Case de PLAN.md** : aucune ; demande consignée dans `docs/ETAT.md` (« implémente toutes les solutions », choix 2 B).
- **Invariants** : aucun calcul nouveau. Les possibilités sont celles du serveur, seul leur ordre et le choix du verdict changent sur le téléphone.

## 1. But

Constaté le 2026-11-06 par adb, recherche Domicile → gare de Flers, vendredi 14:00 :

| Rang dans la liste (« Arrivée la plus tôt ») | Trajet | Particularité |
|---|---|---|
| 1 | 14:48 → 19:59 | taxi 12 min au début |
| 2 | 15:47 → 21:04 | taxi 12 min au début |
| 3 | 18:26 → samedi 09:10 | nuit dehors (8 h 39 à la gare routière) |
| 4 | 15:17 → 22:18 | marche de 48 min |

Le bandeau disait « Possible, départ 15:17, arrivée 22:18 » : il prend le premier trajet sans taxi (D80, D103), celui que la liste range en dernier. Bandeau et liste ne disent pas la même chose ; un débutant ne sait pas lequel croire. Le trajet avec une nuit dehors passait aussi devant celui de 15:17.

## 2. Ce qui change

1. **Ordre** : dans tous les tris, une possibilité avec une nuit dehors (D79) passe après toutes les autres. « Arrivée la plus tôt » (et « Sans réservation », qui range pareil) : sans nuit, puis sans marche longue, puis l'arrivée la plus tôt, puis le départ le plus tard, puis le moins de correspondances. « Moins de marche » : sans nuit, puis la marche, puis l'arrivée.
2. **Verdict** : la première possibilité de « Arrivée la plus tôt ». Elle est en tête de la liste rangée par défaut. Le verdict ne bouge pas avec le tri choisi (D97).
3. Un taxi dans le trajet du verdict : la phrase le dit déjà (« Avec un taxi à réserver (prix non publié). »), et la carte le dit aussi (« réservation obligatoire »).
4. Mes trajets (D101) : avec « Arrivée la plus tôt », le rectangle montre la même possibilité que le verdict, donc la première de la liste.

Sur l'exemple : bandeau « Possible, départ 14:48 », liste 14:48, 15:47, 15:17, puis le trajet avec la nuit dehors.

## 3. Critères d'acceptation

1. `possibiliteDuVerdict` rend la première de `trier(…, "arrivee")` (tests).
2. Une nuit dehors est dernière dans les trois tris, même si elle arrive plus tôt ou marche moins (tests).
3. Toutes les possibilités avec une nuit dehors ⇒ verdict « Nuit dehors » comme avant (D79, test existant).
4. Sur le téléphone, Domicile → gare de Flers : bandeau « Départ » = l'heure de la première carte ; la nuit dehors en dernier.
