# Issue 0026 — Rappels jusqu'à 1 h en retard

- **Date** : 2026-11-06
- **État** : **corrigée** dans le code le 2026-11-06 (analyse approuvée par délégation, D119) ; à constater après le prochain development build (permission dans le manifeste).
- **Branche** : `verif/constats-a`. Décision : D120.

## 1. Reproduction

Spec 30, constat par adb du 2026-11-06 : trajet du 07/11 enregistré, `adb shell dumpsys alarm` montre les trois rappels (veille 19:00, taxi 07:35, « Partez dans 15 min » 08:20) avec `window=+1h`.

## 2. Hypothèse (vérifiée)

expo-notifications 58.1.8, `ExpoSchedulingDelegate.setupAlarm` : sans `alarmManager.canScheduleExactAlarms()`, il programme par `setAndAllowWhileIdle()` (alarme inexacte, fenêtre laissée à Android). Le manifeste de l'app ne déclare ni `SCHEDULE_EXACT_ALARM` ni `USE_EXACT_ALARM` ; sur Android 14 et plus, la première est refusée par défaut. Donc `canScheduleExactAlarms()` est faux et Android décale jusqu'à une heure.

## 3. Cause racine

D108 avait choisi « livraison au mieux, sans alarme exacte ». Ce choix ne tient pas pour « Partez dans 15 min ».

## 4. Correction (D120)

- `app.json` : `android.permissions` = `USE_EXACT_ALARM` (Android 13 et plus, accordée à l'installation) et `SCHEDULE_EXACT_ALARM` (Android 12).
- `src/rappels.ts` : `delivery: "alarmClock"` pour « Partez » et « Appelez le taxi » (`livraisonDe`), `bestEffort` (exact avec la permission) pour la veille et la réservation.

## 5. Test de régression

`src/domaine/rappels.test.ts` (« issue 0026 ») : le type de livraison de chaque rappel. La permission elle-même se constate sur le téléphone : `adb shell dumpsys alarm | grep -A3 Itinhero` ⇒ plus de `window=+1h`, `ALARM_CLOCK` pour « Partez ».

## 6. Constat

À faire après le development build (le manifeste change).
