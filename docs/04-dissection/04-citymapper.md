# Dissection — Citymapper

> kodivine-documentaliste · relevé le 2026-10-19 · captures dans `captures/` (index : `captures/SOURCES.md`).
> Fiche App Store FR id469463298 : version 11.52.2 du 2026-10-16, note 4,81/5 sur 194 763 notes
> (source: https://itunes.apple.com/lookup?id=469463298&country=fr, relevé le 2026-10-19).
> **Hors périmètre géographique** : aucune région Citymapper ne couvre l'Yonne (volet A §A3 du
> chercheur, https://citymapper.com/cities, relevé le 2026-10-19). Disséqué pour ses mécanismes, pas
> pour un constat de trajet.

## Modèle mental

L'utilisateur croit manipuler **un comparateur de façons d'arriver** : à partir d'un trajet, une
grille de modes (marche, vélos, trottinettes, taxis, scooters, autopartage) avec prix et minutes,
puis les trajets en transports « Suggérés » (`citymapper-comparateur-modes-2026-10-19.jpg`).

## Organisation spatiale (écran par écran)

| Écran | Ce qui est où | Ce qui est masqué | Capture |
|---|---|---|---|
| Recherche + comparaison | deux champs (Position actuelle / destination) ; **grille 2 colonnes de modes** : pictogramme, prix (« 8.80€ » pour Taxis), minutes ; dessous « Suggérés » : lignes avec « dans 0, 2, 4 min » | heure de départ/arrivée choisie | `citymapper-comparateur-modes-2026-10-19.jpg` |
| Détail d'un trajet | carte (Départ / Arrivée) ; « Départ 18:32 · Arrivée 18:55 », 23 min ; étapes : « Marcher vers Richelieu – Drouot 5 min », **« Meilleure entrée 5 – rue Laffitte »**, arrêt de montée avec prochains passages « dans 6 min », **« Où monter ? – Avant »** (voiture de rame) ; bouton GO | — | `citymapper-detail-trajet-2026-10-19.jpg` |
| Guidage en cours (GO) | alerte « Descendez bientôt ! » ; liste « 4 arrêts jusqu'à Château Rouge » avec arrêts restants | — | `citymapper-alerte-descente-2026-10-19.jpg` |
| Guidage piéton | consigne vocale « Dans 85 m tourner à droite sur Boulevard Voltaire », liste d'instructions | — | `citymapper-guidage-pieton-2026-10-19.jpg` |
| Modes partagés | carte avec opérateurs (vélos, trottinettes, VTC) | — | `citymapper-modes-partages-2026-10-19.jpg` |
| Départs à un arrêt, perturbations, hors ligne | ⬜ NON CAPTURÉE | | |

## Geste principal

Destination saisie → la grille de modes avec prix et minutes apparaît sur le même écran que les
trajets suggérés (`citymapper-comparateur-modes-2026-10-19.jpg`). Décompte de taps : ⬜ NON RÉSOLU
(app non manipulée ; couverture absente dans l'Yonne de toute façon).

## Ce qui la rend utilisable

- **Prix ET minutes pour chaque mode, dans une grille** : le taxi (8.80€, 19 min) est comparable au bus sur le même écran (`citymapper-comparateur-modes-2026-10-19.jpg`).
- **Micro-indications de terrain** : « Meilleure entrée », « Où monter ? – Avant » (`citymapper-detail-trajet-2026-10-19.jpg`) — l'équivalent textuel d'un guidage visuel.
- **Alerte de descente** avec arrêts restants (`citymapper-alerte-descente-2026-10-19.jpg`).

## Ce qui la rend pénible (avis datés)

Source : https://itunes.apple.com/fr/rss/customerreviews/page=1/id=469463298/sortby=mostrecent/json, relevé le 2026-10-19.

- 2026-10-15, 1★ : « je suis déjà dans un train et elle me dit que je vais en prendre un autre ».
- 2026-10-02, 3★ : travaux et fermetures de station non indiqués ; « pas l'heure d'arrivée systématique ».
- 2026-09-23, 1★ : « Ne nous prévient pas quand une ligne de bus ou train est temporairement non desservie ».

## Ce qu'on emprunte / ce qu'on refuse

| Décision | Élément | Raison |
|---|---|---|
| **Emprunte** | Grille de modes avec prix + minutes avant la liste des trajets | à Brienon, la décision est « taxi / covoiturage / TAD / attendre 13:25 » : chaque option doit montrer coût et durée côte à côte |
| **Emprunte** | Indications de terrain en texte (« Meilleure entrée », « Où monter ») | socle textuel du guidage photo : une consigne visuelle par point de bascule |
| **Emprunte** | Alerte « Descendez bientôt » + arrêts restants | guidage du jour J |
| **Refuse** | Couverture « grandes villes » et modes partagés (trottinettes, scooters) | inexistants en zone rurale ; grille à réduire aux modes réellement disponibles |
| **Refuse** | Mascottes et identité Citymapper | structures et gestes seulement |
