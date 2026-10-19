# ADR 0001 — Cadrage (interview inversée, phases 1-2)

- **Date** : 2026-10-19
- **Statut** : adopté — Brainditech : « on va commencer par créer le cahier des charges suivant tes recherches »
  (19/10/2026). Les recommandations ci-dessous valent décision ; chacune reste révisable par Brainditech,
  et toute révision s'écrit ici (nouvelle ADR qui remplace celle-ci, jamais une retouche silencieuse).
- **Entrées** : `docs/03-marche/` (gate sources vert, corrigé C2 le 19/10) · `docs/04-dissection/` (60 captures, gate captures vert).

## Contrainte principale

**Zéro trajet inventé.** Chaque segment proposé (train, car, bus, taxi, marche) provient d'une donnée datée et
traçable (GTFS / GTFS-RT, fiche d'annuaire sourcée, calcul de marche du moteur) — jamais du modèle de langage.
Le LLM comprend la demande et explique ; un moteur déterministe calcule.
Écartées : « arriver à l'heure » (dépend de tiers, non garantissable) ; « tout couvrir » (non vérifiable).

## Décisions

| # | Question | Décision | Raison | Options écartées |
|---|---|---|---|---|
| Q1 | Utilisateur v1 | Brainditech et sa famille | un vrai utilisateur avant mille | grand public v1 |
| Q2 | Zone v1 | Couloir Yonne nord ↔ Paris/IDF (Brienon, Migennes, Saint-Florentin, Joigny, Auxerre, Sens, Troyes, Paris) | la douleur réelle est là ; une région = un branchement de données | France entière |
| Q3 | Plateforme | Android d'abord, React Native/Expo (iOS plus tard sans réécriture) | briques photo natives Google | iOS d'abord ; natif Kotlin |
| Q4 | Réservation/paiement | Non. Bouton « appeler » (annuaire taxis) + lien Uber pré-rempli | aucune API ouverte (03-api-tierces) ; paiement = contrats + sécurité | réservation intégrée |
| Q5 | Hors ligne v1 | Trajet du jour téléchargé avant départ (horaires, carte du parcours, étapes) ; guidage photo sous-sol hors réseau = lot dédié ultérieur | plus haut risque, se prouve à part | tout hors ligne dès v1 |
| Q6 | « C'est raté si… » | (a) un segment proposé n'existe pas ; (b) il faut ouvrir une autre app pour comprendre ; (c) pas de réponse claire < 10 s ; (d) perdu en gare sans savoir quel quai | devient des tests chiffrés | — |
| Q6b | Scénario de référence | Brienon → lieu de rendez-vous à Joigny, jeudi 12/11/2026, arrivée avant 10:00 : doit trouver car 06:27 → Saint-Florentin + marche → train 08:50 → Joigny 09:09, ET l'alternative routière | Google/Transit/Mobigo ne la trouvent pas (04-dissection/07) | — |
| Q7 | Données perso | Restent sur le téléphone ; serveur sans état (ne conserve pas les requêtes) | divulgation minimale | compte utilisateur serveur |
| Q8 | Autonomie | ✅ calculer, comparer, prévenir d'un retard · ⚠️ appeler un taxi, ouvrir Uber, ajouter à l'agenda (confirmation) · 🚫 payer, partager la position, réserver à la place de l'utilisateur | — | — |
| Q9 | Budget | Dev : serveur local (Docker sur le PC de Brainditech), clé API Anthropic (pas l'abonnement — CGU). Plafond mensuel : ⬜ à fixer par Brainditech avant le premier appel payant | mémoire MOTIS non mesurée | hébergement payant dès v1 |
| Q10 | Interface | On imite les STRUCTURES et GESTES, jamais l'identité visuelle (logo, couleurs, nom SNCF) | ne pas se faire passer pour un tiers | clone visuel |
| Q11 | Nom | « MobiliteIA » provisoire | ne bloque rien | — |
| Q12 | Modèle d'interface | Frise verticale de segments de Transit + accueil de SNCF Connect (champ unique, dictée, trajets enregistrés) + 4 écrans propres : rendez-vous à heure fixe (E2), verdict d'atteignabilité en titre (E3), échéance de réservation sur le segment (E7), guidage photo (E10) | 04-dissection/00-synthese | — |

## Exigences nées des constats (à porter dans la SPEC)

- Le planificateur explore les gares voisines (Saint-Florentin-Vergigny, Troyes, Laroche-Migennes) et accepte un
  tronçon à pied plus long que les calculateurs grand public, en l'affichant explicitement (« 2,8 km à pied, ~35 min »).
- Un horaire sans temps réel (Mobigo) s'affiche **théorique** ; une ligne « réservation obligatoire » porte son échéance.
- Le verdict dit en clair « transport public seul : possible / impossible » avant les options.

## Mode de travail (Brainditech, 19/10/2026)

Le développement se fait dans une **autre session** ouverte sur ce dossier projet ; il est **piloté depuis MindOS** :
la session de dev lit `CONSTITUTION.md` puis `docs/ETAT.md`, ne travaille que sur le lot ouvert, et rend une preuve
dans `docs/preuves/`. MindOS vérifie par `node <MindOS>/app/backend/scripts/kodivine.js gates|prochain <projet>`.
