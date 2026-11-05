# Issue 0019 — Arrêt « JOIGNY-3 RUE DE LA GARE » proposé « à 5348 km »

- **Date** : 2026-11-05
- **État** : **analyse approuvée** par Brainditech le 2026-11-05, option « 0,0 seulement ». Cause vérifiée sur MOTIS ; aucune correction écrite.
- **Branche** : `issue/0018-0019-essai-recalcul` (analyse seulement).

## 1. Reproduction

Formulaire, arrivée « Gare de Joigny » depuis Brienon : l'écran « Quel lieu ? » propose, en deuxième position, « JOIGNY-3 RUE DE LA GARE · Arrêt · à 5348 km ». Vu une première fois dans l'issue 0017 §7.

## 2. Cause (vérifiée)

MOTIS national du PC, `GET /api/v1/geocode?text=JOIGNY-3 RUE DE LA GARE` :

| type | nom | lat | lon | id |
|---|---|---|---|---|
| STOP | 3 RUE DE LA GARE | 47.9742 | 3.3938 | `r84072_3103869` |
| STOP | JOIGNY-3 RUE DE LA GARE | **0** | **0** | `r83931_UT89:ST:06391` |

L'arrêt `UT89:ST:06391` du jeu `r83931` est placé à 0,0 dans son GTFS (golfe de Guinée). Depuis Brienon, 0,0 est à environ 5 350 km, d'où « à 5348 km ». Pendant l'essai de l'issue 0018, une position simulée envoyée par erreur en 0,0 a aussi affiché « Le chemin est à 5352 km », ce qui confirme l'ordre de grandeur.

`lireReponseGeocode` ([serveur/src/lieux/motis-geocode.ts](../../serveur/src/lieux/motis-geocode.ts)) accepte toute latitude entre −90 et 90 et toute longitude entre −180 et 180, donc 0,0 passe.

## 3. Correction proposée (après approbation)

Écarter côté serveur, dans `lireReponseGeocode`, les candidats à 0,0 exactement, qui sont la valeur par défaut d'une coordonnée manquante. À trancher par Brainditech :

- **0,0 seulement** (proposé, **retenu par Brainditech le 2026-11-05**) : simple, et aucune vraie adresse française n'est à 0,0.
- **Hors de la France** (métropole et outre-mer) : plus large, mais le projet calcule « dans toute la France » et devrait garder les gares frontalières.

Le même arrêt peut aussi servir dans un itinéraire MOTIS. Il faudra vérifier si un trajet peut y passer, et l'écarter aussi à l'import des horaires si c'est le cas (à signaler au producteur du jeu `r83931`).

## 4. Test de régression prévu

`serveur/src/lieux/motis-geocode.test.ts` (nouveau) : une réponse MOTIS avec un `STOP` à 0,0 et un autre normal ⇒ seul le second ressort. Le test doit échouer sur le code actuel.
