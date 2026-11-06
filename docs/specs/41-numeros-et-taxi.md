# Spec 41 — Numéros à appeler, marche longue et taxi de bout en bout

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (D119). Règle : D122.
- **Branche** : `fin/bugs-et-voyage-complet` (avec l'issue 0025, l'issue 0026 et la spec 40, D119).
- **Cases de PLAN.md** : phase 4, « Annuaire `data/fiches/` validé. Avertissement ⚠ au-delà de 15 min de marche, avec un taxi pour cette étape », « Lien Uber pré-rempli, et taxi de bout en bout », « Numéros trouvés hors des fiches, « non vérifié » (D49, `POST /v1/numeros`) ».
- **Invariants** : 3, 5 (aucun prix de taxi), 6 et 10 (le point de `/v1/numeros` n'est ni gardé ni journalisé), 9 (fiches validées par Zod), 16 (numéro toujours sourcé).

## 1. But

Un débutant qui doit appeler un taxi ou réserver un car à la demande doit avoir **le numéro**, et savoir d'où il vient. Une marche de plus de 15 min doit pouvoir se faire en taxi. Quand les transports ne conviennent pas, le taxi de bout en bout doit être proposé avec sa durée.

## 2. Doc lue

- MOTIS v2.11.4, `openapi.yaml` du tag : `directModes`, `maxDirectTime`, `transitModes` ; constaté sur le MOTIS national : `directModes=CAR&transitModes=WALK` ⇒ 0 itinéraire et 1 trajet direct en voiture (Brienon → Flers : 15 698 s, 458 km).
- GTFS (référence) : `agency.txt`, `agency_phone` facultatif.
- Uber « Deep Links » (spec 31).

## 3. Décision D122

1. **Fiches** : `serveur/src/fiches/fiches.json` (versionné, validé par Zod), chacune avec type (`taxi` ou `tad`), nom, numéro, communes, centre et rayon, délai de réservation, URL, date de lecture et `valide_le`.
   - `valide_le` rempli par Brainditech ⇒ fiche affichée telle quelle, « Fiche validée le … ».
   - `valide_le: null` (candidate) ⇒ affichée seulement si le serveur **retrouve le numéro sur sa page** (relue au démarrage puis chaque jour), avec « Non vérifié : lu sur {site} le … » (D49).
2. **Exploitant** : pour un passage sur réservation, le `agency_phone` du GTFS de l'exploitant (lu par `npm run donnees:horaires`) ; c'est un fichier public lu par le serveur, pas une fiche validée : « Non vérifié : numéro publié par l'exploitant avec ses horaires, lu le … ». Sinon la fiche de transport à la demande la plus proche.
3. **Taxi** : la fiche la plus proche du lieu de prise en charge (dans son rayon).
4. `POST /v1/numeros` `{point, type}` ⇒ au plus 3 numéros, les plus proches ; aucun ⇒ liste vide (« Aucun numéro connu. »).
5. Chaque étape de la réponse porte `contact` (ou null).
6. **Marche de plus de 15 min** (écran Étape) : « Marche de 21 min : un taxi peut faire cette étape. », lien Uber pré-rempli et « Numéros de taxi près du départ ».
7. **Taxi de bout en bout** : `taxi_direct` dans chaque sens de la réponse (durée de route MOTIS, distance, départ et arrivée placés sur la demande) ; carte « Taxi de bout en bout » sous les trajets du Résultat : heures, « 4 h 22 de route estimée, hors attente · 458 km », « Prix non publié. », Uber, numéros. Pas sur un trajet rouvert.

## 4. Options écartées

- Chercher les numéros sur le web à chaque demande (lent, conditions des sites, R16).
- Afficher le numéro du GTFS comme « vérifié » : l'invariant 16 ne connaît que la fiche validée.
- Prix d'un taxi estimé (invariant 5).

## 5. Critères d'acceptation

1. Annuaire : validée affichée, candidate seulement si son numéro est sur sa page, retirée quand la page change, rayon et type respectés (`serveur/src/fiches/annuaire.test.ts`).
2. Contact de chaque étape : taxi ⇒ fiche ; réservation ⇒ exploitant (non vérifié, URL et date du jeu), sinon fiche TAD ; marche ⇒ rien (même fichier).
3. `POST /v1/numeros` : 200 avec la liste, 400 sur un type inconnu, liste vide sans annuaire ; route couverte par `securite.test.ts`.
4. Taxi de bout en bout : URL MOTIS, heures en « arriver » et « partir », null sans route (`serveur/src/routes/taxi-direct.test.ts`).
5. App : texte de la source, `tel:`, Uber d'une marche longue et de bout en bout (`src/domaine/contacts.test.ts`).
6. Téléphone (adb) : carte « Taxi de bout en bout » au Résultat ; écran Étape d'une marche de plus de 15 min avec l'avertissement et les numéros ; numéro d'un passage sur réservation ; au moins une fiche validée par Brainditech (case de la phase 4).

## 6. Constats

À remplir.
