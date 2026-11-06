import { z } from "zod";
import { distanceMetres } from "../lieux/distance.js";

/**
 * Annuaire des numéros (spec 41, D122, D49, invariant 16) :
 * - une fiche **validée** par Brainditech (`valide_le`) s'affiche telle quelle ;
 * - une fiche **candidate** (relevée sur une page publique, pas encore validée) ne s'affiche que si le serveur a
 *   retrouvé le numéro sur sa page, aujourd'hui ou à la dernière lecture, avec l'URL, la date et « non vérifié » ;
 * - sinon rien (« aucun numéro connu » dans l'app). Claude n'écrit jamais un numéro (invariant 3).
 */
const NUMERO = /^\+?[0-9 .]{6,20}$/;

export const schemaFiche = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    type: z.enum(["taxi", "tad"]),
    nom: z.string().min(1).max(80),
    numero: z.string().regex(NUMERO),
    communes: z.array(z.string().min(1)).min(1),
    centre: z.object({ lat: z.number().min(41).max(52), lon: z.number().min(-6).max(10) }).strict(),
    rayon_km: z.number().positive().max(150),
    delai: z.string().min(1).max(120).nullable(),
    url: z.url(),
    lu_le: z.iso.date(),
    valide_le: z.iso.date().nullable(),
  })
  .strict();
export type Fiche = z.infer<typeof schemaFiche>;
export const schemaFichierFiches = z.object({ note: z.string(), fiches: z.array(schemaFiche) }).strict();

/** Ce que l'étape reçoit (même forme que `contact` dans l'app). */
export type Contact = {
  nom: string;
  numero: string;
  source: "gtfs" | "fiche" | "page";
  url: string | null;
  lu_le: string | null;
  verifie: boolean;
  delai: string | null;
};

/** Chiffres seuls, « +33 3 86 » ⇒ « 0386 » : un numéro se cherche dans la page sans ses espaces ni points. */
export function chiffres(numero: string): string {
  const c = numero.replace(/[^0-9+]/g, "");
  return c.startsWith("+33") ? `0${c.slice(3)}` : c.replace(/\+/g, "");
}

/** Vrai si le numéro figure dans le texte de la page (espaces, points, tirets et « +33 » ignorés). */
export function numeroDansPage(numero: string, page: string): boolean {
  const texte = page.replace(/&nbsp;|&#160;/g, " ").replace(/\+33\s*\(?0?\)?\s*/g, "0");
  return texte.replace(/[^0-9]/g, "").includes(chiffres(numero));
}

export type LirePage = (url: string) => Promise<string>;

/** Page publique, 10 s au plus, 2 Mo au plus ; jamais la clé ni un lieu dans la requête. */
export const lirePageHttp: LirePage = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { "user-agent": "Itinhero/0.1 (verification de numeros publics)" } });
  if (!r.ok) throw new Error(`page ${r.status}`);
  const texte = await r.text();
  return texte.slice(0, 2_000_000);
};

export class Annuaire {
  /** id ⇒ date (Paris) où le numéro a été retrouvé sur sa page. */
  private readonly retrouvees = new Map<string, string>();

  constructor(
    private readonly fiches: Fiche[],
    private readonly lirePage: LirePage = lirePageHttp,
  ) {}

  /**
   * Relit la page de chaque fiche candidate (au démarrage puis chaque jour). Une page injoignable ou sans le numéro
   * retire la fiche jusqu'à la lecture suivante. Rend le nombre de fiches candidates retrouvées.
   */
  async verifierPages(aujourdhui: string, signaler: (id: string, e: unknown) => void = () => {}): Promise<number> {
    await Promise.all(
      this.fiches
        .filter((f) => f.valide_le === null)
        .map(async (f) => {
          try {
            if (numeroDansPage(f.numero, await this.lirePage(f.url))) this.retrouvees.set(f.id, aujourdhui);
            else this.retrouvees.delete(f.id);
          } catch (e) {
            this.retrouvees.delete(f.id);
            signaler(f.id, e);
          }
        }),
    );
    return this.retrouvees.size;
  }

  /** Numéros affichables autour d'un point, le plus proche d'abord ; validés avant non vérifiés à distance égale. */
  contactsPres(point: { lat: number; lon: number }, type: Fiche["type"], max = 3): Contact[] {
    return this.fiches
      .filter((f) => f.type === type)
      .map((f) => ({ f, d: distanceMetres(point, f.centre) }))
      .filter(({ f, d }) => d <= f.rayon_km * 1000 && (f.valide_le !== null || this.retrouvees.has(f.id)))
      .sort((a, b) => a.d - b.d || Number(b.f.valide_le !== null) - Number(a.f.valide_le !== null))
      .slice(0, max)
      .map(({ f }) =>
        f.valide_le !== null
          ? { nom: f.nom, numero: f.numero, source: "fiche", url: f.url, lu_le: f.valide_le, verifie: true, delai: f.delai }
          : { nom: f.nom, numero: f.numero, source: "page", url: f.url, lu_le: this.retrouvees.get(f.id) ?? f.lu_le, verifie: false, delai: f.delai },
      );
  }
}
