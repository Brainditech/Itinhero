import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { SymbolView } from "expo-symbols";

import { Ecran } from "@/composants/Ecran";
import { BoutonPrincipal, CarteErreur, Lien } from "@/composants/elements";
import type { Candidat } from "@/domaine/api";
import { detailCandidat, sousTitreDemande } from "@/domaine/resultat";
import { useChercherItineraires, useRecherche } from "@/recherche";
import { couleurs, ombreFlottante } from "@/theme/jetons";

/** Un candidat, choix unique (bouton radio à droite), comme la maquette 03. */
function LigneCandidat({ candidat, choisi, onPress }: { candidat: Candidat; choisi: boolean; onPress: () => void }) {
  const detail = detailCandidat(candidat);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: choisi }}
      onPress={onPress}
      className={`flex-row items-center gap-4 rounded-carte bg-fond p-5 ${choisi ? "border-2 border-primaire" : "border border-bordure-carte"}`}
      style={{ boxShadow: ombreFlottante }}
    >
      <SymbolView name={{ android: "location_on", web: "location_on" }} size={28} tintColor={couleurs.primaire} />
      <View className="flex-1">
        <Text className="font-inter-semibold text-titre-carte text-texte">{candidat.nom}</Text>
        {detail ? <Text className="font-inter text-secondaire text-texte-secondaire">{detail}</Text> : null}
      </View>
      <View
        className={`h-7 w-7 items-center justify-center rounded-full border-2 ${choisi ? "border-primaire" : "border-bordure-carte"}`}
      >
        {choisi ? <View className="h-4 w-4 rounded-full bg-primaire" /> : null}
      </View>
    </Pressable>
  );
}

/**
 * Confirmation du lieu (phase 2, maquette 03) : ouverte quand `/v1/lieux` rend plusieurs candidats.
 * Le premier est choisi d'office ; « C'est ce lieu » lance la recherche des trajets.
 */
export default function Confirmation() {
  const { recherche } = useRecherche();
  const chercherItineraires = useChercherItineraires();
  const [choix, setChoix] = useState(0);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | undefined>();

  // Ouvert sans recherche (application relancée sur cet écran) : retour au formulaire.
  if (!recherche) return <Redirect href="/formulaire" />;
  const base = recherche;

  async function confirmer() {
    if (enCours) return;
    const arrivee = base.candidats[choix];
    if (!arrivee) return;
    setEnCours(true);
    setErreur(undefined);
    try {
      const echec = await chercherItineraires(base, arrivee);
      if (echec) setErreur(echec);
    } catch {
      setErreur("La recherche a échoué.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Ecran
      bas={<BoutonPrincipal libelle={enCours ? "Recherche en cours…" : "C'est ce lieu"} onPress={confirmer} desactive={enCours} />}
    >
      <View className="gap-1">
        <Text accessibilityRole="header" className="font-inter-bold text-titre-ecran text-texte">
          Quel lieu ?
        </Text>
        <Text className="font-inter text-secondaire text-texte-secondaire">{sousTitreDemande(base.demande, base.depart)}</Text>
      </View>
      <View accessibilityRole="radiogroup" className="gap-3">
        {base.candidats.map((c, i) => (
          <LigneCandidat key={`${c.nom}-${c.lat}-${c.lon}`} candidat={c} choisi={i === choix} onPress={() => setChoix(i)} />
        ))}
      </View>
      <View className="items-center">
        <Lien libelle="Saisir l'adresse moi-même" onPress={() => router.back()} />
      </View>
      {erreur ? <CarteErreur message={erreur} onReessayer={confirmer} /> : null}
    </Ecran>
  );
}
