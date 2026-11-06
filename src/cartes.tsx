import { createContext, use, useCallback, useEffect, useState, type ReactNode } from "react";
import { useSQLiteContext } from "expo-sqlite";

import { enregistrerCartesEnBase, lireCartesEnBase } from "@/stockage/reglages";

/** Cartes de réduction cochées (spec 43, invariant 7) : lues une fois, partagées par le Résultat et les Réglages. */
type Cartes = { cartes: readonly string[]; basculer: (carte: string) => void };
const Contexte = createContext<Cartes>({ cartes: [], basculer: () => {} });

export function FournisseurCartes({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [cartes, setCartes] = useState<readonly string[]>([]);
  useEffect(() => {
    void lireCartesEnBase(db).then(setCartes, () => setCartes([]));
  }, [db]);
  const basculer = useCallback(
    (carte: string) =>
      setCartes((avant) => {
        const apres = avant.includes(carte) ? avant.filter((c) => c !== carte) : [...avant, carte];
        void enregistrerCartesEnBase(db, [...apres]).catch(() => undefined);
        return apres;
      }),
    [db],
  );
  return <Contexte value={{ cartes, basculer }}>{children}</Contexte>;
}

export function useCartes(): Cartes {
  return use(Contexte);
}
