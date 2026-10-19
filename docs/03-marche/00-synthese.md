# Synthèse de l'état de l'art — MobiliteIA

> Agent : kodivine-chercheur · 2026-10-19 · artefact d'entrée du documentaliste et de la spec.
> Chaque affirmation ci-dessous renvoie à une puce sourcée des volets `01` à `08` (même dossier),
> qui porte l'URL et la date de constat. Rien ici n'est une conception d'UI ni une architecture.

## Épreuve de l'amont

Le brief était subtilement faux sur trois points, tous vérifiés dans la donnée :

1. **« Personne ne dit comment rejoindre Migennes »** — la donnée existe : car TER K941 à
   l'arrêt Brienon Mairie dans le GTFS SNCF, bus Mobigo 856 dans le GTFS Yonne. Le vrai trou est
   l'**offre aux heures utiles** et sa direction : le matin, rien vers Laroche-Migennes en car TER,
   mais un car à 06:27 vers Troyes (Paris Est à 09:16) (source: 02-donnees-yonne-bfc.md §B1-B2, GTFS téléchargés le 2026-10-19).
2. **« RDV » ≠ Paris** — le rendez-vous réel est à Joigny, le 12/11/2026 à
   10:00, et elle n'est atteignable en transport public qu'avec un départ à 06:27 et environ 2,8 km
   à pied (arrivée en gare de Joigny 09:09) (source: 02-donnees-yonne-bfc.md §B6 ; <coffre personnel>).
3. **« Guidage photo en sous-sol sans réseau » via ARCore Geospatial** — Geospatial exige
   internet et l'extérieur ; ce cas ne relève que de briques 100 % embarquées (source: 05-briques-mobiles.md §E3, https://developers.google.com/ar/develop/java/geospatial/quickstart, vérifié le 2026-10-19).

## Les faits qui changent la conception

1. Depuis Brienon, le seul car TER du matin (lun–ven) part à **06:27 vers Troyes** (Paris Est 09:16 via Troyes) ; vers Laroche-Migennes, le premier car part à **13:25** et le bus Mobigo 856 ne roule que **mardi et jeudi à 09:25, sur réservation** ; le 12/11, Joigny n'est atteint avant 10:00 qu'en prenant le car de 06:27 jusqu'à Saint-Florentin-Ville, puis environ 2,8 km à pied et le train 08:50 → 09:09 ; le premier kilomètre à pied ou en voiture décide donc du plan (source: 02-donnees-yonne-bfc.md §B1, §B2, §B6 — GTFS SNCF https://www.data.gouv.fr/api/1/datasets/r/9ae758ec-cd7a-40cd-a890-bb3963224942 et GTFS Mobigo 89 https://www.data.gouv.fr/api/1/datasets/r/5c995d2c-8e79-4e40-b4a6-c0583c647201, téléchargés le 2026-10-19).
2. Le premier kilomètre routier n'a **aucune API ouverte** utilisable sans accord : Uber réserve `request` à une revue (Limited Access = comptes développeurs seulement), BlaBlaCar Daily distribue un jeton partenaire sur demande (≤ 80 km, ≤ 1 semaine), et aucune donnée taxi n'existe pour la BFC (source: 03-api-tierces.md §C1, §C3, §C4 ; https://developer.uber.com/docs/riders/guides/scopes et https://api-doc.blablacardaily.com/docs/BlaBlaCarDaily_Partner-API.pdf, vérifiés le 2026-10-19).
3. Navitia est AGPL-3.0 et son éditeur annonce la **fermeture progressive** des dépôts ; l'instance MOTIS gratuite (Transitous) interdit l'usage commercial ; MOTIS (MIT) accepte GTFS, GTFS-Flex et GTFS-RT (source: 04-moteurs-open-source.md §D2, §D3 ; https://github.com/hove-io/navitia/blob/dev/readme.rst et https://transitous.org/api/, vérifiés le 2026-10-19).
4. Aucun module officiel ne relie ARCore Geospatial à React Native ; ViroReact passe par un service hébergé tiers et est épinglé `expo <58` ; hors réseau, seuls ML Kit (OCR embarqué) et un modèle de vision local (ExecuTorch, llama.rn — ce dernier en échec d'installation chez Brainditech) restent (source: 05-briques-mobiles.md §E3-E5 ; https://registry.npmjs.org/@reactvision/react-viro, vérifié le 2026-10-19 ; D:\Mes Logiciels\02-Mobile-Desktop\Pecule\app\src\app\langage\moteur-embarque.ts).
5. Le GTFS Mobigo n'a **ni temps réel ni règles de réservation** (`booking_rules.txt` absent) : le délai de réservation du TAD n'est pas dans la donnée ouverte (source: 02-donnees-yonne-bfc.md §B2-B3 ; https://transport.data.gouv.fr/datasets/reseau-de-transport-interurbain-mobigo-en-bourgogne-franche-comte, vérifié le 2026-10-19).

## Adopter > adapter > imiter > construire, brique par brique

| Brique | Verdict | Pourquoi (renvoi aux faits sourcés) |
|---|---|---|
| Horaires train + car TER | **Adopter** GTFS SNCF (ODbL) | contient l'arrêt Brienon Mairie et le K941 (§B1) |
| Horaires Mobigo / TAD Yonne | **Adopter** GTFS Mobigo 89 (LOv2) | seule source ; TAD en lignes virtuelles 715 (§B2-B3) |
| Temps réel | **Adopter** GTFS-RT SNCF ; rien côté Mobigo | aucune ressource GTFS-RT Mobigo publiée (§B2) |
| Règles de réservation TAD | **Construire** (saisie manuelle, sourcée) | absentes de la donnée (§B2, ⬜) |
| Moteur d'itinéraire | **Adopter** MOTIS auto-hébergé | MIT, GTFS-Flex + GTFS-RT ; Navitia en fermeture ; Transitous non commercial ; OTP LGPL mais 10 Go pour la Finlande (§D1-D3) — RAM Yonne à **mesurer** |
| Partie Île-de-France | **Adopter** PRIM si besoin | gratuit, 1 000 req/jour pour un jeton récent (§B7) |
| Taxi local | **Construire** un annuaire manuel + appel | aucune donnée ouverte en BFC (§B5, §C4) |
| Uber | **Adapter** : deep link `setPickup` | `request` privilégié ; deep link sans prix (§C1) |
| Covoiturage courte distance | **Adopter** l'API Partner BlaBlaCar Daily si jeton obtenu, sinon deep link | jeton sur demande ; inventaire à 1 semaine (§C3) |
| Cartes et hors ligne | **Adopter** MapLibre RN + `OfflineManager` | MIT, maintenu, plugin Expo (§E2) |
| PMTiles local | **Adapter** (fichier local, pas de pack) | pas de pack hors ligne pour PMTiles (§E2) |
| Guidage photo dehors, avec réseau | **Adapter** plus tard (module natif Expo sur ARCore) | pas de binding officiel ; couverture VPS de Brienon ⬜ (§E3) |
| Guidage photo hors réseau | **Adopter** ML Kit Text Recognition (wrapper Infinite Red) ; **adapter** un VLM via react-native-executorch | OCR embarqué et hors ligne ; llama.rn en échec interne (§E4-E5) |
| Compréhension « demain 9h RDV … » | **Imiter l'interne** : le modèle traduit, un moteur déterministe calcule ; Claude par clé d'API côté serveur | patron Pécule + Tripagent ; abonnement grand public exclu (§G1-G2, §4.1) |
| File de tâches (rappels, réservations) | **Adopter** Inngest si le serveur reprend Tripagent (EAS Hosting) ; sinon pg-boss | EAS Hosting tourne sur Cloudflare Workers en isolats V8, pas en processus Node.js complet (source: https://docs.expo.dev/eas/hosting/introduction/, vérifié le 2026-10-19) ; un worker permanent pg-boss/BullMQ y est donc douteux (⬜) ; pg-boss MIT sur Postgres seul (§F2-F3) |
| Socle app | **Adopter** Expo + structure Pécule/Tripagent ; choisir SDK 57 vs 58 | SDK 58 sorti le 2026-09-29 ; Viro épinglé `<58` (§E1, §E3) |

(source: volets 02 à 08 de ce dossier, constats du 2026-10-19)

## Trous non remplis (⬜ NON RÉSOLU), par volet

- **A** : affichage réel de SNCF Connect, Google Maps, Moovit, Transit, Mobigo pour Brienon → Joigny (12/11, 10:00) et Brienon → Paris — constats d'écran ; hors ligne et AR de SNCF Connect ; Indoor Live View en France ; modes Mappy 2026 ; taxis dans l'app Mobigo ; prix d'une course taxi / Uber Brienon → Laroche-Migennes.
- **B** : distance et temps à pied gare de Joigny → agence (19 route de Chamvres) et itinéraire piéton réel Saint-Florentin-Ville → gare Saint-Florentin-Vergigny ; GTFS-RT SNCF couvre-t-il les cars K941 ; délai et canal de réservation du TAD Mobigo ; 803 réellement sur réservation ? ; donnée Flexibus Auxerre ; taxis de Brienon/Migennes (page gare bloquée par DataDome) ; CGU de l'API SNCF ; quota PRIM des jetons post-2024.
- **C** : ouverture de Full Access Uber en 2026 ; chauffeurs Uber autour de Brienon ; API BlaBlaCar longue distance ; inventaire BlaBlaCar Daily à Brienon et éligibilité d'un particulier au jeton ; G7 dans l'Yonne ; accès client à l'API le.taxi ; registre VTC / ADS ouvert.
- **D** : RAM des trois moteurs pour l'Yonne / la France ; temps réel de Navitia auto-hébergé ; sources Transitous pour la BFC ; nombre de mainteneurs (API GitHub épuisée) ; coût d'hébergement.
- **E** : version MapLibre Native embarquée (≥ 11.7 ?) et PMTiles iOS ; quotas/coût ARCore Geospatial ; couverture VPS de Brienon ; ReactVision Platform et Google ; conditions ML Kit ; VLM/OCR dans react-native-executorch ; binding RN de LiteRT-LM ; Gemma 3n Terms ; vision de Gemma 4 edge.
- **F** : quotas gratuits d'Inngest Cloud ; possibilité d'un worker pg-boss sur EAS Hosting.

(source: sections ⬜ des volets 01 à 08 de ce dossier, 2026-10-19)
