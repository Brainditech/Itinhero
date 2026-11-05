# Spec 18 — Lieux suggérés pendant la frappe

- **Date** : 2026-11-05
- **État** : **approuvée par Brainditech le 2026-11-05 (« implemente »), avec une demande en plus : supprimer l'écran « C'est ce lieu » (« c'est moche »).** Appliquée, voir §10. **Complément §12 (icônes selon le transport, doublons écartés, D92) approuvé le 2026-11-05 (« vas y démerde toi pour que tout s'embranche parfaitement »), appliqué et constaté sur le téléphone (§12.5, §12.6).**
- **Branche** : `phase-2/autosuggestion-lieux`
- **Maquettes** : `design/accueil/02-formulaire-repli.png` (formulaire). La maquette `design/confirmation-lieu/03-confirmation-lieu.png` n'est plus suivie : l'écran disparaît (D91). Écart voulu, décrit en §4.
- **Demande de Brainditech (2026-11-05)** : « lorsque je tape un endroit il faut que je saisisse également l'arrivée avant qu'il corrige la première adresse ; lorsque je reviens après validation du lieu, ça ne modifie pas la zone de texte, ça remet le texte initial alors que valider le lieu devrait justement rectifier ; je voudrais plutôt une autosuggestion pour éviter un aller-retour », puis « supprime la suggestion avec le c'est ce lieu, car c'est moche ».
- **Décisions** : D90, D91 (acceptées le 2026-11-05) ; D78 révisée. **Invariants** : 2, 6, 8, 9, 10.

## 1. But

Choisir le départ et l'arrivée **pendant qu'on les tape**, dans une liste de lieux sous le champ, comme dans les applications de trajet courantes. Un lieu choisi dans la liste est retenu tout de suite et s'écrit dans le champ. L'écran de Confirmation (« C'est ce lieu ») disparaît : quand un texte tapé reste ambigu à « Chercher », c'est la même liste qui s'ouvre sous son champ.

## 2. Ce qui est constaté (2026-11-05, dans le code)

- Les lieux ne sont cherchés qu'à l'appui sur « Chercher » (`useDeroulerRecherche`, `src/recherche.tsx`) : le départ d'abord, puis l'arrivée près du départ choisi (D78). D'où le constat de Brainditech : l'arrivée doit être remplie avant que le départ soit corrigé, puisque « Chercher » refuse un champ vide.
- **Défaut** : « C'est ce lieu » retient le candidat dans la recherche en mémoire (`recherche[cote].lieu`), mais rien ne le reporte dans les champs du formulaire (`formulaire.tsx`, état `champs`). Revenir au formulaire montre le texte d'origine, et une nouvelle recherche repasse par la Confirmation. Corrigé ici (§4.3) au lieu d'une issue à part : la même mécanique (un bout « lieu choisi ») règle les deux.
- `GET /v1/lieux?q=&proche=` rend déjà jusqu'à 10 candidats classés (IGN + MOTIS, D60 ; catégories autour de `proche`, D61), au moins 2 caractères. **Aucun changement côté serveur.**
- Chaque appel compte dans la limite de débit par clé (`LIMITE_REQ_MINUTE`, `LIMITE_REQ_JOUR`, D56), valeurs choisies par Brainditech dans le `.env` (que Claude ne lit pas).
- `detailCandidat` (`src/domaine/resultat.ts`) écrit déjà la ligne « Adresse, Joigny, 89300 · à 2,4 km » ; elle sert pour les suggestions.

## 3. Décisions

- **D90 — Lieux suggérés pendant la frappe (révise D78).** Dans un champ Départ ou Arrivée qui a le clavier, dès 3 caractères (espaces de bord retirés), 350 ms après la dernière touche, l'app appelle `GET /v1/lieux` avec `proche` = l'autre bout s'il est un lieu connu (lieu choisi, ou domicile lu sur le téléphone), sinon la position si l'accès est déjà accordé (sans le demander), sinon rien. Les 5 premiers candidats s'affichent sous le champ ; seule la réponse au dernier texte tapé est montrée. Un toucher sur un candidat le retient pour ce bout.
  - Raison : un débutant voit tout de suite si le lieu est le bon, sans aller-retour, et peut choisir le départ avant d'avoir rempli l'arrivée.
  - Options écartées : chercher à chaque touche, sans attente (un appel par lettre, limite de débit vite atteinte) ; la route `/completion` de l'IGN en plus (elle ne connaît ni les arrêts ni les commerces, et ferait un second classement à côté de D60) ; une liste flottante au-dessus du clavier (cache le champ suivant et le bouton, plus dur à lire avec TalkBack).
- **D91 — Un lieu retenu s'écrit dans son champ ; plus d'écran de Confirmation.** Un bout peut être un **lieu choisi** : nom, point, nature (adresse, lieu, arrêt), commune, code postal. Le champ montre alors le nom, et dessous sa ligne de détail. Modifier une lettre en refait un simple texte (le lieu est oublié). ⇅ l'échange comme les autres bouts. À « Chercher », un lieu choisi n'est plus cherché. Un texte tapé sans rien choisir est cherché à « Chercher » (D78) : un seul lieu ⇒ retenu et écrit dans le champ ; plusieurs ⇒ la liste s'ouvre sous ce champ avec « Choisissez le lieu dans la liste. » ; aucun ⇒ le message actuel.
  - Raison : ce qu'on voit dans le champ est ce qui sera cherché ; un écran de plus pour choisir parmi les mêmes candidats est un aller-retour (demande de Brainditech).
  - Options écartées : garder l'écran de Confirmation pour les textes ambigus (refusé par Brainditech) ; prendre d'office le premier candidat d'un texte ambigu (risque de partir du mauvais Joigny sans le voir) ; réécrire seulement le texte du champ (la recherche suivante repasserait par `/v1/lieux`) ; une étiquette non modifiable comme « ⌂ Domicile » (on ne peut plus corriger une lettre).

## 4. Ce qui est construit

### 4.1 Formulaire : la liste sous le champ

```
Départ   [ gare d'aux|                 ⌂  ◎ ]
         ┌─────────────────────────────────┐
         │ ⓜ Gare d'Auxerre-Saint-Gervais   │
         │   Arrêt, Auxerre · à 38 km       │
         │ ⌖ Gare, Auxerre                  │
         │   Auxerre, 89000 · à 38 km       │
         │ …                                │
         └─────────────────────────────────┘
                                              ⇅
Arrivée  [ ⌂ Domicile                  ⌂  ◎ ]
```

- La liste s'ouvre sous le champ qui a le clavier, dans la carte du formulaire (elle pousse les champs suivants vers le bas ; la liste du formulaire défile si besoin). Un seul champ à la fois.
- Chaque ligne : icône selon la nature (arrêt, adresse, lieu), le nom, la ligne de `detailCandidat`. Hauteur 48 dp au moins. Rôle « bouton », lu « Gare d'Auxerre-Saint-Gervais, Arrêt, Auxerre, à 38 km ».
- Toucher une ligne : le bout devient ce lieu choisi (D91), la liste se ferme, le clavier se ferme.
- Pendant l'attente de la réponse : la liste précédente reste affichée (pas de clignotement) ; s'il n'y en a pas, une ligne « Recherche… ».
- Aucun candidat : « Aucun lieu trouvé pour « … ». Essayez avec la commune. » (indication, pas une erreur).
- Échec (réseau coupé, serveur arrêté, limite atteinte, délai dépassé, clé refusée) : « Suggestions indisponibles pour l'instant. » ; le texte reste cherchable à « Chercher », qui dira l'erreur comme aujourd'hui (et ouvre l'écran de la clé si elle est refusée).
- La liste se ferme quand le champ perd le clavier, quand le texte repasse sous 3 caractères, ou quand un lieu est choisi.
- TalkBack annonce le nombre de lieux proposés quand la liste change (`accessibilityLiveRegion="polite"`).

### 4.2 Formulaire : le champ d'un lieu choisi

```
Départ   [ Gare d'Auxerre-Saint-Gervais ⌂  ◎ ]
           Arrêt, Auxerre
```

- Le champ reste un texte modifiable qui montre le nom ; la ligne de détail est sous le champ (sans distance : elle dépend de l'autre bout, qui peut changer).
- Taper une lettre : le bout redevient un texte (avec ce qui est écrit), la ligne de détail disparaît, les suggestions reprennent.

### 4.3 « Chercher »

- Un lieu choisi est retenu tel quel, comme le domicile ou la position : pas d'appel à `/v1/lieux`.
- Un texte non choisi suit D78 (le départ d'abord, `proche` = l'autre bout), puis D91 : un seul candidat ⇒ retenu **et écrit dans le champ** ; plusieurs ⇒ la liste s'ouvre sous ce champ (sans clavier) avec « Choisissez le lieu dans la liste. » en message, et la recherche s'arrête là ; aucun ⇒ message actuel.
- Deux lieux choisis à moins de 50 m l'un de l'autre ⇒ « Le départ et l'arrivée sont le même lieu. » sous l'Arrivée (message existant).
- L'écran `confirmation.tsx` et sa route `/confirmation` sont supprimés.

### 4.4 Domaine, testé sous Node

- `src/domaine/demande.ts` : `schemaBout` gagne `{ type: "lieu"; nom; lat; lon; nature; commune?; code_postal? }` (Zod, invariant 9) ; `validerFormulaire` l'accepte et applique « même lieu » à moins de 50 m.
- `src/domaine/suggestions.ts` (nouveau) : `texteASuggerer(bout)` (3 caractères au moins, rien pour un lieu choisi, le domicile ou la position) ; `boutDuCandidat(candidat)` ; `candidatDuBout(bout)` ; `etatSuggestions(resultat, texte)` ; `reporterLieu(champs, cote, texteCherche, lieu)` (texte inchangé ⇒ lieu choisi ; texte modifié entre-temps ⇒ rien) ; `Derniere` : ignore une réponse arrivée après une plus récente.
- `src/domaine/resultat.ts` : `nomBout` et `adresseBout` pour un lieu choisi ; `sousTitreDemande` (Confirmation) supprimé.
- `src/recherche.tsx` : `lieuFixe` rend directement un lieu choisi ; plus de Confirmation ni de `confirmer`.
- `src/composants/elements.tsx` : `ChampLieu` gagne la liste de suggestions et la ligne de détail ; le hook `useSuggestionsLieu` (`src/composants/`) fait l'attente et l'appel.

## 5. Fichiers touchés

`src/domaine/demande.ts`, `suggestions.ts` (nouveau), `resultat.ts` (+ tests), `src/recherche.tsx`, `src/composants/elements.tsx`, `src/composants/useSuggestionsLieu.ts` (nouveau), `src/app/(onglets)/(chercher)/formulaire.tsx`, `confirmation.tsx` (supprimé) ; `PLAN.md` (phase 2), `docs/ETAT.md`, `docs/decisions/0001-cadrage-v1.md` (D90, D91, renvoi dans D78). Aucune dépendance ajoutée, aucun module natif : un rechargement du development build suffit.

## 6. Sécurité, vie privée, débit

- Ce qui part est de même nature qu'aujourd'hui (un texte et un point `proche` vers l'API, puis vers l'IGN et MOTIS), mais **plus souvent et en morceaux** (« gare d'au », « gare d'aux… »). Le serveur ne garde ni le texte ni le point (invariant 6) et ne les journalise pas (invariant 10) : la route ne change pas. L'app n'appelle que l'API Itinhero (invariant 2), avec la clé d'appareil (invariant 8).
- Débit : avec 350 ms d'attente et 3 caractères au moins, taper « tribunal administratif dijon » d'un trait fait 1 à 3 appels, en hésitant 5 à 8. **À vérifier par Brainditech** : `LIMITE_REQ_MINUTE` doit laisser au moins une trentaine d'appels par minute ; sinon les suggestions se taisent (« Suggestions indisponibles »), sans bloquer « Chercher ».
- L'IGN accepte 50 requêtes par seconde par adresse IP (D60) : sans effet pour un seul téléphone ; à revoir avant la phase 10 (VPS, plusieurs utilisateurs derrière la même IP du serveur).

## 7. Critères d'acceptation

1. Tests : `texteASuggerer` : rien sous 3 caractères (« au », « a  » avec espaces) ; « gar » ⇒ « gar » ; rien pour Domicile, Ma position, un lieu choisi.
2. Tests : `boutDuCandidat` garde nom, point, nature, commune, code postal ; un lieu choisi passe le schéma Zod ; `echangerBouts` échange un lieu choisi.
3. Tests : `validerFormulaire` accepte un lieu choisi des deux côtés, et refuse deux lieux choisis à moins de 50 m (« même lieu »).
4. Tests : `reporterLieu` : texte inchangé ⇒ lieu choisi ; texte modifié depuis ⇒ inchangé ; Domicile et position ⇒ inchangés.
5. Tests : `etatSuggestions` (5 au plus, aucun, échec) ; une réponse arrivée après une plus récente est ignorée.
6. Tests : `nomBout` et `adresseBout` d'un lieu choisi.
7. Sur le téléphone : taper « tribunal adm » dans l'Arrivée ⇒ une liste en une seconde environ, le tribunal administratif de Dijon dedans ; le toucher ⇒ le champ montre son nom et sa ligne de détail ; « Chercher » ⇒ Résultat directement.
8. Sur le téléphone : départ « gare d'auxerre » choisi dans la liste **avant** de remplir l'arrivée ; puis arrivée « Joigny » : la liste propose Joigny près d'Auxerre.
9. Sur le téléphone : un texte ambigu tapé sans rien choisir, puis « Chercher » ⇒ la liste s'ouvre sous ce champ avec « Choisissez le lieu dans la liste. », aucun autre écran ; un lieu touché ⇒ écrit dans le champ ; « Chercher » ⇒ Résultat.
10. Sur le téléphone : serveur arrêté ⇒ « Suggestions indisponibles pour l'instant. » sous le champ, la saisie continue ; TalkBack lit chaque ligne. Capture côte à côte avec la maquette 02, écart accepté par Brainditech.
11. Cinq recherches comparées aux suggestions de Google Maps (deux adresses, une gare, un lieu, une catégorie comme « pharmacie ») : le bon lieu dans les 5 proposés.
12. `npx expo lint`, `npx tsc --noEmit`, `npm test` verts.

## 8. Ce qui n'est pas fait ici

Les lieux récents ou favoris proposés avant la frappe ; les suggestions hors ligne ; la phrase de l'Accueil comprise par Claude (phase 1) ; le choix d'un point sur la carte ; une limite de débit propre aux suggestions côté serveur (à voir en phase 9 si l'usage le demande).

## 9. Étapes de vérification

`npm test`, `npx expo lint`, `npx tsc --noEmit` ; puis Brainditech vérifie `LIMITE_REQ_MINUTE` (§6), recharge l'app et refait les critères 7 à 11 sur le téléphone (Claude peut piloter par `adb` et comparer dans le navigateur, à sa demande).

## 10. Ce qui a été appliqué (2026-11-05)

- `src/domaine/demande.ts` : `schemaBoutLieu` (bout « lieu choisi »), `MEME_LIEU_METRES` ; « même lieu » pour deux lieux choisis à moins de 50 m.
- `src/domaine/suggestions.ts` (nouveau) : `texteASuggerer`, `boutDuCandidat`, `candidatDuBout`, `etatSuggestions`, `enAttente`, `annonceSuggestions`, `Derniere`, `reporterLieu`, messages.
- `src/domaine/resultat.ts` : `nomBout` d'un lieu choisi ; `sousTitreDemande` supprimé avec la Confirmation.
- `src/recherche.tsx` : un lieu choisi est retenu sans réseau ; un texte à un seul lieu est retenu et remonté au formulaire (`SurLieuRetenu`) ; plusieurs ⇒ échec avec `candidats` ; `confirmer` supprimé.
- `src/composants/useSuggestionsLieu.ts` (nouveau) : attente de 350 ms, `proche` de D90, dernière réponse seule. L'annulation par `AbortController` prévue en §4.4 n'a pas été faite : une réponse dépassée est ignorée (`Derniere`), ce qui suffit.
- `src/composants/elements.tsx` : `ChampLieu` (lieu choisi modifiable, ligne de détail, début du nom visible sans le clavier) et `ListeSuggestions`.
- `formulaire.tsx` : suggestions des deux champs, liste imposée par « Chercher », ⇅ qui ne chevauche pas une liste ouverte ; `confirmation.tsx` supprimé.
- Vérifié : `npm test` (224 tests, dont 15 pour `suggestions.ts`), `npx tsc --noEmit`, `npx expo lint` verts.

## 11. Constaté sur le téléphone (2026-11-05, par Claude via `adb`, captures hors dépôt, D38)

- **Critère 7 — rempli.** « tribunal adm » ⇒ liste en moins de 3 s (Tribunal Administratif / Melun, arrêt ; Tribunal administratif, Dijon, 21000, à 130 km ; …) ; le toucher ⇒ « Tribunal administratif », « Dijon, 21000 » dessous ; « Chercher » ⇒ Résultat directement (Domicile → Tribunal administratif, « Possible », départ 06:18).
- **Critère 8 — rempli.** Départ « gare auxerre » tapé après une arrivée choisie (la Gare, Seignelay) : distances comptées depuis Seignelay (« à 12 km »), Gare d'Auxerre-Saint-Gervais choisie ; « Chercher » ⇒ Résultat directement (bus 02 + taxi, 09:18 → 09:47).
- **Critère 9 — rempli.** « gare » tapé sans choisir, « Chercher » ⇒ « Choisissez le lieu dans la liste. » en rouge sous l'Arrivée, 5 lieux dessous, aucun autre écran ; « la Gare » touchée ⇒ écrite dans le champ avec « Seignelay, 89250 ».
- Une lettre retirée d'un lieu choisi (« la Gar ») ⇒ redevient un texte, la ligne de détail disparaît, les suggestions reprennent.
- Corrigé pendant l'essai : ligne de détail coupée (« à … ») ⇒ deux lignes ; nom long affiché par sa fin (« d'Auxerre-Saint-Gervais ») ⇒ par son début quand le champ n'a pas le clavier ; ligne de détail alignée sur le texte du champ.
- **Critère 10 — en partie.** Le tunnel `adb reverse` coupé pendant la frappe n'a pas fait apparaître « Suggestions indisponibles » de façon sûre (connexion déjà ouverte gardée) ; le cas est couvert par les tests de `etatSuggestions`. Restent : serveur vraiment arrêté, TalkBack, capture côte à côte avec la maquette 02, par Brainditech.
- **Critère 11** : à faire (comparaison avec Google Maps).

## 12. Complément : une icône qui dit ce qu'est le lieu (approuvé le 2026-11-05)

- **Demande de Brainditech (2026-11-05)** : « des icônes pour adresse et métro pour les métros ou gare ».
- **Constaté** : la liste montre une icône par nature (`ICONE_NATURE`, `elements.tsx`) : `directions_transit` pour **tout** arrêt (métro, gare, simple arrêt de bus), `signpost` pour une adresse, `location_on` pour un lieu. On ne distingue donc pas Châtelet (métro) de « Rue de la Gare » (bus).
- **Constaté contre le MOTIS local (v2.11.4, données nationales)** : `/api/v1/geocode` rend pour chaque arrêt la liste `modes` des transports qui le desservent. Exemples : Châtelet, Paris ⇒ `SUBWAY, BUS` ; Gare de Lyon, Paris ⇒ `REGIONAL_RAIL, SUBWAY, BUS` ; Auxerre Saint-Gervais ⇒ `REGIONAL_RAIL, BUS` ; DIJON Gare ⇒ `REGIONAL_RAIL, TRAM, BUS` ; Rue de la Gare, Pusignan ⇒ `BUS` ; Domer - Garibaldi, Lyon ⇒ `[]`. Aujourd'hui le serveur jette ce champ (`schemaMatch`, `serveur/src/lieux/motis-geocode.ts`).

### D92 — Icône d'un arrêt selon le transport le plus lourd qui le dessert (acceptée ; écarts d'application en §12.5)

- Le serveur garde `modes` des arrêts MOTIS et rend dans chaque candidat de `GET /v1/lieux` un champ **`transport`** : `"train"`, `"metro"`, `"tram"`, `"car"`, `"bus"`, `"bateau"`, ou absent (adresse, lieu, arrêt sans mode connu). Le plus lourd l'emporte, dans cet ordre : train (`RAIL`, `HIGHSPEED_RAIL`, `LONG_DISTANCE`, `NIGHT_RAIL`, `REGIONAL_FAST_RAIL`, `REGIONAL_RAIL`, `SUBURBAN`) > métro (`SUBWAY`) > tram (`TRAM`) > car (`COACH`) > bus (`BUS`, `ODM`) > bateau (`FERRY`). Un mode inconnu est ignoré (le schéma Zod ne refuse pas la réponse pour autant).
- L'app choisit l'icône (Material Symbols, déjà utilisés par `expo-symbols`) :

  | Candidat | Icône | Exemple |
  |---|---|---|
  | arrêt `train` | `train` | Auxerre Saint-Gervais, Gare de Lyon |
  | arrêt `metro` | « M » en gras (§12.5) | Châtelet, Pré-Saint-Gervais |
  | arrêt `tram` | `tram` | arrêt de tram seul |
  | arrêt `car` ou `bus` | `directions_bus` | Rue de la Gare, Pusignan |
  | arrêt `bateau` | `directions_boat` | |
  | arrêt sans `transport` | `directions_transit` (comme aujourd'hui) | Domer - Garibaldi |
  | adresse | `home_pin` (repère avec une maison) | 3 rue de la Gare, Joigny |
  | lieu (commune, monument, commerce) | `location_on` (comme aujourd'hui) | Tribunal administratif, Dijon |

- La ligne de détail, écrite et lue, dit ce qu'est le lieu : « Gare, Auxerre, 89000 · à 38 km » ; « Métro, Paris, 75004 » ; « Arrêt de bus, … » ; « Adresse, … » (§12.5). TalkBack lit le nom puis cette ligne.
- Le lieu choisi garde son `transport` (bout « lieu choisi », `schemaBoutLieu`), pour que l'icône reste la même si la liste se rouvre.
- Raison : un débutant reconnaît d'un coup d'œil la gare ou la station de métro parmi des homonymes, sans lire la ligne de détail.
- Options écartées : une icône par mode, plusieurs côte à côte (illisible sur 48 dp, et Gare de Lyon en aurait trois) ; deviner le mode depuis le nom (« Gare », « Métro ») (faux pour « Rue de la Gare », arrêt de bus) ; le pictogramme officiel de chaque réseau (logos des opérateurs, droits et cohérence) ; `signpost` pour l'adresse (lu comme un panneau de direction, pas comme une adresse).

### Ce qui est construit en plus

- Serveur : `schemaMatch` lit `modes` (facultatif) ; `transportDesModes(modes)` (pur, testé) ; `Candidat.transport` facultatif ; la réponse de `/v1/lieux` le transmet (les candidats de l'IGN et d'OSM n'en ont pas). Aucune donnée de plus envoyée ni gardée (invariants 6 et 10).
- App : `schemaCandidat` (`src/domaine/api.ts`) et `schemaBoutLieu` acceptent `transport` facultatif ; `iconeCandidat(candidat)` et `natureLue(candidat)` dans `src/domaine/suggestions.ts` (purs, testés) ; `ListeSuggestions` et le libellé lu s'en servent.
- Aucune dépendance ni module natif ajoutés.

### Critères d'acceptation en plus

13. Tests serveur : `transportDesModes` : `REGIONAL_RAIL, SUBWAY, BUS` ⇒ `train` ; `SUBWAY, BUS` ⇒ `metro` ; `REGIONAL_RAIL, TRAM, BUS` ⇒ `train` ; `BUS` ⇒ `bus` ; `[]` ou absent ⇒ rien ; un mode inconnu seul ⇒ rien. Une réponse MOTIS enregistrée avec `modes` donne `transport` dans `/v1/lieux`.
14. Tests app : `iconeCandidat` rend l'icône du tableau pour chaque ligne ; `natureLue` rend « Gare », « Métro », « Tram », « Arrêt de car », « Arrêt de bus », « Arrêt », « Adresse », « Lieu » ; un ancien candidat sans `transport` passe toujours le schéma.
15. Sur le téléphone : « chatelet » ⇒ Châtelet, Paris avec l'icône métro ; « auxerre saint » ⇒ la gare avec l'icône train ; « 3 rue de la gare joigny » ⇒ icône adresse ; « rue de la gare » ⇒ arrêts de bus avec l'icône bus.
16. Tests serveur : doublons écartés (§12.5) : « Basilique de Saint-Denis » = « Basilique Saint-Denis » à 35 m ; « Châtelet » deux fois dans le 1er à 210 m ⇒ une fois ; la commune donnée quatre fois ⇒ une fois, l'arrêt du même nom gardé ; la gare de l'IGN et l'arrêt de MOTIS du même nom ⇒ une fois, même dans deux arrondissements ; le monument et la station de métro du même nom ⇒ deux ; même nom dans deux communes, ou à 1 km dans la même ⇒ deux.

### 12.5 Ce qui a été appliqué (2026-11-05), avec les écarts constatés en essayant

- Serveur, `motis-geocode.ts` : `modes` lu (facultatif) ; `transportDesModes` ; `Candidat.transport`.
- Serveur, `ign-geocode.ts` :
  - **En plus** : `transportDesCategories` donne aussi un transport aux gares de la BD TOPO (`category` de l'IGN : « gare voyageurs… » ⇒ train, « gare routière » ⇒ car, « station de métro » ⇒ métro). Sans cela, « Gare d'Auxerre-Saint-Gervais », que seule l'IGN rend, gardait l'icône d'un lieu.
  - **En plus, doublons écartés** (constaté sur le téléphone : « saint michel sur orge » ⇒ 5 lignes, toutes la commune ou presque). Deux candidats sont le même lieu : noms proches à moins de 80 m (règle d'avant), noms comparés sans les petits mots (« de », « la ») ; même nom à moins de 300 m s'ils sont tous deux desservis par un transport, ou de même nature dans la même commune ; la commune elle-même à moins de 5 km.
  - **En plus, classement** : le bonus de 0,2 du nom exact vaut aussi pour un arrêt (« gare de lyon » : la gare avant son parking) ; un transport lourd ajoute 0,15 (train, métro) ou 0,06 (tram). Depuis l'Yonne, « chatelet » montre le métro de Paris en 4e, après le lieu-dit voisin et deux arrêts de bus que MOTIS place lui-même devant (rang de MOTIS compté dans la note) : laissé tel quel, il est dans les 5.
- App, `api.ts`, `demande.ts` : `transport` facultatif dans le candidat et le lieu choisi ; une valeur inconnue est oubliée (`.catch`), le candidat reste valable.
- App, `suggestions.ts` : `iconeCandidat`, `natureLue`. **Écart** : le métro est un « M » en gras dans le rond, pas le pictogramme `subway`, qui se confondait avec le bus à 22 dp sur le téléphone.
- App, `resultat.ts`, `detailCandidat` : **écart** : la ligne de détail écrite dit ce qu'est le lieu (« Gare, Paris, 75012 », « Métro, Paris, 75004 », « Arrêt de bus, … », « Adresse, … ») au lieu de « Arrêt » pour tous, et ne redit pas la commune sous un lieu qui porte son nom (« Saint-Michel-sur-Orge » ⇒ « 91240 · à 120 km »). Le libellé lu par TalkBack est le nom puis cette ligne (« Joigny, Gare, 89300, à 17 km »).
- App, `elements.tsx` : `IconeDuLieu`, rond de 48 dp (`h-12 w-12`, la taille des autres boutons ronds ; `h-10` n'était pas produit par NativeWind et le rond suivait son contenu) ; ligne de détail sur 3 lignes au plus (« à 66 km » était coupé).
- Vérifié : serveur 221 tests, app 229 tests, `tsc` et `expo lint` verts.

### 12.6 Constaté sur le téléphone (2026-11-05, par Claude via `adb`, captures hors dépôt, D38)

- « gare de lyon » ⇒ Gare de Lyon (Paris), Paris-Gare-de-Lyon, Lyon Part-Dieu, Lyon Perrache : icône train, « Gare, … » ; la station de métro de l'IGN du même nom n'apparaît plus en double.
- « chatelet » ⇒ Châtelet, Paris avec le « M », « Métro, Paris, 75004 » ; arrêts de bus de Montereau et Corquilleroy avec l'icône bus. Touché ⇒ le champ montre « Châtelet », « Métro, Paris, 75004 » dessous.
- « 3 rue de la gare joigny » ⇒ icône adresse. **Limite connue, antérieure à ce complément** (même classement avant) : l'IGN n'a pas de n° 3 rue de la Gare à Joigny (89), seulement la rue ; le « 3 » tapé fait passer les adresses numérotées de Joigny-sur-Meuse devant. À traiter à part si Brainditech le juge utile.
- « joigny » tapé sans choisir, « Chercher » ⇒ « Choisissez le lieu dans la liste. » sous l'Arrivée, Joigny (commune, une seule fois) puis Joigny (Gare, icône train) ; aucun autre écran ; la gare touchée, « Chercher » ⇒ Résultat directement (« Possible », départ 06:18).
- Saint-Michel-sur-Orge (arrêt) → Basilique de Saint-Denis ⇒ Résultat « Possible » (07:49 → 09:03) ; l'API n'a jamais redémarré (issue 0020).
- Reste du critère 10 (TalkBack, serveur arrêté, capture côte à côte avec la maquette 02) et critère 11 (comparaison avec Google Maps) : par Brainditech.
