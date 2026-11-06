# Spec 39 — L'Assistant en discussion, réponses en flux

- **Date** : 2026-11-06
- **État** : **approuvée** par Brainditech le 2026-11-06.
- **Branche** : `app/assistant-discussion`.
- **Règle** : D117 (texte libre + cartes), qui modifie D10, D31, D115 et l'invariant 3.
- **Cases de PLAN.md** : la phase 6 bis est réécrite (§8).
- **Invariants** : 1, 2 (l'app ne parle qu'à l'API), 3 réécrit (§6), 6 (rien de stocké sur le serveur), 8 (clé, débit, plafond), 9 (Zod), 10 (aucun texte au journal), 16 (aucun numéro écrit par Claude).

## 1. But

Demande de Brainditech (2026-11-06) : l'Assistant n'est pas là pour modifier une recherche. Il est là, comme ChatGPT, pour discuter, planifier, proposer des solutions en interrogeant la base et **présenter les recours possibles**. Les réponses s'écrivent **en flux**, au fur et à mesure, pas d'un bloc.

La demande se fait en trois temps, chacun avec sa spec :

| Temps | Contenu | Spec |
|---|---|---|
| **1 (celle-ci)** | La fenêtre de discussion, les réponses en flux, l'Assistant qui connaît la recherche en cours | 39 |
| 2 | L'Assistant interroge la base : il lance des recherches au moteur et montre les trajets trouvés en cartes ; il peut recevoir une pièce jointe (photo, fichier) | 40 (à écrire) |
| 3 | Le petit bot de l'onglet Trajet (fenêtre surgissante, ou « Discuter de ce trajet » vers l'Assistant) | 41 (à écrire) |

## 2. Ce que voit la personne (onglet Assistant)

1. En-tête « Assistant ». Sous-titre : « Je vous aide à préparer votre voyage. Je n'invente aucun horaire. »
2. Si une recherche est en cours : la carte « Trajet suivi » de la maquette (jour, départ du premier trajet, départ → arrivée), au-dessus de la discussion. Sans recherche, pas de carte : on peut discuter quand même (préparer un voyage, poser une question).
3. **Discussion** : les messages de la personne à droite (bulle pleine, couleur primaire), ceux de l'Assistant à gauche avec le robot (bulle blanche), comme la maquette `design/assistant/09-assistant.png`. Le fil défile ; il descend tout seul pendant que la réponse s'écrit.
4. **Réponse en flux** : la bulle de l'Assistant apparaît dès l'envoi avec trois points animés, puis le texte s'y écrit mot à mot à mesure qu'il arrive.
5. Pendant l'écriture, le bouton ➤ devient **■ Arrêter** : il coupe la réponse, le texte déjà écrit reste.
6. Discussion vide : trois puces de départ qui envoient la question d'un toucher : « Que faire si je rate une correspondance ? », « Comment réserver un transport à la demande ? », « Explique-moi mon trajet » (cette dernière seulement avec une recherche en cours).
7. Champ « Écrivez votre message » et ➤, au-dessus du clavier comme aujourd'hui.
8. Lien « Nouvelle discussion » en haut de la discussion : vide le fil.
9. La discussion vit dans la mémoire du téléphone le temps que l'app est ouverte. Elle n'est enregistrée nulle part (ni sur le serveur ni dans le téléphone) dans ce premier temps. **Remplacé par la spec 48 (D129)** : gardée dans le téléphone, Historique.
10. Erreurs, dans la bulle de l'Assistant : plafond atteint ou Claude en panne ⇒ « Je ne suis pas disponible pour l'instant. La recherche marche toujours depuis l'Accueil. » ; réseau coupé ⇒ « Pas de réseau. Votre message n'est pas parti. » avec « Réessayer ».
11. Disparaissent : « Relancer la recherche », « Annuler », les puces de réglages et les gabarits de conseils de la spec 37.

## 3. Ce que sait l'Assistant

À chaque message, le téléphone envoie :

- la discussion en cours (au plus les 20 derniers messages, chacun d'au plus 1 000 caractères) ;
- s'il y a une recherche en cours, son résumé : départ et arrivée **en texte** (« Domicile » ou « Ma position » sans coordonnées), jour, heure, sens, marge, et pour chaque possibilité de la liste : modes empruntés, nombre de correspondances, durée de marche, et les alertes déjà calculées par l'app (nuit dehors, taxi ou transport à réserver, marche longue, sans réservation). Ni horaire, ni coordonnée, ni prix.

Claude reçoit des consignes fixes (dans le serveur) : français simple pour un débutant ; phrases courtes ; toujours proposer un recours concret quand quelque chose peut mal tourner (correspondance ratée, car qui ne passe pas, transport à la demande non réservé, nuit dehors) ; renvoyer vers ce que l'app sait faire (« Recalculer depuis ici » dans le trajet, « Voir les étapes », l'onglet Trajet, l'Accueil pour une nouvelle recherche) ; ne jamais écrire d'horaire, de prix, de numéro ni de coordonnée ; dire « je ne sais pas » plutôt qu'inventer. Le contenu des trois conseils de la spec 37 y entre comme connaissances.

## 4. Serveur : `POST /v1/assistant/discussion`

1. Clé d'appareil, limite de débit et plafond de coût mensuel, communs avec `/v1/comprendre` (invariant 8, D15).
2. Entrée validée par Zod : `messages` (1 à 20, rôle `personne` ou `assistant`, texte 1 à 1 000 caractères, le dernier de la personne), `recherche` facultative (§3). Coordonnées, champs inconnus ⇒ 400.
3. Réponse en **flux** (`text/event-stream`), événements :
   - `texte` : un morceau de la réponse, déjà filtré (§5) ;
   - `fin` : la réponse est complète ;
   - `erreur` : `indisponible` (plafond, panne de Claude) ou `invalide`.
4. Claude par `client.messages.stream` du SDK installé (`@anthropic-ai/sdk` 1.3.0), modèle `CLAUDE_MODEL`, au plus 800 jetons de réponse. Le coût réel (jetons lus et écrits) est ajouté au compteur à la fin.
5. Personne arrête (connexion fermée par l'app) ⇒ le serveur arrête le flux de Claude.
6. Rien n'est stocké ni journalisé du texte (invariants 6 et 10) : le journal ne garde que la durée, le nombre de jetons et l'issue.
7. L'ancienne route `POST /v1/assistant` (actions `relancer`, `trier`, `conseil`) est retirée, avec `conseils.json` et son jeu de 30 demandes.

## 5. Le filtre du texte (D117)

Avant d'envoyer un morceau, le serveur y remplace :

| Ce qui est retiré | Exemples | Remplacé par |
|---|---|---|
| Une heure | `14:48`, `14h48`, `14 h`, `à 9h` | « (voir l'horaire dans l'app) » |
| Un prix | `12 €`, `12,50 euros` | « (voir le prix dans l'app) » |
| Un numéro de téléphone | `03 86 12 34 56`, `0386123456`, `+33…` | « (voir le numéro dans l'app) » |
| Des coordonnées | `47.98, 3.39` | rien |

Une durée (« 20 minutes de marge », « 1 h 30 de trajet ») reste permise : ce n'est pas une donnée du moteur inventée, et la marge est un réglage. Pour ne pas couper une heure à cheval sur deux morceaux, le serveur garde les derniers caractères de chaque morceau jusqu'au suivant. Le filtre est une fonction pure, testée seule.

## 6. Invariant 3 réécrit

> 3. **Claude ne produit jamais de donnée de trajet affichée comme telle.** Il ne produit ni horaire, ni arrêt choisi, ni correspondance, ni coordonnée, ni prix, ni numéro, ni texte d'étape. Dans `/v1/comprendre`, sa sortie se limite aux champs de requête validés par Zod. Dans la discussion de l'Assistant (D117), il écrit librement ses explications, mais le serveur retire de son texte tout horaire, prix, numéro ou coordonnée ; les trajets s'affichent en cartes construites par l'app à partir du moteur.

## 7. App : lecture du flux

1. `fetch` d'`expo/fetch` (SDK 58), dont la réponse expose `body` en `ReadableStream` ; lecture morceau par morceau.
2. Le découpage des événements `text/event-stream` est une fonction pure de `src/domaine/` (testée sous vitest), sans rien de React Native.
3. ■ Arrêter ⇒ `AbortController`.

## 8. PLAN.md, phase 6 bis réécrite

- [x] reste : écran, clé et limites (déjà prouvés).
- Retirées : « Claude transforme la demande en action », jeu de 30 demandes, `conseils.json`, confirmation avant modification (sans objet : l'Assistant ne modifie plus rien).
- Ajoutées pour ce temps 1 : route en flux et son filtre (preuve : tests) ; fenêtre de discussion en flux (preuve : captures adb, texte qui grandit) ; jeu de 20 questions de voyageur (preuve : 20 réponses en français, aucune heure, aucun prix, aucun numéro après filtre, coût consigné).

## 9. Critères d'acceptation

1. Sur le téléphone, une question envoyée : la bulle de l'Assistant apparaît tout de suite, puis le texte s'y écrit en plusieurs fois (deux captures à une seconde d'écart montrent un texte plus long).
2. Les premiers mots arrivent en moins de 3 secondes sur le réseau du téléphone.
3. ■ Arrêter coupe la réponse ; le texte déjà écrit reste ; on peut renvoyer un message.
4. Avec la recherche Domicile → Flers en cours, « Explique-moi mon trajet » parle des correspondances, de la marche, du taxi à réserver, sans aucune heure ni prix.
5. « Et si je rate le car ? » propose au moins un recours concret (Recalculer depuis ici, demander au conducteur ou au guichet, prochain passage).
6. Filtre : une heure, un prix ou un numéro dans le texte de Claude n'arrive jamais à l'app, même coupé entre deux morceaux (tests).
7. Entrée avec coordonnées, plus de 20 messages ou un message de plus de 1 000 caractères ⇒ 400 (tests).
8. Plafond atteint ⇒ événement `erreur` `indisponible`, et le message du §2.10 (test et capture).
9. Le journal du serveur ne contient aucun texte de la discussion (test).
10. Lint, types et tests verts.

## 10. Hors de ce temps

L'Assistant qui lance des recherches et montre des cartes de trajets, et les pièces jointes (spec 40) ; le bot de l'onglet Trajet (spec 41) ; garder les discussions d'une ouverture de l'app à l'autre.

## 11. Constat (2026-11-06)

| Critère | Résultat | Preuve |
|---|---|---|
| 1. Bulle tout de suite, texte en plusieurs fois | oui : trois points et « Arrêter » 0,5 s après l'envoi, texte plus long à chaque capture (0,5 s d'écart), puis fini | `docs/screenshots/20261106-spec39-05-flux-1.png` à `-4.png` |
| 2. Premiers mots en moins de 3 s | oui : premier texte visible à 1 s sur le téléphone ; jeu de 20 : médiane 1,3 s, pire 2,7 s | captures ci-dessus, `docs/preuves/2026-11-06-spec39/jeu-20-questions-haiku.txt` |
| 3. Arrêter | oui : coupé à « Pour le prix et », le texte reste, ➤ revient ; journal du serveur `"issue":"arretee"` | `-08-arrete-apres.png` ; tests |
| 4. « Explique-moi mon trajet », Domicile → Flers | oui : correspondances, marche, taxi à réserver, nuit dehors, aucune heure ni prix | `-11-explique.png` ; jeu, question 1 |
| 5. « Et si je rate le car ? » | oui : « Recalculer depuis ici », conducteur ou guichet, plus de temps entre deux véhicules | jeu, question 2 |
| 6. Filtre, même coupé | oui | `serveur/src/assistant/filtre.test.ts` |
| 7. Entrées refusées ⇒ 400 | oui | `serveur/src/routes/discussion.test.ts` |
| 8. Plafond atteint | oui : message du §2.10 sur le téléphone (API relancée un moment avec un plafond minuscule, sans toucher au `.env`) | `-12-plafond.png` ; test |
| 9. Journal sans texte | oui : durée, jetons, issue seulement | test (chaîne canari) ; `docker logs` |
| 10. Lint, types, tests | verts | — |

Écarts constatés et corrigés en route : Claude écrivait en Markdown (`**…**`) et disait que l'app affiche les prix ; il répétait l'heure du rendez-vous, masquée par le filtre (« avant (voir l'horaire dans l'app) »). Consignes complétées (texte brut, « Prix non publié », « avant votre rendez-vous ») et gras retiré par le filtre ; nouveau passage du jeu : 20/20, plus aucune heure masquée. Une réponse arrêtée ne compte que les jetons reçus avant l'arrêt (l'API ne donne le total qu'à la fin).
