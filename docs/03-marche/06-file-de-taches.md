# Volet F — File de tâches côté serveur

> Agent : kodivine-chercheur · relevé le 2026-10-19 (registre npm, API GitHub, fichiers LICENSE,
> changelog).

## Épreuve de l'amont

Le brief nomme BullMQ et pg-boss. Le mensonge par omission : la stack interne existante
(Tripagent) utilise déjà **Inngest**, et le choix « BullMQ = Redis obligatoire » n'est plus vrai
depuis BullMQ v6, qui a ajouté un backend PostgreSQL. Autre piège : Inngest semble sous GPL-3.0 si
l'on se fie aux métadonnées GitHub ; le paquet publié dit Apache-2.0, et le serveur auto-hébergé est
sous SSPL.

## F1. BullMQ

- Licence **MIT** ; version npm **6.3.17 du 2026-10-18** ; dernier commit le 2026-10-19 ; 9 519 étoiles (source: https://registry.npmjs.org/bullmq et https://api.github.com/repos/taskforcesh/bullmq, vérifiés le 2026-10-19).
- Se présente comme « Redis-based distributed queue for Node.js, Python, Elixir, .NET, Rust, PHP » (source: https://raw.githubusercontent.com/taskforcesh/bullmq/master/README.md, vérifié le 2026-10-19).
- La v6 introduit une abstraction `IQueueBackend` avec des backends **Redis et PostgreSQL** (source: https://raw.githubusercontent.com/taskforcesh/bullmq/master/docs/gitbook/changelog.md, vérifié le 2026-10-19).
- `pg`, `redis` et `ioredis` sont des peer dependencies **optionnelles** de bullmq 6.3.17 (source: https://registry.npmjs.org/bullmq/6.3.17, champ peerDependenciesMeta, vérifié le 2026-10-19).
- Une offre commerciale « BullMQ Pro » existe à côté de la version MIT (source: README ci-dessus, vérifié le 2026-10-19).

## F2. pg-boss

- Licence **MIT** ; version **12.38.0 du 2026-10-13** ; dernier commit le 2026-10-15 ; 4 071 étoiles (source: https://registry.npmjs.org/pg-boss et https://api.github.com/repos/timgit/pg-boss, vérifiés le 2026-10-19).
- « a job queue built in Node.js on top of PostgreSQL » — aucune autre dépendance d'infrastructure que PostgreSQL (source: https://raw.githubusercontent.com/timgit/pg-boss/master/README.md, vérifié le 2026-10-19).

## F3. Inngest (déjà utilisé en interne)

- SDK `inngest` : version **4.24.0 du 2026-10-14**, licence npm **Apache-2.0** (source: https://registry.npmjs.org/inngest, vérifié le 2026-10-19).
- **Incohérence signalée** : l'API GitHub du dépôt `inngest/inngest-js` affiche `GPL-3.0`, mais le fichier `packages/inngest/LICENSE.md` est l'Apache License 2.0 ; le fichier fait foi pour le paquet publié (source: https://api.github.com/repos/inngest/inngest-js et https://raw.githubusercontent.com/inngest/inngest-js/main/packages/inngest/LICENSE.md, vérifiés le 2026-10-19).
- Le **serveur** Inngest (auto-hébergement) est sous « Server Side Public License, Version 1.0 » avec une « Apache 2.0 Future License » (source: https://raw.githubusercontent.com/inngest/inngest/main/LICENSE.md, vérifié le 2026-10-19).
- Tripagent utilise `inngest ^4.23.0` pour sa génération longue (statut écrit en base, relu par l'app) (source: D:\Mes Logiciels\02-Mobile-Desktop\Tripagent\package.json ; <coffre personnel>).
- ⬜ NON RÉSOLU — tarif et quotas du plan gratuit d'Inngest Cloud en 2026. Où chercher : https://www.inngest.com/pricing.

## F4. Comparatif

| Brique | Licence | Dernière version | Infra requise | Déjà maîtrisée en interne |
|---|---|---|---|---|
| BullMQ | MIT | 6.3.17 (2026-10-18) | Redis **ou** PostgreSQL (v6) | non |
| pg-boss | MIT | 12.38.0 (2026-10-13) | PostgreSQL | non |
| Inngest | SDK Apache-2.0 / serveur SSPL | 4.24.0 (2026-10-14) | service Inngest Cloud ou serveur SSPL | **oui** (Tripagent) |

(source: puces F1 à F3, vérifiées le 2026-10-19)
