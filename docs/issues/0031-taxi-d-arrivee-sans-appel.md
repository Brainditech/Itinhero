# Issue 0031 — Le taxi pris à l'arrivée n'a ni « Appeler le taxi » ni rappel

- **Trouvée** le 2026-11-07 par Claude, en constatant le critère de fin de v1 « voyage planifié de porte à porte, aller et retour, avec taxi et heure d'appel, enregistré et rouvert en mode avion » (D47, D48), à la demande de Brainditech (D133).
- **État** : corrigée (analyse et correction par délégation, D133, comme les issues 0023 à 0029).

## 1. Reproduction

Accueil, « rendez-vous gare de Flers jeudi 12 novembre a 11h, fin du rendez-vous a 15h », Domicile ⇒ Gare de Flers. Retour 16:38 → 22:08 : marche, TER K4, bus 39, métro 14, TER P31, puis **taxi 12 min** de la gare de Laroche-Migennes (prise en charge 21:56) jusqu'au domicile. Disquette du retour ⇒ Mes trajets : le retour ne dit pas « 1 appel à passer » ; rouvert, « À faire » ne montre que « Partir, départ de la porte à 16:38 ». Aucune alarme n'est programmée pour le taxi.

## 2. Hypothèse

Les rappels d'un trajet ne gardent que ceux d'avant le départ de la porte.

## 3. Cause racine

Confirmée dans `src/domaine/rappels.ts`, `tousLesRappels` : `.filter((r) => r.instant < depart)`. La spec 30 (§2) le voulait (« un rappel qui tomberait après le départ n'est pas programmé ») pour la veille, la réservation et « Partez ». Mais le rappel d'un taxi pris en cours de route ou à l'arrivée tombe, par nature, pendant le trajet (60 min avant 21:56, soit 20:56, dans le train) : il était jeté avec les autres. L'action « Appeler le taxi » de la spec 40 et le compte des appels venaient de la même liste.

Second défaut vu en lisant : `texteRappel` disait « Rappel la veille » pour tout rappel d'un autre jour que le départ, donc aussi pour un taxi d'arrivée le lendemain (nuit dehors).

## 4. Correction

- Le rappel d'un taxi est gardé s'il précède **sa propre prise en charge** ; les autres gardent la règle de la spec 30 (rien après le départ de la porte).
- `texteRappel` : même jour ⇒ « Rappel à 20:56 » ; jour d'avant ⇒ « Rappel la veille à … » ; jour d'après ⇒ « Rappel le 15/11 à … ».
- Spec 30 §2 complétée par cette exception.

## 5. Test de régression

`src/domaine/rappels.test.ts`, « Taxi à l'arrivée : appel pendant le trajet (issue 0031, D48) » : rappel du taxi d'arrivée 60 min avant sa prise en charge ; « À faire » rangé (réserver, partir, taxi) et « 2 appels à passer » ; les autres rappels toujours avant le départ ; « Rappel le 15/11 à 05:10 » pour un taxi du lendemain. Trois de ces tests échouaient avant la correction (constaté en remettant l'ancien `rappels.ts`).

## 6. Constat

2026-11-07 par adb : retour réenregistré ⇒ Mes trajets « 1 appel à passer » ; en mode avion, app fermée puis rouverte, « À faire » du retour : « Partir, 16:38, rappel à 16:23 » puis « Appeler le taxi, prise en charge à 21:56, Laroche - Migennes, rappel à 20:56 », LENOBLE TAXIS avec « Fiche validée le 07/11/2026, source : www.pagesjaunes.fr » (`docs/screenshots/fin-impl/fl-09-retour-avion-a-faire.png`, non versionnée). `dumpsys alarm` : alarme exacte (`window=0`) le 12/11 à 20:56 (heure de Paris).
