import { z } from "zod";
import {
  instantReference,
  MARCHE_AUX_BOUTS_SECONDES,
  schemaReponsePlan,
  type DemandeRecherche,
  type Point,
} from "./motis-plan.js";

/**
 * Marches « coûteuses » (issue 0008, D62).
 *
 * MOTIS (osr, profil piéton) borne la marche d'accès par un COÛT, pas par une durée : chaque
 * tronçon d'un chemin non marqué piéton coûte 90 s de plus, chaque tronçon d'une rue au trottoir
 * dessiné à part 45 s. Un couloir souterrain découpé en petits tronçons peut ainsi coûter plus
 * de 30 min pour 4 min de marche réelle : à Châtelet, les quais des lignes 1 et 14 étaient hors
 * de portée, et la recherche envoyait à Pyramides (21 min à pied).
 *
 * Relever la limite pour toutes les recherches fait perdre des trajets (14 sur 200 tirés au
 * hasard : MOTIS préfère alors de longues marches, que nous écartons). Règle retenue :
 * 1. la recherche ordinaire est toujours faite, telle quelle ;
 * 2. en même temps, de chaque côté (départ, arrivée), MOTIS liste les arrêts atteints à pied
 *    avec la limite ordinaire, puis avec la limite élargie ; un arrêt à 15 min de marche réelle
 *    ou moins qui n'apparaît qu'avec la limite élargie est « masqué par le coût » ;
 * 3. s'il y en a, une seconde recherche est faite avec la limite élargie de ce côté ; ses
 *    possibilités dont la marche réelle au départ ou à l'arrivée dépasse 30 min sont écartées,
 *    les autres s'ajoutent à la recherche ordinaire.
 * La suite (jour, tri, doublons, possibilités inutiles, sources) est celle de `/v1/itineraires`.
 * Si la détection ou la seconde recherche échoue, la recherche ordinaire est rendue telle quelle.
 */
export const COUT_ELARGI_SECONDES = 3600;
/** Au-delà de 15 min de marche, l'app avertit déjà (D3) : un arrêt plus loin ne déclenche rien. */
export const MARCHE_REVELATRICE_MINUTES = 15;

export type Cote = "depart" | "arrivee";

/** Appels à MOTIS dont la règle a besoin ; JSON brut, validé ici par Zod (invariant 9). */
export type AppelsMotis = {
  plan(d: DemandeRecherche): Promise<unknown>;
  /** `/api/v6/one-to-all` à pied seulement (`transitModes` vide) ; `arrivee` ⇒ `arriveBy=true`. */
  aPied(p: Point, cote: Cote, instant: Date, coutSecondes: number): Promise<unknown>;
};

const schemaAtteints = z.object({
  all: z.array(z.object({ place: z.object({ stopId: z.string().optional() }), duration: z.number().nonnegative() })),
});

/** Étape 2 : arrêts à 15 min de marche réelle ou moins, atteints seulement avec la limite élargie. */
export function arretsMasques(ordinaireBrut: unknown, elargiBrut: unknown): string[] {
  const ordinaire = new Set(schemaAtteints.parse(ordinaireBrut).all.map((x) => x.place.stopId));
  return schemaAtteints
    .parse(elargiBrut)
    .all.filter((x) => x.place.stopId !== undefined && x.duration <= MARCHE_REVELATRICE_MINUTES && !ordinaire.has(x.place.stopId))
    .map((x) => x.place.stopId!);
}

type Itineraire = z.infer<typeof schemaReponsePlan>["itineraries"][number];

/** Étape 3 : la marche RÉELLE au départ et à l'arrivée reste d'au plus 30 min (D3, D42). */
export function marchesAdmises(its: Itineraire[]): Itineraire[] {
  const admise = (l: Itineraire["legs"][number] | undefined) => l === undefined || l.mode !== "WALK" || l.duration <= MARCHE_AUX_BOUTS_SECONDES;
  return its.filter((it) => admise(it.legs[0]) && admise(it.legs.at(-1)));
}

async function masque(m: AppelsMotis, p: Point, cote: Cote, instant: Date): Promise<boolean> {
  const [ordinaire, elargi] = await Promise.all([
    m.aPied(p, cote, instant, MARCHE_AUX_BOUTS_SECONDES),
    m.aPied(p, cote, instant, COUT_ELARGI_SECONDES),
  ]);
  return arretsMasques(ordinaire, elargi).length > 0;
}

/**
 * Recherche ordinaire, complétée si besoin par la seconde recherche à limite élargie.
 * Rend le JSON de MOTIS, enrichi : la route le valide et le normalise comme d'habitude.
 */
export async function planComplet(m: AppelsMotis, d: DemandeRecherche): Promise<unknown> {
  const ordinaire = m.plan(d);
  ordinaire.catch(() => {}); // l'erreur est rendue par `await ordinaire` plus bas
  let ajouts: Itineraire[] = [];
  try {
    const instant = instantReference(d);
    const [depart, arrivee] = await Promise.all([masque(m, d.depart, "depart", instant), masque(m, d.arrivee, "arrivee", instant)]);
    if (depart || arrivee) {
      const brut = await m.plan({
        ...d,
        coutMarche: {
          depart: depart ? COUT_ELARGI_SECONDES : MARCHE_AUX_BOUTS_SECONDES,
          arrivee: arrivee ? COUT_ELARGI_SECONDES : MARCHE_AUX_BOUTS_SECONDES,
        },
      });
      ajouts = marchesAdmises(schemaReponsePlan.parse(brut).itineraries);
    }
  } catch {
    ajouts = []; // un complément : la recherche ordinaire reste rendue
  }
  const brut = await ordinaire;
  if (ajouts.length === 0 || typeof brut !== "object" || brut === null) return brut;
  const b = brut as { itineraries?: unknown };
  if (!Array.isArray(b.itineraries)) return brut;
  return { ...b, itineraries: [...b.itineraries, ...ajouts] };
}
