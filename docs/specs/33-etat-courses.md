# Spec 33 — État des courses d'un trajet enregistré (`POST /v1/etat-courses`)

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (« implement tous les specs … jusqu'à voir toutes les phases implémentées », 2026-11-06). Règle : D111. **Appliquée** sur `phase-7/etat-courses`.
- **Branche** : `phase-7/etat-courses`.
- **Case de PLAN.md** : phase 7, « Rafraîchissement d'un trajet enregistré (`/v1/etat-courses`) » : la route et le client. L'affichage dans Mes trajets viendra avec le flux GTFS-RT (case « GTFS-RT SNCF branché dans MOTIS ») : sans lui, toutes les courses sont « prévu ».
- **Invariants** : 2, 8, 9, 12 (aucun « en direct » sans donnée temps réel de MOTIS).

## 1. But

Un trajet enregistré garde ses horaires prévus. Quand le réseau revient (A7), l'app doit pouvoir demander l'état de chacune de ses courses : prévue, en direct, en retard ou supprimée, avec les seuils de D21.

## 2. Doc lue

- MOTIS v2.11.4, `/api/v6/trip` (openapi.yaml du tag, déjà lu pour la spec 17) : chaque `leg` porte `realTime`, `cancelled`, `startTime` / `scheduledStartTime`, `endTime` / `scheduledEndTime`. Réponse enregistrée le 2026-11-05 : `realTime: false`, `departureTimestampReason: "NO_RT_DATA"`.

## 3. Décision D111

1. `POST /v1/etat-courses` `{ courses: [identifiants] }` : 1 à 20 identifiants distincts au format d'une course MOTIS (le champ `course` des étapes), rien d'autre.
2. Pour chaque course, `/api/v6/trip` puis : une partie supprimée ⇒ `supprime` ; aucune donnée temps réel ⇒ `prevu` ; sinon le plus grand écart au départ ou à l'arrivée, **5 min ou plus ⇒ `retard`** (D21), moins ⇒ `en_direct`, avec `retard_minutes` (jamais négatif).
3. Une course illisible ou injoignable ⇒ `inconnu`, sans faire échouer les autres ; toutes ⇒ 503.
4. L'app a `client.etatCourses(courses)` ; un état hors schéma ⇒ échec (rien d'inventé).

## 4. Options écartées

- Lire le temps réel ailleurs que dans MOTIS (flux GTFS-RT directement) : MOTIS l'intègre déjà, et l'app ne parle qu'à l'API (invariant 2).
- Une requête par course depuis l'app : plus d'appels, plus de limites de débit consommées.

## 5. Critères d'acceptation

1. Réponse enregistrée sans temps réel ⇒ `prevu` ; 4 min ⇒ `en_direct` ; 5 min ⇒ `retard` ; supprimée ⇒ `supprime` ; en avance ⇒ 0 (`serveur/src/routes/etat-courses.test.ts`).
2. Un état par course, dans l'ordre ; une course en panne ⇒ `inconnu` (test).
3. Liste vide, de plus de 20, avec doublon, mal formée, champ en plus ⇒ 400 (test).
4. Sans clé ⇒ 401 ; toutes en panne ⇒ 503 (test).
5. Client de l'app (`src/domaine/api.test.ts`).

## 6. Constats

- 2026-11-06 : critères 1 à 5 verts (`npm test`, `cd serveur && npm test`).
