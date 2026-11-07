# Décision 0003 — Choix du VPS (D137, proposée)

- **Date** : 2026-11-07
- **État** : **proposée par Claude** (D133), **à trancher par Brainditech** : c'est lui qui loue le serveur. Case de PLAN.md : phase 10 · « Choix du VPS argumenté à partir de la mesure de la phase 0 avec les données de toute la France » (preuve : cette décision, avec le prix et sa source). La case se coche quand Brainditech a choisi.
- **Mesure de départ** (`docs/decisions/0002-memoire-motis.md`, 2026-11-04) : MOTIS chargé avec l'OSM France entière et 516 GTFS, **15,6 GiB au plus haut pendant l'import**, 7,0 GiB au repos, 7,4 GiB pendant les recherches, 16,6 Go sur disque, import d'environ 15 min. L'ingestion nocturne (spec 44) importe dans un volume neuf pendant que l'ancien MOTIS répond, puis bascule : au pire, les deux tournent ensemble.

## 1. Besoin

- Mémoire : 16 Go ne suffisent pas (≈ 14,9 GiB < pic de 15,6 GiB). 24 Go suffisent pour un import seul ; **un import pendant que le service tourne** demande environ 23 GiB plus le système, donc 32 Go, ou 24 Go avec un fichier d'échange de 8 à 12 GiB sur NVMe.
- Disque : deux copies des données (2 × 16,6 Go) plus les téléchargements OSM et GTFS : 200 Go suffisent.
- Processeur : l'image `ghcr.io/motis-project/motis:2.11.4` est publiée pour linux/amd64 **et** linux/arm64 (manifeste du registre lu le 2026-11-07) : un serveur ARM convient aussi.
- Facturation au mois, sans long engagement ; données en France ou dans l'UE.

## 2. Offres relevées le 2026-11-07 (pages officielles)

| Offre | vCPU | RAM | Disque | Lieu | Prix | Source |
|---|---|---|---|---|---|---|
| **OVHcloud VPS-4** | 8 | 24 Go | 200 Go NVMe | Gravelines, Strasbourg, Roubaix (France) | **23,49 € HT/mois sans engagement** (≈ 28,19 € TTC) ; 19,96 € HT avec 12 mois payés d'avance ; installation 0 € | https://www.ovhcloud.com/fr/vps/ et catalogue `https://eu.api.ovh.com/v1/order/catalog/public/vps?ovhSubsidiary=FR` (plan `vps-2027-model4`) |
| **Hetzner dédié AX41** | 6 cœurs (Ryzen 5 3600) | 64 Go | 2 × 512 Go NVMe | Falkenstein (DE), Helsinki (FI) | **59 € HT/mois**, sans durée minimum, installation 0 € | https://www.hetzner.com/dedicated-rootserver/ax41/ |
| Hetzner Cloud CX53 | 16 | 32 Go | 320 Go NVMe | DE, FI | 29,99 € HT/mois — **indisponible** à la lecture | https://www.hetzner.com/cloud/cost-optimized/ |
| Contabo Cloud VPS 12 | 12 | 48 Go | 200 Go NVMe | UE | 20 € TTC/mois engagé 24 mois ; prix au mois **non confirmé** (page en erreur) | https://contabo.com/en/vps/ |
| netcup VPS 4000 G12.5 | 12 | 32 Go | 512 Go SSD | AT, DE ou NL | 38,56 € TTC sur 24 mois, ≈ 52 € au mois | https://www.netcup.com/en/server/vps |
| IONOS VPS XXL+ | 12 | 24 Go | 720 Go NVMe | DE, ES | 17 € HT 3 mois puis prix non explicite ; mise en service 10 € | https://www.ionos.fr/serveurs/vps |
| Scaleway GP1-XS | 4 | 16 Go | à part | Paris | ≈ 67,75 € HT/mois, 16 Go insuffisants | https://www.scaleway.com/en/pricing/virtual-instances/ |

Prix en hausse en 2026 (hausse du prix de la mémoire, citée par Contabo).

## 3. Proposition

1. **OVHcloud VPS-4, 23,49 € HT par mois, sans engagement, en France.** Seule offre au mois vérifiée avec un centre de données français. Ses 24 Go couvrent le pic d'import. Pour la bascule à chaud de l'ingestion nocturne : un fichier d'échange de 12 Go sur le NVMe (import de nuit plus lent, sans coupure) ; passage à une offre supérieure possible sans migration si la mesure sur le serveur le demande.
2. **Repli : Hetzner AX41 dédié, 59 € HT par mois**, 64 Go : bascule à chaud sans échange, au prix d'un serveur physique à administrer, en Allemagne ou en Finlande.

## 4. Options écartées

- 16 Go (Scaleway GP1-XS, Hetzner CX43) : sous le pic d'import.
- Offres engagées sur 24 mois (Contabo, netcup) : prix bas mais engagement long, prix au mois non confirmé.
- Hetzner CX53 : meilleur rapport mémoire-prix, mais indisponible le 2026-11-07 ; à revoir s'il revient.

## 5. Après le choix

Brainditech loue le serveur (compte, paiement), ajoute sa clé SSH et un nom de domaine qui pointe vers lui (R10). Claude installe Docker, le dépôt, le `.env` du VPS (rempli par Brainditech) et lance `docker compose -p itinhero-prod -f docker-compose.yml -f docker-compose.national.yml -f docker-compose.prod.yml` (spec 52), puis mesure la mémoire réelle de l'import sur le serveur.
