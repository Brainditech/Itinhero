# Spec 48 — Historique et nouvelle discussion dans l'Assistant

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (D119 ; demande du 2026-11-06 : « mets ça dans les specs aussi, prochain »). Règle : D129. **Appliquée** et constatée sur le téléphone le 2026-11-06 (critères 1 à 5, captures `docs/screenshots/48-*.png`, non versionnées).
- **Branche** : `fin/bugs-et-voyage-complet` (PR #61).
- **Case de PLAN.md** : aucune ; demande consignée dans `docs/ETAT.md` (« Historique et Nouvelle discussion en haut à droite de l'Assistant »). Spec 39 §9 (« rien n'est enregistré ») et §10 (« garder les discussions d'une ouverture de l'app à l'autre », plus tard) : remplacés par celle-ci.
- **Invariants** : 6 (rien de plus n'est envoyé au serveur : l'historique reste dans le téléphone), 3 (une carte de recherche rouverte relance la recherche ordinaire ; aucun horaire n'est gardé dans l'historique).

## 1. But

Demande de Brainditech (2026-11-06) : « en haut à droite, mettre Historique et Nouvelle discussion ». Comme dans les applications de discussion : repartir d'une page vide, et retrouver une discussion passée.

## 2. Ce qui change

### 2.1 En-tête de l'Assistant

1. À droite du titre « Assistant », deux boutons ronds de 48 dp, icône seule et nom lu par TalkBack :
   - **Historique** (icône horloge à flèche) : ouvre la liste des discussions gardées ;
   - **Nouvelle discussion** (icône bulle avec « + ») : arrête la réponse en cours, vide la discussion, la pièce jointe en attente et le texte tapé. Grisé quand la discussion est déjà vide.
2. Le lien « Nouvelle discussion » dans le fil (spec 39 §2.8) est retiré : le bouton du haut le remplace.

### 2.2 Ce qui est gardé

1. Après chaque réponse finie (complète ou arrêtée), la discussion est enregistrée dans la base du téléphone (table `discussions`, migration en version 3) : messages de la personne (texte, et **nom** de la pièce jointe seulement, jamais son contenu), réponses de l'Assistant finies, recherches proposées (la demande, pas les trajets).
2. Les réponses en échec ou vides ne sont pas gardées.
3. Titre : le premier message de la personne, sur une ligne, coupé à 60 caractères.
4. Au plus **30** discussions : au-delà, les plus anciennes partent.
5. Rien n'est envoyé au serveur pour l'historique.

### 2.3 La liste « Historique »

1. Fenêtre plein écran « Historique », bouton « Fermer » en haut à droite.
2. Une rangée par discussion, la plus récente en haut : titre, puis date et heure de la dernière réponse (« ven. 6 nov., 20:45 »).
3. Toucher une rangée rouvre la discussion à l'écran ; on peut la continuer (elle garde sa place dans l'historique, mise à jour).
4. Une corbeille par rangée supprime la discussion, sans confirmation (rien d'autre n'en dépend).
5. Sans discussion : « Aucune discussion gardée pour l'instant. »

## 3. Ce qui ne change pas

Envoi, arrêt, pièces jointes, cartes de recherche (spec 45), « Discuter de ce trajet » (qui démarre une nouvelle discussion, gardée elle aussi).

## 4. Critères d'acceptation

1. Ce qui est gardé : pas de contenu de pièce jointe, pas de réponse en échec ou en cours, titre coupé à 60 caractères (`src/domaine/historique.test.ts`).
2. Une ligne illisible de la base est ignorée, jamais une erreur (test).
3. **Téléphone** : les deux boutons en haut à droite ; « Nouvelle discussion » vide le fil.
4. **Téléphone** : après une réponse, la discussion apparaît dans Historique ; la toucher la rouvre avec ses messages.
5. **Téléphone** : la corbeille retire la discussion de la liste.

## 5. Preuve

Tests, captures adb `docs/screenshots/48-*.png` (non versionnées, D38), lint, types.
