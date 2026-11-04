# Issue 0007 — Brienon → Dijon : MOTIS semble rater les meilleurs trajets

- **Date** : 2026-11-04
- **État** : cause racine trouvée, **pas un défaut de l'app ni des données**. Erreur de méthode dans la comparaison : MOTIS a été interrogé directement, sans `useRoutedTransfers=true`. Aucune correction de code. Test de régression proposé au §6, à approuver par Brainditech.

## 1. Reproduction

MOTIS national de la spec 08 (`itinhero-national`, données du 2026-11-04), jeudi 12/11/2026, de la mairie de Brienon-sur-Armançon au tribunal judiciaire de Dijon (cité judiciaire, bd Clemenceau). Requête directe à MOTIS, **sans** `useRoutedTransfers` (donc `false`, valeur par défaut) :

```
GET /api/v5/plan?fromPlace=47.9918,3.6170&toPlace=47.3297,5.0450&time=2026-11-12T05:00:00Z
```

Réponse : départ 06:26, car K941 jusqu'à Neuvy-Sautour, 2 h d'attente, retour à Saint-Florentin, train de 09:11, arrivée 10:42.

Attendu (vu dans SNCF Connect et Google Maps) :
- 06:27 → environ 09:45 : car K941 jusqu'à Saint-Florentin-Ville, 48 min de marche jusqu'à la gare, train de 08:12 ;
- 08:24 → 10:41 : car 803 08:25 jusqu'à la gare de Saint-Florentin, train de 09:11.

## 2. Hypothèses écartées

1. **Données Mobigo trop vieilles** (premier constat) : fausse. Le fichier de l'Yonne `r84072` (« Données du Réseau Mobigo dans l'Yonne - 89 », mis à jour le 2026-09-21) est chargé à côté de l'ancien fichier régional `r83931` (24/06). La course `1014608-1-1` du 803, partie de MAIRIE (`600326`) à 08:25, a pour calendrier `5225:7483-7-127` : tous les jours du 21/10/2026 au 31/08/2027, sauf les dimanches. MOTIS la donne dans les départs de l'arrêt (`/api/v1/stoptimes?stopId=r84072_600326`).
2. **Correspondance à pied absente entre deux jeux de données** (deuxième hypothèse) : fausse aussi, voir §3.

## 3. Cause racine

Sans `useRoutedTransfers=true`, MOTIS n'utilise pas les correspondances à pied calculées sur la carte OSM (`osr_footpath`). Les correspondances entre un arrêt de car et la gare, longues de 14 et 48 min, sont alors ignorées. C'était déjà écrit dans la spec 04 §11 : « `useRoutedTransfers=true` est obligatoire, sinon MOTIS ignore les marches calculées sur OSM ». Le serveur met ce paramètre à chaque appel ([serveur/src/itineraires/motis-plan.ts](../../serveur/src/itineraires/motis-plan.ts), vérifié par `motis-plan.test.ts`). La comparaison, elle, était faite à la main sans ce paramètre.

## 4. Vérification (2026-11-04)

Même MOTIS national, mêmes paramètres que le serveur (`/api/v6/plan`, `useRoutedTransfers=true`, `searchWindow=36000`). Heures de Paris :

| Départ | Trajet trouvé par MOTIS | Arrivée | Référence |
|---|---|---|---|
| dès 06:00 | 06:26, K941 → Saint-Florentin-Ville, marche 48 min, train P5 08:12 → Dijon, bus 10 | 09:46 | SNCF Connect : 06:27 → ~09:45 ✅ |
| dès 06:00 ou 08:00 | 08:24, car 803 → gare de Saint-Florentin, marche 14 min, train K7 09:11 → Dijon, tram T2 | 10:43 | Google 10:41, SNCF Connect 10:56 ✅ |
| l'après-midi | 13:24, K941 → Laroche-Migennes, train P5 → Dijon, bus 10 | 16:08 | Google 16:07 ✅ |

Le trajet de 06:26 par Neuvy-Sautour disparaît : celui de 06:26 par la marche le domine.

D'arrêt à arrêt (de `r84072_600326` à `r83582_StopArea:OCE87713040`, gare de Dijon), on retrouve les deux trajets attendus avec `useRoutedTransfers=true`, et aucun des deux avec `false`.

## 5. Conséquence

- Aucune correction de code ni de données.
- Toute comparaison avec une autre application doit passer par les paramètres du serveur, jamais par une requête directe à MOTIS avec ses valeurs par défaut. Dès la spec 09, on passera par `POST /v1/itineraires`.
- Remarque, sans incidence ici : 14 min de marche pour environ 400 m à vol d'oiseau entre l'arrêt « Saint-Florentin-Vergigny 3 rue de la Gare » et la gare (détour pour traverser les voies, à vérifier sur la carte).

## 6. Test de régression (proposé)

Dans la spec 09, un test d'intégration sur le MOTIS national (sur le PC seulement, jamais en CI). Il passe par la route du serveur et vérifie, pour le jeudi 12/11 de la mairie de Brienon au tribunal judiciaire de Dijon :
- dès 06:00 : un trajet qui arrive au plus tard à 09:50 ;
- dès 08:00 : un trajet qui part à 08:24 et arrive au plus tard à 10:45, par le car 803.
