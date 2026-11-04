import { heureParis, instantParis } from "../temps.js";

/**
 * Limites de débit en mémoire, par empreinte de clé (D56) : une fenêtre par minute d'horloge
 * et une par jour de Paris. Rien n'est écrit sur disque ; un redémarrage remet à zéro.
 */
export type Refus = { fenetre: "minute" | "jour"; retryAfterSecondes: number };

type Compteur = { minute: number; nMinute: number; jour: string; nJour: number };

export class Limites {
  private readonly compteurs = new Map<string, Compteur>();

  constructor(
    private readonly parMinute: number,
    private readonly parJour: number,
    private readonly maintenant: () => Date = () => new Date(),
  ) {}

  /** Compte une requête ; renvoie le refus s'il y a dépassement (la requête refusée n'est pas comptée). */
  compter(empreinte: string): Refus | null {
    const t = this.maintenant();
    const minute = Math.floor(t.getTime() / 60_000);
    const jour = heureParis(t).jour;
    let c = this.compteurs.get(empreinte);
    if (!c) {
      c = { minute, nMinute: 0, jour, nJour: 0 };
      this.compteurs.set(empreinte, c);
    }
    if (c.minute !== minute) {
      c.minute = minute;
      c.nMinute = 0;
    }
    if (c.jour !== jour) {
      c.jour = jour;
      c.nJour = 0;
    }
    if (c.nJour >= this.parJour) {
      const minuit = instantParis(jour, 1440).getTime();
      return { fenetre: "jour", retryAfterSecondes: Math.max(1, Math.ceil((minuit - t.getTime()) / 1000)) };
    }
    if (c.nMinute >= this.parMinute) {
      return { fenetre: "minute", retryAfterSecondes: Math.max(1, Math.ceil(((minute + 1) * 60_000 - t.getTime()) / 1000)) };
    }
    c.nMinute++;
    c.nJour++;
    return null;
  }
}
