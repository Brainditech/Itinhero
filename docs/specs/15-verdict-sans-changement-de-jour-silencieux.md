# Spec 15 — Verdict sans changement de jour silencieux

- **Date** : 2026-11-04
- **État** : **approuvée par délégation** : Brainditech a demandé de régler la suite sans attendre (« règle tout ça un par un… reloop jusqu'à ce que tout est parfait »). Seuils et textes : D79.
- **Branche** : `app/verdict-nuit` (empilée sur `issue/0012-cibles-48-dp`).
- **Issue d'origine** : 0011, défauts A et B.
- **Case de PLAN.md** : phase 3, « Verdict et marge, sans changement de jour silencieux ».
- **Invariants** : 3 (rien d'inventé : tout vient des heures et durées de la réponse), 6 (rien de neuf n'est envoyé).

## 1. But

Un débutant ne doit jamais lire « Possible » en vert pour un trajet qui le laisse **une nuit dehors** ou qui le fait **arriver le lendemain** sans que ce soit dit. Constaté :

- Dijon → Brienon, jeudi 05/11, partir à 17:00 : « Possible », départ 20:11, arrivée 06:32, avec « Attente 471 min » à l'arrêt de Laroche-Migennes (issue 0011) ;
- Brienon → Lonlay-l'Abbaye, jeudi 12/11 : une possibilité arrive à Flers à 22:17, puis attend le car du vendredi 07:38.

## 2. Décision D79 (seuils et textes)

- **Nuit dehors** : une attente entre deux étapes d'**au moins 60 min** qui touche la plage **22:00 – 05:00**.
  - Écarté : « plus de 3 h, quelle que soit l'heure » (une longue attente l'après-midi dans une gare n'est pas une nuit dehors) ; « toute attente qui passe minuit » (une attente de 23:50 à 00:10 n'est pas une nuit).
- **Changement de jour** : l'arrivée tombe un autre jour que le départ. Calcul : heure de départ (heure de Paris) + durée totale, sans fuseau ni `Intl` (Hermes).
- **Verdict** :
  - le verdict s'appuie sur la **première possibilité sans nuit dehors** ; s'il n'y en a aucune, sur la première ;
  - sans nuit dehors : « Possible » en vert, comme aujourd'hui ; si l'arrivée est le lendemain, le détail le dit : « Arrivée prévue vendredi 06:32. » ;
  - avec une nuit dehors : titre **« Nuit dehors »** en `avertissement` (orange, icône triangle), jamais en vert ; détail « Arrivée vendredi 06:32 après 7 h 51 d'attente de nuit à Laroche-Migennes. Aucun trajet sans nuit dehors trouvé. »
  - « Impossible » ne change pas.
- **Attentes** : au-delà de 60 min, « Attente 7 h 51 » (même format que les durées), plus « 471 min ».
- **Carte d'une possibilité** :
  - arrivée le lendemain : « 20:11 → 06:32 » suivi de « vendredi » en petit sous les heures ;
  - nuit dehors : un badge orange « Nuit dehors à Laroche-Migennes (7 h 51) » avec l'icône lune (`bedtime`), au-dessus de « Marche de plus de 15 min ».
- La couleur n'est jamais le seul signal : mot + icône (design system, règle 4).

## 3. Ce qui est construit

Tout est dans l'app ; **le serveur ne change pas**.

- `src/domaine/resultat.ts` (testé sous Node) :
  - `joursEnPlus(p)` : nombre de jours entre le départ et l'arrivée ;
  - `nuitDehors(p)` : `{ lieu, minutes } | null`, la plus longue attente qui répond à D79 ;
  - `jourApres(date, n)` : « vendredi » pour la date demandée + n jours ;
  - `formaterAttente(n)` : « 12 min », « 7 h 51 » ;
  - `phraseVerdict` : renvoie aussi `etat: "possible" | "nuit" | "impossible"` (le booléen `possible` reste pour le reste du code).
- `src/composants/Trajet.tsx` : ligne d'attente formatée, jour d'arrivée, badge « Nuit dehors ».
- `src/app/(onglets)/(chercher)/resultat.tsx` : couleur, icône et titre du verdict selon `etat`.

## 4. Critères d'acceptation

1. Tests : `nuitDehors` vrai pour 22:23 → 06:14 (471 min, Laroche-Migennes) ; faux pour 14:00 → 17:30 (3 h 30 l'après-midi) ; faux pour 23:50 → 00:10 (20 min) ; vrai pour 04:00 → 05:30.
2. Tests : `joursEnPlus` vaut 1 pour départ 20:11 + 621 min, 0 pour 06:17 + 135 min ; `formaterAttente(471)` = « 7 h 51 », `formaterAttente(12)` = « 12 min ».
3. Tests : `phraseVerdict` sur la réponse Dijon → Brienon (une seule possibilité, nuit) ⇒ état `nuit`, titre « Nuit dehors », détail avec « vendredi 06:32 » et « Laroche-Migennes » ; avec en plus une possibilité sans nuit placée après ⇒ état `possible` sur celle-là ; Joigny 06:27 ⇒ inchangé.
4. Sur le téléphone : Joigny (Gifi) → Domicile, jeudi 12/11, partir à 17:00 ⇒ verdict orange « Nuit dehors », pas de vert ; la carte montre « vendredi » et le badge ; l'attente s'écrit en heures.
5. Sur le téléphone : Domicile → Joigny, arriver avant 10:00 ⇒ toujours « Possible » en vert.
6. `npx expo lint`, `npx tsc --noEmit`, `npm test` verts.

## 5. Ce qui n'est pas fait ici

- Proposer un taxi pour éviter la nuit : spec 16 (D48).
- Le trajet FlixBus de nuit que trouve Google (question ouverte de l'issue 0011).

## 6. Constaté sur le téléphone (2026-11-04, par Claude via `adb`, captures hors dépôt, D38)

- **Critère 4 — rempli.** Gifi Joigny 2 → Domicile, jeudi 12/11, partir à 17:00 ⇒ verdict orange, triangle, « Nuit dehors · Départ 23:07 » ; ouvert : « Arrivée vendredi 06:32 après 6 h 33 d'attente de nuit à Laroche - Migennes. Aucun trajet sans nuit dehors trouvé. » La carte : « 23:07 → 06:32 », « Arrivée vendredi », badge lune « Nuit dehors à Laroche - Migennes (6 h 33) » ; étapes : « Attente 6 h 33 ». TalkBack lit « 23:07 à vendredi 06:32, 7 h 25, nuit dehors à Laroche - Migennes, … ».
- **Critère 5 — rempli.** Domicile → Gifi Joigny 2, arriver avant 10:00 ⇒ « Possible, Départ 06:17 », en vert.
- **Critère 6 — rempli** : lint, `tsc`, 107 tests verts.
- Précisions apportées en appliquant : le détail ne répète pas « Départ 23:07 » (déjà en gros au-dessus) ; replié, « Départ 23:07 » passe à la ligne d'un bloc, jamais coupé.
