# Spec 10 — L'app branchée : clé, domicile, position, Confirmation et Résultat réels

> Rédigée le 2026-11-04. État : **à approuver par Brainditech.**
> Branche : `app/branchee`. Une seule PR (D34 : ce qui se vérifie ensemble).
> Maquettes : `design/confirmation-lieu/03-confirmation-lieu.png`, `design/resultat/04-resultat.png`, `design/reglages/07-reglages.png`.
> Choix de Brainditech du 2026-11-04 : départ depuis le **domicile et la position** ; clé demandée **au premier lancement**.
> Décisions liées : D3, D15, D17, D22, D34, D54, D55, D58, A3, A19, R11. Nouvelles décisions proposées : D63 à D67. Invariants : 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 20.

## 1. But

Pouvoir juger le moteur **dans l'app** (D54) : choisir un départ (domicile ou position), un lieu, un jour et une heure, puis voir le verdict et les vrais trajets du MOTIS national, pour les comparer à Google Maps.

Cases de PLAN.md visées :
- phase 0 · « Vérification des variables d'environnement au démarrage » : la partie app (`EXPO_PUBLIC_API_URL`), qui la ferme ;
- phase 1 · « Clé d'appareil (secure-store, saisie unique) et limites de débit côté serveur » : la saisie sur le téléphone, qui la ferme ;
- phase 2 · « Confirmation demandée quand il y a plusieurs candidats » ;
- phase 2 et 3 · « Écran en valeurs en dur, comparé à sa maquette » : **non cochées** ici, les écrans sont construits directement avec les vraies valeurs ; la capture côte à côte est fournie quand même et peut les cocher si Brainditech l'accepte.

Hors de cette spec (§9) : la phrase comprise par Claude, les tris, le prix, le taxi, le retour, le Détail, l'enregistrement du trajet.

## 2. Ce qui est déjà constaté (2026-11-04)

| Constat | Source |
|---|---|
| L'API publie son port sur `127.0.0.1:3000` seulement : le téléphone ne peut pas la joindre par le Wi-Fi | `docker-compose.yml`, l. 48-49 |
| Le build de développement autorise le HTTP sans chiffrement (`usesCleartextTraffic="true"` dans les manifestes `debug` et `debugOptimized`) ; le build `release` ne l'autorise pas | `android/app/src/debug/AndroidManifest.xml` (généré, jamais modifié à la main) |
| `expo-secure-store` (SDK 58) : `setItemAsync`, `getItemAsync`, `deleteItemAsync` ; chiffré par le Keystore d'Android ; exclu de la sauvegarde automatique par défaut (`configureAndroidBackup: true`) ; nom de clé : lettres, chiffres, `.`, `-`, `_` | docs.expo.dev/versions/v58.0.0/sdk/securestore, lue le 2026-11-04 |
| `expo-location` (SDK 58) : `requestForegroundPermissionsAsync`, `getLastKnownPositionAsync({ maxAge, requiredAccuracy })`, `getCurrentPositionAsync({ accuracy })` ; arrière-plan désactivé par défaut (`isAndroidBackgroundLocationEnabled: false`) | docs.expo.dev/versions/v58.0.0/sdk/location, lue le 2026-11-04 |
| `expo-sqlite` (SDK 58) : `SQLiteProvider` avec `onInit` pour les migrations (`PRAGMA user_version`), `useSQLiteContext`, `runAsync`, `getFirstAsync` | docs.expo.dev/versions/v58.0.0/sdk/sqlite, lue le 2026-11-04 |
| Contrats des routes : `GET /v1/lieux?q=&proche=lat,lon` ⇒ `{ candidats: [{ nom, type, commune?, code_postal?, lat, lon, distance_metres? }] }` ; `POST /v1/itineraires` ⇒ `{ verdict, demande, possibilites[] }`, chaque étape avec sa `source` ; 401 sans clé valide, 429 avec `Retry-After` | spec 09, §4.4, §4.5, §11.1 |
| L'app n'appelle encore aucune route ; « Chercher » de l'Accueil ne fait rien ; celui du formulaire valide seulement | `src/app/(onglets)/(chercher)/index.tsx`, `formulaire.tsx` |
| Les jetons de couleur n'existent que pour train, car, transport à la demande, marche et taxi ; aucun pour métro, tram, bus, RER | `design/design-system.md`, « Modes de transport » |

## 3. Décisions proposées

- **D63 — En développement, le téléphone joint l'API du PC par `adb reverse`.**
  - `EXPO_PUBLIC_API_URL=http://localhost:3000` dans le `.env` du PC (rempli par Brainditech), et `adb reverse tcp:3000 tcp:3000` à chaque branchement du téléphone (USB ou émulateur).
  - Raison : le compose reste sur `127.0.0.1`, l'API n'est jamais exposée au réseau local ; même adresse pour l'émulateur et le téléphone.
  - Écartés : publier le port sur `0.0.0.0` (n'importe quel appareil du Wi-Fi atteint l'API) ; l'adresse IP du PC (change avec le Wi-Fi, et pare-feu Windows à ouvrir).
  - Limite : le build `release` (D22) refuse le HTTP ; il attendra l'API en HTTPS du VPS (phase 10).
- **D64 — Clé d'appareil : écran au premier lancement, vérifiée par le serveur avant d'être gardée.**
  - Tant que `expo-secure-store` ne contient pas `cle_appareil`, seul l'écran « Clé d'appareil » s'ouvre (`Stack.Protected` d'Expo Router, doc de la version installée relue à l'application).
  - Format vérifié dans l'app : 43 caractères base64url (D55). Puis un appel `GET /v1/lieux?q=Paris` avec la clé : 200 ⇒ gardée ; 401 ⇒ « Cette clé est refusée par le serveur. » ; serveur injoignable ⇒ « Le serveur ne répond pas. La clé n'est pas enregistrée. » La clé n'est jamais affichée en clair une fois gardée, ni journalisée.
  - Dans Réglages : « Remplacer la clé ». Si une route répond 401 plus tard, la clé est effacée et l'écran revient.
  - Écartés : garder la clé sans la vérifier (une faute de frappe ne se verrait qu'à la première recherche) ; la mettre dans une variable `EXPO_PUBLIC_*` (invariant 1).
- **D65 — Domicile dans SQLite, sur le téléphone seulement.**
  - Table `reglages` (PLAN §4) : `cle TEXT PRIMARY KEY, valeur TEXT NOT NULL` ; le domicile y est une ligne `domicile` = `{ libelle, commune?, lat, lon }` en JSON validé par Zod à la lecture. Migration v1 par `PRAGMA user_version` (`SQLiteProvider`, `onInit`).
  - Choisi dans Réglages : « Modifier » ⇒ champ de recherche ⇒ `GET /v1/lieux` ⇒ liste des candidats ⇒ choix. Le serveur ne garde rien (invariant 6).
  - Écartés : `expo-sqlite/kv-store` (pas de schéma, et la table `reglages` du PLAN servira aussi aux cartes de réduction) ; `expo-secure-store` (fait pour les secrets, pas pour des réglages).
- **D66 — Position : demandée au moment de chercher, au premier plan seulement.**
  - Avec « Depuis ma position », « Chercher » demande la permission (`requestForegroundPermissionsAsync`) puis lit `getLastKnownPositionAsync({ maxAge: 120000, requiredAccuracy: 200 })`, sinon `getCurrentPositionAsync({ accuracy: Accuracy.Balanced })` (environ 100 m), avec un délai de 15 s.
  - Refus ⇒ « Sans accès à votre position, choisissez Domicile. » ; délai dépassé ⇒ « Position introuvable. Réessayez, ou choisissez Domicile. »
  - La position n'est ni gardée, ni journalisée ; elle part seulement dans la requête (`proche`, `depart`).
  - Plugin : arrière-plan désactivé (valeurs par défaut), message de permission en français.
  - L'interrupteur « Depuis ma position » de la maquette Réglages n'est pas construit ici : la permission d'Android en tient lieu.
- **D67 — Couleurs des modes sans jeton propre.** Métro, tram, RER et Transilien prennent `mode-train` ; bus, `mode-car` ; bateau et autre, `mode-taxi`. Chaque mode garde sa propre icône et son nom écrit (« Métro 14 », « Bus 72 »). À revoir avec le design system si Brainditech veut des couleurs distinctes.

## 4. Ce qui est construit

### 4.1 Domaine, en TypeScript pur et testé (`src/domaine/`)

- `environnement.ts` : `lireEnvironnement(env)` valide `EXPO_PUBLIC_API_URL` par Zod (URL `http` ou `https`, sans chemin ni paramètre, sans `/` final). Absente ou mal formée ⇒ erreur qui nomme la variable sans recopier sa valeur.
- `api.ts` : client des deux routes, avec `fetch` injecté (aucun réseau dans les tests). Chaque réponse est validée par un schéma Zod (invariant 9) ; une réponse non conforme est une erreur, jamais affichée à moitié. Résultat typé : `ok`, `cle_refusee` (401), `trop_de_demandes` (429, minutes jusqu'à `Retry-After`), `injoignable` (réseau ou délai de 20 s dépassé), `erreur_serveur` (5xx, 400, réponse non conforme).
- `cle.ts` : format de la clé (43 caractères base64url, espaces aux bords retirés).
- `resultat.ts` : ce que l'écran Résultat affiche, tiré seulement de la réponse : phrase du verdict, résumé d'une possibilité (« Marche 4 min · Métro 14 · Marche 3 min »), avertissement « Marche de plus de 15 min » (D3 : une marche de l'étape > 15 min), date des horaires (la plus ancienne `source.version` des étapes en transport), jour en toutes lettres (« Jeudi 12/11 », R11).
- `demande.ts` : passage du formulaire (`arriver_avant`, `partir_a`) au corps de `/v1/itineraires` (`arriver`, `partir`) ; aucune autre modification.

### 4.2 Écrans et parcours (`src/app/`)

1. **Clé d'appareil** (`src/app/cle.tsx`, hors des onglets) : titre « Clé d'appareil », texte « Saisissez la clé donnée pour ce téléphone. Elle est gardée chiffrée sur le téléphone. », champ masqué (avec « Afficher »), bouton « Enregistrer », messages de D64. Mêmes composants que l'Accueil, sur le fond de carte.
2. **Accueil** : « Chercher » ouvre le formulaire avec `raison=indisponible` (D15 : `/v1/comprendre` n'existe pas encore) et le départ choisi. La phrase tapée n'est pas transmise.
3. **Formulaire** : en plus de la maquette, sous les champs, les deux puces de l'Accueil (« Depuis : Domicile », « Depuis ma position »), reprises de l'Accueil. Écart à la maquette, voulu : sans elles, le formulaire ne dit pas d'où l'on part. « Chercher » : validation actuelle, puis départ (domicile lu dans SQLite, ou position par D66 ; domicile absent ⇒ « Indiquez votre domicile dans Réglages. » avec un lien), puis `GET /v1/lieux?q=<lieu>&proche=<départ>`.
4. **Confirmation du lieu** (`(chercher)/confirmation.tsx`), comme la maquette 03 :
   - sous-titre « Jeudi 12/11 · arriver avant 10:00 · marge 10 min · depuis Domicile » ;
   - jusqu'à 5 candidats : nom en gras, puis adresse ou « commune, code postal », et la distance si le serveur la donne ; le premier est choisi d'office ;
   - **un seul candidat** ⇒ l'écran est passé, la recherche part (case de la phase 2) ; **aucun** ⇒ « Aucun lieu trouvé pour « … ». Essayez avec la commune. » et retour au formulaire ;
   - « Saisir l'adresse moi-même » revient au formulaire, champ Lieu actif ; « C'est ce lieu » lance `POST /v1/itineraires`.
5. **Résultat** (`(chercher)/resultat.tsx`), comme la maquette 04, sans ce qui est hors de la spec :
   - carte du verdict : jour, « Possible » ou « Impossible » (couleurs d'état du design system) ; si possible, « Départ HH:MM » de la première possibilité, puis « À faire : être sur place avant 09:50 (rendez-vous 10:00, marge 10 min). » en « arriver avant », ou « Arrivée HH:MM. » en « partir à » ; si impossible : « Aucun trajet ce jour-là à ces heures. » et rien d'autre (invariant 13) ;
   - une carte par possibilité, dans l'ordre du serveur : « 06:27 → 09:09 », frise des étapes (blocs colorés par D67, marche en pointillé), résumé, avertissement de marche, « Prix non publié » (invariant 5) ;
   - toucher une carte la déplie : chaque étape avec son heure, son arrêt de départ et d'arrivée, sa ligne, sa direction et « Horaire prévu, sans suivi en direct » (invariant 12). C'est ce qui permet la comparaison avec Google, en attendant le Détail (phase 4) ;
   - en bas : « Horaires du 18/10 » ;
   - pas de puces de tri, pas de carte taxi, pas de bouton « Voir le trajet ».
6. **Réglages** (`(onglets)/reglages.tsx`), une partie de la maquette 07 : section « Domicile » (libellé, « Modifier », écran de choix par D65) et section « Clé d'appareil » (« Clé enregistrée », « Remplacer la clé »), puis la phrase sur la vie privée de la maquette. Pas de cartes de réduction ni d'interrupteur de position.

Erreurs, sur chaque écran qui appelle l'API, dans une carte d'information avec « Réessayer » : injoignable ⇒ « Le serveur ne répond pas. » ; 429 ⇒ « Trop de recherches. Réessayez dans N min. » ; erreur serveur ⇒ « La recherche a échoué. » ; 401 ⇒ retour à l'écran de la clé (D64).

### 4.3 Configuration

- `npx expo install expo-secure-store expo-location expo-sqlite` (versions du SDK 58 constatées à l'installation et notées dans PLAN §2).
- `app.json` : plugins `expo-secure-store`, `expo-location` (message de permission en français, arrière-plan désactivé), `expo-sqlite`. **Un nouveau development build est nécessaire** (`npx expo run:android`, lancé par Brainditech).
- `.env.example` : la ligne `EXPO_PUBLIC_API_URL` précise « `http://localhost:3000` sur le PC, avec `adb reverse tcp:3000 tcp:3000` (D63) ».
- Démarrage de l'app : `lireEnvironnement` est appelé dans `src/app/_layout.tsx` ; s'il échoue, un écran « Configuration incomplète : EXPO_PUBLIC_API_URL » remplace l'app.

## 5. Fichiers touchés

- Nouveaux : `src/domaine/environnement.ts`, `api.ts`, `cle.ts`, `resultat.ts` et leurs `*.test.ts` ; `src/stockage/cle.ts` (secure-store), `src/stockage/reglages.ts` (SQLite, migration) ; `src/app/cle.tsx`, `src/app/(onglets)/(chercher)/confirmation.tsx`, `resultat.tsx`, `src/app/(onglets)/domicile.tsx` (ou dans la pile de Réglages) ; composants `Frise`, `CartePossibilite`, `CarteErreur` dans `src/composants/`.
- Modifiés : `src/app/_layout.tsx`, `(chercher)/index.tsx`, `formulaire.tsx`, `(onglets)/reglages.tsx`, `src/domaine/demande.ts`, `app.json`, `package.json`, `package-lock.json`, `.env.example`, `PLAN.md`, `docs/ETAT.md`, `docs/decisions/0001-cadrage-v1.md` (D63 à D67).
- Aucun fichier de `serveur/`, ni du compose, ni d'`android/`.

## 6. Source de chaque valeur affichée

| Valeur | Source |
|---|---|
| Candidats du lieu, distance | `GET /v1/lieux` (IGN et MOTIS, spec 09) |
| Verdict, limite, heures, lignes, arrêts, directions, durées | `POST /v1/itineraires` ; l'app ne calcule aucune heure |
| « Marche de plus de 15 min » | `duree_minutes` d'une étape `marche` > 15 (D3) |
| « Horaires du … » | `source.version` des étapes en transport |
| « Prix non publié » | absence de fiche tarifaire (invariant 5, phase 3 suivante) |
| « Horaire prévu, sans suivi en direct » | `etat: "prevu"` de chaque étape (invariant 12) |
| Domicile | SQLite du téléphone, choisi parmi les candidats de `/v1/lieux` |

## 7. Sécurité

- La clé ne quitte le Keystore que pour l'en-tête `Authorization: Bearer` ; elle n'est ni affichée une fois gardée, ni journalisée, ni dans le bundle (invariants 1, 8).
- Ni le lieu, ni le domicile, ni la position ne sont écrits dans un journal (`console`) ni envoyés ailleurs qu'à l'API (invariants 2, 10).
- Chaque réponse de l'API est validée par Zod avant affichage (invariant 9).
- Position au premier plan seulement ; aucune permission d'arrière-plan dans le manifeste.
- Rien de ce qui est affiché ne vient d'ailleurs que de l'API ou du téléphone : aucune couleur ni logo de tiers (invariant 20).

## 8. Critères d'acceptation

1. Tests vitest : `EXPO_PUBLIC_API_URL` absente, vide, sans protocole, avec un chemin ⇒ erreur qui la nomme sans recopier sa valeur.
2. Tests vitest du client : 200 conforme ⇒ `ok` ; réponse non conforme ⇒ `erreur_serveur` ; 401 ⇒ `cle_refusee` ; 429 avec `Retry-After: 90` ⇒ 2 min ; réseau coupé ⇒ `injoignable` ; l'en-tête `Authorization` est envoyé.
3. Tests vitest de `resultat.ts` : phrase du verdict en « arriver » et en « partir » ; « impossible » sans aucune heure ; avertissement de marche à 16 min et pas à 15 ; date des horaires ; résumé des étapes.
4. Sur le téléphone, premier lancement : une clé fausse ⇒ « refusée » ; la bonne ⇒ l'Accueil s'ouvre ; relancer l'app ⇒ plus d'écran de clé.
5. Domicile choisi dans Réglages, puis l'app relancée ⇒ toujours là.
6. Formulaire, « Depuis : Domicile », « France Travail Joigny », jeudi 12/11, arriver avant 10:00, marge 10 ⇒ Confirmation ⇒ Résultat « Possible », avec un trajet comparable à celui du test Joigny (car de 06:27 depuis Brienon si le domicile est Brienon).
7. « Depuis ma position » : la permission est demandée ; refusée ⇒ le message de D66.
8. Châtelet → Orly (domicile ou position à Châtelet), vendredi 13/11, partir à 07:00 ⇒ métro 14 direct, 07:01 → 07:36 environ (issue 0008).
9. API arrêtée ⇒ « Le serveur ne répond pas. » avec « Réessayer », sans plantage.
10. `npx expo lint`, `npx tsc --noEmit`, `npm test` verts ; CI verte.

Les critères 4 à 9 sont constatés par Brainditech sur son téléphone (captures hors dépôt, D38) ; Claude ne lance pas l'app.

## 9. Ce qui n'est pas fait ici

- `/v1/comprendre` (phrase comprise par Claude) : la phrase de l'Accueil reste sans effet.
- Tris, prix, taxi (D48), retour (D47), Détail et carte du trajet (phase 4), enregistrement dans « Mes trajets » (phase 5), cartes de réduction, Sentry (spec 07).
- Le build `release` : il attend l'API en HTTPS (D63).

## 10. Étapes de vérification

1. **Brainditech** relit et approuve cette spec (ou demande des changements).
2. **Claude** applique la spec sur `app/branchee`, lance lint, types et tests, puis ouvre la PR.
3. **Brainditech** : ajoute `EXPO_PUBLIC_API_URL=http://localhost:3000` à son `.env`, branche le téléphone, lance `adb reverse tcp:3000 tcp:3000`, puis `npx expo run:android` (nouveau development build, trois modules natifs ajoutés).
4. **Brainditech** saisit la clé gardée à la spec 09, choisit son domicile, puis rejoue les critères 4 à 9 et compare avec Google Maps.
