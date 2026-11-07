# Spec 30 — Rappels locaux d'un trajet enregistré

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (« implement tous les specs … jusqu'à voir toutes les phases implémentées », 2026-11-06). Règle : D108. **Appliquée** sur `phase-5/rappels`.
- **Branche** : `phase-5/rappels`.
- **Case de PLAN.md** : phase 5, « Rappels locaux : veille, échéance de réservation, « partez dans N min » » ; prépare « Plan de voyage complet enregistré … appels à passer … avec leurs rappels ».
- **Invariants** : 3 (aucune heure recalculée : tout vient de la possibilité enregistrée), 6 (rien n'est envoyé au serveur : les rappels sont locaux), 16 (aucun numéro : aucune fiche validée, « délai non connu »).
- **Build** : `expo-notifications` est un module natif ⇒ un development build de plus (le même que celui de la spec 23 s'il est refait après la fusion).

## 1. But

D45 promet un voyage planifié « pour un débutant ». Enregistrer un trajet doit suffire pour être prévenu au bon moment : la veille, quand il faut réserver un passage sur appel, quand il faut appeler le taxi, et un quart d'heure avant de partir. Sans réseau, puisque tout est déjà sur le téléphone.

## 2. Doc lue

- Expo SDK 58, `expo-notifications` (https://docs.expo.dev/versions/v58.0.0/sdk/notifications/, lu le 2026-11-06) : `scheduleNotificationAsync` avec `identifier` et déclencheur `DATE` (`channelId`), `getAllScheduledNotificationsAsync`, `cancelScheduledNotificationAsync`, `setNotificationChannelAsync` à créer **avant** la demande d'autorisation (Android 13), `getPermissionsAsync` / `requestPermissionsAsync`, `setNotificationHandler` (`shouldShowBanner`, `shouldShowList`), plugin `defaultChannel`. Notifications locales sans FCM ni `projectId`. Sans `SCHEDULE_EXACT_ALARM`, livraison approximative.
- Version installée par `npx expo install expo-notifications` : **58.1.8**.

## 3. Décision D108

1. **Quatre rappels**, tirés de la possibilité que montre le trajet enregistré (D101, D102), heure de Paris :
   - **veille** à 19:00 : « Demain : trajet vers <arrivée> » — « Départ HH:MM, <première étape> à HH:MM. Arrivée prévue HH:MM. » ;
   - **réservation** (étape sur réservation, D69) la veille à 10:00 : « À réserver : <ligne> de HH:MM » — « Passage sur réservation à <arrêt>. Délai non connu : réservez au plus tôt. » ;
   - **taxi** 60 min avant la prise en charge : « Appelez le taxi maintenant » — « Prise en charge à HH:MM, <lieu>. Délai pour appeler non connu. » ;
   - **partir** 15 min avant le départ de la porte : « Partez dans 15 min ».
   Un rappel passé, ou qui tomberait après le départ, n'est pas programmé. Exception (issue 0031, 2026-11-07) : le rappel d'un taxi pris en cours de route ou à l'arrivée est gardé tant qu'il précède sa propre prise en charge. Aucun numéro tant qu'aucune fiche n'est validée (invariant 16) ; avec les fiches (phase 4), le délai de réservation remplacera 10:00 et 60 min.
2. **Programmation** à l'enregistrement (disquette) ; un trajet remplacé (« Modifier ») ou supprimé perd ses rappels. Un refus d'autorisation ou un échec n'empêche jamais l'enregistrement.
3. **Pas de table `rappels_programmes`** : chaque notification porte l'identifiant `rappel|<clé du trajet>|<clé du rappel>` ; on retrouve et annule ceux d'un trajet par la liste des notifications prévues. Une table aurait doublé un état que le système tient déjà.
4. **Canal** Android « Rappels de trajet » (importance haute), créé avant la demande d'autorisation ; notifications montrées aussi app ouverte. **Livraison « au mieux »** : pas d'alarme exacte (`SCHEDULE_EXACT_ALARM` refusée par défaut sur Android 14, réservée aux réveils et agendas) ; un décalage de quelques minutes est accepté.

## 4. Options écartées

- Alarmes exactes : permission réservée aux applications d'alarme ; 15 min d'avance absorbent le décalage.
- Notifications envoyées par le serveur : inutile pour des heures déjà connues, et contraire au fonctionnement sans réseau.
- Table `rappels_programmes` (PLAN §4) : l'identifiant de la notification suffit.

## 5. Critères d'acceptation

1. Brienon → Dijon du samedi 14/11 (bus 803 sur réservation 08:25) : réservation vendredi 10:00, veille vendredi 19:00, partir 07:59 ; textes tirés de la possibilité, sans numéro ; taxi ⇒ 60 min avant (`src/domaine/rappels.test.ts`).
2. Enregistré la veille à 20:00 ⇒ seul « partir » ; trajet passé ⇒ aucun (test).
3. `instantDeParis` : heure d'hiver, d'été, jour du changement (test).
4. **Téléphone** (après le build) : enregistrer un trajet de demain ⇒ demande d'autorisation, puis `adb shell dumpsys notification` montre les rappels prévus ; supprimer le trajet ⇒ ils disparaissent ; un rappel reçu app fermée (essai avec un trajet qui part dans 20 min).

## 6. Constats

- 2026-11-06 : critères 1 à 3 verts (`npm test`), `npx tsc --noEmit` et `npx expo lint` verts.
- Critère 4 : à faire après le development build.
