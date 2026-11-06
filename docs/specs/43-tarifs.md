# Spec 43 — Tarifs, « Moins cher » et cartes de réduction

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (D119). Règle : D124.
- **Branche** : `fin/bugs-et-voyage-complet`.
- **Cases de PLAN.md** : phase 3, « `data/tarifs.json` … puis le tri « Moins cher » » ; phase 6, « Cartes de réduction ».
- **Invariants** : 5 (aucun prix sans fiche sourcée, aucun prix calculé ou estimé), 7 (les cartes restent sur le téléphone), 9 (fiches validées par Zod).

## 1. But

Dire combien coûte un trajet quand le prix est publié, le ranger par prix, et appliquer les cartes de réduction de la personne, sans jamais inventer un prix.

## 2. Doc lue

Grilles officielles relevées le 2026-11-06 (`docs/collecte/2026-11-06-tarifs-candidats.json`, URL de chaque tarif) : Mobigo (car 2 €), TRAIN Mobigo (tarif plein **non publié**, carte Solidaire −75 %), Nomad (prix par zones), Némus (1,10 €), Île-de-France Mobilités (ticket Métro-Train-RER 2,55 €, réduit 1,30 €).

## 3. Décision D124

1. **Fiches** : `serveur/src/tarifs/tarifs.json` (versionné, Zod) : réseau, produit, montant, réseau du jeu GTFS (`producteurs`), exploitant (facultatif), modes, réductions (carte, nom, %, conditions), canal de vente, URL, date de lecture, `valide_le`. **Seuls les tarifs validés par Brainditech s'appliquent** ; aujourd'hui : Mobigo car, ticket Métro-Train-RER d'IDFM, Némus, tous à valider.
2. Écartés tant que leur prix ne se lit pas tel quel : TER (non publié), Nomad (dépend des zones traversées), ticket Bus-Tram d'IDFM (pas relevé).
3. **Serveur** : chaque étape porte `tarif` (le tarif validé qui correspond au producteur du jeu, au mode et à l'exploitant), ou null. `GET /v1/fiches` rend les cartes connues et les tarifs validés.
4. **App** : prix du trajet = somme des tarifs des véhicules, chacun réduit par la meilleure carte cochée ; un véhicule sans tarif ⇒ « 2,00 € + prix non publié (TER K7) » ; aucun ⇒ « Prix non publié » ; un taxi n'a jamais de prix.
5. **« Moins cher »** : quatrième puce ; prix complets croissants, puis partiels, puis sans prix ; à égalité, « Arrivée la plus tôt ».
6. **Réglages** : « Cartes de réduction », cases à cocher tirées de `GET /v1/fiches`, liste gardée pour l'affichage sans réseau ; les cases cochées restent dans la base du téléphone.

## 4. Options écartées

- Appliquer les tarifs relevés sans validation (le PLAN exige la validation de Brainditech).
- Estimer un prix TER au kilomètre, ou Nomad par la distance (invariant 5).
- Envoyer les cartes au serveur pour qu'il calcule (invariant 7).

## 5. Critères d'acceptation

1. Serveur : tarif d'une étape (réseau, mode, exploitant) ; non validé, autre mode, autre exploitant, marche ⇒ null (`serveur/src/tarifs/tarifs.test.ts`).
2. `GET /v1/fiches` : cartes et tarifs validés seulement ; sans clé ⇒ 401 (même fichier, `securite.test.ts`).
3. App : total, réduction (Solidaire −75 % sur un train), partiel, non publié, taxi sans prix (`src/domaine/prix.test.ts`).
4. App : « Moins cher » (ordre, rang gardé, la carte change l'ordre) (même fichier, `tri.test.ts`).
5. Téléphone : puce « Moins cher », Réglages « Cartes de réduction » ; prix affiché **après la validation d'au moins un tarif** par Brainditech.

## 6. Constats

- 2026-11-06 : critères 1 à 4 verts.
