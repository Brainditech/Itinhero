# MobiliteIA — assistant IA de déplacement multimodal — Plan d'ingénierie

> kodivine-chef · 2026-10-19 · entrées : `CONSTITUTION.md`, `docs/decisions/0001-cadrage-interview.md`,
> `docs/SPEC.md` (gate `spec` vert : 38 exigences, F1-F24), `docs/03-marche/00-synthese.md`,
> `docs/04-dissection/00-synthese.md`.
> Découpe par CAPACITÉ, jamais par couche. Chaque lot rend vraie une phrase observable.
> Se re-planifie après chaque lot : lots proches détaillés, lots lointains en intentions.
> Ce plan ne change ni le SPEC ni les ADR ; il ordonne les features F1-F24 en lots.

## Épreuve de l'amont

> *Quelle exigence du SPEC serait la plus coûteuse à découvrir fausse tard ?*

**E1, et précisément son tronçon à pied entre deux arrêts.** Toute la valeur du produit (« trouver la
voie que les calculateurs grand public ne trouvent pas ») repose sur un fait de moteur jamais constaté :
MOTIS accepte-t-il une marche d'environ 2,8 km à vol d'oiseau (chemin réel plus long) entre
Saint-Florentin-Ville et la gare de Saint-Florentin-Vergigny, au milieu d'un trajet ? La limite de
marche de correspondance de MOTIS n'est documentée nulle part dans l'amont (SPEC, Épreuve 8 ;
03-marche/04 §D3). Si elle plafonne la marche, la voie de référence disparaît, et l'architecture « un
moteur déterministe calcule » change de forme (composition de segments par notre code, ou autre
moteur). Découvert au lot de l'interface, ce serait six lots bâtis sur une hypothèse. **D'où L1 en
premier, avec F4 comme jalon de bascule.**

Ce que j'ai vérifié moi-même, et les pièges qui restent :

1. **La course de 06:27 a une date de fin.** Dans le GTFS SNCF figé (feed_version 2026-10-18), la course
   `…:87683268:87139501:12:737:20261211` porte le `service_id` `000015`, actif sur 39 dates du 2026-10-19
   au 2026-12-11, dont le 2026-10-20 et le 2026-11-12, mais pas le 2026-11-11 (férié) (lu dans
   `trips.txt` et `calendar_dates.txt` le 2026-10-19). Les deux scénarios de L1 tombent donc dans sa
   période. Après le 11/12, c'est une autre course (06:28 ou 06:38, SPEC Épreuve 4) : un test tiré au
   hasard jusqu'au 2027-03-31 (E5) ne doit jamais supposer « 06:27 ».
2. **Le jeu figé n'existe que dans un dossier temporaire.** Les deux fichiers relevés par la session
   pilote sont dans le dossier de travail temporaire de la session MindOS (chemin dans `docs/ETAT.md`) :
   `sncf.zip` sha256 `6892f10eb62e48e2a6dc6fd0ea6e27cbadcc1163d44b34e64661dae6be701dce` (feed_version
   2026-10-18) et `mobigo89.zip` sha256 `201780dac66a1663607d4c12f138d60c7e2b78ee7ae896eae06abbdc85d09db6`
   (fichiers du 2026-09-21). Les URL de data.gouv.fr pointent la « dernière version » : retélécharger
   demain rendra un autre fichier. Premier geste de F1 : les rapatrier dans le projet.
3. **La destination de E1 n'a pas de coordonnées sourcées.** « Arrivée à l'agence ≤ 10:00 » exige un
   point pour le dernier tronçon à pied ; l'amont donne l'adresse, pas les coordonnées. Elles viennent
   d'un géocodage sourcé (service, date, réponse consignés dans le manifeste), jamais d'une saisie de
   mémoire (CONSTITUTION, zéro trajet inventé).
4. **Le seuil mémoire de E9 bute sur un plafond plus bas que lui.** 50 % de la RAM physique de l'hôte font
   34,2 Go (hôte : 68,3 Go constatés), mais la machine virtuelle de Docker Desktop n'en voit que 33,5 Go
   (`docker info`, 2026-10-19). Un dépassement se manifestera par un arrêt pour manque de mémoire DANS
   la VM avant le seuil. La preuve F2 consigne les deux nombres et le pic du conteneur.
5. **La marche réelle n'a jamais été calculée.** 2,8 km est à vol d'oiseau ; le SPEC exige la distance
   du réseau piéton (E21). Si le chemin réel dépasse 60 min (plafond du SPEC), E1 et E21 se
   contredisent : ce serait une remontée au SPEC, pas une retouche du plafond en silence.
6. **Le train 08:50 → 09:09 n'a pas été contrôlé ligne à ligne par le pilote** (seuls la montée et la
   descente du car l'ont été). C'est l'oracle F3 qui le tranche, avant F4.

## 1. La capacité finale, en une phrase

**Brainditech dit ou tape « jeudi 10h RDV à Joigny » sur son téléphone Android et lit, en moins de
10 secondes, « Transport public seul : possible » puis la voie réelle (car 06:27, marche, train 08:50 →
09:09) dont chaque segment cite sa source, avec l'option routière et son heure de prise en charge ;
le matin même, le trajet s'ouvre en mode avion et le guide étape par étape.**

## 2. Les lots

Budget de sessions = nombre de sessions fraîches de `kodivine-dev` (une feature = une session). Il sert
à comparer les lots entre eux, jamais à promettre une date.

| Lot | Capacité rendue vraie (ce que je MONTRE) | Features | Preuve de fin (définie avant ouverture) | Sessions |
|---|---|---|---|---|
| L1 | Je montre que, sur le jeu figé, MOTIS auto-hébergé trouve Brienon → Joigny du 12/11 (06:27 → 09:09, agence ≤ 10:00) et Brienon → Paris Est du 20/10 (≤ 09:46 via Troyes), que l'oracle GTFS indépendant confirme chaque segment à la minute, et que la mémoire tient | F1, F2, F3, F4, F5 | `npm run check:F1 && npm run check:E9 && npm run check:F3 && npm run check:E1 && npm run check:E3 && npm run check:E4` sort 0 ; F1-F5 `passes: true` avec `docs/preuves/F<n>-<date>.md` ; gate `preuve` vert | 5 (+1 de réserve sur F2) |
| L2 | Je montre qu'une requête structurée envoyée au serveur local rend le verdict en titre puis des options dont chaque segment porte sa source validée par l'oracle — 200 requêtes tirées : 100 % résolues, 0 segment sans source — et que le serveur n'a rien gardé | F7, F8, F9 | `npm run check:E18 && npm run check:E15 && npm run check:contrainte && npm run check:E2 && npm run check:E27 && npm run check:E26` sort 0 ; F7-F9 `passes: true` avec preuves | 4 (F9 en 2) |
| L3 | Je montre que le moteur tient à ses bords : marche 60 min proposée / 61 min refusée en distance réelle, 4 correspondances rendues dans l'ordre, très tôt et très tard sans changement de jour silencieux, dimanche et férié identiques à l'oracle, p95 moteur ≤ 3 s | F6 | `npm run check:E21 && npm run check:E22 && npm run check:E23 && npm run check:E24 && npm run check:E8` sort 0 ; F6 `passes: true` avec preuve | 3 (F6 à scinder) |
| L4 | Je montre que chaque horaire affiché dit s'il est théorique ou temps réel, qu'un retard simulé de +12 min apparaît en ≤ 60 s avec ⚠ si la correspondance tombe, qu'un segment à réservation porte son échéance (ou « délai non connu »), et que la date des données et sa couverture sont affichées | F10, F11, F12 | `npm run check:E10 && npm run check:E11 && npm run check:E12 && npm run check:E25` sort 0 ; F10-F12 `passes: true` avec preuves | 3-4 |
| L5 | Je montre sur un émulateur Android : champ unique, trajets enregistrés, « Transport public seul : possible » en titre pour E1, comparaison sans prix inventé, frise verticale avec badges et échéance | F17, F18, F19 | intention : `check:F17`, `E37`, `E2`, `E38`, `E32`, `E12` verts côté application | 3-4 |
| L6 | Je montre que le trajet du jour E1 s'ouvre en mode avion en ≤ 2 s, tracé compris, avec un pack ≤ 100 Mo | F22 | intention : `check:E13 && check:E14` | 2 |
| L7 | Je montre que la phrase « jeudi 10h RDV à Joigny » devient la bonne requête (≥ 27/30 phrases), que tout horaire inventé par le modèle est rejeté (10/10), et que sans modèle le formulaire répond | F13, F14, F15, F16 | intention : `check:E17 E20 E31 E6 E7 E19 E30 E16` | 5 (F14 à scinder) |
| L8 | Je montre les rappels locaux de la veille et du jour J, le guidage par consignes-actions, l'appel d'un taxi de l'annuaire sourcé après confirmation et le lien Uber pré-rempli | F20, F21 | intention : `check:E33 E34 E28 E29 E30` | 3 |
| L9 | Je montre, dehors à l'arrêt Brienon Mairie, une flèche de guidage photo seulement si la précision est ≤ 5 m, sinon la consigne texte | F23 | intention : `check:E35` | 2-3 |
| LS | SPIKE non bloquant : je montre combien de panneaux sur 25 sont lus hors réseau (seuil 20/25), verdict vert ou rouge consigné | F24 | intention : `check:E36`, verdict dans la preuve, quel qu'il soit | 1-2 |

**v1 finie** = L1 à L9 fermés (F1-F23 `passes: true` avec preuve) ; LS fermé sur son verdict, quel qu'il
soit (SPEC §4).

### Détail des lots proches

**L1 — le moteur dérisqué** (dépend de : rien).
Ordre des sessions = ordre du SPEC, qui est aussi l'ordre du risque :

| Session | Feature | Ce qui la ferme | Points d'attention |
|---|---|---|---|
| 1 | F1 jeu figé | `npm run check:F1` : refuse si un sha256 diffère de `fixtures/manifest.json` | rapatrier les deux zip du dossier temporaire (Épreuve 2) ; extrait OSM du couloir à choisir et consigner (source, date, emprise, sha256) — emprise minimale : Yonne + Aube (Troyes) ; Paris réduit à ses gares (pas de marche calculée en Île-de-France, SPEC §5) ; c'est la session qui crée le squelette TypeScript + vitest et les scripts `check:*` |
| 2 | F2 MOTIS en Docker | `npm run check:E9` : import + 30 requêtes structurées servies, pic de mémoire consigné ≤ 50 % RAM hôte, 0 arrêt mémoire | tag de l'image ⬜ à constater et coller ; consigner la valeur du paramètre de marche de correspondance de MOTIS et celle retenue ; crée `fixtures/` des 30 requêtes structurées (réutilisées par E8 et E7) |
| 3 | F3 oracle GTFS | `npm run check:F3` : départs d'un arrêt à une date, résolution d'une course | indépendant de MOTIS (aucun import commun) ; contrôle aussi la course 08:50 → 09:09 (Épreuve 6) |
| 4 | F4 scénario Joigny | `npm run check:E1 && npm run check:E3` | **jalon de bascule** (§5) ; coordonnées de l'agence sourcées (Épreuve 3) |
| 5 | F5 scénario Paris Est | `npm run check:E4` | 0 option via Laroche-Migennes 13:25 classée devant |

Risque principal : MOTIS refuse la marche longue entre deux arrêts (Épreuve de l'amont). Risque second :
l'image Docker de MOTIS v2.11.3 n'est pas publiée sous un tag constaté (SPEC §6, ⬜) ; il faudrait alors
la construire, d'où la session de réserve.

**L2 — la boucle sourcée** (dépend de : L1).
F7 (serveur sans état, journal de franchissement, canaris), F8 (validateur de provenance avant émission +
propriété 200 requêtes : c'est la contrainte principale rendue mécanique), F9 (verdict en titre, option
routière avec durée moteur et prise en charge, refus hors couloir). F9 porte trois exigences : deux
sessions, (a) E2 + E26, (b) E27. Risque : l'oracle et MOTIS divergent sur une minute (arrondi des
secondes, fuseau, passage de minuit) ; l'écart se corrige dans notre code de lecture, jamais en
assouplissant la tolérance de 0 min.

**L3 — les bords du moteur** (dépend de : L2, pour le verdict en titre exigé par E23 et E24).
F6 porte cinq exigences : elle ne tient pas en une session. Découpe à faire **avant l'ouverture de L3** :
demander à `kodivine-spec` de scinder F6 en trois features (E21 ; E22 + E23 ; E24 + E8). Sans cette
scission, budget de trois sessions et F6 ne passe `true` qu'à la troisième.

**L4 — l'état de chaque horaire** (dépend de : L2). Intention détaillée à la replanification après L2.
Les fiches de réservation (F11) sont des données sourcées à la main : leur collecte appartient à
`kodivine-chercheur` et peut se faire en parallèle de n'importe quel lot.

### Lots lointains (intentions, à redécouper après L4)

L5 téléphone, L6 hors ligne, L7 assistant, L8 rappels/guidage/taxis, L9 guidage photo, LS spike. F14
(trois exigences) est à scinder avant l'ouverture de L7. Le plafond mensuel de l'API est une décision de
Brainditech à prendre **avant** F13 (SPEC, Questions ouvertes).

## 3. Graphe de dépendances et chemin critique

```
L1 moteur dérisqué (F1-F5)
 └─► L2 boucle sourcée (F7-F9)
      ├─► L3 bords du moteur (F6)
      └─► L4 état des horaires (F10-F12)
           └─► L5 téléphone (F17-F19)
                ├─► L6 hors ligne (F22)
                ├─► L7 assistant IA (F13-F16)      [F13-F15 n'exigent que L2 ; F16 exige L5]
                ├─► L8 rappels, guidage, taxis (F20-F21)
                │    └─► L9 guidage photo (F23)
                └─► LS spike OCR hors réseau (F24) [non bloquant]
```

Flèches justifiées : L2 consomme le moteur et l'oracle de L1 ; L3 a besoin du verdict en titre de F9 ;
L4 pose l'état sur des segments sourcés de L2 ; la frise de L5 affiche les badges et l'échéance de L4
(E12 est dans le check de F19) ; L6, L7 (F16 : lieux enregistrés sur le téléphone), L8 et LS ont besoin
du socle Expo de L5 ; L9 affiche la consigne du guidage de L8.

**Chemin critique : L1 → L2 → L4 → L5 → L8 → L9** (≈ 5 + 4 + 4 + 4 + 3 + 3 sessions). Tout le reste a du mou.

**Parallélisations réelles** (sous la règle « un seul lot ouvert », elles se traduisent en ordre libre,
pas en simultané) :
- L3 et L4 sont indépendants l'un de l'autre après L2 ;
- L6, L7 et L8 sont indépendants entre eux après L5 ; LS peut s'insérer à n'importe quel moment après L5 ;
- **hors code, vraiment en parallèle** : la collecte des fiches de réservation (F11) et de l'annuaire de
  taxis (F21) par `kodivine-chercheur`, et la CI par `kodivine-devops` (voir §4).

## 4. Ordre d'exécution (par risque décroissant)

| Rang | Lot | Pourquoi à cette place |
|---|---|---|
| 1 | L1 | Plus gros risque (moteur, marche longue, mémoire) au coût le plus bas (aucune interface). S'il échoue, rien de ce qui suit n'a d'objet |
| — | CI | Branchée par `kodivine-devops` entre L1 et L2 : `check:contrainte` doit tourner à chaque commit (SPEC §2). Protège tous les lots suivants. Gate `ci` rouge jusque-là, c'est attendu |
| 2 | L2 | Rend la contrainte principale mécanique (200 requêtes, validateur avant émission) : tout ce qui s'affiche ensuite passe par elle |
| 3 | L3 | Les bords du moteur (marche 60/61, férié, minuit) se corrigent dans le moteur ; découverts sous une interface, ils coûtent le double |
| 4 | L4 | Le temps réel GTFS-RT n'a jamais été branché ; couverture des cars K941 ⬜ (SPEC §6). Doit précéder la frise, qui l'affiche |
| 5 | L5 | Premier écran : la valeur devient visible pour Brainditech ; Expo SDK 58 est connu (Pécule) mais neuf ici |
| 6 | L6 | Le serveur n'est joignable qu'au domicile (SPEC, Questions ouvertes) : sans hors ligne, rien ne sert sur la route. Prérequis PMTiles de MapLibre ⬜ |
| 7 | L7 | L'assistant est le « IA » du nom, mais le formulaire (E19) rend le produit utilisable sans lui ; le patron « le modèle traduit, le moteur calcule » est déjà éprouvé (Pécule, Tripagent). Attend la décision de plafond |
| 8 | L8 | Rappels et guidage : briques Expo connues ; annuaire = données à collecter, sans risque technique |
| 9 | L9 | Risque technique élevé (module natif ARCore, couverture VPS de Brienon ⬜) mais valeur d'appoint : la consigne texte reste le repli exigé |
| 10 | LS | Incertitude maximale mais non bloquante par décision (SPEC §4) : se joue quand un créneau existe, son verdict ne conditionne rien |

## 5. Jalon de bascule et condition d'arrêt écrite

**Jalon de bascule : `npm run check:E1` vert à la fin de F4 (L1, session 4).**
On peut alors démontrer que le moteur trouve la voie 06:27 → 09:09 que Google, Transit et Mobigo ne
trouvent pas, confirmée par l'oracle à la minute.

**S'il n'est pas franchi**, après avoir constaté (et collé dans la preuve) la configuration de marche de
MOTIS v2.11.3 :
1. arrêt du lot, rien d'autre ne s'ouvre ;
2. ADR `docs/adr/0002-…` qui tranche entre trois options réelles : (a) garder MOTIS et composer
   nous-mêmes les segments (deux requêtes de transport + un tronçon à pied calculé par le moteur sur le
   réseau piéton), (b) OpenTripPlanner sur l'emprise du couloir (écarté pour la RAM à l'échelle d'un
   pays, jamais mesuré à celle de l'Yonne), (c) recherche sur l'oracle lui-même (moteur maison) ;
3. si aucune des trois ne rend E1 vert, **le chantier s'arrête** : sans cette voie, le produit ne fait
   pas mieux que les calculateurs existants, et la phrase finale est fausse.

**Second seuil d'arrêt, mémoire (F2)** : pic > 50 % de la RAM hôte ou arrêt pour manque de mémoire ⇒
réduire l'emprise OSM au couloir strict et remesurer ; si cela ne suffit pas, même ADR que ci-dessus.

**Condition d'arrêt du chantier (succès)** : F1-F23 `passes: true` avec preuve, LS fermé sur son verdict,
`kodivine gates` vert (CI comprise), et le scénario E1 rejoué sur l'émulateur en mode avion. Toute idée
neuve au-delà va dans une liste d'attente datée, jamais dans un lot ouvert.

## 6. Compétences exigées par lot

Repère : `vault/02-dossiers/formation-mindos/referentiel-devops-architecte-cloud.md` (D1→D15). Statut
honnête : aucun module D n'est validé à ce jour (verdict d'adoption du référentiel, 2026-07-18) ; ce
qui est pratiqué sans être validé est « à consolider ». On n'apprend une brique qu'à l'ouverture du lot
qui la réclame.

| Lot | Ce qu'il faut savoir | Repère D1→D15 | Statut |
|---|---|---|---|
| L1 | Lancer un service en conteneur, monter des volumes, lire le pic mémoire (`docker stats`), limites de la VM WSL2 | D2 runtime conteneur | à consolider |
| L1 | Mémoire résidente d'un processus, pic contre moyenne | D1 Linux de production | à acquérir |
| L1 | Figer un artefact par empreinte sha256 et refuser l'écart | D9 supply chain | à acquérir |
| L1 | Format GTFS (`stop_times`, `calendar_dates`, `pickup/drop_off_type`), configuration MOTIS | hors référentiel (métier) | **à acquérir** |
| L1 | TypeScript strict + vitest, domaine pur | hors référentiel (patron Pécule) | acquis |
| L2 | Serveur HTTP sans état, journal structuré de chaque appel externe | D10 observabilité | **à acquérir** |
| L2 | Test de propriété (tirage avec graine), recherche de canaris | hors référentiel | à acquérir |
| L2 → CI | Pipeline qui rejoue les checks à chaque commit | D8 CI/CD et gates | à consolider |
| L3 | Mesurer un p95 de latence, raisonner en objectif chiffré | D3 SLI/SLO | **à acquérir** |
| L4 | GTFS-RT (protobuf, trip updates), simuler un flux | hors référentiel (métier) | à acquérir |
| L5 | Expo SDK 58, React Native, émulateur Android | hors référentiel (mobile) | à consolider |
| L6 | Packs hors ligne MapLibre, PMTiles, budget de taille | hors référentiel (mobile) | à acquérir |
| L7 | Clé côté serveur seulement, recherche de secrets dans l'historique et le bundle | D9 supply chain | à acquérir |
| L7 | Plafond de dépense mensuel et bascule | D13 FinOps | à acquérir |
| L8 | Notifications locales Expo | hors référentiel (mobile) | à acquérir |
| L9 | Module natif Expo en Kotlin, ARCore Geospatial, projet Google Cloud | D12 cloud provider (projet, quotas) | à acquérir |
| LS | OCR embarqué ML Kit | hors référentiel | à acquérir |
