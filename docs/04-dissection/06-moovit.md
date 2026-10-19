# Dissection — Moovit (partielle)

> kodivine-documentaliste · relevé le 2026-10-19 · captures dans `captures/` (index : `captures/SOURCES.md`).
> Fiche App Store FR id498477945 : version 5.202.0 du 2026-10-05, note 4,61/5 sur 25 524 notes
> (source: https://itunes.apple.com/lookup?id=498477945&country=fr, relevé le 2026-10-19).
> Dissection **partielle** : 3 captures du store ; le planificateur web
> (https://moovitapp.com/tripplan?…) a répondu « Error code: 403 » le 2026-10-19 ; aucun contournement tenté.

## Modèle mental

Un **horaire de lignes proches + planificateur**, où le VTC est une option parmi les itinéraires
(`moovit-itineraires-avec-vtc-2026-10-19.jpg`).

## Organisation spatiale

| Écran | Ce qui est où | Capture |
|---|---|---|
| Itinéraires suggérés | départ / arrivée, « Partir maintenant », Filtre ; « Trajets à pied & en vélo » (Vélo 32 min, Location 42 min) ; **« S'y rendre plus rapidement : Uber — Arrivée du taxi dans environ 9 min · Durée 27 min · €23-30 · Commander »** dans la même liste | `moovit-itineraires-avec-vtc-2026-10-19.jpg` |
| Départs proches | « Votre bus arrive maintenant », arrêts proches avec temps réel | `moovit-departs-proches-2026-10-19.jpg` |
| Guidage | « Instructions étape par étape » : étape « Attendez », ligne 4, « Service modifié », « Plus d'infos & horaires » | `moovit-instructions-etapes-2026-10-19.jpg` |
| Détail de trajet, perturbations, hors ligne | ⬜ NON CAPTURÉE (le hors-ligne est documenté par le chercheur, volet A §A4) | |

## Geste principal

⬜ NON RÉSOLU — app non manipulée, web en 403.

## Ce qui la rend utilisable

- **Le taxi/VTC porte délai d'arrivée, durée et fourchette de prix dans la liste des itinéraires**, à côté du vélo (`moovit-itineraires-avec-vtc-2026-10-19.jpg`).
- **« Service modifié » posé sur l'étape du guidage** (`moovit-instructions-etapes-2026-10-19.jpg`).

## Ce qui la rend pénible (avis datés)

Source : https://itunes.apple.com/fr/rss/customerreviews/page=1/id=498477945/sortby=mostrecent/json, relevé le 2026-10-19.

- 2026-10-09, 1★ : le bus annoncé « retarde à chaque fois […] et le bus n'arrive jamais ».
- 2026-09-29, 1★ : « more ads and popups than info, shows bus stops that do not exist ».
- 2026-07-27, 1★ : « Bus fantôme » — attente de 30 min, « J'ai dû prendre un taxi ».

## Ce qu'on emprunte / ce qu'on refuse

| Décision | Élément | Raison |
|---|---|---|
| **Emprunte** | Ligne taxi dans les résultats : « arrive dans ~9 min · 27 min · 23-30 € » | format exact d'une option de premier km routier |
| **Refuse** | Publicités et pop-ups | avis du 2026-09-29 ; public cible peu à l'aise |
| **Refuse** | Afficher un départ comme réel sans preuve | avis « bus fantôme » : l'état réel / théorique doit être explicite (voir Transit) |

## Trous

- ⬜ NON RÉSOLU — Moovit couvre-t-il Brienon / Mobigo 89 ? Que répond-il pour Brienon → Joigny (12/11, 10:00) et Brienon → Paris ? Web en 403, app non installée.
