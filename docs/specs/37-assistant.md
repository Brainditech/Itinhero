# Spec 37 — Assistant

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (« dès que t'as fini tous les tests, implémente également l'Assistant », 2026-11-06, après « je te laisse choisir »). Règles : D31, D115. **Appliquée** sur `app/assistant`.
- **Branche** : `app/assistant`.
- **Cases de PLAN.md** : phase 6 bis (écran, route, jeu de 30 demandes, conseils, confirmation, clé et limites, branchement réel).
- **Invariants** : 3 (Claude ne rend que des réglages de recherche, jamais d'horaire, d'arrêt, de prix ni de numéro), 9 (le serveur contrôle la sortie de Claude), 10 (ni la phrase ni la sortie au journal).

## 1. But

D31 : dans l'onglet Assistant, la personne modifie la recherche en cours en langage courant (« je voudrais 20 min d'avance au lieu de 10 », « plutôt demain », « en partant de la gare de Sens », « moins de marche »), ou demande un conseil. Rien n'est relancé sans « Relancer la recherche ». Maquette : `design/assistant/09-assistant.png`.

## 2. Doc et code lus

- `serveur/src/routes/comprendre.ts`, `serveur/src/comprendre/comprendre.ts` et `cout.ts` (même clé, limites, plafond ; `messages.parse` + `zodOutputFormat`, effort « low », skill officielle `claude-api`).
- App : `src/recherche.tsx` (`useDeroulerRecherche`), `src/domaine/demande.ts` (`validerFormulaire`), `src/domaine/voyages.ts` (`champsDepuisRecherche`), `src/app/(onglets)/(trajet)/resultat.tsx` (tri).

## 3. Serveur : `POST /v1/assistant`

1. Entrée (Zod, stricte) : `phrase` (3 à 300 caractères) et `reglages` de la recherche en cours : `depart` et `arrivee` (`domicile`, `position` ou `{ texte }`, **jamais de coordonnées**), `date`, `heure`, `sens` (`arriver_avant` | `partir_a`), `marge`, `retour` (HH:MM ou null). Aucun historique, aucun trajet.
2. Claude (sortie structurée) rend une action :
   - `relancer` avec les seuls réglages changés : `date`, `heure`, `sens`, `marge`, `depart` (`domicile`, `position` ou texte), `arrivee` (texte), `retour` (HH:MM, ou « sans retour ») ;
   - `trier` avec `arrivee`, `marche` ou `sans_reservation` ;
   - `conseil` avec l'identifiant d'un conseil **validé** ;
   - `incompris`.
3. Le serveur contrôle : schéma, heures et dates valides, marge 0 à 120, au moins un changement pour `relancer`, date ignorée si la phrase ne dit pas de jour (D113), conseil inconnu ou non validé ⇒ `incompris`. Hors schéma, refus de Claude ou panne ⇒ 503 `assistant_indisponible`.
4. Mêmes clé d'appareil, limites (401, 429) et plafond du mois (503 `plafond_atteint`) que `/v1/comprendre`, même compteur.
5. Conseils : `serveur/src/assistant/conseils.json` (D115 : dans le serveur, qui le contrôle et l'envoie ; PLAN disait `data/`). Chaque gabarit a `id`, `situation` (pour Claude), `titre`, `texte` avec des `{valeurs}` et `valide` (relu par Brainditech). Seuls les gabarits `valide: true` sont proposés à Claude et rendus. Les premiers sont écrits non validés : ils attendent la relecture de Brainditech.

## 4. App : onglet Assistant

1. En-tête « Assistant », « Je relance les recherches pour vous. Je n'invente aucun horaire. »
2. Sans recherche en cours : « Aucune recherche en cours. Faites d'abord une recherche depuis l'Accueil. » et « Aller à l'Accueil ».
3. Carte « Trajet suivi » : jour, départ du premier trajet de la liste, départ → arrivée.
4. La demande s'écrit dans « Écrivez votre demande » (bouton ➤), ou par les puces « Changer l'heure », « Moins de marche », « Partir d'ailleurs » qui préremplissent le champ.
5. Réponse :
   - `relancer` : « D'accord. Je relance la recherche avec ces réglages : » et les puces des réglages (jour, sens et heure, marge, départ, arrivée, retour), celles qui changent entourées ; puis « Relancer la recherche » et « Annuler ». Rien n'est relancé avant le toucher. Les réglages invalides (heure passée…) donnent le message du formulaire, sans relance.
   - `trier` : « Je range les trajets : moins de marche. » et « Voir les trajets » (onglet Trajet, tri choisi).
   - `conseil` : titre et texte, les `{valeurs}` remplies par la recherche en cours, « — » quand une valeur manque.
   - `incompris` : « Je n'ai pas compris. Essayez par exemple « 20 min d'avance » ou « partir de la gare de Sens ». »
   - Indisponible, plafond : « L'assistant est indisponible pour l'instant. Utilisez « Modifier la recherche ». » et le bouton du formulaire.
6. « Relancer la recherche » : les lieux non changés gardent leur point ; un nouveau lieu se cherche par `GET /v1/lieux` (D78) ; plusieurs lieux ⇒ le formulaire s'ouvre avec la liste (D91) ; sinon l'onglet Trajet montre la nouvelle réponse.

## 5. Critères d'acceptation

1. Route : sans clé ⇒ 401 ; limites ⇒ 429 ; plafond ⇒ 503 ; coordonnées ou champ inconnu dans l'entrée ⇒ 400 ; sortie hors schéma ⇒ 503 ; conseil non validé ⇒ `incompris` (tests).
2. Jeu de 30 demandes, 27/30 au moins avec le modèle de `CLAUDE_MODEL`.
3. App : changements appliqués aux réglages, puces et marquage des changements, gabarit rempli (« — » si absent), rien de relancé sans confirmation (tests du domaine).
4. Téléphone : « Je voudrais 20 min d'avance au lieu de 10. » sur une recherche en « Arriver avant » ⇒ puce « Marge 20 min » entourée, « Relancer la recherche » ⇒ nouveau Résultat ; « moins de marche » ⇒ tri ; écran comparé à la maquette.

## 6. Constat (2026-11-06)

- Serveur : 24 tests de l'Assistant (route et contrôle), 397 tests serveur verts. Jeu de 30 demandes avec `claude-haiku-5-5` : 29/30, puis 30/30 après l'ajout de « veille » aux mots qui disent un jour (`phraseDitUnJour`).
- App : 8 tests du domaine (`src/domaine/assistant.test.ts`).
- Téléphone (adb), recherche Domicile → gare de Joigny, jeudi 12/11, avant 10:00 :
  - « Je voudrais 20 minutes de marge au lieu de 10. » ⇒ puces Jeudi 12/11, Arriver avant 10:00, **Marge 20 min** (entourée), Depuis Domicile, Vers Joigny ; « Relancer la recherche » ⇒ « être sur place avant 09:40 (rendez-vous 10:00, marge 20 min) » ;
  - « montre moi les trajets avec moins de marche » ⇒ « Je range les trajets : moins de marche. », « Voir les trajets » ⇒ onglet Trajet, tri « Moins de marche » coché ;
  - « combien coute le billet ? » ⇒ « Je n'ai pas compris… » ;
  - « je pars de la gare de Sens » ⇒ puce « Depuis gare de Sens » ; « Relancer » ⇒ formulaire avec la liste des lieux (D91), gare choisie ⇒ « Gare de Sens → Joigny, départ 07:26 ».
- Trouvé pendant l'essai : l'issue 0024 (formulaire rouvert qui perdait la recherche), corrigée ; les classes `rounded-bulle` et `max-w-[85%]` ne s'appliquaient pas, remplacées par un style direct.
- Conseils : trois gabarits écrits, **non validés** (`valide: false`) : ils attendent la relecture de Brainditech. Tant qu'aucun n'est validé, Claude ne peut pas choisir l'action « conseil ».
- Case « Confirmation avant toute modification » de PLAN non cochée : le comportement est constaté sur le téléphone, mais aucun test de composant ne le couvre.
