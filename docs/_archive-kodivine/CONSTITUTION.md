# MobiliteIA — assistant IA de déplacement multimodal — Constitution (règles immuables)

> Rechargée à chaque session de développement. N'explique pas le projet — énonce ce qui
> ne se négocie pas. Toute règle ici est vérifiable par une machine ou par un `grep`.

## La contrainte principale

**Zéro trajet inventé** : chaque segment proposé provient d'une donnée datée et traçable (GTFS/GTFS-RT,
fiche d'annuaire sourcée, calcul du moteur) — jamais du modèle de langage, qui comprend et explique mais ne
produit ni horaire, ni arrêt, ni correspondance. Si un changement la met en défaut, il est refusé.
(Décision : `docs/decisions/0001-cadrage-interview.md`.)

## Interdits absolus (🚫)

1. Aucune clé API dans le dépôt ou côté client.
2. Aucun fichier monolithique (> ~500 lignes se découpe).
3. Aucune feature verte sans trace d'exécution.

## Obligations structurelles (✅)

1. Un incrément = une feature + son check + un commit.
2. Aucune frontière externe muette : chaque appel externe logge son franchissement et
   conserve la preuve en cas d'échec.
3. Chaque axe qui varie est éprouvé à son extrémité haute.

## Ce qui déclenche un arrêt complet

| Signal | Action |
|---|---|
| Un horaire, arrêt ou segment affiché sans source traçable dans la réponse | Arrêt : le lot ne ferme pas, le test de contrainte passe au rouge |
| Le scénario de référence (Brienon → Joigny 12/11/2026 avant 10:00) ne trouve plus la voie 06:27 → 09:09 | Arrêt : régression du planificateur |
| Une clé API détectée dans le dépôt ou le bundle mobile | Arrêt : révocation de la clé, purge, puis reprise |
| Une donnée personnelle (domicile, rendez-vous) conservée côté serveur | Arrêt : purge et correctif avant toute suite |
