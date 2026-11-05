import { useEffect, useRef, useState } from "react";
import { Text, View, type ScrollViewInstance } from "react-native";
import { Redirect, router } from "expo-router";
import { SymbolView } from "expo-symbols";

import { Ecran } from "@/composants/Ecran";
import { Lien } from "@/composants/elements";
import { BoutonRepli } from "@/composants/Repli";
import { CartePossibilite } from "@/composants/Trajet";
import { VotreTrajet } from "@/composants/VotreTrajet";
import type { ReponseSens } from "@/domaine/api";
import type { Trajet } from "@/domaine/demande";
import { adresseArrivee, finHoraires, phraseVerdict } from "@/domaine/resultat";
import { useRecherche } from "@/recherche";
import { couleurs, ombreFlottante } from "@/theme/jetons";

/**
 * Résultat (phase 3, maquettes 04 et 04b, spec 10 §4.2, spec 14) : « Votre trajet », verdict, puis une carte
 * par possibilité dans l'ordre du serveur.
 * Pas de tris, de taxi, de prix ni de « Voir le trajet » ici (spec 10, §9) ; toucher une carte déplie ses étapes.
 * Chaque bloc a un chevron qui le replie (spec 14 §11).
 * Avec une fin de rendez-vous (spec 19, D94) : l'aller, puis « Retour », son verdict et ses possibilités.
 */
export default function Resultat() {
  const { recherche } = useRecherche();
  // Issue 0018 : après « Recalculer depuis ici », le Résultat déjà monté reçoit une nouvelle réponse et garde
  // son défilement ; si la page raccourcit (cartes remontées repliées), Android le laisse sous la fin du
  // contenu et l'écran paraît vide. Chaque nouvelle réponse se lit donc depuis le haut.
  const defilement = useRef<ScrollViewInstance>(null);
  const reponseCourante = recherche?.reponse;
  useEffect(() => {
    defilement.current?.scrollTo({ y: 0, animated: false });
  }, [reponseCourante]);
  const depart = recherche?.depart.lieu;
  const arrivee = recherche?.arrivee.lieu;
  if (!recherche?.reponse || !depart || !arrivee) return <Redirect href="/formulaire" />;
  const { reponse, demande } = recherche;
  const horaires = finHoraires([...reponse.possibilites, ...(reponse.retour?.possibilites ?? [])]);
  const modifier = () => router.dismissTo("/formulaire");

  return (
    <Ecran ref={defilement}>
      <VotreTrajet
        demande={demande}
        depart={{ nom: depart.nom, adresse: depart.adresse }}
        arrivee={{ nom: arrivee.nom, adresse: adresseArrivee(demande.arrivee, arrivee.adresse, reponse.arrivee.adresse) }}
        onModifier={modifier}
      />
      <Sens reponse={reponse} trajet="aller" destination={arrivee.nom} date={demande.date} adresse={reponse.arrivee.adresse} />

      {reponse.retour ? (
        <>
          <Text accessibilityRole="header" className="mt-2 font-inter-semibold text-titre-carte text-texte">
            {`Retour vers ${depart.nom}`}
          </Text>
          {/* L'adresse de l'IGN est celle de l'arrivée de l'aller : au retour, on garde celle connue du départ. */}
          <Sens reponse={reponse.retour} trajet="retour" destination={depart.nom} date={demande.date} adresse={depart.adresse} />
        </>
      ) : null}

      {horaires ? (
        <Text className="text-center font-inter-medium text-secondaire text-primaire">{`Horaires valables jusqu'au ${horaires}`}</Text>
      ) : null}
      <View className="items-center">
        <Lien libelle="Modifier la recherche" onPress={modifier} />
      </View>
    </Ecran>
  );
}

/** Un sens du voyage : son verdict, puis une carte par possibilité dans l'ordre du serveur. */
function Sens({
  reponse,
  trajet,
  destination,
  date,
  adresse,
}: {
  reponse: ReponseSens;
  trajet: Trajet;
  destination: string;
  date: string;
  adresse: string | null;
}) {
  return (
    <>
      <BlocVerdict reponse={reponse} trajet={trajet} />
      {reponse.possibilites.map((p, i) => (
        <CartePossibilite
          key={`${trajet}-${p.depart_utc}-${p.arrivee_utc}-${i}`}
          possibilite={p}
          index={i}
          trajet={trajet}
          destination={destination}
          date={date}
          adresse={adresse}
        />
      ))}
    </>
  );
}

function BlocVerdict({ reponse, trajet }: { reponse: ReponseSens; trajet: Trajet }) {
  const verdict = phraseVerdict(reponse, trajet);
  // Replié au départ (spec 14), sauf « Impossible » : aucune carte dessous ne dit pourquoi (issue 0021).
  const [verdictOuvert, setVerdictOuvert] = useState(() => verdict.etat === "impossible");
  // Vert seulement pour « Possible » ; une nuit dehors est en orange avec le triangle (spec 15, D79).
  const teinte = verdict.etat === "possible" ? couleurs.possible : verdict.etat === "nuit" ? couleurs.avertissement : couleurs.erreur;
  const iconeVerdict = verdict.etat === "possible" ? "check_circle" : verdict.etat === "nuit" ? "warning" : "cancel";
  return (
    <View
      accessibilityRole="summary"
      className="overflow-hidden rounded-carte border border-bordure-carte bg-fond"
      style={{ boxShadow: ombreFlottante }}
    >
      <View className="flex-row">
        <View style={{ width: 6, backgroundColor: teinte }} />
        <View className={`flex-1 gap-2 py-5 pl-5 pr-1 ${verdictOuvert ? "" : "pb-3 pt-3"}`}>
          <View className="flex-row items-center gap-2">
            <SymbolView name={{ android: iconeVerdict, web: iconeVerdict }} size={28} tintColor={teinte} />
            <View className="flex-1 flex-row flex-wrap items-baseline gap-x-3">
              <Text className="font-inter-bold text-verdict" style={{ color: teinte }}>
                {verdict.titre}
              </Text>
              {!verdictOuvert && verdict.heureDepart ? (
                <Text className="font-inter-semibold text-corps text-texte" style={{ fontVariant: ["tabular-nums"] }}>
                  {`Départ ${verdict.heureDepart}`}
                </Text>
              ) : null}
            </View>
            <BoutonRepli
              ouvert={verdictOuvert}
              nom={trajet === "retour" ? "Verdict du retour" : "Verdict"}
              onPress={() => setVerdictOuvert((o) => !o)}
            />
          </View>
          {verdictOuvert ? (
            <>
              {verdict.heureDepart ? (
                <Text className="font-inter-bold text-heure-depart text-texte" style={{ fontVariant: ["tabular-nums"] }}>
                  {`Départ ${verdict.heureDepart}`}
                </Text>
              ) : null}
              <Text className="pr-4 font-inter text-corps text-texte">{verdict.detail}</Text>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}
