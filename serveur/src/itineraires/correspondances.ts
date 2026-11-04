import type { DemandeRecherche, Etape, Possibilite } from "./motis-plan.js";

/**
 * Longues correspondances à pied (issue 0013, D81).
 *
 * MOTIS accepte des correspondances à pied jusqu'à 50 min (`max_footpath_length`, D42) et classe d'abord
 * par heure d'arrivée, puis par nombre de correspondances. Quand le véhicule suivant fixe l'heure d'arrivée,
 * 41 min de marche de Châtelet à Montparnasse « coûtent » une correspondance de moins que le métro 4 :
 * MOTIS garde la marche (constaté le 2026-11-05, Brienon → un village de l'Orne près de Flers).
 *
 * Pour chaque marche de plus de 15 min (D3) entre deux transports, on demande à MOTIS ce bout seul, à
 * l'heure où la marche commence. Un trajet qui prend un transport, marche moins, et arrive au moins
 * 3 min avant le véhicule suivant remplace la marche. Sinon la marche reste.
 */
export const MARCHE_CORRESPONDANCE_MAX_SECONDES = 15 * 60;
export const MARGE_AVANT_VEHICULE_MS = 3 * 60_000;
/** Au plus 8 bouts redemandés par liste de possibilités (temps de réponse). */
export const MAX_BOUTS_REDEMANDES = 8;

const enCommun = (e: Etape) => e.mode !== "WALK" && e.mode !== "CAR";
const marche = (es: Etape[]) => es.filter((e) => e.mode === "WALK").reduce((n, e) => n + e.dureeSecondes, 0);

/** Un transport court entre deux longues marches (RER Gare de Lyon → Châtelet) fait partie de la même traversée. */
export const TRANSPORT_COURT_SECONDES = 20 * 60;

const longueMarche = (e: Etape | undefined) => !!e && e.mode === "WALK" && e.dureeSecondes > MARCHE_CORRESPONDANCE_MAX_SECONDES;

/**
 * Traversées à redemander : de la première à la dernière longue marche (plus de 15 min) encadrées par deux
 * transports, en y incluant les transports courts (20 min au plus) qui les séparent. `[debut, fin]` inclus.
 * Constaté le 2026-11-05 : TER → Bercy, marche 23 min, RER 4 min, marche 38 min → Montparnasse, TER.
 */
export function longuesCorrespondances(p: Possibilite): [number, number][] {
  const fenetres: [number, number][] = [];
  const es = p.etapes;
  for (let i = 1; i < es.length - 1; i++) {
    if (!longueMarche(es[i]) || !enCommun(es[i - 1]!)) continue;
    let fin = i;
    while (
      es[fin + 1] && enCommun(es[fin + 1]!) && es[fin + 1]!.dureeSecondes <= TRANSPORT_COURT_SECONDES &&
      longueMarche(es[fin + 2]) && es[fin + 3]
    ) {
      fin += 2;
    }
    if (es[fin + 1] && enCommun(es[fin + 1]!)) fenetres.push([i, fin]);
    i = fin;
  }
  return fenetres;
}

/** Le meilleur remplaçant d'une marche : un transport, moins de marche, à l'heure pour le véhicule suivant. */
export function meilleurRemplacant(fenetre: Etape[], suivant: Etape, candidats: Possibilite[]): Etape[] | null {
  const premiere = fenetre[0]!;
  const derniere = fenetre[fenetre.length - 1]!;
  const limite = suivant.depart.getTime() - MARGE_AVANT_VEHICULE_MS;
  const transportsAvant = fenetre.filter(enCommun).length;
  const bons = candidats.filter(
    (c) =>
      c.depart.getTime() >= premiere.depart.getTime() &&
      c.arrivee.getTime() <= limite &&
      c.etapes.some(enCommun) &&
      c.etapes.filter(enCommun).length <= transportsAvant + 1 &&
      marche(c.etapes) < marche(fenetre),
  );
  // Le plus simple d'abord (le moins de transports), puis le moins de marche : un métro direct vaut mieux
  // qu'une chaîne métro + RER + métro + bus qui économise 3 min de marche (constaté le 2026-11-05).
  const transports = (c: Possibilite) => c.etapes.filter(enCommun).length;
  bons.sort((a, b) => transports(a) - transports(b) || marche(a.etapes) - marche(b.etapes) || a.arrivee.getTime() - b.arrivee.getTime());
  const choisi = bons[0];
  if (!choisi) return null;
  // MOTIS nomme le début et la fin d'un bout « START » et « END » : on remet les lieux de la marche remplacée.
  return choisi.etapes.map((e) => ({
    ...e,
    de: e.de.nom === "START" ? premiere.de : e.de,
    a: e.a.nom === "END" ? derniere.a : e.a,
  }));
}

export async function raccourcirCorrespondances(
  possibilites: Possibilite[],
  plan: (d: DemandeRecherche) => Promise<Possibilite[]>,
): Promise<Possibilite[]> {
  let budget = MAX_BOUTS_REDEMANDES;
  return Promise.all(
    possibilites.map(async (p) => {
      const fenetres = longuesCorrespondances(p).filter(() => budget-- > 0);
      if (fenetres.length === 0) return p;
      const remplacants = await Promise.all(
        fenetres.map(async ([debut, fin]) => {
          const fenetre = p.etapes.slice(debut, fin + 1);
          const m = fenetre[0]!;
          try {
            const candidats = await plan({
              depart: m.coordDe,
              arrivee: fenetre[fenetre.length - 1]!.coordA,
              jour: m.departParis.jour,
              sens: "partir",
              depuisMinutes: m.departParis.minutes,
            });
            return meilleurRemplacant(fenetre, p.etapes[fin + 1]!, candidats);
          } catch {
            return null; // la traversée reste : une recherche ratée ne fait jamais échouer la recherche
          }
        }),
      );
      const etapes: Etape[] = [];
      for (let i = 0; i < p.etapes.length; i++) {
        const k = fenetres.findIndex(([debut]) => debut === i);
        if (k >= 0 && remplacants[k]) {
          etapes.push(...remplacants[k]);
          i = fenetres[k]![1];
        } else {
          etapes.push(p.etapes[i]!);
        }
      }
      return { ...p, etapes };
    }),
  );
}
