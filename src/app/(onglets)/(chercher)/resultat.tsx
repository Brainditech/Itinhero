import { useState } from "react";
import { Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { SymbolView } from "expo-symbols";

import { Ecran } from "@/composants/Ecran";
import { Lien } from "@/composants/elements";
import { BoutonRepli } from "@/composants/Repli";
import { CartePossibilite } from "@/composants/Trajet";
import { VotreTrajet } from "@/composants/VotreTrajet";
import { adresseArrivee, finHoraires, phraseVerdict } from "@/domaine/resultat";
import { useRecherche } from "@/recherche";
import { couleurs, ombreFlottante } from "@/theme/jetons";

/**
 * Résultat (phase 3, maquettes 04 et 04b, spec 10 §4.2, spec 14) : « Votre trajet », verdict, puis une carte
 * par possibilité dans l'ordre du serveur.
 * Pas de tris, de taxi, de prix ni de « Voir le trajet » ici (spec 10, §9) ; toucher une carte déplie ses étapes.
 * Chaque bloc a un chevron qui le replie (spec 14 §11).
 */
export default function Resultat() {
  const { recherche } = useRecherche();
  const [verdictOuvert, setVerdictOuvert] = useState(false);
  const depart = recherche?.depart.lieu;
  const arrivee = recherche?.arrivee.lieu;
  if (!recherche?.reponse || !depart || !arrivee) return <Redirect href="/formulaire" />;
  const { reponse, demande } = recherche;
  const verdict = phraseVerdict(reponse);
  // Vert seulement pour « Possible » ; une nuit dehors est en orange avec le triangle (spec 15, D79).
  const teinte = verdict.etat === "possible" ? couleurs.possible : verdict.etat === "nuit" ? couleurs.avertissement : couleurs.erreur;
  const iconeVerdict = verdict.etat === "possible" ? "check_circle" : verdict.etat === "nuit" ? "warning" : "cancel";
  const horaires = finHoraires(reponse.possibilites);
  const modifier = () => router.dismissTo("/formulaire");

  return (
    <Ecran>
      <VotreTrajet
        demande={demande}
        depart={{ nom: depart.nom, adresse: depart.adresse }}
        arrivee={{ nom: arrivee.nom, adresse: adresseArrivee(demande.arrivee, arrivee.adresse, reponse.arrivee.adresse) }}
        onModifier={modifier}
      />
      <View
        accessibilityRole="summary"
        className="overflow-hidden rounded-carte border border-bordure-carte bg-fond"
        style={{ boxShadow: ombreFlottante }}
      >
        <View className="flex-row">
          <View style={{ width: 6, backgroundColor: teinte }} />
          <View className={`flex-1 gap-2 py-5 pl-5 pr-1 ${verdictOuvert ? "" : "pb-3 pt-3"}`}>
            <View className="flex-row items-center gap-2">
              <SymbolView
                name={{ android: iconeVerdict, web: iconeVerdict }}
                size={28}
                tintColor={teinte}
              />
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
              <BoutonRepli ouvert={verdictOuvert} nom="Verdict" onPress={() => setVerdictOuvert((o) => !o)} />
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

      {reponse.possibilites.map((p, i) => (
        <CartePossibilite
          key={`${p.depart_utc}-${p.arrivee_utc}-${i}`}
          possibilite={p}
          index={i}
          destination={arrivee.nom}
          date={demande.date}
          adresse={reponse.arrivee.adresse}
        />
      ))}

      {horaires ? (
        <Text className="text-center font-inter-medium text-secondaire text-primaire">{`Horaires valables jusqu'au ${horaires}`}</Text>
      ) : null}
      <View className="items-center">
        <Lien libelle="Modifier la recherche" onPress={modifier} />
      </View>
    </Ecran>
  );
}
