import type { Etape, EtatCourse, Possibilite } from "./api";
import { decouperGlossaire, type Morceau } from "./glossaire";
import { phraseMarche, phraseTrajetVehicule } from "./guidage";
import {
  attenteApres,
  directionEtape,
  formaterAttente,
  formaterDuree,
  libelleEtape,
  phraseMontee,
  phraseReservation,
  phraseTaxi,
} from "./resultat";
import { libelleEtat } from "./temps-reel";

/**
 * Frise verticale d'une possibilité (spec 51, D134) : ce que la carte dépliée affiche, ligne par ligne. Les heures
 * sont celles du serveur (invariant 3) ; sans état reçu, l'horaire est « prévu » (invariant 12).
 */
export type LigneFrise =
  | {
      type: "etape";
      index: number;
      heure: string;
      mode: Etape["mode"];
      titre: string;
      glossaire: Morceau[];
      direction: string | null;
      phrase: string;
      exploitant: string | null;
      reservation: string | null;
      horaire: ReturnType<typeof libelleEtat> | null;
    }
  | { type: "attente"; texte: string }
  | { type: "arrivee"; heure: string };

export function lignesFrise(p: Possibilite, etats: EtatCourse[] = []): LigneFrise[] {
  const premiereMontee = p.etapes.findIndex((e) => e.mode !== "marche");
  const montee = phraseMontee(p);
  const titres = p.etapes.map((e) => (e.mode === "marche" ? "Marche" : libelleEtape(e)));
  const glossaires = decouperGlossaire(titres);
  const lignes: LigneFrise[] = [];
  p.etapes.forEach((e, i) => {
    const marche = e.mode === "marche";
    const suivie = !marche && e.mode !== "taxi";
    lignes.push({
      type: "etape",
      index: i,
      heure: e.depart,
      mode: e.mode,
      titre: titres[i],
      glossaire: glossaires[i],
      direction: marche ? null : directionEtape(e),
      phrase: marche ? phraseMarche(e, p.etapes[i + 1]) : phraseTrajetVehicule(e, formaterDuree(e.duree_minutes)),
      exploitant: marche ? null : (e.exploitant ?? null),
      reservation: marche ? null : (phraseReservation(e) ?? phraseTaxi(e)),
      horaire: suivie ? libelleEtat(etats.find((x) => !!e.course && x.course === e.course)) : null,
    });
    const attente = attenteApres(p.etapes, i);
    // Avant la première montée, la ligne dit l'heure d'arrivée à l'arrêt et le passage du véhicule (D68).
    const texte = i === premiereMontee - 1 && montee ? montee : attente !== null ? `Attente ${formaterAttente(attente)}` : null;
    if (texte) lignes.push({ type: "attente", texte });
  });
  lignes.push({ type: "arrivee", heure: p.arrivee });
  return lignes;
}
