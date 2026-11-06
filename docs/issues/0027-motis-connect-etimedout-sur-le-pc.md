# Issue 0027 — Tests nationaux : « ETIMEDOUT connect » vers MOTIS, par moments, sur le PC

- **Date** : 2026-11-06
- **État** : **ouverte**, cause racine non trouvée ; aucune correction (l'analyse doit être approuvée par Brainditech avant toute correction). Contournement : laisser MOTIS au repos une trentaine de secondes entre deux lancements des tests nationaux.
- **Branche** : `fin/bugs-et-voyage-complet`.

## 1. Reproduction

Sur le PC (Windows 11, Docker Desktop), stack national lancé (`docker-compose.national.yml`, MOTIS v2.11.4 publié sur `127.0.0.1:8080`) :

```bash
cd serveur
JOURNAL_NATIONAL=1 npx vitest run --config vitest.national.config.ts src/national/trajets-nationaux.national.test.ts
```

Lancé 4 fois de suite à quelques secondes d'intervalle : le 1er passe, les suivants échouent (503 `moteur_indisponible`). Le journal (niveau erreur, affiché grâce à `JOURNAL_NATIONAL=1`) dit : `MOTIS injoignable (http://127.0.0.1:8080/api/v6/plan) : ETIMEDOUT connect`, environ 0,3 s après le début de la requête. Après 30 s de repos, le test repasse.

Une fois aussi, la sonde de santé de `appNationale` a échoué au tout premier appel (« MOTIS injoignable », 318 ms), juste après une recherche lourde lancée à la main par `curl`.

## 2. Hypothèses essayées, une à la fois

| Hypothèse | Essai | Résultat |
|---|---|---|
| La mise à jour temps réel de MOTIS (chaque minute) bloque le serveur | Santé interrogée toutes les 200 ms pendant 70 s | 327 réponses, aucun échec : **écartée** |
| Connexion gardée ouverte (keep-alive de Node 22) fermée par MOTIS au moment de la réutiliser | Deux requêtes séparées de 0 à 30 s, agent par défaut (`keepAlive: true`) | Toujours 200 : **écartée** |
| Trop de connexions ouvertes en même temps (relais de ports de Docker Desktop) | Rafales de 4, 10, 20, 40 requêtes parallèles | Toutes servies en moins de 50 ms : **écartée** |
| MOTIS occupé par des recherches lourdes abandonnées par le client précédent | 6 recherches Laroche → Flers lancées puis coupées, santé interrogée pendant | 6 réponses en 4 à 7 ms : **écartée** |
| Le moteur seul (sans les routes du serveur) | 6 tours de 4 recherches parallèles (`moteurMotis(...).plan`) | 24 réponses, aucun échec : non reproduit hors des routes |

## 3. Ce qui est établi

- L'erreur est à l'ouverture de la connexion TCP (`syscall: connect`), pas un délai de lecture d'Itinhero (qui dirait « délai dépassé »).
- Elle n'apparaît que lorsque les routes complètes (`POST /v1/itineraires`) sont lancées plusieurs fois de suite depuis le PC vers le port publié par Docker Desktop.
- L'app du téléphone n'emprunte pas ce chemin : l'API (`itinhero-national-api-1`) joint MOTIS par le réseau interne de Docker.

## 4. Changement fait pour le diagnostic (sans correction)

- `serveur/src/itineraires/motis-plan.ts` : le message « MOTIS injoignable » nomme aussi l'appel système (`connect`, `read`). Aucune URL complète ni coordonnée n'est journalisée (le chemin seul, comme avant).
- `serveur/src/national/app-nationale.ts` : `JOURNAL_NATIONAL=1` affiche les lignes d'erreur du serveur pendant les tests nationaux.

## 5. Suite

À reprendre si la même erreur apparaît dans le journal de l'API dans Docker, ou sur le VPS (phase 10) : là, ce serait un vrai défaut pour les voyageurs.
