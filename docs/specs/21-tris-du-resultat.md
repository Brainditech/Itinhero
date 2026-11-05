# Spec 21 — Tris du Résultat : arrivée la plus tôt, moins de marche, sans réservation

- **Date** : 2026-11-05
- **État** : **proposée**, à approuver par Brainditech. Règle : D97 (proposée).
- **Branche** : `phase-3/tris` (spec, puis code sur la même branche après approbation).
- **Case de PLAN.md** : phase 3, « Tris : arrivée la plus tôt, moins de marche, sans réservation (D97, spec 21) » ; « Moins cher » passe dans la case de `data/tarifs.json` (§3).
- **Invariants** : 3 par extension (l'app ne calcule aucune heure : elle range les possibilités du serveur avec leurs valeurs), 4 (aucune étape ne perd sa source), 5 (aucun prix), 13 (le verdict ne change pas de jour), 20 (jetons du design system seulement).

## 1. But

La maquette 04 montre une rangée de puces sous le verdict : « Arrivée la plus tôt » (choisie), « Moins cher », « Moins de marche », « Sans réservation ». Aujourd'hui le Résultat montre les possibilités dans l'ordre du serveur (départ le plus tôt, puis arrivée), sans moyen de les ranger autrement.

Un débutant veut pouvoir dire simplement : « je veux arriver le plus tôt », « je ne veux pas trop marcher », « je ne veux rien avoir à réserver ». D3 et D42 comptent déjà sur le tri « moins de marche » pour faire remonter les trajets sans longue marche (la voie de Saint-Florentin, 48 min à pied, reste proposée sans être recommandée).

## 2. Doc lue

Aucun service nouveau n'est branché : le tri se fait sur la réponse déjà reçue de `POST /v1/itineraires`. Au moment du code, la doc React Native 0.88 de `ScrollView` (`horizontal`) et des rôles d'accessibilité (`radiogroup`, `radio`, `accessibilityState.checked`) sera lue et notée au §6.

## 3. Décision D97 (proposée)

1. **Trois puces, pas quatre.** « Arrivée la plus tôt », « Moins de marche », « Sans réservation ». **« Moins cher » n'est pas montrée** tant qu'aucune fiche tarifaire n'existe : chaque trajet afficherait « Prix non publié » (invariant 5, R5) et la puce ne changerait rien. Elle arrive avec `data/tarifs.json` ; la case de PLAN.md est coupée en deux en conséquence.
2. **Le tri se fait sur le téléphone**, sans nouvelle recherche : il range les possibilités reçues, avec leurs heures et leurs durées, sans rien calculer de neuf. Il marche donc aussi sans réseau, et plus tard sur un trajet enregistré (phase 5).
3. **Les règles** (à égalité, la règle suivante ; puis l'ordre du serveur) :
   - **Arrivée la plus tôt** (choisie à l'ouverture) : arrivée la plus tôt (`arrivee_utc`) ; puis départ le plus tard (moins de temps en route) ; puis moins de correspondances.
   - **Moins de marche** : le moins de minutes à pied au total (somme des étapes `marche`) ; puis arrivée la plus tôt.
   - **Sans réservation** : **seulement** les trajets sans aucune étape à réserver, rangés comme « Arrivée la plus tôt ». Une étape est à réserver quand la carte le dit déjà : passage sur réservation du GTFS (`reservation: "appel"`, D69) ou taxi (D48). S'il n'en reste aucun : « Aucun trajet sans réservation ce jour-là. » sous les puces, et rien d'autre ; les autres puces restent là pour revenir.
4. **Le verdict ne bouge pas** quand on change de puce. Il dit toujours si le trajet est possible et l'heure de départ choisie par D79 et D80. Un verdict qui changerait d'heure en touchant une puce troublerait un débutant.
5. **Une rangée par sens** : avec un retour planifié (spec 19), l'aller et le retour ont chacun leur rangée, sous leur verdict, et chacun son choix. À chaque nouvelle réponse, les deux reviennent à « Arrivée la plus tôt ». Le choix n'est pas gardé.
6. **Rangée montrée seulement à partir de 2 possibilités** : avec une seule, il n'y a rien à ranger.

**Écarté** :
- Montrer « Moins cher » grisée ou sans effet : un débutant la touche et rien ne se passe.
- Trier sur le serveur (`tri` dans la requête) : une nouvelle recherche à chaque puce, lente, impossible sans réseau, pour ranger 10 trajets déjà reçus.
- « Sans réservation » qui remonte les trajets sans réservation au lieu de cacher les autres : le libellé promet « sans », un trajet à réserver ne doit plus apparaître.
- Verdict qui suit la première carte du tri : il changerait d'heure selon la puce, alors que la question « est-ce possible ? » ne dépend pas du rangement.
- Une seule rangée pour l'aller et le retour : la rangée du retour serait loin de ses cartes.

## 4. Ce qui est construit

### App seulement (rien ne change sur le serveur)

- `src/domaine/tri.ts` (TypeScript pur, testé) :
  - `type Tri = "arrivee" | "marche" | "sans_reservation"` et les libellés des puces ;
  - `minutesDeMarche(p)` : somme des `duree_minutes` des étapes `marche` ;
  - `etapeAReserver(p)` : la première étape à réserver (`reservation === "appel"` ou taxi), ou `undefined` ;
  - `trier(possibilites, tri)` ⇒ `{ possibilite, index }[]`, où `index` est le **rang dans la réponse du serveur**. Les écrans « Étape » et « Guidage » retrouvent la possibilité par ce rang (`possibiliteDe`) : une carte rangée à la 1re place mais 4e dans la réponse ouvre bien la 4e.
- `CartePossibilite` (`src/composants/Trajet.tsx`) : la ligne « réservation obligatoire » utilise `etapeAReserver`, la même règle que le filtre ; elle ne change pas à l'écran.
- `resultat.tsx`, composant `Sens` : sous le verdict, la rangée de puces (composant `Puces`, défilement horizontal, la dernière coupée par le bord comme sur la maquette), puis les cartes dans l'ordre de `trier`. État local, remis à « arrivee » à chaque nouvelle réponse.
- Puces selon le design system (« Puce » : pilule, texte `badge` 14 sp 500, marge interne 16 dp ; choisie : pleine `primaire`, texte blanc ; autre : blanche, contour `bordure-carte`), hauteur touchable d'au moins 48 dp.
- TalkBack : la rangée est un groupe « Classer les trajets », chaque puce un bouton radio coché ou non ; changer de puce fait lire « Trajets classés : moins de marche ».

## 5. Critères d'acceptation

1. **Tests du domaine** (`src/domaine/tri.test.ts`), rouges avant le code :
   - « Arrivée la plus tôt » : 08:24 → 10:43 et 08:40 → 10:30 ⇒ 08:40 d'abord ; deux arrivées à 10:30 ⇒ le départ le plus tard d'abord ; tout égal ⇒ l'ordre du serveur ;
   - « Moins de marche » : 48 min de marche (Saint-Florentin) contre 9 min ⇒ 9 min d'abord ; même marche ⇒ arrivée la plus tôt ; un trajet en taxi sans marche passe devant ;
   - « Sans réservation » : un passage « appel » ou un taxi ⇒ trajet retiré ; tous à réserver ⇒ liste vide ;
   - chaque élément garde son `index` dans la réponse ; `trier` ne modifie pas la liste reçue.
2. **Test de la carte** : `etapeAReserver` donne la même étape que l'ancienne règle de la carte sur `src/domaine/__exemples__/possibilite-brienon-dijon.json` (aucune étape à réserver), et sur cette possibilité avec un passage « appel » puis avec un taxi.
3. **Téléphone** (adb, MOTIS national) :
   - Brienon → France Travail Joigny, jeudi 12/11, arriver avant 10:00 : trois puces, « Arrivée la plus tôt » choisie ; « Moins de marche » met la voie de Saint-Florentin (longue marche) après les autres ;
   - après un tri, déplier la 1re carte, toucher une étape puis « Démarrer le guidage » ouvre bien ce trajet-là (mêmes heures) ;
   - « Sans réservation » sur un trajet avec un taxi (Gifi Joigny → Domicile, 17:00, spec 16) : le taxi disparaît ; s'il ne reste rien, la phrase s'affiche ;
   - avec un retour (fin 16:00) : deux rangées, chacune range ses cartes ;
   - TalkBack lit le groupe et l'état coché.
   Captures dans `docs/screenshots/spec-21/` (D93), comparées à la maquette 04 (écart voulu : pas de « Moins cher »).
4. `npx expo lint`, `npx tsc --noEmit`, `npm test` **verts**.

## 6. Constats

(À remplir au code et à l'essai.)

## 7. Ce qui n'est pas fait ici

- **« Moins cher »** : avec `data/tarifs.json` et les cartes de réduction (phase 3, puis phase 6).
- **Regrouper les départs successifs d'un même trajet** (Châtelet → Pont de Rungis : 8 possibilités sur 10 sont le même trajet aux métros suivants, spec 10 §11.3). C'est une autre question que le rangement ; elle aura sa propre spec si Brainditech la veut.
- Un transport à la demande que le GTFS ne marque pas « sur réservation » (pas de `pickup_type` 2 ou 3) n'est pas compté comme à réserver : la règle reste celle de D69, sans deviner.
- Le tri demandé par l'Assistant (« moins de marche », phase 6 bis) réutilisera `trier`.
