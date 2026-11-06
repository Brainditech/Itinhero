# Spec 44 — Mise à jour nocturne des horaires

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (D119). Règle : D125.
- **Branche** : `fin/bugs-et-voyage-complet`.
- **Case de PLAN.md** : phase 8, « `ingestion-gtfs` pour chaque jeu (D46) ».
- **Invariants** : 14 (aucun jeu basculé sans contrôles ; aucune fixture retéléchargée), 17 (images épinglées).

## 1. But

Recharger chaque nuit les 536 jeux d'horaires de transport.data.gouv.fr, pour que les horaires restent à jour (issue 0025 : Île-de-France Mobilités ne publie qu'un mois d'avance), sans qu'un jeu cassé ne bloque les autres ni ne casse le serveur.

## 2. Doc lue

API `https://transport.data.gouv.fr/api/datasets` (spec 08) ; MOTIS v2.11.4, `motis import -c … -d …` (spec 04) ; Docker Compose, `--env-file` et nom de volume par variable.

## 3. Décision D125

1. **Par jeu** (`deciderJeu`, `serveur/src/donnees/nuit.ts`) : même sha256 ⇒ inchangé ; contrôles de la spec 08 en échec, téléchargement en échec, horaires déjà finis, couverture en recul sous J+30, ou arrêt témoin perdu (« BRIENON SUR ARMANCON-MAIRIE ») ⇒ **l'ancien fichier est gardé**, avec sa raison ; sinon remplacé. Un jeu absent de la liste du jour garde l'ancien.
2. **Préparation à part** : `npm run donnees:nuit` écrit `donnees-AAAA-MM-JJ` (liens durs pour l'OSM et les fichiers gardés), avec manifest, jeux, config de MOTIS, `horaires.json` et `nuit.json` (une décision par jeu). Le dossier en service n'est jamais touché.
3. **Bascule** (`scripts/ingestion-nuit.sh`, cron du serveur) : import MOTIS dans un volume neuf pendant que l'ancien répond ; si l'import échoue, rien ne change ; sinon `donnees-actives.env` désigne le nouveau dossier et le nouveau volume, `up -d` ; `/health` sans 200 en 20 min ⇒ retour au dossier et au volume d'avant. Les deux derniers sont gardés.
4. Pas d'Inngest (D123) ; l'alerte Sentry d'un jeu gardé viendra avec Sentry (phase 9) : en attendant, `nuit.json` et le journal.

## 4. Options écartées

- Un seul import, tout ou rien : un jeu cassé bloquerait les 535 autres.
- Importer dans le MOTIS en service : une coupure longue et pas de retour arrière.

## 5. Critères d'acceptation

1. Décision par jeu : inchangé, remplacé, nouveau, ancien gardé (fichier cassé, injoignable, fini, en recul, témoin perdu), écarté (`serveur/src/donnees/nuit.test.ts`).
2. Passage réel de la préparation sur le PC : dossier du jour écrit, `nuit.json` lu.
3. Bascule et retour arrière essayés une fois sur le serveur (phase 10).

## 6. Constats

- 2026-11-06 : critère 1 vert (4 tests).
