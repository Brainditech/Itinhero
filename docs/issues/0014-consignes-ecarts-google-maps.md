# Issue 0014 — Consignes de marche : écarts avec Google Maps

- **Date** : 2026-11-05
- **État** : causes vérifiées, **analyse à approuver** par Brainditech avant correction.
- **Branche** : `phase-4/consignes-de-marche` (PR #19, spec 11). La PR attend la correction.

## 1. Reproduction

Critère 4 de la spec 11 (§11) : 5 marches de la boucle de comparaison (spec 09 §11), MOTIS national du PC, comparées à Google Maps à pied, mêmes coordonnées. Morceaux bruts relus par `/api/v6/plan?directModes=WALK&transitModes=&detailedLegs=true` entre les mêmes points.

| Marche | Ce qu'Itinhero dit | Google Maps |
|---|---|---|
| Saint-Charles → Vieux-Port, Marseille | « À gauche cours Jean Ballard », puis **« Faites demi-tour »**, puis « à droite » | « À gauche cours Jean Ballard », arrivée |
| Roubaix, Grand-Place → La Piscine | **« Continuez tout droit avenue Jean Lebas »** | « Prenez à droite avenue Jean Lebas » |
| Saint-Florentin-Ville → gare | « Légèrement à droite N 77 », puis **« Continuez tout droit avenue du 19 Mars 1962 »** | « Prenez à droite avenue du 19 Mars 1962/N77 » |
| Auxerre, rue Paul-Doumer → avenue Pierre-Scherrer | **« Tournez à droite » sur 583 m sans nom de rue** | « Légèrement à gauche avenue de la Tournelle » |
| Trocadéro → tour Eiffel | après le pont, **virages sans nom** le long du quai | « À droite quai Jacques-Chirac » |

## 2. Causes (vérifiées sur les morceaux bruts)

### 2.1 « Demi-tour » fabriqué par la fusion de deux virages (Marseille)

Morceaux : cours Jean Ballard au cap 164°, rue Saint-Saëns au cap 251° sur **21 m**, puis un chemin sans nom au cap 344°. Ce sont deux vrais virages à droite (+87° puis +93°). La règle « deux manœuvres à moins de 25 m n'en font qu'une » (seuil ajouté à D71) les fond en une seule, mesurée avant la première et après la seconde : 164° → 344° = 180°, d'où « demi-tour ».

Hypothèse écartée : un tracé de MOTIS qui revient sur ses pas. Ici, il ne revient pas : il fait le tour d'un pâté de maisons.

### 2.2 Le virage placé quelques mètres avant le coin (Roubaix)

Morceaux : Grand Place au cap 260°, puis quatre bouts de 7, 7, 3 et 6 m **toujours sur Grand Place**, puis avenue Jean Lebas au cap 303° (+43°, « légèrement à droite »). La règle 1 de D71 rattache un morceau de moins de 10 m **au suivant**. Les 9 derniers mètres de Grand Place sont donc collés au début de l'avenue Jean Lebas, et le virage est mesuré 9 m avant le vrai coin. La fenêtre de 15 m n'y voit plus qu'environ 20°, d'où « tout droit ».

### 2.3 La même route sous deux noms (Saint-Florentin)

Morceaux : « N 77 » sur 1 137 m, puis « Avenue du 19 Mars 1962 », au même cap (188°). Dans OSM, certaines portions n'ont que le numéro (`ref`), d'autres ont aussi le nom. MOTIS rend le numéro quand le nom manque. Le changement de nom en ligne droite devient une consigne « Continuez tout droit », alors que la route ne change pas.

### 2.4 Trottoirs sans nom (Auxerre, Paris, Dijon)

Dans OSM, les trottoirs dessinés à part sont des chemins (`footway=sidewalk`) **sans nom**, et MOTIS les rend sans `streetName`. Le cas d'Auxerre fait 583 m sans nom, le long de l'avenue de la Tournelle. Le « Tournez à droite » vient de là : le trottoir part vers le nord sur 48 m avant de longer l'avenue. Itinhero n'invente aucun nom (spec 11, critère 3) : la consigne reste juste, mais elle n'a pas de nom.

### 2.5 Écarts qui ne sont pas des défauts

- **Demi-tours réels** : à Paris (rue de Rivoli), MOTIS dépasse le lieu, traverse et revient sur 12 m. À Monaco (chemin nommé « C » dans OSM), la rampe de la gare fait un lacet. Le tracé fait vraiment demi-tour, et la consigne le dit.
- **Chemins différents** : Lyon (Google évite les escaliers), Marseille (Noailles au lieu du boulevard d'Athènes), Saint-Florentin (début). C'est MOTIS qui choisit le chemin, pas les consignes.
- **Rue de la Gare à Saint-Florentin** : avec notre tracé (cap 188° puis 254°), le virage est bien à droite. Google suit une autre géométrie.

## 3. Corrections proposées (dans `serveur/src/itineraires/consignes.ts`, D71 complétée)

1. **Pas de fusion qui fabrique un demi-tour** : si deux virages à moins de 25 m donnent ensemble plus de 150°, on garde les deux. Exemple : « Tournez à droite rue Saint-Saëns », puis « Tournez à droite ».
2. **Un morceau court reste sur sa rue** : un morceau de moins de 10 m qui porte le même nom que le tronçon précédent est rattaché **au précédent**, pas au suivant. Le virage est alors mesuré au vrai coin.
3. **Numéro et nom d'une même route** : quand on continue tout droit (moins de 25°) d'un nom à un numéro de route, ou l'inverse, ce n'est pas une consigne. La consigne précédente prend les deux, par exemple « N 77 (avenue du 19 Mars 1962) ». Un numéro de route, c'est une lettre ou un sigle (A, N, D, M, RN, RD) suivi d'un nombre.
4. **Trottoirs sans nom** : pas de correction ici. MOTIS ne donne pas la rue longée. La retrouver demanderait une autre source (la rue d'OSM la plus proche, parallèle au trottoir), donc une décision à part. Je l'écris comme limite connue dans la spec 11.

## 4. Tests de régression prévus

Dans `serveur/src/itineraires/consignes.test.ts`, des morceaux réduits tirés des cas ci-dessus :

- deux virages à droite séparés de 21 m ⇒ deux consignes « droite », jamais « demi-tour » ;
- bouts courts de Grand Place avant l'avenue Jean Lebas ⇒ « légèrement à droite avenue Jean Lebas » ;
- « N 77 » puis « Avenue du 19 Mars 1962 », même cap ⇒ une seule consigne, nommée avec les deux ;
- un vrai demi-tour (aller 51 m, revenir 12 m) reste un « demi-tour ».

Puis on rejoue les 5 marches et on compare de nouveau à Google Maps (spec 11, critère 4).
