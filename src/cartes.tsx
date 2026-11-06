import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSQLiteContext } from "expo-sqlite";

import { enregistrerCartesEnBase, lireCartesEnBase } from "@/stockage/reglages";

/** Cartes de réduction cochées (spec 43, invariant 7) : lues une fois, partagées par le Résultat et les Réglages. */
type Cartes = { cartes: readonly string[]; basculer: (carte: string) => void };
const Contexte = createContext<Cartes>({ cartes: [], basculer: () => {} });

export function FournisseurCartes({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [cartes, setCartes] = useState<readonly string[]>([]);
  // Revue : une case touchée avant la fin de la lecture n'est pas effacée par elle.
  const touchee = useRef(false);
  const courantes = useRef<readonly string[]>([]);
  useEffect(() => {
    void lireCartesEnBase(db).then(
      (lues) => {
        if (touchee.current) return;
        courantes.current = lues;
        setCartes(lues);
      },
      () => undefined,
    );
  }, [db]);
  const basculer = useCallback(
    (carte: string) => {
      touchee.current = true;
      const avant = courantes.current;
      const apres = avant.includes(carte) ? avant.filter((c) => c !== carte) : [...avant, carte];
      courantes.current = apres;
      setCartes(apres);
      // Écriture hors de la mise à jour d'état (qui doit rester pure).
      void enregistrerCartesEnBase(db, [...apres]).catch(() => undefined);
    },
    [db],
  );
  return <Contexte value={{ cartes, basculer }}>{children}</Contexte>;
}

export function useCartes(): Cartes {
  return use(Contexte);
}
