# Spec 42 — Temps réel : retards SNCF, alertes, autre solution

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (D119). Règle : D123.
- **Branche** : `fin/bugs-et-voyage-complet`.
- **Cases de PLAN.md** : phase 7, « GTFS-RT SNCF branché dans MOTIS (R3) », « `suivi-retards` », « Replanification (D51) ».
- **Invariants** : 2 (l'app ne lit le temps réel que par l'API), 6 et 10 (l'abonnement ne garde que course, jour et jeton ; le message poussé ne dit ni lieu ni heure), 12 (aucun « en direct » sans flux).

## 1. But

Prévenir pendant le voyage : retard d'au moins 5 min, véhicule supprimé, et proposer une autre solution sans rien remplacer d'office (D21, D51).

## 2. Doc lue

- MOTIS v2.11.4, `docs/setup.md` du tag : `rt: [{url}]` par jeu, `update_interval`.
- transport.data.gouv.fr, jeu `horaires-sncf` : `https://proxy.transport.data.gouv.fr/resource/sncf-gtfs-rt-trip-updates` (constaté : 200, 1,4 Mo de protobuf).
- expo-background-task ~58.0.12 et expo-task-manager ~58.0.13 (`BackgroundTask.types.d.ts` : 15 min au moins, intervalle inexact) ; expo-notifications 58.1.8 (`getExpoPushTokenAsync` : `projectId` d'EAS) ; « Sending notifications with Expo's push API » (100 messages par requête).

## 3. Décision D123

1. **MOTIS** : le flux GTFS-RT SNCF est branché sur le jeu `horaires-sncf`, relevé chaque minute (`npm run donnees:config` réécrit `donnees/config.yml`). Constaté le 2026-11-06 : 2 049 entités, 1 760 rattachées (85,9 %), sans réimport (MOTIS redémarré en 1 min).
2. **Pas d'Inngest** : `suivi-retards` et la purge tournent dans le processus de l'API (minuteries), comme la purge de la spec 29. Raison : un seul serveur, une seule instance ; Inngest ajoutait un conteneur, deux secrets à mettre dans `.env` et la question de la licence (A10).
3. **App, sans compte** : le téléphone relève lui-même l'état de ses trajets en cours (de 3 h avant le départ à l'arrivée) par `POST /v1/etat-courses` : chaque minute à l'écran du trajet rouvert (bloc « En direct »), et en arrière-plan par `expo-background-task` (15 min au mieux). Une alerte nouvelle (D21 : supprimé une fois ; retard de 5 min puis chaque hausse de 5 min) devient une notification locale.
4. **Serveur, avec compte** : `suivi-retards` lit chaque minute les courses abonnées et envoie les alertes par Expo Push (`EXPO_ACCESS_TOKEN` facultatif). L'app s'abonne à l'enregistrement d'un trajet seulement si un jeton Expo existe, ce qui demande un projet Expo (`extra.eas.projectId`) et Firebase (`google-services.json`) : à créer par Brainditech (R7).
5. **Autre solution (D51)** : un véhicule supprimé affiche « Chercher une autre solution » : nouvelle recherche depuis son arrêt de montée, à partir de maintenant, vers la même arrivée ; le trajet enregistré n'est pas remplacé. Toucher une alerte rouvre le trajet.

## 4. Options écartées

- Inngest auto-hébergé (voir D123.2).
- Notifications poussées seulement : rien ne marcherait sans les comptes Expo et Firebase.
- Recalcul par le serveur depuis le prochain arrêt : il faudrait lui confier la destination (invariant 6).

## 5. Critères d'acceptation

1. App : étapes suivies, pastilles, règle D21 des alertes (`src/domaine/temps-reel.test.ts`).
2. Serveur : `suivi-retards` sur un flux simulé (réponses `/api/v6/trip`) : 7 min ⇒ alerte, 9 ⇒ rien, 12 ⇒ alerte, suppression une fois, abonnement expiré ignoré, aucun lieu ni heure dans le message (`serveur/src/alertes/suivi.test.ts`).
3. MOTIS : statistiques du flux dans son journal (constat daté).
4. Téléphone : bloc « En direct » sur un trajet du jour avec un TER ; notification locale reçue en arrière-plan (après le development build).
5. Notification poussée reçue app fermée : après la création du projet Expo et de Firebase.

## 6. Constats

- 2026-11-06 : critères 1 et 2 verts ; critère 3 : journal de MOTIS, « total_entities=2049, total_entities_success=1760 (85.8956%) ».
- Critères 4 et 5 : à faire (development build, comptes).
