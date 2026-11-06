import { useCallback, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";

import { supprimerCarte } from "@/carte/packs";
import { useCarteVoyage } from "@/carte/useCarteVoyage";
import { Ecran } from "@/composants/Ecran";
import { CarteFlottante, Lien } from "@/composants/elements";
import { RectangleVoyage } from "@/composants/RectangleVoyage";
import { maintenantAParis } from "@/domaine/demande";
import { rangerVoyages, resumeVoyage, type Voyage } from "@/domaine/voyages";
import { useOuvrirVoyage } from "@/recherche";
import { lireVoyages, separerAnciensVoyages, supprimerVoyage, type LigneVoyage } from "@/stockage/voyages";
import { annulerRappels } from "@/rappels";

type VoyageLu = Voyage & { cle: string };

/**
 * Mes trajets (phase 5, spec 22, D98) : les trajets enregistrés sur le téléphone, rouverts sans réseau.
 * Un petit rectangle par trajet, l'aller et le retour à part (spec 24, D100, D101), avec sa corbeille ;
 * le toucher ouvre le trajet, où le crayon le modifie.
 * La pastille de carte (spec 23, D99) dit si la carte de la zone est gardée. Pas encore de « Rappels » ni de
 * bandeau « Hors connexion » : ils arrivent avec leurs cases.
 */
export default function MesTrajets() {
  const db = useSQLiteContext();
  const ouvrir = useOuvrirVoyage();
  // undefined : pas encore lu.
  const [lignes, setLignes] = useState<LigneVoyage[] | undefined>(undefined);
  const [erreur, setErreur] = useState(false);

  const relire = useCallback(() => {
    let actif = true;
    // Les voyages d'avant D101 enregistrés avec leur retour sont d'abord coupés en deux ; leur carte part.
    // Un échec ici n'empêche pas de lire la liste : l'ancien voyage reste tel quel.
    separerAnciensVoyages(db)
      .catch(() => [] as string[])
      .then((anciennes) => Promise.all(anciennes.map((cle) => supprimerCarte(cle).catch(() => undefined))))
      .then(() => lireVoyages(db))
      .then(
        (l) => {
          if (!actif) return;
          setLignes(l);
          setErreur(false);
        },
        () => {
          if (!actif) return;
          setLignes([]);
          setErreur(true);
        },
      );
    return () => {
      actif = false;
    };
  }, [db]);

  // Relu à chaque retour sur l'onglet, après un enregistrement.
  useFocusEffect(relire);

  function supprimer(cle: string, nom: string) {
    Alert.alert("Supprimer ce trajet ?", nom, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => {
          // La carte du voyage part avec lui (D99, §3.5) ; un échec ici ne garde pas le voyage.
          supprimerVoyage(db, cle)
            .then(() => supprimerCarte(cle).catch(() => undefined))
            .then(() => annulerRappels(cle).catch(() => undefined))
            .then(relire, () => setErreur(true));
        },
      },
    ]);
  }

  const lisibles: VoyageLu[] = (lignes ?? []).flatMap((l) => (l.voyage ? [{ ...l.voyage, cle: l.cle }] : []));
  const illisibles = (lignes ?? []).filter((l) => !l.voyage);
  const { aVenir, passes } = rangerVoyages(lisibles, maintenantAParis(new Date()).date);
  const rectangle = (v: VoyageLu, passe: boolean) => (
    <Rectangle key={v.cle} voyage={v} passe={passe} onAfficher={() => ouvrir(v.cle, v)} onSupprimer={supprimer} />
  );

  return (
    <Ecran>
      <Text accessibilityRole="header" className="font-inter-bold text-titre-ecran text-texte">
        Mes trajets
      </Text>

      {erreur ? (
        <Text accessibilityRole="alert" className="font-inter-medium text-corps text-erreur">
          Les trajets enregistrés n&apos;ont pas pu être lus sur le téléphone.
        </Text>
      ) : null}

      {lignes && lignes.length === 0 && !erreur ? (
        <CarteFlottante>
          <Text className="font-inter text-corps text-texte">
            Aucun trajet enregistré. Cherchez un trajet, puis touchez la disquette en haut du résultat.
          </Text>
        </CarteFlottante>
      ) : null}

      {/* Écart entre rectangles : ecart-cartes (12 dp), dans l'écart de 16 dp de l'écran. */}
      {aVenir.length > 0 ? <View className="gap-3">{aVenir.map((v) => rectangle(v, false))}</View> : null}

      {passes.length > 0 ? (
        <Text accessibilityRole="header" className="mt-2 font-inter-semibold text-titre-carte text-texte">
          Passés
        </Text>
      ) : null}
      {passes.length > 0 ? <View className="gap-3">{passes.map((v) => rectangle(v, true))}</View> : null}

      {illisibles.map((l) => (
        <CarteFlottante key={l.cle}>
          <View className="gap-2">
            <Text className="font-inter text-corps text-texte">Ce trajet enregistré ne peut plus être lu.</Text>
            <View className="items-start">
              <Lien libelle="Supprimer" onPress={() => supprimer(l.cle, "Trajet illisible")} />
            </View>
          </View>
        </CarteFlottante>
      ))}
    </Ecran>
  );
}

/** Un voyage : son rectangle (spec 24, D100) et l'état de sa carte (spec 23, D99). */
function Rectangle({
  voyage,
  passe,
  onAfficher,
  onSupprimer,
}: {
  voyage: VoyageLu;
  passe: boolean;
  onAfficher: () => void;
  onSupprimer: (cle: string, nom: string) => void;
}) {
  const r = resumeVoyage(voyage);
  const carte = useCarteVoyage(voyage.cle, voyage);
  return (
    <RectangleVoyage
      resume={r}
      passe={passe}
      carte={carte.etat}
      onAfficher={onAfficher}
      onSupprimer={() => onSupprimer(voyage.cle, `${r.jour} · ${r.titre}`)}
      onEnregistrerCarte={() => carte.lancer(false)}
    />
  );
}
