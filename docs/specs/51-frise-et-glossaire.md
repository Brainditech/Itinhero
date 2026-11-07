# Spec 51 — Frise verticale testée et glossaire à la première occurrence

- **Date** : 2026-11-07
- **État** : **approuvée par délégation** de Brainditech (D133 ; demande du 2026-11-07 : « termine toutes les implémentations qui restent que tu peux faire »). Règle : D134. **Appliquée** et constatée sur le téléphone le 2026-11-07 (critères 1 à 4).
- **Branche** : `etapes/fin-implementations`.
- **Cases de PLAN.md** : phase 4 · « Frise verticale et états d'horaire » (preuve : test de rendu, plus capture) ; phase 4 · « Gabarits de consignes et glossaire à la première occurrence » (preuve : tests). Les gabarits de consignes sont faits (spec 11, `src/domaine/consignes.ts`, `src/domaine/guidage.ts`).
- **Invariants** : 3 (l'app ne calcule aucune heure : la frise reprend celles du serveur), 4 (chaque ligne vient d'une étape sourcée), 12 (« horaire prévu » tant qu'aucun état en direct n'est reçu), 20 (jetons du design system seulement). D10 : le glossaire est un gabarit fixe versionné, Claude n'écrit aucun texte d'étape.

## 1. But

1. **Frise.** Les étapes dépliées d'une carte du Résultat (heure, mode, ligne, direction, phrase, réservation, état d'horaire, attentes, arrivée) sont construites dans le composant `Trajet.tsx`, sans test : A5 interdit le rendu React Native sous vitest. On sort ce que la frise affiche dans une fonction pure, `lignesFrise`, testée, que le composant ne fait qu'afficher. C'est le « test de rendu » de la case.
2. **Glossaire.** La maquette 05 souligne « TER » en pointillé : un mot de métier qu'un débutant ne connaît pas est expliqué **la première fois** qu'il apparaît dans les étapes d'un trajet. Aujourd'hui rien ne l'explique.

## 2. Ce qui change (D134)

### 2.1 Frise

`src/domaine/frise.ts`, `lignesFrise(p: Possibilite, etats?: EtatCourse[])` rend la liste ordonnée des lignes :

- `etape` : `heure` (départ du serveur), `mode`, `titre` (« Marche » ou `libelleEtape`), `direction`, `phrase` (`phraseMarche` ou `phraseTrajetVehicule`), `exploitant`, `reservation`, `horaire` (`libelleEtat` de la course, `null` pour la marche et le taxi), `glossaire` (morceaux du titre, §2.2) ;
- `attente` : la phrase de la première montée, ou « Attente 12 min », entre deux étapes (D68) ;
- `arrivee` : l'heure d'arrivée du serveur.

`Trajet.tsx` affiche ces lignes telles quelles ; aucun texte n'est plus construit dans le composant. L'état d'horaire reste « Horaire prévu, sans suivi en direct » sans état reçu (cas du Résultat) ; si des états sont fournis, la ligne dit « Retard 7 min », « Supprimé » ou « En direct, à l'heure » (spec 42).

### 2.2 Glossaire

`src/domaine/glossaire.ts` : liste fixe, versionnée, de mots et de leur explication, **à relire par Brainditech** (D10) :

| Mot | Explication |
|---|---|
| TER | Train express régional : le train de la région, qui s'arrête aussi dans les petites gares. |
| RER | Réseau express régional : train d'Île-de-France qui traverse Paris et s'arrête souvent, comme un métro. |
| Car | Autocar entre les villes et les villages. À l'arrêt, faites signe au conducteur pour qu'il s'arrête. |
| Tram | Tramway : un train léger qui roule sur des rails, dans la rue. |
| Transport à la demande | Bus ou minibus qui ne passe que si on l'a réservé avant, par téléphone ou sur internet. |
| Train de banlieue | Train qui relie Paris aux villes autour. |

- `decouperGlossaire(titres: string[])` découpe chaque titre en morceaux `{ texte, terme? }` ; un mot n'est marqué qu'à sa **première occurrence** dans le trajet (mot entier, majuscules respectées : « Car » et pas « carte »).
- Le mot marqué est **souligné en pointillé**, couleur primaire. Le toucher affiche son explication sous le titre de l'étape (le toucher encore la cache) ; toucher ailleurs sur la ligne ouvre toujours l'Étape (spec 17). TalkBack lit « TER, explication disponible » et l'explication quand elle est ouverte.
- Le glossaire ne sert que dans la frise des cartes (Résultat, trajet rouvert de Mes trajets).

## 3. Options écartées

- **Test de rendu React Native** (react-test-renderer, jsdom) : contraire à A5, et une dépendance de plus pour ce que `lignesFrise` prouve déjà.
- **Explication écrite par Claude** : interdit par D10.
- **Fenêtre surgissante pour l'explication** : cache la frise ; une ligne sous le titre suffit.
- **Glossaire à chaque occurrence** : la maquette et la case disent « première occurrence » ; répété, il encombre.

## 4. Critères d'acceptation

1. Tests vitest de `lignesFrise` : ordre des lignes (étapes, attente, arrivée), heures reprises du serveur, « Marche » et sa phrase, réservation d'un transport à la demande, horaire « prévu » sans état, « Retard 7 min » et « Supprimé » avec état, aucun horaire pour la marche et le taxi, phrase de la première montée avant la première étape en véhicule.
2. Tests vitest du glossaire : première occurrence seulement, mot entier (« Carte » non marqué), titre sans mot inchangé, deux mots différents dans le même trajet marqués chacun une fois.
3. **Téléphone** : Résultat déplié ⇒ « TER » souligné en pointillé sur la première étape en TER seulement ; le toucher ⇒ l'explication s'affiche ; toucher le reste de la ligne ⇒ l'Étape s'ouvre.
4. `npx expo lint`, `npx tsc --noEmit`, `npm test` verts ; CI verte.

## 5. Preuve

Tests ; captures adb `docs/screenshots/fin-impl/51-*.png` (non versionnées, D38).
