# Spec 27 — Refus explicite hors de la zone couverte

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (« implement tous les specs … jusqu'à voir toutes les phases implémentées », 2026-11-06). Règle : D105. **Appliquée** sur `phase-2bis/hors-zone`.
- **Branche** : `phase-2bis/hors-zone`.
- **Case de PLAN.md** : phase 2 bis, « Refus explicite hors des données chargées (étranger, réseau sans données) ».
- **Invariants** : 9 (entrée validée), 10 (le refus ne recopie aucune coordonnée), 13 (rien de silencieux : le verdict ou le message dit pourquoi).

## 1. But

Une recherche dont le départ ou l'arrivée est à l'étranger, ou outre-mer, part aujourd'hui chez MOTIS, qui ne connaît ni rue ni arrêt à cet endroit, et revient vide ou en erreur : l'utilisateur lit « Impossible » ou « La recherche a échoué » sans savoir pourquoi. Le serveur doit refuser tout de suite, en disant lequel des deux points est hors de la zone.

## 2. Doc lue

- Geofabrik, extrait « France » : le fichier `.poly` publié avec l'extrait est le contour exact des données OSM qu'il contient (https://download.geofabrik.de/europe/france.html, lu le 2026-11-06). Spec 08 : l'OSM chargé dans MOTIS est cet extrait.
- Format `.poly` d'Osmosis (wiki OSM « Osmosis/Polygon Filter File Format »), lu le 2026-11-06.

## 3. Décision D105

1. **Zone couverte = contour de l'extrait OSM chargé** : `france.poly` de Geofabrik (France métropolitaine et Corse, avec la marge de l'extrait), un anneau de 493 sommets recopié dans `serveur/src/zone/contour-france.ts` avec sa source, sa date et son sha256.
2. `POST /v1/itineraires` vérifie le départ et l'arrivée après la validation Zod, avant tout appel à MOTIS. Hors zone ⇒ **422** `{ "erreur": "hors_zone", "points": ["depart" | "arrivee", …] }`, sans coordonnées. Le retour (spec 19) inverse les mêmes points : un seul contrôle suffit.
3. L'app lit ce 422 (`etat: "hors_zone"`) et écrit : « Le départ est hors de la zone couverte : Itinhero ne connaît que la France métropolitaine et la Corse. » (ou « L'arrivée est… », « Le départ et l'arrivée sont… »). Un seul point ⇒ le message va sous son champ ; les deux ⇒ dans la carte d'erreur.
4. **Réseau sans données** (dans la zone, mais aucun transport ce jour-là ou à cet endroit) : déjà explicite, le verdict dit « Impossible » avec sa raison (spec 15, D79). Rien à ajouter.

## 4. Options écartées

- Un rectangle autour de la France : il inclut Genève, Bruxelles, Turin, Barcelone.
- Un contour calculé à partir des arrêts des GTFS chargés : il varie chaque nuit (phase 8) et exclut des lieux où l'on peut marcher ou prendre un taxi.
- Filtrer `/v1/lieux` : l'IGN connaît l'outre-mer ; mieux vaut montrer le lieu et dire clairement pourquoi on ne peut pas y aller.

## 5. Critères d'acceptation

1. Les gares et mairies de Brienon, Joigny, Flers, Paris, Brest, Strasbourg, Nice, Perpignan, Ajaccio, Bastia, Dunkerque et Hendaye sont dans la zone ; Madrid, Londres, Bruxelles, Turin, Francfort, la Guadeloupe, La Réunion et le large du golfe de Gascogne n'y sont pas (`serveur/src/zone/zone.test.ts`).
2. Départ, arrivée ou les deux hors zone ⇒ 422 `hors_zone` avec les points, sans appeler MOTIS ni recopier les coordonnées ; idem avec une fin de rendez-vous (`serveur/src/routes/itineraires.test.ts`).
3. L'app : 422 `hors_zone` ⇒ `etat: "hors_zone"` ; un 422 d'une autre forme ⇒ « La recherche a échoué. » ; message par point (`src/domaine/api.test.ts`).
4. Téléphone (à constater par adb) : « Madrid » choisi comme arrivée ⇒ message sous le champ d'arrivée, aucune possibilité affichée.

## 6. Constats

- 2026-11-06 : critères 1 à 3 verts (`cd serveur && npm test`, `npm test`).
- Critère 4 : à constater sur le téléphone.
- 2026-11-06, par adb (critère 4), passe demandée par Brainditech : l'IGN ne connaît pas Madrid ni Bruxelles (« gare de Bruxelles Midi » ne propose que des lieux français) ; essai fait avec l'outre-mer, que l'IGN connaît : Domicile → Pointe-à-Pitre (97110) ⇒ « L'arrivée est hors de la zone couverte : Itinhero ne connaît que la France métropolitaine et la Corse. » sous le champ d'arrivée, aucune possibilité affichée (`docs/screenshots/passe/34-hors-zone.png`, non versionnée).
