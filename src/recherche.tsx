import { createContext, use, useState, type ReactNode } from "react";
import { router } from "expo-router";

import { messageEchec, type Candidat, type Point, type ReponseItineraires } from "@/domaine/api";
import { versRequeteItineraires, type Demande } from "@/domaine/demande";
import type { Depart } from "@/domaine/resultat";
import { useClient, useSession } from "@/session";

// Recherche en cours dans la pile de l'onglet Chercher : Formulaire ⇒ Confirmation ⇒ Résultat.
// En mémoire seulement : rien n'est gardé ni envoyé ailleurs qu'à l'API (invariant 6).

export type Recherche = {
  demande: Demande;
  depart: Depart;
  pointDepart: Point;
  candidats: Candidat[];
  arrivee: Candidat | null;
  reponse: ReponseItineraires | null;
};

type ContexteValeur = { recherche: Recherche | null; setRecherche: (r: Recherche | null) => void };

const Contexte = createContext<ContexteValeur | null>(null);

export function FournisseurRecherche({ children }: { children: ReactNode }) {
  const [recherche, setRecherche] = useState<Recherche | null>(null);
  return <Contexte value={{ recherche, setRecherche }}>{children}</Contexte>;
}

export function useRecherche(): ContexteValeur {
  const v = use(Contexte);
  if (!v) throw new Error("useRecherche hors de FournisseurRecherche");
  return v;
}

/**
 * Lance `POST /v1/itineraires` pour le lieu choisi, puis ouvre le Résultat.
 * Rend le message à afficher en cas d'échec, ou null (succès, ou clé refusée : l'écran de la clé s'ouvre).
 */
export function useChercherItineraires() {
  const client = useClient();
  const { oublierCle } = useSession();
  const { setRecherche } = useRecherche();
  return async (base: Omit<Recherche, "arrivee" | "reponse">, arrivee: Candidat): Promise<string | null> => {
    const r = await client.itineraires(versRequeteItineraires(base.demande, base.pointDepart, arrivee));
    if (r.etat === "cle_refusee") {
      await oublierCle();
      return null;
    }
    if (r.etat !== "ok") return messageEchec(r);
    setRecherche({ ...base, arrivee, reponse: r.donnees });
    router.push("/resultat");
    return null;
  };
}
