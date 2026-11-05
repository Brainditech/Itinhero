import type { Etape } from "./api";
import { phraseConsigne } from "./consignes";
import { maintenantAParis } from "./demande";
import { nomFinMarche, preparerEtape, vehiculeMinuscule, type EtatGuidage, type Parcours } from "./guidage";

// Perdu pendant une marche (spec 20, D96) : pur TypeScript, sans Expo, testé sous Node.
// « Recalculer depuis ici » demande d'abord un chemin à pied jusqu'à la fin de la marche ; ce module décide
// s'il suffit (le reste du trajet ne change pas) ou s'il faut la recherche complète, et remplace la marche.

/** Avance minimale sur le véhicule suivant pour garder le trajet : le temps de trouver le quai ou l'arrêt (D96). */
export const AVANCE_MIN_MS = 2 * 60_000;
/** Un chemin à pied plus long ne remplace pas la marche : la recherche complète décide (D96). */
export const MARCHE_MAX_MS = 60 * 60_000;

export type ChoixApresEcart = { type: "marche" } | { type: "recherche"; raison: string };

const AUCUN_CHEMIN = "Aucun chemin à pied";

/** Durée de la nouvelle marche (ms), d'après ses instants s'ils sont donnés, sinon ses minutes. */
function dureeMs(m: Etape): number {
  if (m.depart_utc && m.arrivee_utc) return Math.max(0, Date.parse(m.arrivee_utc) - Date.parse(m.depart_utc));
  return m.duree_minutes * 60_000;
}

/**
 * Règles de D96, pour la marche `k` en écart, avec le chemin à pied rendu par le serveur (`null` : aucun) :
 * 1. arrivée au véhicule suivant au moins 2 min avant son départ prévu ⇒ nouveau chemin ;
 * 2. la marche finit le trajet (aucun véhicule après elle) ⇒ nouveau chemin, même en retard ;
 * 3. véhicule plus à portée, ou aucun chemin d'au plus 1 h ⇒ recherche complète, avec la raison à écrire.
 * Les marches entre celle-ci et le véhicule (rare : deux marches de suite) comptent avec leur durée prévue.
 */
export function choisirApresEcart(parcours: Parcours, k: number, marche: Etape | null, maintenant: number): ChoixApresEcart {
  if (!marche || dureeMs(marche) > MARCHE_MAX_MS) return { type: "recherche", raison: AUCUN_CHEMIN };
  let arrivee = maintenant + dureeMs(marche);
  for (const g of parcours.etapes.slice(k + 1)) {
    if (g.etape.mode === "marche") {
      arrivee += g.arriveeMs - g.departMs;
      continue;
    }
    if (arrivee <= g.departMs - AVANCE_MIN_MS) return { type: "marche" };
    return { type: "recherche", raison: `Le ${vehiculeMinuscule(g.etape)} de ${g.etape.depart} n'est plus à portée` };
  }
  return { type: "marche" };
}

/** Texte écrit pendant la recherche complète qui suit (règle 3). */
export function phraseNouvelleRecherche(raison: string): string {
  return `${raison} : nouvelle recherche…`;
}

export const NOUVEAU_CHEMIN = "Nouveau chemin";

/**
 * Nouveau parcours où seule la marche `k` change : son tracé, ses consignes et ses heures (partie `maintenant`).
 * Elle garde sa fin (nom et lieu de l'étape d'origine) ; toutes les autres étapes restent les mêmes.
 * L'état repart au début de l'étape `k` : abscisse 0, plus d'écart, annonces de l'étape `k` oubliées.
 */
export function remplacerMarche(
  parcours: Parcours,
  etat: EtatGuidage,
  k: number,
  marche: Etape,
  maintenant: number,
): { parcours: Parcours; etat: EtatGuidage } {
  const p = parcours.possibilite;
  const ancienne = p.etapes[k]!;
  const fin = maintenant + dureeMs(marche);
  const heure = (ms: number) => maintenantAParis(new Date(ms)).heure;
  const nouvelle: Etape = {
    ...marche,
    de: { ...marche.de, nom: "Votre position", type: "depart" },
    a: ancienne.a,
    depart: heure(maintenant),
    arrivee: heure(fin),
    depart_utc: new Date(maintenant).toISOString(),
    arrivee_utc: new Date(fin).toISOString(),
  };
  const etapes = p.etapes.map((e, i) => (i === k ? nouvelle : e));
  const premiere = k === 0;
  const derniere = k === p.etapes.length - 1;
  const departUtc = premiere ? nouvelle.depart_utc! : p.depart_utc;
  const arriveeUtc = derniere ? nouvelle.arrivee_utc! : p.arrivee_utc;
  const possibilite = {
    ...p,
    depart: premiere ? nouvelle.depart : p.depart,
    depart_utc: departUtc,
    arrivee: derniere ? nouvelle.arrivee : p.arrivee,
    arrivee_utc: arriveeUtc,
    duree_minutes: Math.round((Date.parse(arriveeUtc) - Date.parse(departUtc)) / 60_000),
    etapes,
  };
  return {
    parcours: {
      possibilite,
      etapes: parcours.etapes.map((g, i) => (i === k ? preparerEtape(possibilite, nouvelle) : g)),
      arriveeMs: Date.parse(arriveeUtc),
    },
    etat: {
      ...etat,
      etape: k,
      aBord: false,
      horsCheminDepuis: null,
      abscisse: 0,
      annonces: etat.annonces.filter((a) => !a.startsWith(`${k}:`)),
    },
  };
}

/** Ce que dit la voix au nouveau chemin : « Nouveau chemin. Partez vers le sud sur l'avenue Charles de Gaulle ». */
export function phraseNouveauChemin(parcours: Parcours, k: number): string {
  const premiere = parcours.etapes[k]?.consignes[0];
  if (!premiere) return NOUVEAU_CHEMIN;
  return `${NOUVEAU_CHEMIN}. ${phraseConsigne(premiere.consigne, nomFinMarche(parcours, k))}`;
}
