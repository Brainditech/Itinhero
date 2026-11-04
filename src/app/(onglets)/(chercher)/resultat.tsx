import { Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { SymbolView } from "expo-symbols";

import { Ecran } from "@/composants/Ecran";
import { Lien } from "@/composants/elements";
import { CartePossibilite } from "@/composants/Trajet";
import { finHoraires, jourCourt, phraseVerdict } from "@/domaine/resultat";
import { useRecherche } from "@/recherche";
import { couleurs, ombreFlottante } from "@/theme/jetons";

/**
 * Résultat (phase 3, maquette 04, spec 10 §4.2) : verdict, puis une carte par possibilité dans l'ordre du serveur.
 * Pas de tris, de taxi, de prix ni de « Voir le trajet » ici (spec 10, §9) ; toucher une carte déplie ses étapes.
 */
export default function Resultat() {
  const { recherche } = useRecherche();
  if (!recherche?.reponse || !recherche.arrivee) return <Redirect href="/formulaire" />;
  const { reponse, arrivee } = recherche;
  const verdict = phraseVerdict(reponse);
  const horaires = finHoraires(reponse.possibilites);

  return (
    <Ecran>
      <View
        accessibilityRole="summary"
        className="overflow-hidden rounded-carte border border-bordure-carte bg-fond"
        style={{ boxShadow: ombreFlottante }}
      >
        <View className="flex-row">
          <View style={{ width: 6, backgroundColor: verdict.possible ? couleurs.possible : couleurs.erreur }} />
          <View className="flex-1 gap-2 p-5">
            <Text className="font-inter text-secondaire text-texte-secondaire">{`${jourCourt(reponse.demande.date)} · ${arrivee.nom}`}</Text>
            <View className="flex-row items-center gap-2">
              <SymbolView
                name={verdict.possible ? { android: "check_circle", web: "check_circle" } : { android: "cancel", web: "cancel" }}
                size={28}
                tintColor={verdict.possible ? couleurs.possible : couleurs.erreur}
              />
              <Text
                className="font-inter-bold text-verdict"
                style={{ color: verdict.possible ? couleurs.possible : couleurs.erreur }}
              >
                {verdict.titre}
              </Text>
            </View>
            {verdict.heureDepart ? (
              <Text className="font-inter-bold text-heure-depart text-texte" style={{ fontVariant: ["tabular-nums"] }}>
                {`Départ ${verdict.heureDepart}`}
              </Text>
            ) : null}
            <Text className="font-inter text-corps text-texte">{verdict.detail}</Text>
          </View>
        </View>
      </View>

      {reponse.possibilites.map((p, i) => (
        <CartePossibilite
          key={`${p.depart_utc}-${p.arrivee_utc}-${i}`}
          possibilite={p}
          destination={arrivee.nom}
          adresse={reponse.arrivee.adresse}
        />
      ))}

      {horaires ? (
        <Text className="text-center font-inter-medium text-secondaire text-primaire">{`Horaires valables jusqu'au ${horaires}`}</Text>
      ) : null}
      <View className="items-center">
        <Lien libelle="Modifier la recherche" onPress={() => router.dismissTo("/formulaire")} />
      </View>
    </Ecran>
  );
}
