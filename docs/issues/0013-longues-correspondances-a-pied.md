# Issue 0013 — Longues correspondances à pied dans Paris au lieu du métro

- **Date** : 2026-11-05
- **État** : cause racine vérifiée, **corrigée par délégation** de Brainditech (« règle tout ça un par un »), D81. Constatée corrigée sur le téléphone.
- **Branche** : `issue/0013-correspondances-a-pied` (empilée sur `serveur/taxi-etape`).

## 1. Reproduction

MOTIS national du PC, Brienon → un village de l'Orne près de Flers, jeudi 12/11 (constaté le 2026-11-04 directement sur MOTIS, puis le 2026-11-05 dans l'app) :

- TER K4 Troyes → Paris Est 18:46, RER B Gare du Nord → Châtelet 18:56, **41 min à pied** de Châtelet à Montparnasse (19:37) pour le train de 19:43 ;
- dans un autre trajet, TER K7 → Bercy, **23 min à pied**, RER, **38 min à pied** jusqu'à Montparnasse ;
- ailleurs, bus 91 jusqu'à Port-Royal puis **18 min à pied**.

Depuis Paris Est seul, MOTIS prend bien le métro 4 jusqu'à Montparnasse (16 min).

## 2. Cause racine (vérifiée)

- `max_footpath_length: 50` dans `motis/config.yml` (D42 : la marche réelle de 48 min à Saint-Florentin doit rester possible). MOTIS accepte donc une correspondance à pied jusqu'à 50 min.
- MOTIS classe d'abord par heure d'arrivée, puis par nombre de correspondances. Quand le train suivant (19:43) fixe l'heure d'arrivée, 41 min de marche « coûtent » une correspondance de moins que le métro 4 : la marche gagne.
- Hypothèses écartées : un métro 4 absent du GTFS (trouvé depuis Paris Est) ; `useRoutedTransfers` (déjà à `true`).

## 3. Correction (D81)

`serveur/src/itineraires/correspondances.ts`, appliquée aux trajets sans taxi et avec taxi avant la normalisation :

- une **traversée** commence à une marche de plus de 15 min (D3) encadrée par deux transports ; elle englobe les transports courts (20 min au plus) suivis d'une autre longue marche (Bercy → marche → RER → marche → Montparnasse = une seule traversée) ;
- chaque traversée est redemandée seule à MOTIS, à l'heure où elle commence ;
- un remplaçant est gardé s'il prend un transport, marche moins, arrive au moins 3 min avant le véhicule suivant et n'ajoute pas plus d'un transport ; on prend le plus simple (le moins de transports), puis le moins de marche ;
- au plus 8 traversées redemandées par liste ; une recherche ratée laisse la marche.
- Écarté : baisser `max_footpath_length` (contraire à D42, réimport des données) ; remplacer chaque marche à part (constaté : métro 14 + RER C + métro 4 + bus 91 au lieu du métro 6 direct).

## 4. Tests de régression

`serveur/src/itineraires/correspondances.test.ts` (6 tests) : repérage des traversées, regroupement de deux marches séparées par un RER court, métro direct préféré à une chaîne, aucun remplaçant trop tard ou sans transport, recherche ratée sans effet.

## 5. Constaté sur le téléphone (2026-11-05, par Claude via `adb`, captures hors dépôt)

- Domicile → le village de l'Orne, jeudi 12/11, partir à 15:00 : TER K7 → Paris Bercy 18:27, marche 5 min, **métro 6** Bercy → Montparnasse 18:33 → 18:47, marche 2 min, TER 19:43 → Flers. Verdict « Nuit dehors » (aucun trajet du jour à partir de 15:00 ; le car de Flers part le vendredi).
- Retour Gifi Joigny → Domicile à 17:00 : inchangé (TER puis taxi, arrivée 18:07).
- Constats annexes corrigés dans la même branche : « TER TER » (nom de ligne égal au nom du mode, GTFS Nomad) s'écrit « TER » ; un trajet avec taxi qui laisse quand même une nuit dehors n'est plus montré (D80 complétée).
