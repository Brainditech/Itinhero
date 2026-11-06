# Issue 0025 — « Horaires du 20/08/2026 » sur un trajet du 28/12, et « Impossible » faute d'horaires publiés

- **Date** : 2026-11-06
- **État** : **corrigée** le 2026-11-06, analyse approuvée par délégation (D119 : « rectifie les bugs jusqu'à ce que tout soit nickel »).
- **Branche** : `verif/constats-a`.
- **Demande d'origine** : ETAT, « Dates qui ne collent pas » (2026-11-06).

## 1. Reproduction

1. Accueil, `rendez-vous gare de Flers le 28 decembre a 15h`, Gare de Flers choisie, « Chercher » (2026-11-06 18:50, API nationale).
2. Résultat : **« Impossible — Aucun trajet ce jour-là pour arriver avant 14:50. »** (`docs/screenshots/fin/b5-flers-28-12.png`). Le 12/11, le même trajet est « Possible » (TER, métro 6, K4).
3. Avant la spec 35, Brainditech avait vu sur un trajet du 28/12 la ligne « Horaires du 20/08/2026 ».

## 2. Hypothèses (une à la fois)

**H1 — la date affichée est fausse.** Écartée : `date_horaires` est la `date_fichiers` du manifeste. Le 20/08/2026 est celle des jeux Nomad (`r82317`, Syndicat mixte Atoumod, car régional de Normandie, valable jusqu'au 01/09/2027) et Ficibus (`r82311`). C'est la date de **publication** du jeu le plus ancien parmi ceux du trajet ; elle est juste, mais « Horaires du 20/08/2026 » se lit comme « les horaires du jour 20/08 ».

**H2 — « Impossible » vient d'horaires absents ce jour-là.** Vérifiée dans `donnees/horaires.json` : le jeu d'Île-de-France Mobilités (`r80921`, 111 Mo) s'arrête au **02/12/2026**, Transilien (`r67595`) aussi ; 138 jeux s'arrêtent en décembre 2026 (changement de service annuel du 13/12). Après le 02/12, MOTIS ne voit plus aucun métro ni RER : Brienon → Flers, qui passe par le métro 6, n'a plus de chemin, et le Résultat affirme « Aucun trajet ce jour-là » (invariant 13 : ce n'est pas vrai, c'est inconnu).

## 3. Cause racine

1. Libellé ambigu (« Horaires du » au lieu de la date de publication).
2. Le serveur connaît la fin de validité de chaque jeu (D69) mais ne s'en servait que pour la ligne « valables jusqu'au ». Rien ne prévenait qu'un jour demandé tombait après la fin d'un jeu encore actif.

## 4. Correction

1. Libellés : « Horaires **publiés le** 20/08/2026, valables jusqu'au … » et, dans le bandeau des trajets lointains, « Horaires publiés le … ».
2. Serveur : `POST /v1/itineraires` rend `horaires_a_venir` = `{nombre, reseaux, des_le}` : les jeux encore valables aujourd'hui dont la fin de validité est avant le jour demandé (un jeu déjà fini aujourd'hui est mort, pas « à venir »), les trois plus gros nommés (producteur lu dans `jeux.json` par `npm run donnees:horaires`), et le premier jour sans horaires ; `null` sinon.
3. App : bandeau « Les horaires de 140 réseaux, dont Île-de-France Mobilités et SNCF, ne sont pas encore publiés à partir du 03/12/2026 : les trajets qui les empruntent n'apparaissent pas. Revérifiez plus près de la date. », montré quand un sens est « Impossible » ou que le trajet est à plus de 7 jours ; et « Impossible » dit alors « Aucun trajet **trouvé** ce jour-là … : certains horaires de ce jour ne sont pas encore publiés. »
4. Le fond (des horaires toujours à jour) vient avec l'ingestion nocturne (phase 8) : IDFM republie chaque semaine.

## 5. Tests de régression

- `serveur/src/routes/horaires-a-venir.test.ts` : 28/12 ⇒ 3 jeux, IDFM puis SNCF nommés, premier jour 03/12 ; le 02/12 n'est pas « à venir », le 03/12 l'est ; jeu mort jamais compté.
- `src/domaine/horaires.test.ts` : libellés « publiés le », phrase du bandeau, quand le montrer, « Aucun trajet trouvé ».

## 6. Constat

2026-11-06 par adb, API reconstruite : Domicile → Gare de Flers, lundi 28/12, arriver avant 15:00 ⇒ bandeau « Pour ce jour, les horaires de 39 réseaux ne sont pas encore publiés, dont Île-de-France Mobilités (publiés jusqu'au 02/12/2026), STAR (jusqu'au 14/12/2026) et SNCF (jusqu'au 02/12/2026)… », verdict « Aucun trajet trouvé ce jour-là pour arriver avant 14:50 : certains horaires de ce jour ne sont pas encore publiés. », et le taxi de bout en bout (10:28 → 14:50) : `docs/screenshots/fin/c2-0025-flers-libelle.png`. Un premier libellé (« à partir du 09/11/2026 », date d'un petit réseau) a été remplacé pendant l'essai par la date de chaque réseau nommé (`c1-0025-flers-28-12.png`, avant).
