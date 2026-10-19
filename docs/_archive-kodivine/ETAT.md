# MobiliteIA — assistant IA de déplacement multimodal — ÉTAT DU CHANTIER

> Se relit en deux minutes. C'est le fichier qu'on ouvre en premier après une pause.
> Tenu par la session pilote (MindOS, `kodivine-chef`). Plan complet : `docs/PLAN.md`.
> Dernière mise à jour : **2026-10-19**

## Lot en cours

**L1 — le moteur dérisqué** (ouvert le 2026-10-19). Capacité : je montre que, sur le jeu figé, MOTIS
auto-hébergé trouve Brienon → Joigny du 12/11 (06:27 → 09:09, agence ≤ 10:00) et Brienon → Paris Est du
20/10 (≤ 09:46 via Troyes), que l'oracle GTFS indépendant confirme chaque segment à la minute, et que
la mémoire tient. Jalon de bascule : F4 (PLAN §5).

Features dans ce lot (dans cet ordre, une session chacune) :
- **F1** jeu figé : GTFS SNCF + Mobigo 89 + OSM du couloir, manifeste sha256 — `npm run check:F1`
- **F2** MOTIS en Docker, mémoire mesurée — `npm run check:E9`
- **F3** oracle GTFS indépendant — `npm run check:F3`
- **F4** scénario Joigny 2026-11-12 — `npm run check:E1 && npm run check:E3`
- **F5** scénario Paris Est 2026-10-20 — `npm run check:E4`

Hors de ce lot, interdit dans cette session : F6 à F24.

## Preuve attendue

npm run check:F1 && npm run check:E9 && npm run check:F3 && npm run check:E1 && npm run check:E3 && npm run check:E4 sort 0 ; F1-F5 passes: true, chacune avec docs/preuves/F<n>-<date>.md (sortie collée) ; E1 montre K941 Brienon Mairie 06:27 -> Saint-Florentin-Ville 06:37, marche X,X km, train 08:50 -> Joigny 09:09, écart oracle 0 min, agence <= 10:00 ; E4 montre Paris Est <= 09:46 via Troyes ; E9 consigne le pic mémoire <= 50 % de la RAM hôte, 0 arrêt mémoire ; gate preuve vert

## Prochaine action concrète

**F1 — le jeu figé.** Commande qui la vérifie : `npm run check:F1` (code de sortie 0 ; refuse si un
sha256 diffère du manifeste).

1. Créer le squelette TypeScript + vitest et le `package.json` portant les scripts `check:*` (patron
   Pécule, SPEC §6). Aucun fichier source > 500 lignes.
2. Les deux fichiers figés ont été rapatriés par la session pilote le 2026-10-19 (sha256 recalculés à
   l'arrivée, identiques) dans `fixtures/_rapatrie-2026-10-19/` — les ranger à leur place définitive et
   les inscrire au manifeste :
   `fixtures/_rapatrie-2026-10-19/sncf.zip`
   (sha256 `6892f10eb62e48e2a6dc6fd0ea6e27cbadcc1163d44b34e64661dae6be701dce`, feed_version 2026-10-18) et
   `fixtures/_rapatrie-2026-10-19/mobigo89.zip`
   (sha256 `201780dac66a1663607d4c12f138d60c7e2b78ee7ae896eae06abbdc85d09db6`, fichiers du 2026-09-21).
   S'ils ont disparu : retélécharger depuis les URL du SPEC §6, consigner le nouveau feed_version et
   l'écart dans la preuve, et le signaler à la session pilote (règle C2).
3. Choisir l'extrait OSM du couloir (emprise minimale : Yonne + Aube ; voir PLAN §2, L1) et consigner
   source, date, emprise, sha256.
4. Écrire `fixtures/manifest.json` (URL, date de téléchargement, feed_version, sha256 par fichier), puis
   le check qui refuse tout écart.
5. Coller la sortie de `npm run check:F1` dans `docs/preuves/F1-<date>.md`, passer F1 à `passes: true`,
   commit.

## Décision en attente (bloquante)

Aucune pour L1. À venir, non bloquantes aujourd'hui :
- avant l'ouverture de L3 : scinder F6 (cinq exigences) en trois features — `kodivine-spec` ;
- avant F13 (L7) : plafond mensuel de l'API du modèle de langage — Brainditech ;
- avant l'ouverture de L7 : scinder F14 (trois exigences) — `kodivine-spec`.

## Démarrer une session de développement (session vierge)

**Fichiers à lire, dans cet ordre, et rien d'autre pour commencer :**
1. `CONSTITUTION.md` — ce qui ne se négocie pas, et les signaux d'arrêt ;
2. `docs/ETAT.md` (ce fichier) — lot en cours, features du lot, prochaine action ;
3. `docs/SPEC.md` — §3.1 et §3.6 (exigences E1, E3, E4, E9, E24, E25), §4 features F1 à F5, §6 choix
   figés, §7 mode de travail ;
4. au besoin seulement : `docs/PLAN.md` §2 « Détail des lots proches » (points d'attention par session).

**Règles de rendu :**
- Une session = une feature, la première `passes: false` de la liste « Features dans ce lot » ci-dessus,
  dans l'ordre.
- Un incrément = une feature + son check + un commit + `docs/preuves/F<id>-<date>.md` contenant la
  commande lancée et sa sortie collée (CONSTITUTION ✅ 1, 🚫 3).
- Seule retouche permise du SPEC : passer `passes: false` → `true` sur la feature dont la preuve vient
  d'être écrite (SPEC §7.4). Jamais toucher aux exigences, à la feature list, aux ADR, à
  `docs/03-marche/`, à `docs/04-dissection/`, ni à `docs/PLAN.md`.
- Ne jamais ouvrir ni fermer un lot soi-même : `kodivine lot ouvrir|fermer` appartient à la session pilote.
- Un fait de l'amont démenti par la donnée (horaire ≠ ADR, marche > 60 min, tag Docker absent…) s'écrit
  dans la preuve et s'arrête là : la session pilote le remonte. Pas de contournement silencieux.
- Arrêt immédiat sur tout signal d'arrêt de `CONSTITUTION.md`.
- Aucune clé, aucune donnée personnelle dans le dépôt.
- Fin de session : dire en trois lignes quelle feature est verte, le chemin de sa preuve, le commit.

**Ce qui revient à la session pilote (MindOS) :** ouvrir et fermer les lots ; lancer
`node D:\MindOS\app\backend\scripts\kodivine.js gates|prochain "<projet>"` ; tenir ce fichier et
`docs/PLAN.md` ; écrire la rétrospective avant chaque fermeture ; trancher par ADR (jalon de bascule
de F4) ; remonter au chercheur les écarts de l'amont ; faire scinder F6 et F14 par `kodivine-spec` ;
brancher la CI (`kodivine-devops`) entre L1 et L2 ; recueillir les décisions de Brainditech.

## Prérequis matériels (constatés le 2026-10-19, rien installé)

- Docker : `docker --version` → `Docker version 29.8.2, build 7fc2dff` ; moteur Docker Desktop en marche
  (`docker info` : 20 processeurs, 33,5 Go de mémoire pour la machine virtuelle).
- RAM physique de l'hôte : 68,3 Go (`Get-CimInstance Win32_ComputerSystem` → `TotalPhysicalMemory`
  68 314 578 944 octets) ; environ 34 Go libres au moment du constat ; processeur Intel Core i7-13650HX.
- Disque D: : 789 Go libres.
- Verdict : **pas de risque bloquant matériel pour L1.** Risque non bloquant nommé : le seuil de E9
  (50 % de l'hôte = 34,2 Go) est au-dessus du plafond de la VM Docker (33,5 Go) ; un excès se verra
  comme un arrêt pour manque de mémoire dans la VM. La preuve F2 consigne les deux nombres.

## Journal des lots

| Lot | Ouvert | Fermé | Preuve produite |
|---|---|---|---|
| L1 | 2026-10-19 | — | *en cours* |

## Rétrospectives

Aucune : aucun lot fermé.

## Rappels qui coûtent cher quand on les oublie

- Un seul lot en cours. Un lot commencé se ferme ou s'abandonne explicitement, raison écrite.
- La preuve d'un lot se définit AVANT de le commencer ; tant qu'elle n'est pas produite, le lot est à 0 %.
- Jalon de bascule : `npm run check:E1` vert à la fin de F4. S'il échoue, arrêt et ADR (PLAN §5).
- Le jeu figé ne se retélécharge jamais pour « réparer » un sha256 : un GTFS « dernière version » de
  demain n'est pas celui d'aujourd'hui.
- La course de 06:27 (`service_id` 000015) ne roule que du 2026-10-19 au 2026-12-11 : aucun test tiré
  après le 11/12 ne suppose « 06:27 ».
- Les coordonnées de l'agence de Joigny viennent d'un géocodage sourcé et consigné, jamais de mémoire.
- La tolérance oracle/moteur est de 0 min : un écart se corrige dans la lecture, jamais dans le seuil.
- Gate `ci` rouge jusqu'au passage de `kodivine-devops` entre L1 et L2 : attendu, pas un oubli.
