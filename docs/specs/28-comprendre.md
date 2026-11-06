# Spec 28 — La phrase de l'Accueil comprise par Claude (`POST /v1/comprendre`)

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (« implement tous les specs … jusqu'à voir toutes les phases implémentées », 2026-11-06). Règle : D106. **Appliquée** sur `phase-1/comprendre`.
- **Branche** : `phase-1/comprendre`.
- **Cases de PLAN.md** : phase 1, « `POST /v1/comprendre` » (code et jeu prêts ; la mesure 27/30 et le choix du modèle restent à faire avec la clé), « Plafond mensuel et compteur de coût » ; phase 9, « Limite de débit et plafond de coût sur toute route qui appelle Claude ». Prépare « Branchement réel » (capture à faire).
- **Invariants** : 1 (clé côté serveur seulement), 2, 3 (Claude ne rend que des champs de requête), 8 (clé d'appareil, limite et plafond), 9 (entrée et sortie de Claude validées par Zod), 10 (ni la phrase ni la sortie au journal), 11.

## 1. But

L'Accueil invite à écrire « Où devez-vous être, et quand ? ». Aujourd'hui, « Chercher » ouvre le formulaire vide avec « La compréhension de phrase est indisponible ». Avec cette spec, la phrase est lue par Claude côté serveur ; le formulaire s'ouvre **pré-rempli** et la personne vérifie avant de chercher. Sans Claude (non configuré, plafond atteint, panne), le formulaire de repli reste le chemin (D15).

## 2. Doc lue

- Skill officielle `claude-api` (2026-11-06) : SDK TypeScript, `client.messages.parse` + `zodOutputFormat` (sortie structurée validée par Zod), `output_config.effort`, `stop_reason: "refusal"`, prix par modèle (tableau mis en cache le 2026-10-06).
- `@anthropic-ai/sdk` **1.3.0** épinglé (publié le 2026-10-23, plus de deux semaines ; 1.6.0 est sorti la veille) ; types lus dans `node_modules/@anthropic-ai/sdk` (`helpers/zod`, `Usage`, `effort`).

## 3. Décision D106

1. **Variables** : `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `CLAUDE_PLAFOND_MENSUEL_EUR` : **toutes les trois ou aucune**. Aucune ⇒ le serveur démarre, `/v1/comprendre` répond 503 et l'app ouvre le formulaire. Une ou deux ⇒ refus de démarrer (invariant 11). Une variable vide (`${X:-}` du compose) vaut absente. `CLAUDE_MODEL` doit être un modèle dont le prix est connu (`serveur/src/comprendre/cout.ts`) : sans prix, pas de compteur.
2. **Route** `POST /v1/comprendre` `{ phrase }` (3 à 300 caractères, rien d'autre : ni historique ni coordonnées), sous la clé d'appareil et les limites de débit de toute route `/v1`.
   - Le serveur donne à Claude la date, le jour de la semaine et l'heure de Paris ; Claude ne devine jamais « aujourd'hui ».
   - Sortie structurée (`messages.parse`, effort `low`, `max_tokens` 2048) : `lieu_texte`, `depart_texte`, `date`, `heure`, `sens`, `marge`, `fin_rdv`, chacun null si la phrase ne le dit pas. Le serveur la revalide (date réelle, HH:MM, marge 0–120, aucun champ en plus) ; hors schéma, refus ou panne ⇒ 503 `comprendre_indisponible`.
   - 200 ⇒ `{ comprehension: {…} }`.
3. **Plafond** : compteur du mois de Paris, vérifié avant chaque appel ; atteint ⇒ 503 `plafond_atteint` sans appeler Claude. Coût = jetons × prix du modèle, **un dollar compté pour un euro** (surestime toujours, aucun taux à tenir à jour). Le compteur vit en mémoire : un redémarrage le remet à zéro ; le dépassement reste borné par `max_tokens` et les limites par clé. Le persister aurait ajouté un fichier sur le serveur, contre la lettre de l'invariant 6.
4. **App** : « Chercher » envoie la phrase. Comprise ⇒ le formulaire s'ouvre pré-rempli avec le bandeau « Voici ce qui a été compris. Vérifiez chaque champ, puis touchez « Chercher ». » ; rien n'est cherché sans ce geste. Lieu non dit ⇒ champ vide ; départ non dit ⇒ celui de l'Accueil ; jour non dit ⇒ aujourd'hui ; heure non dite ⇒ « Partir à » maintenant ; marge non dite ⇒ 10 (D17) ; fin du rendez-vous gardée si elle tombe après l'heure. Tout échec ⇒ formulaire de repli, comme avant. 401 ⇒ écran de la clé.
5. **Jeu de 30 phrases** (`serveur/src/comprendre/jeu-30-phrases.json`, attendus écrits pour le vendredi 06/11/2026 09:00) et `npm run comprendre:jeu`, lancé par Brainditech avec la clé dans son environnement, plusieurs modèles possibles (`CLAUDE_MODEL=claude-haiku-5-5,claude-sonnet-5-5`). Le modèle retenu est le moins cher à 27/30 au moins (D15) ; il s'écrit dans une décision.

## 4. Options écartées

- Envoyer la recherche directement après la phrase : une date ou un lieu mal compris lancerait une mauvaise recherche ; le formulaire vérifié est déjà là.
- Laisser Claude choisir le lieu (coordonnées) : interdit (invariant 3) ; le texte du lieu passe par `/v1/lieux` comme une saisie.
- Repli côté serveur (fallbacks d'un modèle vers un autre) : une phrase de trajet ne déclenche pas de refus attendu ; un refus ouvre simplement le formulaire.
- Compteur persisté dans un fichier : contre la lettre de l'invariant 6, pour un risque borné.

## 5. Critères d'acceptation

1. Phrase comprise ⇒ 200 avec les sept champs seulement (`serveur/src/routes/comprendre.test.ts`).
2. Phrase absente, trop courte, trop longue, ou champ en plus ⇒ 400 sans appeler Claude (test).
3. Sans clé ⇒ 401 ; au-delà de la limite ⇒ 429 (test).
4. Sortie hors schéma (heure ou date impossible, marge hors bornes, champ en plus, champ manquant, rien) ⇒ 503 (test).
5. Refus, panne, Claude non configuré ⇒ 503 `comprendre_indisponible` (test).
6. Plafond atteint ⇒ 503 `plafond_atteint` sans appeler Claude ; nouveau mois ⇒ remis à zéro (test).
7. Ni la phrase ni la sortie dans les journaux (test canari).
8. Contexte de Paris fourni par le serveur, changement d'heure compris (test).
9. Champs du formulaire tirés de la compréhension (`src/domaine/comprendre.test.ts`).
10. Client de l'app : POST de la phrase seule ; 503 ⇒ formulaire de repli (test).
11. Jeu de 30 phrases conforme au schéma, notation testée (`serveur/src/comprendre/jeu.test.ts`).
12. Variables : trois ou aucune, clé mal formée, modèle sans prix, plafond nul ⇒ refus sans recopier la valeur (`serveur/src/env.test.ts`).
13. **Mesure** (Brainditech) : `npm run comprendre:jeu` ⇒ 27/30 au moins pour le modèle retenu, consigné dans une décision.
14. **Téléphone** : « jeudi 10h RDV à Joigny » ⇒ formulaire pré-rempli (Joigny, jeudi, 10:00, Arriver avant) avec le bandeau ; serveur sans Claude ⇒ formulaire de repli avec « indisponible ».

## 6. Constats

- 2026-11-06 : critères 1 à 12 verts (`npm test`, `cd serveur && npm test`).
- Critères 13 et 14 : à faire par Brainditech (clé Anthropic, téléphone). Tant que les trois variables sont vides, rien ne change pour l'app : le formulaire de repli s'ouvre comme avant.
