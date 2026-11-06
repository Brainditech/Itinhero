import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useFocusEffect } from "expo-router";

import type { EtatCarte } from "@/domaine/pack-carte";
import type { Voyage } from "@/domaine/voyages";

import { CarteTropLourde, cartePossible, enregistrerCarte, etatCarteVoyage } from "./packs";

/** Ce que la ligne « Carte » affiche (D99, §3.4). null : l'app ne garde pas de carte, rien à dire. */
export type EtatAffiche = EtatCarte | { etat: "echec" } | { etat: "tropLourde" } | null;

/**
 * État de la carte d'un voyage, relu à chaque retour sur l'écran et toutes les 2 s pendant un téléchargement.
 * `lancer` télécharge (ou reprend) la carte ; `remplacer` : le voyage vient d'être enregistré de nouveau.
 */
export function useCarteVoyage(cle: string | null, voyage: Voyage | null) {
  const [etat, setEtat] = useState<EtatAffiche>(null);
  const monte = useRef(true);
  useEffect(() => {
    monte.current = true;
    return () => {
      monte.current = false;
    };
  }, []);

  const relire = useCallback(() => {
    if (!cle || !cartePossible()) return;
    etatCarteVoyage(cle).then(
      (e) => {
        if (!monte.current) return;
        // Un échec reste affiché tant que rien n'a avancé (pas d'effacement par un « absente »).
        setEtat((avant) => (avant && (avant.etat === "echec" || avant.etat === "tropLourde") && e?.etat === "absente" ? avant : e));
      },
      () => undefined,
    );
  }, [cle]);

  useFocusEffect(relire);

  const enCours = etat?.etat === "enCours";
  useEffect(() => {
    if (!enCours) return;
    const minuterie = setInterval(relire, 2000);
    return () => clearInterval(minuterie);
  }, [enCours, relire]);

  const lancer = useCallback(
    (remplacer: boolean, cleLancee = cle, voyageLance = voyage) => {
      if (!cleLancee || !voyageLance || !cartePossible()) return;
      setEtat({ etat: "enCours", pourcentage: 0 });
      enregistrerCarte(cleLancee, voyageLance, {
        remplacer,
        progression: (pourcentage) => {
          if (monte.current) setEtat({ etat: "enCours", pourcentage });
        },
      }).then(
        () => {
          if (monte.current) setEtat({ etat: "enregistree" });
          AccessibilityInfo.announceForAccessibility("Carte enregistrée");
        },
        (e: unknown) => {
          if (monte.current) setEtat({ etat: e instanceof CarteTropLourde ? "tropLourde" : "echec" });
        },
      );
    },
    [cle, voyage],
  );

  return { etat, lancer };
}
