# Spec 45 — L'Assistant cherche des trajets, lit les pièces jointes, et le bot de l'onglet Trajet

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (D119). Règle : D126. Temps 2 et 3 de la spec 39.
- **Branche** : `fin/bugs-et-voyage-complet`.
- **Invariants** : 2, 3 (aucun horaire écrit par Claude : les cartes viennent du moteur), 6 et 10 (pièce jointe ni gardée ni journalisée), 8, 9.

## 1. But

Demande de Brainditech (D117) : l'Assistant interroge la base et montre les trajets trouvés en cartes ; il reçoit une pièce jointe (photo, fichier) ; un petit bot dans l'onglet Trajet pour discuter du trajet et l'améliorer.

## 2. Doc lue

`@anthropic-ai/sdk` 1.3.0 installé : `tools`, `tool_choice`, blocs `tool_use` du message final ; blocs `image` (`Base64ImageSource` : jpeg, png, gif, webp) et `document` (`Base64PDFSource`). expo-image-picker ~58.0.10, expo-image-manipulator ~58.0.16 (`manipulateAsync`, `resize`, `base64`), expo-document-picker ~58.0.4, expo-file-system (`File.bytes()`).

## 3. Décision D126

1. **Outil `proposer_recherche`** déclaré à Claude (départ « domicile » / « position » / lieu, arrivée, jour, heure, sens, marge). Le serveur **n'exécute pas** l'outil : il revalide la demande (Zod, jour pas passé) et l'envoie à l'app en événement `recherche` du flux.
2. **L'app lance la recherche ordinaire** (lieux par `GET /v1/lieux`, puis `POST /v1/itineraires`) sans quitter la discussion, et montre une carte : jour et sens, départ → arrivée, verdict, trois trajets au plus (heures, durée, véhicules), « Voir ces trajets » (ouvre le Résultat). Lieu ambigu ⇒ la liste des lieux trouvés à toucher. Aucun horaire ne vient du texte de Claude (invariant 3).
3. **Pièce jointe** : trombone du champ ⇒ « Photo de la galerie », « Prendre une photo », « PDF ». Photo réduite à 1600 px en JPEG (1,5 Mo au plus), PDF de 2 Mo au plus ; base64 dans le dernier message seulement (le serveur refuse une pièce sur un ancien message) ; lue par Claude pour cette réponse, jamais gardée ni journalisée. Consigne : ne recopier ni numéro, ni numéro de dossier, ni adresse personnelle. Le trombone n'apparaît qu'avec les modules natifs (development build).
4. **Bot de l'onglet Trajet** : « Discuter de ce trajet » sous le Résultat ⇒ l'onglet Assistant s'ouvre et envoie « Explique-moi ce trajet et dis-moi comment l'améliorer. » avec le résumé du trajet en cours (spec 39).

## 4. Options écartées

- Le serveur exécute la recherche et la donne à Claude pour qu'il la commente avec les horaires (invariant 3) ; il faudrait aussi lui envoyer les coordonnées du domicile (invariant 6).
- Fenêtre surgissante dans l'onglet Trajet : une deuxième fenêtre de discussion à maintenir ; l'Assistant a déjà le trajet en cours.
- Pièces jointes gardées dans la discussion (mémoire, coût à chaque message).

## 5. Critères d'acceptation

1. Serveur : événement `recherche` revalidé ; jour passé ou coordonnées ⇒ rien ; pièce jointe acceptée sur le dernier message, refusée ailleurs ou hors base64, absente du journal (`serveur/src/routes/discussion.test.ts`, `serveur/src/assistant/discussion.test.ts`).
2. App : lecture de l'événement, demande tirée de la proposition, seule la dernière pièce jointe envoyée (`src/domaine/discussion.test.ts`).
3. Téléphone : une demande de trajet dans l'Assistant ⇒ texte puis carte de trajets ; « Voir ces trajets » ⇒ Résultat ; « Discuter de ce trajet » ⇒ réponse sur le trajet ; photo d'une convocation ⇒ recherche proposée (après le development build).

## 6. Constats

- 2026-11-06 : critères 1 et 2 verts (serveur 460, app 420 tests).
- 2026-11-06, par adb (API reconstruite, `claude-haiku-5-5`) : « Je dois être à la gare de Joigny jeudi 12 novembre à 10h, je pars de chez moi » ⇒ carte « Jeudi 12/11 · arriver avant 10:00 », liste des lieux (`docs/screenshots/fin/e1-spec45-choisir.png`), gare choisie ⇒ « Possible · départ 08:46 » et trois trajets (Taxi · TER K7, Taxi · TER P25, Bus K941 · TER P5 · TER P31) (`e2-spec45-cartes.png`) ; même chose vers Auxerre, « Voir ces trajets » ⇒ Résultat « Possible, Départ 08:56 » ; « Discuter de ce trajet » ⇒ l'Assistant explique les trois trajets, sans heure (`e4-spec45-discuter.png`).
- Corrigé pendant l'essai : bulle vide au-dessus de la carte quand Claude ne fait que proposer la recherche.
- Reste : la photo d'une convocation (modules natifs du prochain development build).
- 2026-11-06, par adb, nouveau development build : trombone ⇒ « Joindre un document », « PDF », « Prendre une photo », « Photo de la galerie ». Une fausse convocation (image fabriquée pour l'essai, retirée du téléphone ensuite : entretien le mardi 17 novembre 2026 à 14 h 00, agence France Travail de Joigny) choisie dans la galerie, « Voici ma convocation, trouve moi un trajet depuis chez moi » ⇒ « Mardi 17/11 · arriver avant 14:00 », l'agence de Joigny en tête de la liste ; la toucher ⇒ « Domicile → Agence France travail, Possible · départ 13:16 », trois cartes et « Voir ces trajets » (`docs/screenshots/passe/16-` à `20-`, non versionnées). Le reste ci-dessus est fait.
