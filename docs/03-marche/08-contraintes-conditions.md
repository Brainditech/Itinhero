# Volet 4 — Contraintes de conditions d'utilisation et de licences de données

> Agent : kodivine-chercheur · relevé le 2026-10-19. Ce volet recense ce que **disent** les
> conditions et licences publiées ; il ne contient aucune interprétation juridique (voie business,
> moteur juridique non mobilisé). Une lecture juridique, si elle est nécessaire, se demande
> explicitement.

## Épreuve de l'amont

Le piège classique nommé par la convention : un **abonnement grand public** servant de backend
produit. Ici, il concerne l'assistant IA : les conditions grand public d'Anthropic interdisent
l'accès automatisé hors clé d'API (C4.1). Deuxième piège propre à ce produit : l'instance gratuite
Transitous paraît idéale pour un utilisateur unique, mais elle exclut tout usage commercial —
utilisable pour un prototype open source, pas pour un produit vendu.

## 4.1 Assistant IA (LLM)

- Les conditions grand public d'Anthropic interdisent, « Except when you are accessing our Services via an Anthropic API Key or where we otherwise explicitly permit it », d'accéder aux services « through automated or non-human means, whether through a bot, script, or otherwise » ; conditions en vigueur au 8 octobre 2025 (source: https://www.anthropic.com/legal/consumer-terms, vérifié le 2026-10-19).
- Les deux apps internes appellent Claude par **clé d'API** (Pécule : clé personnelle dans le Keystore ; Tripagent : clé côté serveur) (source: D:\Mes Logiciels\02-Mobile-Desktop\Pecule\app\src\app\langage\cle-api.ts ; D:\Mes Logiciels\02-Mobile-Desktop\Tripagent\AGENTS.md).

## 4.2 Données de transport

- GTFS / GTFS-RT / NeTEx SNCF : **ODbL** (source: https://transport.data.gouv.fr/datasets/horaires-sncf, vérifié le 2026-10-19).
- GTFS Mobigo (dont Yonne 89) : **Licence Ouverte v2** (`lov2`) (source: https://transport.data.gouv.fr/datasets/reseau-de-transport-interurbain-mobigo-en-bourgogne-franche-comte, vérifié le 2026-10-19).
- Base nationale des lieux de covoiturage : **ODbL** ; lieux de covoiturage BFC : Licence Ouverte v2 (source: https://transport.data.gouv.fr/datasets/base-nationale-des-lieux-de-covoiturage et https://transport.data.gouv.fr/datasets/aires-de-covoiturage-de-bourgogne-franche-comte, vérifiés le 2026-10-19).
- Stations de taxi le.taxi : licence « notspecified » (source: https://www.data.gouv.fr/datasets/stations-de-taxi-en-france, vérifié le 2026-10-19).
- PRIM IDFM : CGU de juillet 2022, données sous « Licence Mobilité » (source: https://prim.iledefrance-mobilites.fr/fr/apis/idfm-navitia-general-v2, récupéré le 2026-10-19).
- ⬜ NON RÉSOLU — conditions d'utilisation de l'API SNCF (lien présent, non ouvert) (source du lien: https://numerique.sncf.com/startup/api/, récupéré le 2026-10-19).

## 4.3 Services tiers

- Transitous : « Due to data source licences and resource prioritisation, commercial use is not allowed » ; réservé aux projets open source, non commerciaux, légers ; `User-Agent` avec contact ; lien visible vers la page des sources et attribution OpenStreetMap (source: https://transitous.org/api/, vérifié le 2026-10-19).
- Uber : le scope `request` est privilégié ; Full Access soumis à revue et à une politique de confidentialité publique (source: https://developer.uber.com/docs/riders/guides/scopes, vérifié le 2026-10-19).
- BlaBlaCar Daily : jeton par partenaire, sur demande (source: https://api-doc.blablacardaily.com/docs/BlaBlaCarDaily_Partner-API.pdf, lu le 2026-10-19).
- ARCore Geospatial : projet Google Cloud avec l'API ARCore activée (source: https://developers.google.com/ar/develop/java/geospatial/quickstart, vérifié le 2026-10-19) ; ⬜ NON RÉSOLU — quotas et facturation (page « API usage quota » non ouverte).
- Google Places (si utilisé) : la pratique interne de Tripagent est de ne stocker que le `place_id` « conformément aux Places Policies » (source: D:\Mes Logiciels\02-Mobile-Desktop\Tripagent\PLAN.md, § Contexte).

## 4.4 Modèles embarqués

- Gemma 4 : Apache 2.0 (source: https://opensource.googleblog.com/2026/03/gemma-4-expanding-the-gemmaverse-with-apache-20.html, vérifié le 2026-10-19).
- Gemma 3 / 3n : « Gemma Terms of Use » avec politique d'usages interdits — ⬜ NON RÉSOLU, texte non ouvert (où chercher : https://ai.google.dev/gemma/terms).
- ML Kit : ⬜ NON RÉSOLU — conditions du SDK Google (les wrappers React Native sont MIT, volet E §E4).
