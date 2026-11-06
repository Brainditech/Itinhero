import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";

import { BoutonSecondaire } from "@/composants/elements";
import type { Candidat } from "@/domaine/api";
import type { CoteBout, Demande } from "@/domaine/demande";
import { demandeDeProposition, type PropositionRecherche } from "@/domaine/discussion";
import { formaterDuree, jourCourt, libelleEtape, parArrivee, phraseVerdict } from "@/domaine/resultat";
import { boutDuCandidat, natureLue } from "@/domaine/suggestions";
import { useDeroulerRecherche, useRecherche, type Recherche } from "@/recherche";
import { couleurs } from "@/theme/jetons";

/** Au plus trois trajets dans la discussion ; la liste entière s'ouvre dans l'onglet Trajet. */
export const TRAJETS_DANS_LA_DISCUSSION = 3;

type Etat =
  | { etat: "en_cours" }
  | { etat: "trouvee"; recherche: Recherche }
  | { etat: "choisir"; cote: CoteBout; candidats: Candidat[]; message: string }
  | { etat: "echec"; message: string };

/**
 * Recherche proposée par l'Assistant (spec 45, D126, invariant 3) : l'app la lance avec la recherche ordinaire (lieux
 * par `GET /v1/lieux`, puis le moteur) et montre les trajets en cartes ; aucun horaire ne vient du texte de Claude.
 * Un lieu ambigu ⇒ la liste des lieux trouvés, à toucher. « Voir ces trajets » ouvre le Résultat.
 */
export function RechercheAssistant({ proposition }: { proposition: PropositionRecherche }) {
  const { demarrer } = useDeroulerRecherche();
  const { setRecherche } = useRecherche();
  const [etat, setEtat] = useState<Etat>({ etat: "en_cours" });
  const demande = useRef<Demande>(demandeDeProposition(proposition));
  // Revue : seule la dernière recherche lancée écrit son résultat, et jamais après le démontage.
  const tour = useRef(0);
  const monte = useRef(true);
  useEffect(
    () => () => {
      monte.current = false;
    },
    [],
  );

  // La recherche ne touche l'état qu'une fois finie ; `lancer` remet d'abord « en cours » (bouton, choix d'un lieu).
  const executer = async (): Promise<Etat> => {
    let trouvee: Recherche | null = null;
    const echec = await demarrer(demande.current, undefined, undefined, (t) => {
      trouvee = t;
    });
    if (trouvee) return { etat: "trouvee", recherche: trouvee };
    if (echec?.candidats && echec.champ) return { etat: "choisir", cote: echec.champ, candidats: echec.candidats, message: echec.message };
    return { etat: "echec", message: echec?.message ?? "La recherche a échoué." };
  };
  const lancer = () => {
    const n = ++tour.current;
    setEtat({ etat: "en_cours" });
    void executer().then((e) => {
      if (monte.current && n === tour.current) setEtat(e);
    });
  };

  useEffect(() => {
    let actif = true;
    const n = ++tour.current;
    void executer().then((e) => {
      if (actif && n === tour.current) setEtat(e);
    });
    return () => {
      actif = false;
    };
    // Lancée une fois, à l'arrivée de la proposition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const p = proposition;
  const titre = `${jourCourt(p.date)} · ${p.sens === "arriver_avant" ? `arriver avant ${p.heure}` : `partir à ${p.heure}`}`;

  return (
    <View className="gap-3 rounded-bouton border border-bordure-carte bg-fond p-4" accessibilityLiveRegion="polite">
      <View className="flex-row items-center gap-2">
        <SymbolView name={{ android: "route", web: "route" }} size={22} tintColor={couleurs.primaire} />
        <Text className="flex-1 font-inter-semibold text-corps text-texte">{titre}</Text>
      </View>

      {etat.etat === "en_cours" ? <Text className="font-inter text-secondaire text-texte-secondaire">Recherche des trajets…</Text> : null}

      {etat.etat === "echec" ? (
        <>
          <Text className="font-inter text-secondaire text-erreur">{etat.message}</Text>
          <BoutonSecondaire libelle="Réessayer" onPress={lancer} />
        </>
      ) : null}

      {etat.etat === "choisir" ? (
        <View className="gap-2">
          <Text className="font-inter-medium text-secondaire text-texte">{etat.message}</Text>
          {etat.candidats.slice(0, 5).map((c, i) => (
            <Pressable
              key={`${c.nom}-${i}`}
              accessibilityRole="button"
              onPress={() => {
                demande.current = { ...demande.current, [etat.cote]: boutDuCandidat(c) };
                lancer();
              }}
              className="min-h-12 justify-center rounded-bouton bg-surface px-3 py-2 active:opacity-70"
            >
              <Text className="font-inter-medium text-corps text-texte">{c.nom}</Text>
              <Text className="font-inter text-badge text-texte-secondaire">
                {[natureLue(c), c.commune, c.code_postal].filter(Boolean).join(", ")}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {etat.etat === "trouvee" ? <Trajets recherche={etat.recherche} onOuvrir={() => {
        setRecherche(etat.recherche);
        router.navigate("/resultat");
      }} /> : null}
    </View>
  );
}

function Trajets({ recherche, onOuvrir }: { recherche: Recherche; onOuvrir: () => void }) {
  const r = recherche.reponse!;
  const verdict = phraseVerdict(r);
  const premieres = [...r.possibilites].sort(parArrivee).slice(0, TRAJETS_DANS_LA_DISCUSSION);
  return (
    <>
      <Text className="font-inter text-secondaire text-texte">{`${recherche.depart.lieu?.nom ?? "Départ"} → ${recherche.arrivee.lieu?.nom ?? "Arrivée"}`}</Text>
      <Text
        className="font-inter-semibold text-corps"
        style={{ color: verdict.etat === "possible" ? couleurs.possible : verdict.etat === "nuit" ? couleurs.avertissement : couleurs.erreur }}
      >
        {verdict.titre}
        {verdict.heureDepart ? ` · départ ${verdict.heureDepart}` : ""}
      </Text>
      {premieres.length === 0 ? <Text className="font-inter text-secondaire text-texte">{verdict.detail}</Text> : null}
      {premieres.map((p, i) => (
        <View key={`${p.depart_utc}-${i}`} className="gap-1 rounded-bouton bg-surface px-3 py-2">
          <Text className="font-inter-semibold text-corps text-texte">{`${p.depart} → ${p.arrivee} · ${formaterDuree(p.duree_minutes)}`}</Text>
          <Text className="font-inter text-badge text-texte-secondaire">
            {p.etapes
              .filter((e) => e.mode !== "marche")
              .map(libelleEtape)
              .join(" · ") || "À pied"}
          </Text>
        </View>
      ))}
      <BoutonSecondaire libelle="Voir ces trajets" onPress={onOuvrir} />
    </>
  );
}
