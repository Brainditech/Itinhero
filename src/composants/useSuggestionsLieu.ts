import { useEffect, useRef, useState } from "react";
import { useSQLiteContext, type SQLiteDatabase } from "expo-sqlite";

import type { Point } from "@/domaine/api";
import type { Bout } from "@/domaine/demande";
import {
  Derniere,
  enAttente,
  etatSuggestions,
  SUGGESTION_ATTENTE_MS,
  texteASuggerer,
  type EtatSuggestions,
} from "@/domaine/suggestions";
import { useClient } from "@/session";
import { lirePositionSiAccordee } from "@/stockage/position";
import { lireDomicileEnBase } from "@/stockage/reglages";

/**
 * Point `proche` des suggestions (D90) : l'autre bout s'il est un lieu connu (lieu choisi, domicile enregistré),
 * sinon la position si l'accès est déjà accordé (sans le demander), sinon rien.
 */
async function procheDe(autre: Bout, db: SQLiteDatabase): Promise<Point | undefined> {
  if (autre.type === "lieu") return { lat: autre.lat, lon: autre.lon };
  if (autre.type === "domicile") {
    const domicile = await lireDomicileEnBase(db);
    if (domicile) return { lat: domicile.lat, lon: domicile.lon };
  }
  return (await lirePositionSiAccordee()) ?? undefined;
}

/** Clé de l'autre bout : les suggestions sont redemandées quand il change (le classement dépend de lui). */
function cleBout(b: Bout): string {
  return b.type === "lieu" ? `lieu:${b.lat},${b.lon}` : b.type;
}

/**
 * Lieux suggérés sous un champ Départ ou Arrivée (spec 18, §4.1) : 350 ms après la dernière touche,
 * dès 3 caractères, tant que le champ a le clavier (`actif`). Seule la réponse au dernier texte compte.
 */
export function useSuggestionsLieu(bout: Bout, autre: Bout, actif: boolean): EtatSuggestions {
  const client = useClient();
  const db = useSQLiteContext();
  const derniere = useRef(new Derniere());
  const autreActuel = useRef(autre);
  const [lu, setLu] = useState<{ pour: string; etat: EtatSuggestions } | null>(null);
  const texte = actif ? texteASuggerer(bout) : null;
  const cleAutre = cleBout(autre);

  useEffect(() => {
    autreActuel.current = autre;
  });

  // Liste fermée : on oublie la précédente, pour ne pas la remontrer à la prochaine ouverture
  // (état ajusté pendant le rendu, sans effet : doc React, « You might not need an effect »).
  if (texte === null && lu !== null) setLu(null);

  useEffect(() => {
    if (texte === null) {
      derniere.current.oublier();
      return;
    }
    const n = derniere.current.nouvelle();
    const minuterie = setTimeout(() => {
      void (async () => {
        let etat: EtatSuggestions;
        try {
          const proche = await procheDe(autreActuel.current, db);
          etat = etatSuggestions(await client.lieux(texte, proche), texte);
        } catch {
          etat = { etat: "echec" };
        }
        if (derniere.current.estDerniere(n)) setLu({ pour: texte, etat });
      })();
    }, SUGGESTION_ATTENTE_MS);
    return () => clearTimeout(minuterie);
  }, [texte, cleAutre, client, db]);

  if (texte === null) return { etat: "ferme" };
  if (lu && lu.pour === texte) return lu.etat;
  return enAttente(lu?.etat ?? { etat: "ferme" });
}
