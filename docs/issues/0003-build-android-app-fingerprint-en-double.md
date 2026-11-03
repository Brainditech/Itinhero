# Issue 0003 — Build Android : « app.fingerprint » déjà présent, `compressDebugAssets` échoue

> Ouverte le 2026-11-03. État : **close le 2026-11-03.** Analyse approuvée par Brainditech (« ok »), hypothèse confirmée.
> Branche : `phase-1/fond-carte` (spec 03), juste après `npx expo install --fix` (commit `d48cb1e`).

## Reproduction

1. Paquets Expo mis à jour (expo 58.0.22 → 58.0.23, etc.) sur un dossier `android/` déjà construit le 2026-11-03 vers 00:22.
2. `npx expo run:android` (Brainditech, 2026-11-03 vers 19:29).
3. Échec :
   `Execution failed for task ':app:compressDebugAssets'` …
   `Zip file '…\android\app\build\intermediates\compressed_assets\debug\compressDebugAssets\out\assets\app.fingerprint.jar' already contains entry 'assets/app.fingerprint', cannot overwrite`

## Constat

Dans `android/app/build/intermediates/` :

- `assets/debug/mergeDebugAssets/app.fingerprint` existe ;
- `compressed_assets/debug/compressDebugAssets/out/assets/` contient `app.config.jar` (00:22, build précédent) et `app.fingerprint.jar` (19:29, build qui échoue).

## Hypothèse (une seule)

Sortie incrémentale périmée : la tâche `compressDebugAssets` reprend le dossier de sortie du build précédent au lieu de le refaire, et bute sur un `app.fingerprint.jar` déjà écrit. Le code du projet n'y est pour rien : ce dossier est généré par Gradle.

## Vérification proposée

Supprimer seulement le dossier généré `android/app/build/intermediates/compressed_assets/`, puis relancer `npx expo run:android`.

- Le build passe ⇒ hypothèse confirmée, cause racine : sortie incrémentale périmée après la mise à jour des paquets.
- Il échoue encore ⇒ hypothèse rejetée, on cherche qui ajoute `app.fingerprint` deux fois.

## Test de régression

Aucun test vitest possible (outillage de build natif). La preuve est le build qui passe après la suppression.

## Résultat

2026-11-03 : dossier `compressed_assets/` supprimé, puis `npx expo run:android --device` par Brainditech : build réussi, app installée et ouverte sur son téléphone (`docs/preuves/2026-11-03-spec03-telephone-attribution-depliee.jpg`). Cause racine : sortie incrémentale de Gradle périmée après la mise à jour des paquets. Si cela revient après une mise à jour, même remède.
