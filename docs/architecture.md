# Architecture — Itinhero v1

> Créé le 2026-11-02. Décisions : [decisions/0001-cadrage-v1.md](decisions/0001-cadrage-v1.md).
> Toute modification de ce fichier passe par une décision écrite dans `docs/decisions/`.

## Principe

**L'IA comprend et explique, le moteur calcule.** Claude ne transforme une phrase qu'en paramètres de requête. Chaque horaire, arrêt, correspondance, distance, prix ou numéro affiché vient d'une source nommée :
- les GTFS ou le GTFS-RT officiels, via MOTIS ;
- OSM, via MOTIS ;
- une fiche sourcée et validée.

## Flux

```
┌──────────────── Téléphone (Android, Expo) ─────────────────┐
│ Accueil · Confirmation · Résultat · Détail · Mes trajets ·  │
│ Réglages                                                    │
│ expo-sqlite : réglages, trajets enregistrés, rappels        │
│ secure-store : clé d'appareil                               │
│ notifications locales (rappels) · pack de carte MapLibre    │
└───────────────┬─────────────────────────────────────────────┘
                │ HTTPS + clé d'appareil (seul point d'entrée)
┌───────────────▼──────────── docker compose (PC dev / VPS prod) ┐
│ API Itinhero (Node, TypeScript, Zod)                           │
│   ├─► Claude (API Anthropic) : phrase → paramètres seulement   │
│   ├─► MOTIS : calcul, géocodage, marche/voiture, temps réel    │
│   ├─► data/tarifs.json, data/fiches/ (versionnés, validés)     │
│   └─► SQLite : abonnements_alerte (seule table persistante)    │
│ Inngest (auto-hébergé)                                         │
│   ├─ ingestion-gtfs (nuit) ─► data.gouv.fr (GTFS officiels)    │
│   ├─ suivi-retards (1 min) ─► Expo Push ─► FCM ─► téléphone    │
│   └─ purge-abonnements (jour)                                  │
│ MOTIS v2.11.4 ◄─ GTFS SNCF + Mobigo 89, OSM, GTFS-RT SNCF      │
└────────────────────────────────────────────────────────────────┘
Sentry ◄─ app et serveur (erreurs techniques seulement)
Tuiles OpenFreeMap ◄─ app (fond de l'Accueil D36, carte du Détail, packs hors ligne)
Uber ◄─ app (lien profond pré-rempli, sans API)
```

## Routes de l'API

Toutes les routes sont validées par Zod. La clé d'appareil est obligatoire sauf pour `/health` et `/api/inngest` (signé).

| Route | Rôle |
|---|---|
| `GET /health` | état de l'API, de MOTIS et date du jeu GTFS actif |
| `POST /v1/comprendre` | phrase → `{lieu_texte, date, heure, sens, marge}` par Claude, sous limite et plafond |
| `POST /v1/assistant` | demande + réglages en cours → action ou identifiant de conseil par Claude, sous limite et plafond (D31) |
| `GET /v1/lieux?q=` | candidats du géocodeur MOTIS |
| `POST /v1/itineraires` | verdict + possibilités (segments sourcés, tous les tarifs applicables) |
| `GET /v1/fiches` | tarifs et fiches validées (la réduction est appliquée côté client) |
| `POST /v1/etat-courses` | état temps réel de trip_ids pour une date |
| `POST /v1/abonnements`, `DELETE /v1/abonnements/:id` | abonnement d'alerte minimal (trip_id, date, jeton push) |
| `POST /api/inngest` | point d'entrée des fonctions Inngest |

## Tâches de fond (Inngest)

| Tâche | Déclencheur | Rôle |
|---|---|---|
| `ingestion-gtfs` | cron nocturne (Europe/Paris) | téléchargement, sha256, import MOTIS à part, contrôles, bascule ou alerte Sentry (l'ancien jeu est conservé) |
| `suivi-retards` | cron toutes les minutes tant qu'il y a des abonnements actifs | temps réel MOTIS → seuils (suppression, retard ≥ 5 min, correspondance menacée) → Expo Push |
| `purge-abonnements` | cron quotidien | supprime les abonnements expirés (J+1) |

## Où vit chaque état

| État | Où | Jamais |
|---|---|---|
| Domicile, cartes de réduction, trajets enregistrés, rappels | téléphone (expo-sqlite) | sur le serveur |
| Clé d'appareil | téléphone (expo-secure-store), empreinte côté serveur (`CLES_APPAREILS`) | en clair dans le dépôt |
| Abonnements d'alerte (trip_id, date, jeton push, expiration) | serveur, SQLite sur volume | au-delà de J+1 |
| Tarifs, fiches taxis et transport à la demande | serveur, fichiers versionnés | sans URL source et date |
| Horaires et temps réel | MOTIS (jeu GTFS actif, GTFS-RT) | dans l'app hors instantané d'un trajet enregistré |
| Compteur de coût Claude | serveur | contourné par une route |
| Secrets | environnement (.env du PC, .env du VPS) | dans l'app, le bundle, l'APK ou git |

## Source de chaque valeur affichée

| Valeur | Source |
|---|---|
| Heures de départ et d'arrivée | MOTIS `legs[].startTime/endTime`, issues de GTFS `stop_times` (feed_version + trip_id) |
| État « en direct », retard, supprimé | GTFS-RT SNCF via MOTIS. Sans flux : « horaire prévu, sans suivi en direct » (toujours le cas pour Mobigo) |
| Nom d'arrêt, repère | GTFS `stops.stop_name`. Le repère n'apparaît que si `stop_desc` ou `platform_code` existe |
| Distance et durée de marche | routage piéton MOTIS sur l'extrait OSM daté (sha256) |
| Durée en taxi | routage voiture MOTIS, libellé « durée de route estimée, hors attente » |
| Prix | `data/tarifs.json` (URL + date) combiné aux cartes cochées sur le téléphone. Sans fiche : « prix non publié ». Jamais calculé pour un taxi |
| Où acheter le billet | champ « canal de vente » de la fiche tarifaire, sinon « information non publiée » |
| Réservation obligatoire | GTFS `pickup_type=2` ou `route_type 715` |
| Échéance de réservation, numéro à appeler | fiche validée, sinon « délai non connu » / « aucun numéro connu » |
| Verdict | calcul déterministe : arrivée ≤ heure du rendez-vous − marge (10 min par défaut, ou valeur dite dans la phrase) |
| Lieu de destination | géocodeur MOTIS (OSM), candidat confirmé |
| « Horaires du JJ/MM » | `feed_info.feed_version` ou date d'ingestion du jeu actif |
| Consignes et glossaire | gabarits fixes versionnés dans le dépôt |
| Marge affichée | décision D17, ou valeur extraite de la phrase |

## Invariants

Chaque règle est une interdiction. Les enfreindre bloque la fusion.

1. **Aucun secret dans l'app.** Aucun secret (clé Anthropic, `EXPO_ACCESS_TOKEN`, clés Inngest, keystore) dans l'app, le bundle, l'APK, une variable `EXPO_PUBLIC_*` ou git.
2. **L'API Itinhero est le seul point d'entrée.** L'app n'appelle jamais directement Anthropic, MOTIS, Inngest ni les flux GTFS-RT.
3. **Claude ne produit jamais de donnée de trajet.** Il ne produit ni horaire, ni arrêt, ni correspondance, ni coordonnée, ni prix, ni numéro, ni texte d'étape affiché. Sa sortie se limite aux champs de requête validés par Zod.
4. **Aucun segment sans `source`.** Aucun segment n'est affiché sans son `source` (feed_version + trip_id/stop_id, ou fiche_id).
5. **Aucun prix sans fiche.** Aucun prix affiché sans fiche tarifaire sourcée. Aucun prix calculé ou estimé.
6. **Le serveur ne stocke presque rien.** Il ne stocke jamais le domicile, le texte d'une demande, un lieu, des coordonnées ni les cartes de réduction. Seule `abonnements_alerte` persiste, et elle est purgée à J+1.
7. **Les cartes de réduction restent sur le téléphone.** Le tarif réduit est choisi côté client.
8. **Aucun appel sans clé d'appareil valide** (sauf `/health` et `/api/inngest`, signé). Aucune route qui appelle Claude sans limite de débit ni plafond de coût.
9. **Aucune entrée non validée.** Aucune entrée (corps, paramètres, réponses de Claude, fichiers de fiches) n'est utilisée sans validation par un schéma Zod.
10. **Rien de personnel dans les journaux.** Ni les journaux serveur ni Sentry ne reçoivent le texte d'une demande, un lieu, des coordonnées ou le domicile. Le replay Sentry n'est jamais démasqué.
11. **Pas de démarrage sans secrets.** Le serveur ne démarre pas si un secret obligatoire manque ou est mal formé. Aucun secret n'est lu ailleurs que dans l'environnement.
12. **Pas de temps réel inventé.** Aucun état « en direct » sans flux GTFS-RT. Mobigo affiche toujours « horaire prévu, sans suivi en direct ».
13. **Pas de changement de jour silencieux.** Quand rien n'existe le jour demandé, le verdict le dit.
14. **Pas de bascule sans contrôles.** Aucun jeu GTFS n'est basculé en production sans contrôles réussis. Aucune fixture n'est retéléchargée pour « réparer » un sha256.
15. **Valeurs attendues tirées des fixtures.** Le test de référence ne tire jamais une valeur attendue d'ailleurs que `fixtures/`.
16. **Numéros validés seulement.** Aucun numéro de taxi ou de transport à la demande n'est affiché sans fiche validée par Brainditech.
17. **Conteneurs sûrs.** Aucun conteneur exécuté en root, aucun sans healthcheck, aucune image `latest` en production. Dev et prod ne partagent ni `.env`, ni données, ni environnement Sentry.
18. **Pas de commit sur `main`.** Aucun commit direct sur `main` (seule exception : le premier commit, D27). Aucune fusion avec une CI rouge ou une remarque majeure de revue ignorée.
19. **`.env*` inaccessible à Claude.** Claude ne lit ni n'écrit jamais `.env*`, et ne lance jamais l'app : Brainditech la fait tourner.
20. **Pas d'identité visuelle tierce.** Aucun logo ni aucune couleur de la SNCF, de Transit ou d'un autre tiers dans l'app ou dans `design/`.
