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

## 6. Complément du 2026-11-07 : gratuit ou moins cher (demande de Brainditech)

Relevé le 2026-11-07 à la demande « un VPS free ou bien peu cher ».

| Offre | Mémoire | Prix | Source |
|---|---|---|---|
| **Oracle Cloud, compte gratuit (Always Free)**, Ampere A1 (ARM) | **12 Go** (2 OCPU) depuis le 15/06/2026 (24 Go avant) ; 200 Go de disque ; 10 To sortants par mois ; région d'attache seulement (Paris ou Marseille possibles) | 0 € | doc officielle « Always Free Resources » : « For Always Free tenancies, this is equivalent to 2 OCPUs and 12 GB of memory » ; https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm |
| **Oracle Cloud, compte payant à l'usage (PAYG)**, Ampere A1 | 24 Go gratuits **si** les comptes payants gardent 3 000 OCPU-h et 18 000 Go-h par mois (page des prix A1) ; la doc gratuite dit « all tenancies get the first 1,500 OCPU hours and 9,000 GB hours » : **contradiction non tranchée** | au-delà : 0,01 $ par OCPU-h et 0,0015 $ par Go-h, soit, pour 4 OCPU et 32 Go, **≈ 9 $/mois** (franchise de 24 Go) ou **≈ 37 $/mois** (franchise de 12 Go) | https://www.oracle.com/cloud/compute/arm/pricing/ (page refusée à la lecture automatique, chiffres lus sur sa copie régionale), fil Oracle https://community.oracle.com/customerconnect/discussion/979422 |
| Hetzner Cloud CAX41 (ARM) | 32 Go | 40,99 € HT/mois depuis le 15/06/2026 : plus cher qu'OVH VPS-4 | https://cloudtally.eu/hetzner-cloud-prices (prix non lu sur le site de Hetzner) |
| **Hostinger KVM 8** | 32 Go, 8 vCPU, 400 Go NVMe | **21,99 €/mois en payant 527,76 € d'avance pour 24 mois** (offre Black Friday), puis 49,99 €/mois au renouvellement ; aucun prix au mois affiché ; HT ou TTC non précisé ; centres de données non listés (« 10 centres sur 4 continents », France non confirmée). KVM 4 : 16 Go, 10,99 €/mois sur 24 mois, sous le pic d'import | https://www.hostinger.com/fr/vps-hosting, lue le 2026-11-07 |

Lecture :

- **Oracle gratuit (12 Go)** : MOTIS au repos (7,0 Gio) et pendant les recherches (7,4 Gio) tient ; **l'import ne tient pas** (pic de 15,6 Gio) sans fichier d'échange de 8 Go au moins, et la bascule à chaud de la spec 44 est impossible : il faudrait couper le service pendant l'import de nuit (≈ 15 min mesurées sur le PC, sans doute bien plus avec l'échange et 2 cœurs). C'est un changement de la spec 44, à décider.
- Risques Oracle relevés : places A1 souvent « Out of capacity » dans les régions demandées, carte bancaire demandée à l'inscription, règle des instances inactives reprises (moins de 20 % de processeur, de réseau et de mémoire sur 7 jours : MOTIS occupe plus de 20 % de la mémoire, donc non concerné), limites changées sans annonce le 15/06/2026.
- **Hostinger KVM 8** : 32 Go, donc l'import à chaud sans échange, pour un prix mensuel proche d'OVH ; en contrepartie, 528 € payés d'un coup, 2 ans d'engagement, un renouvellement à 49,99 € et un lieu non confirmé.
- La proposition du §3 (OVHcloud VPS-4, 23,49 € HT) reste l'offre payante au mois la moins chère vérifiée qui tient l'import et la bascule à chaud.
