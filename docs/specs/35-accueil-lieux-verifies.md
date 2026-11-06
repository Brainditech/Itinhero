# Spec 35 — L'Accueil cherche les lieux de la phrase au lieu de les recopier

- **Date** : 2026-11-06
- **État** : **approuvée par délégation** de Brainditech (« rectifie aussi au passage […] il doit être plus intelligent et interpréter notre requête », 2026-11-06). Règle : D113. **Appliquée** sur `app/accueil-lieux-verifies`.
- **Branche** : `app/accueil-lieux-verifies`.
- **Case de PLAN.md** : aucune ; demandes de Brainditech consignées dans `docs/ETAT.md` (« Accueil qui recopie la phrase », « Flers pas compris comme un endroit précis », « Dates qui ne collent pas »).
- **Invariants** : 3 (Claude ne choisit aucun lieu : les lieux viennent de l'IGN et de MOTIS), 9 (le serveur contrôle la sortie de Claude), 10 (ni la phrase ni les lieux au journal).

## 1. But

Constaté le 2026-11-06 sur le téléphone de Brainditech : « je veux partir à flers » ouvre le formulaire avec « flers » recopié tel quel dans l'Arrivée. L'Accueil ne regarde pas si ce lieu existe : la recherche de lieux n'a lieu qu'au « Chercher » du formulaire, et la personne voit son texte, pas un lieu. Brainditech : « il faut qu'il vérifie quand même dans la base de données […] au lieu de taper la même chose que ce qu'on écrit ».

Constaté par Claude le même jour, en rejouant la fusion de `GET /v1/lieux` (IGN + MOTIS du PC) :

| Texte cherché | Premiers lieux trouvés |
|---|---|
| `flers` | gare de Flers (61100), commune de Flers (61100), Flers (80360), Flers (62270), arrêts de bus de Villeneuve-d'Ascq… |
| `flers basse normandie` | « Urssaf Basse-Normandie » (Saint-Lô), « La Basse Anerie », « La Basse Morinière »… : aucun Flers |
| `Rendez-vous Joigny` (valeur du formulaire) | arrêt « Rendez-Vous Bus » à Louviers, à 225 km |

Le lieu existe donc dans les données ; deux choses manquent : chercher le lieu dès l'Accueil, et ne pas laisser une région ou un département précisé dans la phrase faire dérailler la recherche.

Troisième constat (même capture du 2026-11-06) : la phrase sans aucune date a donné un trajet daté du lundi 28/12. La spec 28 demande à Claude `date: null` quand aucun jour n'est dit, mais le serveur ne le vérifiait pas.

## 2. Doc et code lus

- `serveur/src/comprendre/comprendre.ts` (invite, schémas), `serveur/src/routes/comprendre.ts`, `serveur/src/routes/lieux.ts`, `serveur/src/lieux/ign-geocode.ts` (`fusionner`).
- App : `src/app/(onglets)/(accueil)/index.tsx`, `formulaire.tsx`, `src/recherche.tsx` (`useDeroulerRecherche`, D78, D91), `src/domaine/suggestions.ts`, `src/domaine/comprendre.ts`.
- Liste des régions (actuelles et d'avant 2016) et des départements : code officiel géographique de l'Insee (connu, stable ; recopié dans `src/domaine/zones.ts`).

## 3. Décision D113

1. **Claude sépare le lieu de sa précision.** `lieu_texte` (et `depart_texte`) : le lieu sans la région, l'ancienne région, le département ou le pays dits pour le préciser. Deux champs nouveaux, `lieu_zone` et `depart_zone` : cette précision telle que dite (« Basse-Normandie », « Orne », « 61 »), null sinon. Claude ne l'ajoute jamais lui-même (invariant 3 : il ne choisit pas le lieu).
2. **Le serveur ignore une date que la phrase ne dit pas** (invariant 9) : la date de Claude n'est gardée que si la phrase contient un jour (nom de jour, « demain », « après-demain », « aujourd'hui », « ce soir », « ce matin », « ce midi », « cet après-midi », « prochain », « semaine », un nom de mois, un nombre de 1 à 31 précédé de « le » ou une date en chiffres). Sinon `date: null`, et le formulaire prend aujourd'hui (spec 28).
3. **L'Accueil cherche chaque lieu compris** par `GET /v1/lieux`, près du domicile (départ Domicile) ou de la position si son accès est déjà accordé (même règle que D78), avant d'ouvrir le formulaire. Avec une zone, seuls les lieux dont le code postal est dans un de ses départements sont gardés ; si aucun ne l'est, ou si la zone n'est pas reconnue, la liste reste entière.
   - **un seul lieu** ⇒ il est écrit dans le champ (comme au « Chercher » du formulaire, D91) ;
   - **plusieurs** ⇒ le texte reste, la liste des lieux (5 au plus) est déjà ouverte sous le champ avec « Choisissez le lieu dans la liste. » ;
   - **aucun** ⇒ le texte reste, avec « Aucun lieu trouvé pour « … ». Essayez avec la commune. » sous le champ ;
   - **recherche impossible** (réseau, serveur) ⇒ le texte reste, sans message : le « Chercher » du formulaire refera la recherche.
   Le bouton de l'Accueil dit « Recherche des lieux… » pendant ce temps.
4. Rien n'est choisi d'office quand il y a plusieurs lieux (D91 inchangée) : la personne voit de vrais lieux (« Gare, Flers, 61100 ») au lieu de son texte.
5. **« Partir à » passé de 30 min au plus ⇒ on part maintenant** (`validerFormulaire`). Constaté pendant l'essai : une phrase sans heure met « Partir à » l'heure de l'ouverture du formulaire ; deux minutes plus tard, « Chercher » refusait avec « Cette heure est passée. ». Au-delà de 30 min, ou pour un rendez-vous (« Arriver avant »), l'erreur reste.

## 4. Options écartées

- **Viser d'office la gare quand on n'écrit qu'un nom de ville** : un rendez-vous en ville n'est pas à la gare ; et D91 interdit de choisir sans le dire. La gare reste en tête de liste (D92), un seul toucher suffit.
- **Laisser Claude écrire une requête « corrigée » ou nommer la commune** : il choisirait le lieu (invariant 3).
- **Chercher les lieux côté serveur dans `/v1/comprendre`** : il faudrait y envoyer le point du domicile ; l'app sait déjà chercher les lieux (spec 18) et le refait au « Chercher ».
- **Retirer de la phrase les mots de région par une liste** côté serveur : Claude sépare mieux « Flers basse normandie » que des règles ; la liste sert seulement à filtrer des codes postaux, ce qui se teste.

## 5. Critères d'acceptation

1. `phraseDitUnJour` : vrai pour chaque phrase datée du jeu de 30 phrases, faux pour « je veux partir à flers », « Dijon », « aller à la gare de Laroche-Migennes » (`serveur/src/comprendre/comprendre.test.ts`).
2. Route : Claude rend une date pour une phrase sans jour ⇒ la réponse a `date: null` ; `lieu_zone` et `depart_zone` passent (`serveur/src/routes/comprendre.test.ts`).
3. `departementsDeZone` : « Basse-Normandie », « basse normandie », « Normandie », « Orne », « 61 », « Yonne », « Bourgogne », « Corse », « Île-de-France », « Guadeloupe » ⇒ leurs départements ; « Mars » ⇒ null. `filtrerParZone` : Flers 61100 gardé, Flers 80360 retiré ; zone qui retire tout ⇒ liste entière (`src/domaine/zones.test.ts`).
4. `lieuxDeLaPhrase` : un lieu ⇒ écrit ; plusieurs ⇒ liste ; aucun ⇒ message ; échec ⇒ texte seul (`src/domaine/comprendre.test.ts`).
5. Sur le téléphone, API reconstruite : « je veux partir à flers » ⇒ formulaire avec la liste ouverte sous l'Arrivée, la gare de Flers en tête, date d'aujourd'hui ; « je veux partir à flers basse normandie » ⇒ liste des seuls lieux de Flers dans l'Orne.
6. `validerFormulaire` : « Partir à » 17:42 à 18:00 ⇒ demande à 18:00 ; 17:29 ⇒ erreur ; « Arriver avant » 17:59 ⇒ erreur (`src/domaine/demande.test.ts`).
7. Lint, types et tests (app et serveur) verts.

## 6. Constats

Le 2026-11-06, sur le téléphone de Brainditech par adb, API reconstruite sur le PC (`docker compose … up -d --build api`). Captures : `docs/screenshots/2026-11-06-spec35-*.png` (non versionnées).

- Claude appelé dans le conteneur de l'API (clé lue par le conteneur, jamais par Claude Code) : « je veux partir a flers basse normandie » ⇒ `lieu_texte` « Flers », `lieu_zone` « basse normandie », `date` null, 5 fois sur 5 ; « je veux partir à flers » ⇒ « flers », zone null, date null ; « jeudi 10h RDV à Joigny » ⇒ inchangé (Joigny, 2026-11-12, 10:00).
- Critère 5, avant la reconstruction de l'API : « je veux partir a flers » ⇒ formulaire avec la liste ouverte sous l'Arrivée (« 5 lieux proposés », la gare de Flers 61100 en tête), date du jour (vendredi 06/11).
- Critère 5, après : « je veux partir a flers basse normandie » ⇒ « 3 lieux proposés », tous à Flers 61100 (gare, commune, arrêt « FLERS - Europe ») ; la gare choisie, « Chercher » ⇒ « Possible, Départ 15:17 ».
- Écart trouvé et corrigé : « Cette heure est passée. » sur une phrase sans heure (§3.5).
- **Non reproduit** : au premier essai après la reconstruction de l'API, le formulaire s'est ouvert avec l'Arrivée vide (sans liste). Trois essais suivants identiques et cinq appels directs à Claude : tous justes. Cause non trouvée ; à surveiller.
- Critères 1 à 4, 6, 7 : 63 tests du serveur sur le domaine touché (dont 41 de `phraseDitUnJour`), 378 tests de l'app ; lint et types verts.
