# SPEC — MobiliteIA · le contrat de « fini »

> **Statut : v1 spécifiée le 2026-10-19 (kodivine-spec).** Aucune feature verte.
> Un lot est fini quand TOUTES ses features sont `passes: true`, chacune avec sa trace d'exécution
> dans `docs/preuves/F<id>-<date>.md`. « Ça a l'air de marcher » ne compte pas.
> Entrées (seules sources de ce document) : `CONSTITUTION.md` · `docs/decisions/0001-cadrage-interview.md`
> (Q1 à Q12, adoptées le 2026-10-19) · `docs/03-marche/` (gate `sources` vert, correction C2 du 2026-10-19)
> · `docs/04-dissection/` (gate `captures` vert, écrans 04/E1 à 04/E13).
> Convention de nommage : `E<n>` = une exigence de ce SPEC ; `04/E<n>` = un écran de la dissection.

## Épreuve de l'amont

> *Si ces entrées étaient subtilement fausses, où serait le mensonge ?*

**1. « 2,8 km à pied » est une distance à vol d'oiseau.** Saint-Florentin-Ville → gare
Saint-Florentin-Vergigny est calculé par haversine sur `stops.txt` (03-marche/02 §B6) ; le chemin
piéton réel est plus long et n'a jamais été calculé. La fenêtre est large (descente 06:37, train
08:50 : 2 h 13), donc la voie survit à un chemin de 4 ou 5 km — mais **aucune exigence de ce SPEC
n'affiche « 2,8 km »** : la distance et la durée affichées sont celles du réseau piéton du moteur
(E21), et le plafond de marche (60 min) est éprouvé à son extrémité.

**2. La marche gare de Joigny → agence (19 route de Chamvres) est déclarée ⬜ par le chercheur
(§B6), mais un écran la donne.** Transit calcule « marche 1,09 km » de 9:18 à 9:32, soit 14 min
(`04-dissection/07-constats-scenarios.md` (a), capture `transit-web-brienon-joigny-detail-2026-10-19.png`).
La marge après 09:09 (51 min) tient donc d'après un calculateur tiers ; E1 exige que **notre** moteur
la recalcule et que l'arrivée à l'agence soit ≤ 10:00.

**3. Seule la montée à Brienon a été vérifiée sur la course de 06:27.** Le chercheur a contrôlé
`pickup_type=0` à Brienon Mairie (§B1) ; le `drop_off_type` à Saint-Florentin-Ville ne figure nulle part
dans l'amont. Si la descente y était interdite, la voie de référence disparaîtrait. C'est l'oracle GTFS
(F3) qui le constatera, et c'est pourquoi E1 se joue contre lui et non contre le récit.

**4. Le même car « 06:27 » porte trois horaires selon la période** (06:27, 06:28 ou 06:38, §B1), et l'URL
du GTFS SNCF est un lien « dernière version » : retélécharger demain peut rendre un autre fichier. Toute
exigence de scénario se joue donc sur un **jeu de données figé** (feed_version + sha256 consignés, F1).
Un écart entre ce jeu et les horaires de l'ADR 0001 n'est pas corrigé en silence : il remonte au
chercheur (règle C2).

**5. La synthèse de la dissection n'a pas été mise à jour après la correction C2.** Son verdict dit
encore que le trajet de référence « n'a pas de solution en transport public seul » et son exemple
d'écran 04/E3 écrit « impossible » (`04-dissection/00-synthese.md`, § Le verdict et tableau des
écrans) ; le volet B corrigé dit **possible**, avec 06:27 et une longue marche (§B6, correction du
2026-10-19). Ce SPEC suit la donnée corrigée : verdict « Transport public seul : possible » en titre
(E2). Le modèle d'interface, lui, ne s'écroule pas : l'alternative routière reste exigée (E27), et le
segment de marche longue est exactement le genre de piège que la frise doit rendre visible.

**6. Si la dissection avait retenu le mauvais modèle mental** (la frise verticale de segments de
Transit ouverte par le champ unique de SNCF Connect), s'écrouleraient E32 (frise), E34 (guidage par
consignes) et la mise en page de E12 et E10 (échéance et état posés **sur** le segment). Ne
s'écrouleraient pas : E1 à E9, E15 à E20, E25 — le **contrat de données** (chaque segment porte sa
source, son état, son échéance) est indépendant du dessin. Le mur porteur est le segment sourcé, pas
la frise.

**7. Le serveur local et le « sans état » se contredisent avec deux briques recommandées.** Une file
de tâches serveur (Inngest, pg-boss, 03-marche/00 § briques) stockerait des rendez-vous, ce que Q7
interdit ; elle est donc écartée en v1 et les rappels sont locaux au téléphone (E33). Et un serveur
« Docker sur le PC » (Q9) n'est pas joignable sur la route : la v1 planifie au domicile et emporte le
trajet du jour hors ligne (Q5) — voir Questions ouvertes.

**8. Le risque moteur n'est pas seulement la RAM.** MOTIS doit accepter un tronçon à pied **entre
deux arrêts** de 2,8 km ou plus ; la limite de marche de correspondance de MOTIS n'est constatée nulle
part dans `03-marche/04 §D3`. C'est pourquoi le lot moteur (F2-F6) passe avant tout le reste.

## 1. Pourquoi (PRD)

Depuis une commune rurale de l'Yonne sans voiture, les calculateurs grand public ne trouvent pas les
trajets qui existent (car TER 06:27 vers Troyes ou Saint-Florentin) et ne disent jamais « impossible »
(04-dissection/07). L'utilisateur v1 est le porteur du projet et sa famille, domicile à
Brienon-sur-Armançon (Q1). La valeur : une phrase (« jeudi 10h RDV à Joigny ») donne un
verdict clair, la voie publique réelle si elle existe, sinon l'option routière avec son échéance —
**sans jamais inventer un horaire**, et lisible sans réseau le jour J.

## 2. Contrainte principale

**Zéro trajet inventé : chaque segment proposé provient d'une donnée datée et traçable (GTFS/GTFS-RT,
fiche d'annuaire sourcée, calcul du moteur) — jamais du modèle de langage.** (CONSTITUTION.md ; ADR 0001.)

**Comment elle est testée en continu** (`npm run check:contrainte`, lancé à chaque commit et en CI) :

1. **À l'exécution** : le serveur passe chaque réponse dans un validateur de provenance avant de
   l'émettre. Tout segment porte `source = {type, jeu, feed_version, trip_id|stop_id|fiche_id, date_service}`.
   Un segment de transport public est accepté seulement si l'**oracle GTFS** (lecteur indépendant de
   `stop_times.txt` + `calendar*.txt`, distinct de MOTIS, F3) retrouve la course, les deux arrêts et les
   deux heures à la minute, service actif à la date. Un segment non résolu ⇒ la réponse n'est pas émise,
   le rejet est journalisé (E5).
2. **Propriété** : 200 requêtes tirées (paires d'arrêts du couloir × dates de la période de validité du
   jeu figé) ⇒ 100 % des segments résolus par l'oracle, 0 segment sans `source` (E5).
3. **Injection** : un modèle de langage simulé renvoie un texte qui invente un horaire (« prenez le car de
   07:15 »), un arrêt, une ligne, un quai, une durée, un prix ; le texte n'est jamais affiché, la réponse
   est remplacée par le rendu déterministe des résultats d'outils (E6, 10/10 cas rejetés).
4. **Scénario de référence** (signal d'arrêt de la constitution) : E1 rouge = régression du planificateur
   = arrêt.

## 3. Exigences

Chaque exigence se vérifie par `npm run check:E<n>` (code de sortie 0 = vert). Les exigences de scénario
se jouent sur le **jeu figé** de F1 : GTFS SNCF `feed_version` 2026-10-18 (couverture 2026-10-18 →
2027-03-31) et GTFS Mobigo 89 mis à jour le 2026-09-21, sha256 consignés dans `fixtures/manifest.json`
(03-marche/02 §B1-B2, téléchargés le 2026-10-19). « Oracle » = lecteur GTFS indépendant de F3.

### 3.1 Scénarios de référence (le planificateur)

| ID | Given | When | Then (seuil) | Vérifié par |
|---|---|---|---|---|
| E1 | jeu figé ; origine arrêt Brienon-sur-Armançon Mairie ; destination lieu de rendez-vous, 19 route de Chamvres, 89300 Joigny ; jeudi 2026-11-12, arriver avant 10:00 | planifier | ≥ 1 option en transport public seul contient : car K941 Brienon Mairie 06:27 → Saint-Florentin-Ville 06:37, marche, train Saint-Florentin-Vergigny 08:50 → Joigny 09:09 ; écart 0 min avec l'oracle sur les 4 heures ; arrivée à l'agence ≤ 10:00 | `npm run check:E1` |
| E2 | même requête que E1 | afficher la réponse | le premier élément (titre) est exactement « Transport public seul : possible », suivi de la condition « X,X km à pied, ~N min » (X et N issus du moteur) ; 0 option affichée avant ce titre | `npm run check:E2` |
| E3 | même requête que E1 | planifier | 0 option utilisant la 803 de 08:25 vers le train de 08:50 (correspondance 0 min, §B6) ; 0 option arrivant après 10:00 présentée sous « avant 10:00 » ; 0 correspondance dont le temps disponible < temps de marche calculé | `npm run check:E3` |
| E4 | jeu figé ; origine Brienon Mairie ; destination gare de Paris Est ; mardi 2026-10-20, départ à partir de 06:00 | planifier | la première option arrive à Paris Est ≤ 09:46, au départ du car de 06:27 via Troyes ; 0 option via Laroche-Migennes (13:25) classée avant elle | `npm run check:E4` |
| E27 | même requête que E1 | planifier | ≥ 1 option routière (taxi de l'annuaire ou lien Uber) avec durée routière calculée par le moteur ; heure de prise en charge = 10:00 − durée − 15 min de marge, exacte à la minute ; si la durée routière n'est pas calculable, la ligne dit « durée routière non calculée » et 0 durée affichée | `npm run check:E27` |

### 3.2 Contrainte principale, provenance et fraîcheur

| ID | Given | When | Then (seuil) | Vérifié par |
|---|---|---|---|---|
| E5 | jeu figé ; 200 requêtes tirées au hasard (graine consignée) dans le couloir et la période de validité | planifier chacune | 100 % des segments de transport public résolus par l'oracle (course, arrêts, heures à la minute, service actif) ; 100 % des segments de marche et de route portent `source.type = moteur` ; 100 % des segments taxi portent un `fiche_id` existant ; 0 segment sans `source` | `npm run check:E5` |
| E6 | 10 réponses de modèle simulé, chacune inventant un élément absent des résultats d'outils (horaire, arrêt, ligne, quai, durée, prix, date, numéro de téléphone, gare, correspondance) | rendre la réponse | 10/10 textes rejetés ; 0 élément inventé affiché ; la réponse affichée est le rendu déterministe ; 1 ligne de rejet journalisée par cas | `npm run check:E6` |
| E25 | jeu figé, puis jeu dont la date de téléchargement est vieille de 8 jours, puis date demandée 2027-04-15 (hors couverture) | planifier | chaque réponse affiche la date des données ; jeu > 7 jours ⇒ bandeau « données du <date> » ; date hors couverture ⇒ refus explicite et 0 trajet calculé | `npm run check:E25` |
| E26 | destination hors couloir (Lyon Part-Dieu) | planifier | refus explicite « hors du périmètre » en ≤ 2 s ; 0 trajet proposé | `npm run check:E26` |

### 3.3 États des horaires, réservation, temps réel

| ID | Given | When | Then (seuil) | Vérifié par |
|---|---|---|---|---|
| E10 | 50 réponses du jeu de référence contenant des segments Mobigo 89 ou K941 sans mise à jour GTFS-RT | afficher | 100 % de ces segments portent le badge « théorique » ; 0 segment Mobigo porte « temps réel » (aucun GTFS-RT Mobigo publié, §B2) | `npm run check:E10` |
| E11 | flux GTFS-RT simulé : retard de +12 min sur le train de 08:50 de E1 | rafraîchir le trajet suivi | heure affichée 09:21 badge « temps réel » en ≤ 60 s après publication du flux ; si la correspondance suivante devient impossible, ⚠ sur le segment et alerte locale ; 0 alerte sans trip update | `npm run check:E11` |
| E12 | segment sur une course `pickup_type=2` ou `route_type 715` (856 du jeudi 2026-11-12, 09:25) | afficher l'option | le segment porte « Réservation obligatoire » ; avec une fiche de réservation sourcée (URL + date) : échéance = départ − délai de la fiche, exacte à la minute, et numéro de la fiche ; sans fiche : « délai de réservation non connu », ⚠ sur l'option, 0 échéance affichée | `npm run check:E12` |

### 3.4 Assistant IA, budget, entrée naturelle

| ID | Given | When | Then (seuil) | Vérifié par |
|---|---|---|---|---|
| E7 | serveur local ; 30 requêtes en langage naturel du jeu de référence `fixtures/phrases.json` | envoyer chacune | temps saisie → réponse complète p95 ≤ 10 s ; 0 requête sans réponse au-delà de 20 s (au-delà : message explicite et formulaire) | `npm run check:E7` |
| E8 | mêmes 30 requêtes sous forme structurée (sans modèle de langage) | planifier | temps moteur p95 ≤ 3 s | `npm run check:E8` |
| E31 | `fixtures/phrases.json` : 30 phrases françaises dont « jeudi 10h RDV à Joigny » avec leur intention attendue | extraire l'intention | origine, destination, date et contrainte d'heure exactes sur ≥ 27/30 phrases ; 0 horaire de trajet produit par le modèle | `npm run check:E31` |
| E19 | API du modèle de langage indisponible (simulée) | requête par formulaire (origine, destination, jour, heure) | 30/30 requêtes structurées répondues ; message « assistant indisponible » en ≤ 10 s | `npm run check:E19` |
| E20 | compteur mensuel ≥ plafond configuré | nouvelle requête | 0 appel au modèle de langage émis ; bascule sur le formulaire ; 1 ligne de journal « plafond atteint » | `npm run check:E20` |
| E30 | registre d'outils exposés au modèle | lister les outils | 0 outil de paiement, de partage de position ou de réservation (🚫 Q8) ; 100 % des outils ⚠ (appeler, ouvrir Uber, ajouter à l'agenda) exigent 1 confirmation explicite ; 0 exécution sans elle | `npm run check:E30` |

### 3.5 Données personnelles, clés, frontières

| ID | Given | When | Then (seuil) | Vérifié par |
|---|---|---|---|---|
| E15 | 100 requêtes contenant des chaînes canari (domicile, rendez-vous) | traiter puis arrêter le serveur | 0 occurrence des canaris dans les volumes, fichiers, journaux et bases du serveur (recherche exhaustive) ; 0 table ou fichier d'utilisateur côté serveur | `npm run check:E15` |
| E16 | lieu enregistré « domicile » stocké sur le téléphone avec coordonnées canari | requête « demain 9h maison → Joigny » | la charge envoyée au modèle de langage contient 0 coordonnée et 0 adresse du lieu enregistré (seulement l'alias) ; les coordonnées vont au moteur seul | `npm run check:E16` |
| E17 | dépôt git (historique compris) et bundle de l'APK de release | rechercher les motifs de clé (`sk-ant-`, variables `EXPO_PUBLIC_*KEY*`, `*SECRET*`) | 0 occurrence | `npm run check:E17` |
| E18 | 100 appels externes (modèle de langage, MOTIS, GTFS-RT, téléchargement GTFS), dont 10 en échec simulé | exécuter | 100 % produisent une ligne de journal (horodatage, cible, statut, durée, sha256 de la charge) ; 10/10 échecs conservent leur preuve (code, corps d'erreur tronqué à ≤ 4 Ko) ; 0 contenu de requête utilisateur en clair dans le journal | `npm run check:E18` |
| E37 | dépôt | compter les lignes des fichiers source | 0 fichier source > 500 lignes (CONSTITUTION 🚫 2) | `npm run check:E37` |

### 3.6 Moteur : capacité et extrémités hautes de chaque axe qui varie

| ID | Given | When | Then (seuil) | Vérifié par |
|---|---|---|---|---|
| E9 | MOTIS auto-hébergé (Docker), jeu figé + extrait OSM du couloir | importer puis servir les 30 requêtes de E8 | pic de mémoire résidente mesuré et consigné dans la preuve ; pic ≤ 50 % de la RAM physique de l'hôte ; 0 arrêt sur manque de mémoire | `npm run check:E9` |
| E21 | axe **longueur de marche** : segment à pied de 60 min puis de 61 min (cas construits) | planifier | 60 min : proposé, affiché « X,X km à pied, ~60 min » avec la distance du réseau piéton (pas à vol d'oiseau) ; 61 min : 0 option en transport public seul l'utilisant | `npm run check:E21` |
| E22 | axe **correspondances** : trajet du couloir à 4 correspondances (cas de l'oracle) | planifier et afficher | 100 % des segments rendus dans l'ordre, chaque bascule avec heure de descente et de montée ; 0 correspondance dont le temps disponible < marche calculée | `npm run check:E22` |
| E23 | axe **heure** : (a) Joigny 2026-11-12 arriver avant 07:00 ; (b) départ Brienon 2026-11-12 à 22:30 vers Paris Est | planifier | (a) titre « Transport public seul : impossible » + première arrivée possible avec sa date en clair ; (b) option du lendemain avec la date dans son titre ; 0 changement de jour silencieux (100 % des options hors jour demandé portent leur date) | `npm run check:E23` |
| E24 | axe **calendrier** : dimanche 2026-11-15 et mercredi 2026-11-11 (jour férié) | lister les départs de Brienon Mairie et de l'arrêt Mobigo `600326`, puis planifier Brienon → Joigny | départs identiques à l'oracle (100 % de concordance) ; s'il n'y en a aucun, verdict « impossible » écrit en titre | `npm run check:E24` |
| E14 | axe **taille du pack hors ligne** : trajet le plus long du couloir (Brienon → Paris Est, E4) | télécharger le trajet du jour | pack ≤ 100 Mo, fond de carte compris ; taille consignée dans la preuve | `npm run check:E14` |

### 3.7 Interface, hors ligne, annuaire, guidage

| ID | Given | When | Then (seuil) | Vérifié par |
|---|---|---|---|---|
| E32 | trajet de N segments (N = 1 à 9, cas construits) | afficher le détail | frise verticale de N blocs dans l'ordre, chacun avec heure de montée et de descente, badge d'état et action ; 0 identité visuelle de tiers (logo, nom, couleurs de marque, Q10) | `npm run check:E32` |
| E38 | réponse à E1 | écran de comparaison des options (04/E4) | chaque option porte sa durée ; un coût n'est affiché que s'il a une source (tarif sourcé) ; sinon « coût non connu » ; 0 prix inventé | `npm run check:E38` |
| E13 | trajet du jour E1 téléchargé ; émulateur Android en mode avion | ouvrir le trajet | 100 % des segments lisibles (heures, arrêts, consignes, tracé du parcours) ; bandeau « Hors ligne — horaires théoriques » ; ouverture ≤ 2 s ; 0 appel réseau tenté (journal) | `npm run check:E13` |
| E33 | trajet E1 avec une réservation à échéance et départ 06:27 | programmer les rappels | rappel de la veille (réservation) et « Partez dans N min » le jour J programmés en notifications locales à ± 1 min de l'heure calculée ; 0 rappel transmis au serveur | `npm run check:E33` |
| E34 | trajet E1 en guidage | parcourir les étapes | 100 % des points de bascule ont une consigne-action (« Descendez à Saint-Florentin-Ville », « Marchez X,X km jusqu'à la gare ») ; la consigne suivante s'affiche ≤ 1 s après validation de l'étape | `npm run check:E34` |
| E28 | annuaire de taxis local | charger | 100 % des fiches portent nom commercial, téléphone, communes desservies, URL source et date de constat ; ≥ 1 fiche couvre Brienon-sur-Armançon ; 0 numéro affiché hors fiche | `npm run check:E28` |
| E29 | option routière Uber | ouvrir le lien | lien profond pré-rempli (prise en charge et destination, action `setPickup`, 03-marche/03 §C1) ; 0 prix et 0 temps d'attente affichés pour Uber | `npm run check:E29` |
| E35 | guidage photo extérieur avec réseau, poses Geospatial injectées puis réelles à l'arrêt Brienon Mairie | afficher la consigne visuelle | précision horizontale ≤ 5 m ⇒ flèche affichée ; > 5 m ou VPS indisponible ⇒ 0 flèche, consigne texte et carte ; 100 % des poses injectées classées juste | `npm run check:E35` |
| E36 | SPIKE — 25 photos réelles de panneaux (quais, sorties, gares) prises en sous-sol ou en intérieur, vérité terrain écrite à la main | lecture hors réseau (mode avion) | ≥ 20/25 panneaux lus exactement (texte normalisé) ; ≤ 2 s par photo ; **échec non bloquant pour la v1** | `npm run check:E36` |

## 4. Feature list

Ordre = risque décroissant (le routeur prend la première `passes: false` du lot ouvert). Le champ `lot`
regroupe ; le découpage en lots datés appartient à `kodivine-chef` (`docs/PLAN.md`). Chaque `check` est
la commande qui rend la feature verte ; sa sortie se colle dans `docs/preuves/F<id>-<date>.md`.

```yaml
features:
  # --- Lot A : risque moteur (MOTIS sur GTFS SNCF + Mobigo 89, mémoire mesurée) ---
  - id: F1
    name: "Jeu figé : GTFS SNCF + GTFS Mobigo 89 + extrait OSM du couloir, manifeste (URL, date, feed_version, sha256) ; refus de lancer un test si un sha256 diffère"
    lot: A
    check: "npm run check:F1"
    exigences: [E25]
    passes: false
  - id: F2
    name: "MOTIS auto-hébergé en Docker importe le jeu figé ; mémoire résidente mesurée à l'import et en service"
    lot: A
    check: "npm run check:E9"
    exigences: [E9]
    passes: false
  - id: F3
    name: "Oracle GTFS indépendant de MOTIS (stop_times + calendar + calendar_dates, pickup/drop_off_type) : départs d'un arrêt à une date, résolution d'une course"
    lot: A
    check: "npm run check:F3"
    exigences: [E24]
    passes: false
  - id: F4
    name: "Scénario de référence Joigny 2026-11-12 trouvé par le moteur (06:27 → 09:09) et voies infaisables exclues"
    lot: A
    check: "npm run check:E1 && npm run check:E3"
    exigences: [E1, E3]
    passes: false
  - id: F5
    name: "Scénario Brienon → Paris Est 2026-10-20, arrivée ≤ 09:46 via Troyes"
    lot: A
    check: "npm run check:E4"
    exigences: [E4]
    passes: false
  - id: F6
    name: "Extrémités du moteur : marche 60/61 min, 4 correspondances, très tôt / très tard, dimanche et férié, temps moteur p95"
    lot: A
    check: "npm run check:E21 && npm run check:E22 && npm run check:E23 && npm run check:E24 && npm run check:E8"
    exigences: [E21, E22, E23, E24, E8]
    passes: false
  # --- Lot B : boucle minimale (requête structurée → trajet sourcé) ---
  - id: F7
    name: "Serveur sans état (Docker local) : requête structurée → options de segments portant chacun leur source ; journal de franchissement"
    lot: B
    check: "npm run check:E18 && npm run check:E15"
    exigences: [E18, E15]
    passes: false
  - id: F8
    name: "Validateur de provenance branché avant émission + test de propriété 200 requêtes (contrainte principale)"
    lot: B
    check: "npm run check:contrainte"
    exigences: [E5]
    passes: false
  - id: F9
    name: "Verdict d'atteignabilité en titre + option routière avec durée moteur et heure de prise en charge ; refus hors couloir"
    lot: B
    check: "npm run check:E2 && npm run check:E27 && npm run check:E26"
    exigences: [E2, E27, E26]
    passes: false
  - id: F10
    name: "État de chaque horaire : théorique (Mobigo, K941 sans trip update) / temps réel (GTFS-RT SNCF) ; alerte de retard"
    lot: B
    check: "npm run check:E10 && npm run check:E11"
    exigences: [E10, E11]
    passes: false
  - id: F11
    name: "Réservation obligatoire : fiches de réservation sourcées (délai, numéro, URL, date) et échéance calculée sur le segment"
    lot: B
    check: "npm run check:E12"
    exigences: [E12]
    passes: false
  - id: F12
    name: "Fraîcheur et période de validité des données affichées ; refus hors couverture"
    lot: B
    check: "npm run check:E25"
    exigences: [E25]
    passes: false
  # --- Lot C : assistant IA par outils ---
  - id: F13
    name: "Relais modèle de langage côté serveur (clé serveur seulement), plafond mensuel, aucune clé dans le dépôt ni le bundle"
    lot: C
    check: "npm run check:E17 && npm run check:E20"
    exigences: [E17, E20]
    passes: false
  - id: F14
    name: "Le modèle traduit la phrase en intention structurée et appelle l'outil de planification ; son texte est filtré contre les résultats d'outils"
    lot: C
    check: "npm run check:E31 && npm run check:E6 && npm run check:E7"
    exigences: [E31, E6, E7]
    passes: false
  - id: F15
    name: "Dégradé sans modèle : formulaire structuré toujours disponible ; registre d'outils sans 🚫 et avec confirmation des ⚠"
    lot: C
    check: "npm run check:E19 && npm run check:E30"
    exigences: [E19, E30]
    passes: false
  - id: F16
    name: "Lieux enregistrés résolus sur le téléphone : le modèle ne reçoit que des alias"
    lot: C
    check: "npm run check:E16"
    exigences: [E16]
    passes: false
  # --- Lot D : interface Android (Expo) ---
  - id: F17
    name: "Socle Expo Android + accueil champ unique (dictée du clavier système) + trajets enregistrés locaux avec prochain départ (04/E1)"
    lot: D
    check: "npm run check:F17 && npm run check:E37"
    exigences: [E37]
    passes: false
  - id: F18
    name: "Rendez-vous à heure fixe (04/E2) + verdict en titre (04/E3) + comparaison des options sans prix inventé (04/E4)"
    lot: D
    check: "npm run check:E2 && npm run check:E38"
    exigences: [E2, E38]
    passes: false
  - id: F19
    name: "Frise verticale de segments avec badge d'état, ⚠ et échéance de réservation sur le segment (04/E5, 04/E6, 04/E7)"
    lot: D
    check: "npm run check:E32 && npm run check:E12"
    exigences: [E32, E12]
    passes: false
  - id: F20
    name: "Rappels locaux (veille, jour J) et guidage pas-à-pas en consignes-actions (04/E8, 04/E9, 04/E12)"
    lot: D
    check: "npm run check:E33 && npm run check:E34"
    exigences: [E33, E34]
    passes: false
  # --- Lot E : annuaire taxis + Uber ---
  - id: F21
    name: "Annuaire de taxis sourcé (≥ 1 fiche couvrant Brienon) + bouton appeler avec confirmation + lien Uber pré-rempli"
    lot: E
    check: "npm run check:E28 && npm run check:E29 && npm run check:E30"
    exigences: [E28, E29, E30]
    passes: false
  # --- Lot F : hors ligne (trajet du jour) ---
  - id: F22
    name: "Pack du trajet du jour (horaires, étapes, tracé, fond de carte du corridor) lisible en mode avion (04/E13)"
    lot: F
    check: "npm run check:E13 && npm run check:E14"
    exigences: [E13, E14]
    passes: false
  # --- Lot G : guidage photo extérieur (avec réseau) ---
  - id: F23
    name: "Guidage photo extérieur : module natif Expo sur ARCore Geospatial, flèche seulement si précision ≤ 5 m, sinon consigne texte (04/E10)"
    lot: G
    check: "npm run check:E35"
    exigences: [E35]
    passes: false
  # --- SPIKE séparé : son échec ne bloque pas la v1 ---
  - id: F24
    name: "SPIKE photo sous-sol hors réseau : OCR embarqué ML Kit sur 25 photos réelles, ≥ 20/25 panneaux lus ; non bloquant"
    lot: SPIKE
    check: "npm run check:E36"
    exigences: [E36]
    bloquant_v1: false
    passes: false
```

**Définition de « v1 finie »** : F1 à F23 `passes: true` avec preuve ; F24 est un spike, son verdict
(vert ou rouge) est consigné dans sa preuve et ne conditionne pas la v1.

## 5. Hors-périmètre v1

Verbatim, non négociable sans nouvelle ADR :

- **Paiement** de quoi que ce soit (billet, course, abonnement) — 🚫 Q8.
- **Réservation intégrée** : réserver un TAD, un taxi, un VTC ou un billet à la place de l'utilisateur ;
  la v1 affiche l'échéance et le numéro, l'utilisateur appelle — Q4, Q8.
- **Commande Uber par API** (scope `request`) : lien profond seulement — Q4, 03-marche/03 §C1.
- **Covoiturage** (BlaBlaCar, BlaBlaCar Daily) : aucun jeton partenaire obtenu, inventaire à Brienon
  inconnu (03-marche/03 §C2-C3).
- **iOS** : Android d'abord (Q3) ; le code reste Expo pour ne rien réécrire plus tard.
- **Grand public**, publication sur un magasin d'applications, comptes multiples — Q1.
- **France entière** : couloir Yonne nord ↔ Paris seulement (Brienon, Migennes, Saint-Florentin, Joigny,
  Auxerre, Sens, Troyes, gares parisiennes) — Q2.
- **Itinéraire à l'intérieur de l'Île-de-France** au-delà de la gare parisienne d'arrivée (métro, RER,
  bus) : la réponse s'arrête à la gare avec la mention « suite en Île-de-France non calculée ».
- **Comptes utilisateur côté serveur**, synchronisation, historique serveur des requêtes — Q7.
- **File de tâches côté serveur** (Inngest, pg-boss, BullMQ) : elle stockerait des rendez-vous ; les
  rappels sont des notifications locales — Q7.
- **Accès au serveur depuis Internet** (exposition du PC du domicile) : la v1 planifie au domicile et
  emporte le trajet du jour hors ligne — Q5, Q9.
- **Partage de position** avec un tiers — 🚫 Q8.
- **Prix des taxis et VTC** : aucune source de tarif dans l'amont ; affiché « coût non connu ».
- **Guidage photo en sous-sol hors réseau en production** : spike F24 seulement — Q5.
- **Modèle de langage embarqué** sur le téléphone (llama.rn en échec d'installation, 03-marche/05 §E5) ;
  la v1 sans réseau n'a pas d'assistant, elle a le trajet préparé.
- **Toute identité visuelle de tiers** (logo, nom, couleurs SNCF, Transit, Google) — Q10.
- **Hébergement payant** du serveur — Q9.

## 6. Choix techniques figés

Règle : une version s'épingle **telle que constatée** (registre npm, release GitHub, fichier téléchargé)
avec sa date ; une version non constatée s'écrit ⬜ et se constate à l'installation (sortie de commande
collée dans la preuve de la feature qui l'installe). Aucune version citée de mémoire.

| Brique | Rôle | Version observée | Constat | Source |
|---|---|---|---|---|
| MOTIS (MIT) | moteur d'itinéraire auto-hébergé, GTFS + GTFS-RT + OSM | release v2.11.3 du 2026-09-10 ; image Docker : ⬜ tag non constaté | 2026-10-19 | 03-marche/04 §D3, https://api.github.com/repos/motis-project/motis |
| GTFS SNCF (ODbL) | horaires train + car TER (K941) | feed_version 2026-10-18, couverture → 2027-03-31 | téléchargé 2026-10-19 | 03-marche/02 §B1, https://www.data.gouv.fr/api/1/datasets/r/9ae758ec-cd7a-40cd-a890-bb3963224942 |
| GTFS-RT SNCF (ODbL) | retards, suppressions, alertes | flux trip updates + alerts via proxy.transport.data.gouv.fr ; couverture des cars K941 : ⬜ | 2026-10-19 | 03-marche/02 §B1 |
| GTFS Mobigo 89 (LOv2) | cars et TAD de l'Yonne (sans temps réel) | fichier mis à jour le 2026-09-21 | téléchargé 2026-10-19 | 03-marche/02 §B2, https://www.data.gouv.fr/api/1/datasets/r/5c995d2c-8e79-4e40-b4a6-c0583c647201 |
| Extrait OSM (`.pbf`) du couloir | réseau piéton et routier du moteur | ⬜ source et date non constatées dans l'amont ; se consignent dans le manifeste F1 | — | 03-marche/04 §D3 (format exigé par MOTIS) |
| Expo (socle app) | application Android | `expo` 58.0.16 (SDK 58 sorti le 2026-09-29) ; `react-native` : celle qu'impose expo 58 à l'installation (⬜) | 2026-10-19 | 03-marche/05 §E1, https://registry.npmjs.org/expo |
| TypeScript + domaine pur testé sous Node | patron Pécule : `src/domain/` sans dépendance React Native | Pécule : `typescript ~6.0.3`, `vitest ^4.1.10` | 2026-10-19 | 03-marche/07 §G1 |
| `@maplibre/maplibre-react-native` (MIT) | carte du parcours, packs hors ligne `OfflineManager` | 11.5.0 du 2026-10-04 ; prérequis PMTiles Android (MapLibre Native ≥ 11.7.0) : ⬜ | 2026-10-19 | 03-marche/05 §E2 |
| Fond de carte hors ligne | tuiles du corridor | ⬜ source des tuiles non constatée ; recommandation : fichier PMTiles local (BSD-3) si ⬜ §E2 levé, sinon pack `OfflineManager` | 2026-10-19 | 03-marche/05 §E2 |
| API Anthropic par clé, côté serveur | compréhension de la phrase et explication, jamais de trajet | modèle et SDK : ⬜ non constatés dans l'amont (Pécule : SDK refusé par Metro, remplacé par `fetch` — sans objet côté serveur) | 2026-10-19 | 03-marche/08 §4.1, 03-marche/07 §G1-G2 |
| Uber, lien profond `setPickup` | option routière sans prix | documentation constatée | 2026-10-19 | 03-marche/03 §C1, https://developer.uber.com/docs/deep-linking |
| Annuaire taxis + fiches de réservation TAD | données saisies à la main, sourcées | construit (aucune donnée ouverte en BFC) | 2026-10-19 | 03-marche/02 §B2, §B5 |
| ARCore Geospatial via module natif Expo | guidage photo extérieur (F23) | pages de doc mises à jour 2024-10-31 et 2026-09-04 ; aucun binding RN officiel ; quotas et couverture VPS : ⬜ | 2026-10-19 | 03-marche/05 §E3 |
| `@infinitered/react-native-mlkit-text-recognition` (MIT) | OCR embarqué du spike F24 | 5.0.1 du 2025-11-25 ; conditions du SDK ML Kit : ⬜ | 2026-10-19 | 03-marche/05 §E4 |
| `react-native-executorch` (MIT) | piste VLM du spike F24 si l'OCR seul échoue | 0.10.6 du 2026-10-19 ; modèle vision-langage disponible : ⬜ | 2026-10-19 | 03-marche/05 §E5 |

**Écartés, avec la raison** : Navitia (AGPL-3.0, fermeture annoncée, §D2) ; Transitous (usage commercial
interdit, contact préalable exigé, et les requêtes partiraient chez un tiers, §D3, 03-marche/08 §4.3) ;
OpenTripPlanner (RAM Finlande ≈ 10 Go publiée, MOTIS plus léger déclaré, §D1) ; API SNCF hébergée
(conditions d'utilisation ⬜, requêtes chez un tiers, §B7) ; ViroReact (service hébergé tiers et
`expo <58`, §E3) ; llama.rn (échec d'installation interne, §E5) ; Inngest / pg-boss / BullMQ (serveur sans
état, Q7) ; PRIM IDFM (intra-IDF hors périmètre v1, §B7).

**Configuration figée du planificateur** (choix de ce SPEC, pas des faits) : marche maximale d'un segment
60 min ; marge d'arrivée avant un rendez-vous 0 min pour le verdict, 15 min pour l'heure de prise en charge
routière ; gares voisines explorées : Saint-Florentin-Vergigny, Laroche-Migennes, Troyes (ADR 0001, §
Exigences nées des constats).

## 7. Mode de travail (pour une session de développement vierge)

Le développement se fait dans une **autre session** ouverte sur
`D:\Mes Logiciels\02-Mobile-Desktop\MobiliteIA`, pilotée depuis MindOS (ADR 0001, § Mode de travail).
Cette session :

1. lit `CONSTITUTION.md`, puis `docs/ETAT.md` (lot en cours, preuve attendue, features du lot), puis
   ce SPEC — et rien d'autre n'est nécessaire pour commencer ;
2. ne travaille que sur les features listées « dans ce lot » par `docs/ETAT.md`, dans l'ordre de la
   feature list ; un incrément = une feature + son check + un commit (CONSTITUTION ✅ 1) ;
3. crée pour chaque exigence touchée le script `npm run check:E<n>` (code de sortie 0 = vert) et, pour
   la contrainte, `npm run check:contrainte` ;
4. ne passe une feature à `passes: true` qu'avec `docs/preuves/F<id>-<date>.md` contenant la sortie
   collée de son `check` ;
5. ne modifie jamais `docs/03-marche/`, `docs/04-dissection/`, ni une ADR ; un fait de l'amont démenti
   par la donnée (ex. horaire du jeu figé ≠ ADR) s'écrit dans la preuve et remonte au chercheur (C2) ;
6. s'arrête sur tout signal d'arrêt de `CONSTITUTION.md`.

MindOS vérifie par `node D:\MindOS\app\backend\scripts\kodivine.js gates "<projet>"` et
`node D:\MindOS\app\backend\scripts\kodivine.js prochain "<projet>"`.

## Questions ouvertes pour Brainditech

Aucune ne rend une exigence invérifiable aujourd'hui ; chacune porte la recommandation appliquée par
ce SPEC tant qu'elle n'est pas révisée par une nouvelle ADR.

- ⬜ **Plafond mensuel de l'API du modèle de langage** (ADR Q9, laissé ouvert par l'ADR). E20 se vérifie
  quelle que soit la valeur ; la valeur doit exister avant le premier appel payant (F13). Recommandation :
  la fixer à l'ouverture du lot C, en variable de configuration du serveur.
- ⬜ **Serveur joignable seulement au domicile.** Conséquence de Q9 (Docker sur le PC) : la v1 planifie
  au domicile et emporte le trajet du jour hors ligne ; en route, seul le flux GTFS-RT public est
  interrogé par le téléphone. Recommandation : garder ainsi pour la v1 (rien à exposer sur Internet).
- ⬜ **Arrêt à la gare parisienne.** Q2 dit « Paris/IDF » ; ce SPEC s'arrête à la gare d'arrivée faute de
  donnée IDF dans l'amont. Recommandation : garder pour la v1, PRIM ensuite.
- ⬜ **Marche maximale de 60 min par segment.** Choix de ce SPEC pour loger la voie de référence (2,8 km
  à vol d'oiseau, chemin réel plus long) sans retomber dans les 3 h 49 de marche du site Mobigo.
  Recommandation : 60 min, révisable sans toucher au moteur (paramètre).
- ⬜ **Projet Google Cloud pour ARCore Geospatial** (F23) : obligatoire selon la documentation (§E3),
  coût et quotas non constatés. Recommandation : ne le créer qu'à l'ouverture du lot G, en autorisation
  « Keyless ».
