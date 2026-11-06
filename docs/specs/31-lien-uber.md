# Spec 31 — Lien Uber pré-rempli sur une étape en taxi

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (« implement tous les specs … jusqu'à voir toutes les phases implémentées », 2026-11-06). Règle : D109. **Appliquée** sur `phase-4/lien-uber`.
- **Branche** : `phase-4/lien-uber`.
- **Case de PLAN.md** : phase 4, « Lien Uber pré-rempli, et taxi de bout en bout (durée estimée, « prix non publié ») » : la première moitié. Le taxi de bout en bout reste à faire.
- **Invariants** : 2 (l'app n'appelle aucune API Uber : elle ouvre un lien), 5 (aucun prix affiché), 16 (aucun numéro), 6 (rien n'est envoyé au serveur).

## 1. But

Une étape en taxi (D48, spec 16) dit « À réserver … Délai pour appeler non connu. » sans moyen d'agir. Un lien vers Uber, pré-rempli avec la prise en charge et la dépose de l'étape, donne ce moyen là où Uber circule (A9).

## 2. Doc lue

- Uber, « Deep Links » (https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction, lu le 2026-11-06) : lien universel `https://m.uber.com/looking`, paramètres `pickup` et `drop[0]` (objets Location JSON encodés : `latitude`, `longitude`, `addressLine1` = surnom, `addressLine2` = adresse affichée), `client_id` décrit comme « Client ID of the requesting application » sans être dit obligatoire.

## 3. Décision D109

1. `lienUber(étape)` (`src/domaine/uber.ts`) : seulement pour une étape `taxi` ; `pickup` = lieu de départ de l'étape, `drop[0]` = lieu d'arrivée, chacun `{latitude, longitude, addressLine1: nom}` encodé. **Sans `client_id`** : pas de compte développeur Uber.
2. Écran Étape : sous la phrase « À réserver … », un lien « Commander un Uber pour cette étape » ouvre l'URL (application Uber si installée, sinon le site). Aucun prix ni attente affiché par Itinhero.

## 4. Options écartées

- Schéma `uber://` : échoue sans l'application ; le lien universel ouvre l'application ou le site.
- API Uber (prix, attente) : contrat développeur, et invariant 5 (aucun prix sans fiche).

## 5. Critères d'acceptation

1. Lien : origine et chemin `https://m.uber.com/looking`, `pickup` et `drop[0]` égaux aux lieux de l'étape, aucun autre paramètre ; un nom avec « & » reste dans son paramètre ; aucune autre étape n'a de lien (`src/domaine/uber.test.ts`).
2. **Téléphone** : une étape en taxi (Gifi Joigny → Domicile à 17:00, spec 16) ⇒ le lien ouvre Uber avec les deux lieux.

## 6. Constats

- 2026-11-06 : critère 1 vert (`npm test`), types et lint verts. Critère 2 à constater par adb.
