# Spec 47 — Covoiturage (lien BlaBlaCar pré-rempli)

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (D119). Règle : D128. **Appliquée** et constatée sur le téléphone le 2026-11-06 (critères 1 à 5).
- **Branche** : `fin/bugs-et-voyage-complet` (PR #61).
- **Cases de PLAN.md** : phase 6 ter, « Source du covoiturage constatée » et « Covoiturage proposé quand aucun transport public n'arrive à l'heure, et en option sinon » (D50, R14).
- **Invariants** : 2 (aucune API de covoiturage appelée : un lien s'ouvre), 5 (aucun prix ni place affichés), 6 (rien n'est envoyé au serveur ; le domicile exact ne part pas non plus chez BlaBlaCar).

## 1. But

D50 : « s'il n'y a pas de train, il me propose BlaBlaCar, tous les moyens possibles ». Le covoiturage est proposé quand le jour n'offre aucun transport public à l'heure, et en option sinon.

## 2. Source constatée (R14), le 2026-11-06

- **Accès développeur BlaBlaCar (longue distance)** : `https://dev.blablacar.com/` répond 404 (portail retiré) ; `https://public-api.blablacar.com/api/v3/trips` répond 401 « No API key found in request ». Les articles d'aide « Search V3 », « Migrating from V2 to V3 » et « BlaBlaCar URLs format » sont en 404. Aucune page officielle n'ouvre de clé aux nouveaux développeurs.
- **BlaBlaCar Daily (moins de 80 km, ex-Klaxit)** : API partenaire officielle (`https://api-doc.blablacardaily.com/docs/BlaBlaCarDaily_Partner-API.pdf`, modifiée le 2026-05-05) : « L'utilisation de l'API est protégé par un jeton propre à chaque partenaire. Les nouvelles demandes de jeton peuvent être effectuées via le formulaire : https://blablacardaily.com/contact ». Rachat annoncé par Karos (presse, 2026-07-20).
- **Sources publiques** : ni transport.data.gouv.fr (lieux de covoiturage seulement), ni le Registre de preuve de covoiturage (trajets faits), ni le « Standard covoiturage » (brouillon, sans opérateur) ne donnent d'annonces cherchables à une app privée. L'article L1115-1 7° du code des transports réserve l'accès aux autorités organisatrices de la mobilité.
- **Lien de recherche** : `https://www.blablacar.fr/search?fn=…&fc=lat,lon&tn=…&tc=lat,lon&db=AAAA-MM-JJ&seats=1`, essayé dans Chrome : le formulaire se remplit (« Paris → Auxerre, Ven. 20 nov. », « 44 trajets disponibles »). Sans `fn`/`tn`, la page revient au formulaire vide. Format non documenté aujourd'hui (article d'aide en 404) : il peut changer.

## 3. Ce qui change (D128)

1. `lienBlaBlaCar(de, a, date)` (`src/domaine/covoiturage.ts`) : `fn`/`tn` = commune lue après le code postal de l'adresse (sinon le nom du lieu), `fc`/`tc` = coordonnées **arrondies au centième** (≈ 1 km), `db` = date de la demande, `seats=1`. Ni la rue ni le mot « Domicile » ne partent.
2. Carte « Covoiturage » dans chaque sens du Résultat (aller : départ → arrivée ; retour : l'inverse), avec « Chercher sur BlaBlaCar » et « Prix et places sur BlaBlaCar. » :
   - **en tête** du sens, sous son verdict, quand aucun trajet de ce sens n'est fait de transport public seul : « Aucun transport public n'arrive à l'heure ce jour-là. » (aucun trajet) ou « Sans taxi, aucun transport public n'arrive à l'heure. » (trajets avec un taxi seulement), suivi de « Un conducteur fait peut-être ce trajet. » ;
   - **après les trajets** sinon : « Autre possibilité : partager la voiture d'un conducteur. »
3. Pas de carte sur un trajet rouvert depuis Mes trajets (comme le taxi de bout en bout).

## 4. Options écartées

- API BlaBlaCar longue distance : aucun accès ouvert (§2).
- API BlaBlaCar Daily : jeton sur demande de partenariat (démarche de Brainditech, R14) ; à brancher plus tard pour les trajets courts si le jeton est obtenu.
- Annonces recopiées d'un site : conditions d'utilisation, données périmées (D50).

## 5. Critères d'acceptation

1. Lien : origine et chemin `https://www.blablacar.fr/search`, paramètres `fn`, `fc`, `tn`, `tc`, `db`, `seats` seulement (`src/domaine/covoiturage.test.ts`).
2. Le domicile exact ne part pas : ni la rue, ni « Domicile », ni de coordonnées au-delà du centième (test).
3. En tête si aucun trajet de transport public seul, après les trajets sinon (test).
4. **Téléphone** : une recherche avec trajets ⇒ carte après les trajets ; « Chercher sur BlaBlaCar » ouvre la recherche pré-remplie.
5. **Téléphone** : un jour sans transport public à l'heure ⇒ carte en tête.

## 6. Constats

- 2026-11-06 : critères 1 à 3 verts (`npm test`, 8 tests), types et lint verts.
- 2026-11-06, par adb : Domicile → Joigny (gare), jeudi 10:00 : le seul trajet passe par un taxi ⇒ carte en tête, « Sans taxi, aucun transport public n'arrive à l'heure. » (critère 5 ; la première phrase, « Aucun transport public ce jour-là », était fausse dans ce cas et a été corrigée). « Chercher sur BlaBlaCar » ouvre l'application BlaBlaCar sur « Brienon-sur-Armançon → Joigny, jeu. 12 nov., 1 passager » (critère 4 ; aucun conducteur ce jour-là). Domicile → Gare de Sens : trajets sans taxi ⇒ carte après les trajets, avant le taxi de bout en bout, « Autre possibilité ». Captures `docs/screenshots/47-*.png` (non versionnées, D38).
