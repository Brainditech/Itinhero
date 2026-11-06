# Spec 22 — Mes trajets : un voyage enregistré, rouvert sans réseau

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (« implemente les prochaines phases », 2026-11-06), comme la spec 19. Règle : D98. **Appliquée** sur `phase-5/mes-trajets` ; critère 2 constaté par adb (§6.2) sans serveur ; mode avion à faire.
- **Branche** : `phase-5/mes-trajets`.
- **Case de PLAN.md** : phase 5, « Instantané expo-sqlite, ouvert en mode avion ». La capture côte à côte avec la maquette 06 sert aussi à la case « Écran en valeurs en dur, comparé à sa maquette » (l'écran est branché d'emblée, comme depuis D54).
- **Invariants** : 3 par extension (l'app ne recalcule aucune heure : elle relit la réponse du serveur telle quelle), 4 (chaque étape garde sa source), 6 (le voyage, ses lieux et le domicile restent sur le téléphone), 9 (ce qui est relu de la base passe par un schéma Zod), 12 (aucun « en direct » : l'horaire enregistré est dit prévu), 20 (jetons du design system seulement).

## 1. But

D45 promet un voyage « consultable hors réseau ». Aujourd'hui, la réponse de `POST /v1/itineraires` ne vit qu'en mémoire : sans réseau, ou après avoir fermé l'app, il ne reste rien. L'onglet « Mes trajets » est un écran d'attente.

Un débutant qui a préparé son voyage la veille doit pouvoir, le lendemain dans le car ou sur un quai sans réseau, rouvrir son trajet, ses étapes et le guidage.

## 2. Doc lue

- expo-sqlite 58.0.15 installé (`node_modules/expo-sqlite/build/SQLiteDatabase.d.ts`) : `runAsync`, `getAllAsync`, `getFirstAsync` avec paramètres liés ; migration par `PRAGMA user_version` dans `onInit` du `SQLiteProvider` (déjà en place, `src/stockage/reglages.ts`).
- React Native 0.88 : `Alert.alert(titre, message, boutons)` pour la confirmation de suppression (déjà utilisé par Réglages).
- Aucun service nouveau n'est branché.

## 3. Décision D98

1. **On enregistre tout le voyage, pas une seule possibilité** : la demande, les deux lieux (nom, adresse, point) et la réponse entière du serveur (aller et retour, toutes les possibilités, leurs étapes, consignes, tracés et sources), avec l'heure d'enregistrement. Si on rate le car de 06:27, le suivant est encore là sans réseau ; l'Étape, le Guidage et les tris (D97) marchent sans rien changer.
2. **Un bouton « Enregistrer ce voyage »** en bas du Résultat, au-dessus de « Modifier la recherche », seulement quand l'aller a au moins une possibilité. Une fois enregistré : « Enregistré dans Mes trajets » avec une coche, et le lien « Voir Mes trajets ».
3. **Pas de doublon** : même date, même heure, même sens, même marge, même fin de rendez-vous et mêmes points (au mètre près) ⇒ même voyage ; l'enregistrer de nouveau remplace l'ancien par la nouvelle réponse.
4. **Écran « Mes trajets »** (maquette 06) : une carte par voyage : le jour (« Jeudi 12/11 »), « Départ 06:27 » (l'heure du verdict, D79 et D80), « Brienon-sur-Armançon → France Travail Joigny », la pastille « Horaire prévu, sans suivi en direct », « Disponible sans réseau » coché, le retour s'il existe (« Retour : départ 16:23 »), « Enregistré le 06/11 à 14:32 », puis « Supprimer ».
   - Le prochain voyage a le bouton principal « Ouvrir le trajet » sous sa carte (maquette) ; les autres, un bouton secondaire « Ouvrir le trajet » dans leur carte (un seul bouton principal par écran).
   - Ordre : les voyages à venir (jour du voyage aujourd'hui ou après, à Paris), du plus proche au plus lointain ; puis « Passés », du plus récent au plus ancien. Un voyage passé n'est pas effacé tout seul.
   - Aucun voyage : « Aucun trajet enregistré. Cherchez un trajet, puis touchez « Enregistrer ce voyage ». »
5. **« Ouvrir le trajet »** remet le voyage dans la recherche en cours et ouvre le Résultat dans l'onglet Chercher, sans réseau. En haut du Résultat, un bandeau : « Voyage enregistré le 06/11 à 14:32. Horaires prévus, sans suivi en direct. » Pas de bouton « Enregistrer » ni de « Modifier la recherche » sur un voyage rouvert : une nouvelle recherche part de l'onglet Chercher.
6. **Supprimer** demande une confirmation (« Supprimer ce trajet ? », « Supprimer » / « Annuler »).
7. **Une ligne illisible** (base abîmée, ou forme changée par une version future) n'est jamais montrée à moitié : « Ce trajet enregistré ne peut plus être lu. » et « Supprimer ».
8. **Ce qui demande encore le réseau sur un voyage rouvert**, avec les messages d'erreur existants : « Voir tous les arrêts » (`GET /v1/course`), « Recalculer depuis ici » et le nouveau chemin à pied (`POST /v1/marche`), et les tuiles de la carte qui ne sont pas déjà dans le cache (le pack de carte est une autre case de la phase 5).

**Écarté** :
- N'enregistrer que la possibilité du verdict : rater un car sans réseau ne laisserait aucune autre solution.
- Un bouton « Enregistrer » sur chaque carte de possibilité : un débutant devrait choisir parmi dix trajets ; le verdict a déjà choisi, et toutes les possibilités restent dans le voyage.
- Le bandeau « Hors connexion · dernier état connu affiché » de la maquette : rien n'est encore rafraîchi (temps réel en phase 7) ; il dirait un état qui n'existe pas. L'heure d'enregistrement dit la vérité.
- « Carte enregistrée » et « Rappels » de la maquette : ils arrivent avec leurs cases (pack de carte, rappels locaux), pas avant.
- Effacer seul un voyage passé : un débutant peut vouloir revoir son trajet le soir même.
- Un dossier de fichiers JSON au lieu d'expo-sqlite : la base existe déjà, l'architecture la nomme pour les trajets enregistrés.

## 4. Ce qui est construit

### App seulement (rien ne change sur le serveur)

- `src/domaine/voyages.ts` (TypeScript pur, testé) :
  - `schemaVoyage` : `{ enregistre_le, demande, depart, arrivee, reponse }`, avec les schémas existants (`schemaDemande`, `schemaReponseItineraires`) ;
  - `peutEnregistrer(reponse)` : l'aller a au moins une possibilité ;
  - `cleVoyage(demande, depart, arrivee)` : la clé du §3.3 ;
  - `voyageDepuisRecherche(recherche, maintenant)` ⇒ voyage, ou `null` si rien à enregistrer ;
  - `lireVoyage(texte)` ⇒ voyage, ou `null` si illisible (jamais à moitié) ;
  - `resumeVoyage(voyage)` ⇒ les lignes de la carte (jour, départ, titre, retour, enregistré le) ;
  - `rangerVoyages(voyages, aujourdhui)` ⇒ `{ aVenir, passes }`.
- `src/stockage/voyages.ts` : table `voyages (cle TEXT PRIMARY KEY, enregistre_le TEXT, contenu TEXT)`, migration de la base en version 2 ; `enregistrerVoyage`, `lireVoyages`, `supprimerVoyage`.
- `src/recherche.tsx` : la recherche en cours peut porter `enregistre_le` (voyage rouvert) ; `ouvrirVoyage`.
- `resultat.tsx` : bouton « Enregistrer ce voyage », état « Enregistré dans Mes trajets », bandeau du voyage rouvert.
- `mes-trajets.tsx` : l'écran du §3.4, relu à chaque retour sur l'onglet.

## 5. Critères d'acceptation

1. **Tests du domaine** (`src/domaine/voyages.test.ts`), rouges avant le code :
   - enregistrer puis relire rend le même voyage ; texte vide, illisible, ou d'une autre forme ⇒ `null` ;
   - même recherche deux fois ⇒ même clé ; autre date, autre heure, autre fin de rendez-vous ou autre point ⇒ autre clé ;
   - aller « impossible » sans possibilité ⇒ rien à enregistrer ;
   - résumé : « Jeudi 12/11 », « Départ » à l'heure du verdict, « A → B », le retour s'il existe (« Retour : départ HH:MM » ou « Retour : aucun ce jour-là »), « Enregistré le JJ/MM à HH:MM » à l'heure de Paris ;
   - rangement : aujourd'hui compte « à venir » ; à venir du plus proche au plus lointain, passés du plus récent au plus ancien.
2. **Téléphone** (adb, MOTIS national) :
   - Brienon → France Travail Joigny, jeudi 12/11, arriver avant 10:00, fin 16:00 : « Enregistrer ce voyage » ⇒ « Enregistré dans Mes trajets » ; la carte apparaît dans Mes trajets ;
   - mode avion (avec l'accord de Brainditech), app fermée puis rouverte : la carte est là ; « Ouvrir le trajet » ⇒ Résultat avec le bandeau, aller et retour ; une Étape ; « Démarrer le guidage » s'ouvre ;
   - enregistrer deux fois la même recherche ⇒ une seule carte ;
   - « Supprimer » ⇒ confirmation, puis la carte disparaît.
   Captures dans `docs/screenshots/spec-22/` (D93), comparées à la maquette 06 (écarts voulus : §3, écarté).
3. `npx expo lint`, `npx tsc --noEmit`, `npm test` **verts**.

## 6. Constats

### 6.1 Code (2026-11-06)

- `src/domaine/voyages.test.ts` rouge avant `voyages.ts` (module absent), puis 12 tests verts (dont l'heure d'enregistrement en heure d'été et d'hiver). App : 292 tests, `npx expo lint` et `npx tsc --noEmit` verts ; `npx expo export --platform android` réussi.
- Base du téléphone migrée en version 2 (`src/stockage/reglages.ts`) : la table `reglages` est gardée telle quelle, `voyages` s'ajoute.
- « Ouvrir le trajet » passe par `router.navigate("/resultat")` : l'onglet Chercher s'ouvre sur le Résultat du voyage.
- Le crayon « Modifier la recherche » de « Votre trajet » est retiré aussi sur un voyage rouvert (même raison que le lien du bas, §3.5).
- **Corrigé à l'essai** : `FournisseurRecherche` n'enveloppait que la pile de l'onglet Chercher ; Mes trajets plantait (« useRecherche hors de FournisseurRecherche »). Il est remonté au niveau des onglets (`src/app/(onglets)/_layout.tsx`).

### 6.2 Téléphone (2026-11-06, adb, MOTIS national)

Captures `docs/screenshots/spec-22/01` à `11` (non versionnées, D93 : elles montrent l'adresse du domicile).

| Point du critère 2 | Constaté |
|---|---|
| Mes trajets vide | « Aucun trajet enregistré. Cherchez un trajet, puis touchez « Enregistrer ce voyage ». » ; la base migrée en version 2 se lit (01) |
| Domicile → Agence France travail (Joigny), jeudi 12/11, arriver avant 10:00, fin 16:00 | « Possible · Départ 06:18 » ; « Enregistrer ce voyage » en bas ⇒ « Enregistré dans Mes trajets » et « Voir Mes trajets » (02, 03) |
| Carte de Mes trajets | « Jeudi 12/11 », « Départ 06:18 », « Domicile → Agence France travail », « Horaire prévu, sans suivi en direct », « Disponible sans réseau », « Retour : départ 16:28 », « Enregistré le 06/11 à 02:37 », « Supprimer », puis « Ouvrir le trajet » en bouton principal : comme la maquette 06, sans les écarts voulus du §3 (04) |
| Même recherche relancée puis enregistrée | Le bouton revient pour la nouvelle réponse ; une seule carte, « Enregistré le 06/11 à 02:38 » (remplacée) (05) |
| Sans serveur (`adb reverse` du port 3000 retiré) et app rechargée (mémoire vidée) | La carte est là ; « Ouvrir le trajet » ⇒ Résultat avec le bandeau « Voyage enregistré le 06/11 à 02:38. Horaires prévus, sans suivi en direct. », sans crayon, aller, puces et retour (06) ; Étape « Bus K941 n° 43281 » (07) ; « Voir tous les arrêts » ⇒ « Arrêts indisponibles. Le serveur ne répond pas. » (08) ; « Me guider » ⇒ guidage « Attendez le bus K941 direction Gare de Troyes, passage prévu à 06:27 » (09) |
| « Supprimer » | « Supprimer ce trajet ? », « Jeudi 12/11 · Domicile → Agence France travail », « Annuler » / « Supprimer » ; puis la liste vide (10, 11) |

- **Reste à faire** : le vrai **mode avion**, app fermée puis rouverte. Couper l'API par adb prouve que rien ne vient du serveur, mais le mode avion est un réglage du téléphone, pas touché sans l'accord de Brainditech. **Case non cochée** jusque-là.

## 7. Ce qui n'est pas fait ici

- **Pack de carte** de la zone du trajet (case suivante de la phase 5).
- **Rappels locaux** (veille, échéance de réservation, « partez dans N min ») et les appels à passer (taxi, transport à la demande) : case « Plan de voyage complet », avec `expo-notifications`.
- **Rafraîchir** un voyage enregistré (`/v1/etat-courses`, phase 7) et le bandeau « Hors connexion ».
