# Sources des skills

> Spec 00. Seules les skills publiées par l'éditeur du service sont admises, copiées telles quelles et épinglées à un commit.
> Les consignes du dépôt (`AGENTS.md`, invariants de `docs/architecture.md`, specs approuvées) priment toujours sur une skill.
> Pour mettre à jour une skill : recopier depuis un nouveau commit de la même source, relire le diff, changer cette table.

| Skill | Service | Source (éditeur) | Commit, date | Licence |
|---|---|---|---|---|
| `sentry-instrument` | Sentry (phase 0, spec 04) | https://github.com/getsentry/plugin-claude | `1b082a07d1a8149cf8a50596dd609fd1edf8f7df`, 2026-10-22 | MIT |
| `sentry-fix-stack-traces` | Sentry (source maps, phase 0) | https://github.com/getsentry/plugin-claude | `1b082a07d1a8149cf8a50596dd609fd1edf8f7df`, 2026-10-22 | MIT |
| `inngest-setup` | Inngest (phase 7) | https://github.com/inngest/inngest-skills | `082798a627bbe9c3ed3a6638a9f56116a035f122`, 2026-09-28 | Apache-2.0 |
| `inngest-durable-functions` | Inngest (crons, phases 7 et 8) | https://github.com/inngest/inngest-skills | `082798a627bbe9c3ed3a6638a9f56116a035f122`, 2026-09-28 | Apache-2.0 |
| `inngest-steps` | Inngest (phases 7 et 8) | https://github.com/inngest/inngest-skills | `082798a627bbe9c3ed3a6638a9f56116a035f122`, 2026-09-28 | Apache-2.0 |
| `references/expressions.md` | référence partagée des skills Inngest (lien `../references/`) | https://github.com/inngest/inngest-skills | `082798a627bbe9c3ed3a6638a9f56116a035f122`, 2026-09-28 | Apache-2.0 |
| `maplibre-cartography` | MapLibre (phase 4) | https://github.com/maplibre/maplibre-agent-skills | `18cb48408705a9a9c72464b6736f99368107d6cf`, 2026-11-01 | MIT |
| `maplibre-fonts-glyphs` | MapLibre (phase 4, couvre aussi MapLibre Native) | https://github.com/maplibre/maplibre-agent-skills | `18cb48408705a9a9c72464b6736f99368107d6cf`, 2026-11-01 | MIT |

## Déjà présentes ailleurs (non recopiées)

| Service | Où |
|---|---|
| Expo | plugin `expo@claude-plugins-official`, activé dans `.claude/settings.json` |
| Anthropic (API Claude) | skill `claude-api` intégrée à Claude Code |

## Écartées

- Sentry : `sentry-get-started`, `sentry-create-alert`, `sentry-debug-issue`, `sentry-setup-releases` (provisionnement par le serveur MCP Sentry, hors besoin v1). Le serveur MCP du plugin n'est pas installé.
- Inngest : skills Cloud, agents, realtime, middleware, migration v3→v4 (hors besoin v1). `inngest-setup` cite `inngest-cli@latest` : dans ce dépôt, la version est épinglée (invariant 17, jamais `latest`).
- MapLibre : skills GL JS seulement (migration Mapbox, v6, PMTiles, sprites, terrain, sources) ; nous utilisons MapLibre Native via `@maplibre/maplibre-react-native`.

## Aucune skill officielle constatée le 2026-11-02

MOTIS, NativeWind, Zod, vitest : seules des collections tierces existent, écartées (une skill peut faire exécuter des commandes).
