# Spec 25 — Une longue marche ne passe plus en tête

- **Date** : 2026-11-06
- **État** : **approuvée** par Brainditech le 2026-11-06 (« ok option A va, implement tout vas y »). Règle : D103.
- **Branche** : `phase-5/marche-longue-apres`.
- **Origine** : essai de la spec 21 sur le téléphone, « Domicile → Gifi Joigny 2 » : le trajet de 06:18, avec 48 min de marche, est en tête de « Arrivée la plus tôt » et le verdict « Possible · Départ 06:18 » s'appuie sur lui. Deux options proposées à Brainditech : côté téléphone (celle-ci) ou baisser la marche maximale du serveur (D42), qui ferait perdre des trajets de l'Yonne comme le car de Saint-Florentin vers la gare.
- **Case de PLAN.md** : aucune nouvelle. Complète la case « Tris : arrivée la plus tôt, moins de marche, sans réservation » (D97, spec 21).
- **Invariants** : 3 (aucune heure recalculée : on range seulement les possibilités reçues), 13 (le verdict reste celui du serveur : « Possible » seulement s'il a retenu au moins une possibilité).

## 1. But

Une marche de plus de 15 min est déjà signalée sur sa carte (D3, « ⚠ »). Mais quand un autre trajet convient aussi, celui avec la longue marche ne doit plus être celui qu'on montre en premier ni celui sur lequel s'appuie le verdict.

« Convient aussi » ne demande aucun calcul : le serveur ne renvoie que des possibilités retenues (en « Arriver avant », elles arrivent toutes au plus tard à l'heure du rendez-vous moins la marge ; en « Partir à », elles partent toutes le jour demandé, à l'heure ou après).

## 2. Doc lue

Aucune bibliothèque nouvelle : du TypeScript pur dans `src/domaine/`. Aucun build natif.

## 3. Décision D103

« Marche longue » = au moins une étape à pied de plus de 15 min (`aMarcheLongue`, D3, même seuil que l'avertissement).

### 3.1 Le verdict

La possibilité du verdict (D80) se choisit dans cet ordre, la première qui convient dans l'ordre du serveur :

1. sans nuit dehors, sans taxi, sans marche longue ;
2. sans nuit dehors, sans taxi ;
3. sans nuit dehors ;
4. la première.

Le reste de la phrase du verdict ne change pas.

### 3.2 Le tri « Arrivée la plus tôt » (et « Sans réservation », qui range comme lui)

Les trajets sans marche longue d'abord, rangés comme avant (arrivée la plus tôt, puis départ le plus tard, puis moins de correspondances, puis l'ordre du serveur) ; ensuite les trajets avec une marche longue, rangés de la même façon. Si tous ont une marche longue, l'ordre est celui d'avant.

« Moins de marche » ne change pas : il range déjà par minutes à pied.

### 3.3 Ce qui en découle sans autre code

- Le rectangle de Mes trajets montre la possibilité du verdict pour « Arrivée la plus tôt » (D101) : il suit la même règle.
- Rien ne disparaît : le trajet à longue marche reste dans la liste, avec son « ⚠ », et s'enregistre par sa disquette (D102).

## 4. Options écartées

- Baisser la marche maximale du serveur (D42, 50 min) : des trajets de l'Yonne disparaîtraient (Saint-Florentin-Ville → gare, 47,8 min).
- Retirer de la liste les trajets à longue marche : parfois c'est le seul, ou le seul à l'heure.
- Changer le libellé « Arrivée la plus tôt » : la carte garde ses heures et son « ⚠ », la raison se voit.

## 5. Critères d'acceptation

1. Verdict : avec un trajet de 06:18 (48 min de marche) et un autre plus tard sans marche longue, le verdict dit « Départ » de l'autre (test `resultat.test.ts`).
2. Verdict : si tous ont une marche longue, il s'appuie sur la première comme avant ; une nuit dehors reste évitée avant tout (tests).
3. Tri « Arrivée la plus tôt » : le trajet à longue marche passe après tous les autres, même s'il arrive le premier ; les autres gardent leur ordre (test `tri.test.ts`).
4. Tri « Sans réservation » : même règle (test).
5. Téléphone : « Domicile → Gifi Joigny 2 » : le premier trajet affiché et le verdict ne sont plus le 06:18 avec 48 min de marche (constat par adb).
