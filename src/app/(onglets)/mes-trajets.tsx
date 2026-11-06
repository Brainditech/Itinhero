import { useCallback, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { SymbolView, type AndroidSymbol } from "expo-symbols";

import { supprimerCarte } from "@/carte/packs";
import { useCarteVoyage } from "@/carte/useCarteVoyage";
import { Ecran } from "@/composants/Ecran";
import { BoutonPrincipal, BoutonSecondaire, CarteFlottante, Lien } from "@/composants/elements";
import { LigneCarte } from "@/composants/LigneCarte";
import { maintenantAParis } from "@/domaine/demande";
import { rangerVoyages, resumeVoyage, type Voyage } from "@/domaine/voyages";
import { useOuvrirVoyage } from "@/recherche";
import { lireVoyages, supprimerVoyage, type LigneVoyage } from "@/stockage/voyages";
import { couleurs } from "@/theme/jetons";

type VoyageLu = Voyage & { cle: string };

/**
 * Mes trajets (phase 5, maquette 06, spec 22, D98) : les voyages enregistrés sur le téléphone, rouverts sans réseau.
 * Le prochain voyage a le bouton principal sous sa carte ; les autres, un bouton secondaire dans la leur.
 * « Carte enregistrée » (spec 23, D99) dit si la carte de la zone est gardée. Pas encore de « Rappels » ni de
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
    lireVoyages(db).then(
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

  // Relu à chaque retour sur l'onglet, après « Enregistrer ce voyage ».
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
            .then(relire, () => setErreur(true));
        },
      },
    ]);
  }

  const lisibles: VoyageLu[] = (lignes ?? []).flatMap((l) => (l.voyage ? [{ ...l.voyage, cle: l.cle }] : []));
  const illisibles = (lignes ?? []).filter((l) => !l.voyage);
  const { aVenir, passes } = rangerVoyages(lisibles, maintenantAParis(new Date()).date);
  const [prochain, ...autres] = aVenir;

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
            Aucun trajet enregistré. Cherchez un trajet, puis touchez « Enregistrer ce voyage ».
          </Text>
        </CarteFlottante>
      ) : null}

      {prochain ? (
        <>
          <CarteVoyage voyage={prochain} onSupprimer={supprimer} />
          <BoutonPrincipal libelle="Ouvrir le trajet" onPress={() => ouvrir(prochain)} />
        </>
      ) : null}
      {autres.map((v) => (
        <CarteVoyage key={v.cle} voyage={v} onOuvrir={() => ouvrir(v)} onSupprimer={supprimer} />
      ))}

      {passes.length > 0 ? (
        <Text accessibilityRole="header" className="mt-2 font-inter-semibold text-titre-carte text-texte">
          Passés
        </Text>
      ) : null}
      {passes.map((v) => (
        <CarteVoyage key={v.cle} voyage={v} onOuvrir={() => ouvrir(v)} onSupprimer={supprimer} />
      ))}

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

function Ligne({ icone, teinte, texte }: { icone: AndroidSymbol; teinte: string; texte: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <SymbolView name={{ android: icone, web: icone }} size={24} tintColor={teinte} />
      <Text className="flex-1 font-inter text-corps text-texte">{texte}</Text>
    </View>
  );
}

/** Carte d'un voyage (maquette 06) : jour, départ, lieux, horaire prévu, sans réseau, retour, enregistrement. */
function CarteVoyage({
  voyage,
  onOuvrir,
  onSupprimer,
}: {
  voyage: VoyageLu;
  /** Absent pour le prochain voyage : son bouton principal est sous la carte. */
  onOuvrir?: () => void;
  onSupprimer: (cle: string, nom: string) => void;
}) {
  const r = resumeVoyage(voyage);
  const carte = useCarteVoyage(voyage.cle, voyage);
  return (
    <CarteFlottante>
      <View className="gap-3">
        <View className="gap-1">
          <Text className="font-inter text-corps text-texte-secondaire">{r.jour}</Text>
          {r.depart ? (
            <Text className="font-inter-bold text-heure-depart text-texte" style={{ fontVariant: ["tabular-nums"] }}>
              {r.depart}
            </Text>
          ) : null}
          <Text className="font-inter-medium text-corps text-texte">{r.titre}</Text>
        </View>
        {/* Invariant 12 : aucun suivi en direct n'existe encore pour un voyage enregistré. */}
        <View className="flex-row items-center gap-2 self-start rounded-full bg-surface px-3 py-2">
          <SymbolView name={{ android: "schedule", web: "schedule" }} size={20} tintColor={couleurs["texte-secondaire"]} />
          <Text className="font-inter text-badge text-texte-secondaire">Horaire prévu, sans suivi en direct</Text>
        </View>
        <View className="gap-3 border-t border-bordure-carte pt-3">
          <Ligne icone="check_circle" teinte={couleurs.possible} texte="Disponible sans réseau" />
          <LigneCarte etat={carte.etat} onEnregistrer={() => carte.lancer(false)} />
          {r.retour ? <Ligne icone="undo" teinte={couleurs.primaire} texte={r.retour} /> : null}
        </View>
        <Text className="font-inter text-secondaire text-texte-secondaire">{r.enregistre}</Text>
        {onOuvrir ? <BoutonSecondaire libelle="Ouvrir le trajet" onPress={onOuvrir} /> : null}
        <View className="items-start">
          <Lien libelle="Supprimer" onPress={() => onSupprimer(voyage.cle, `${r.jour} · ${r.titre}`)} />
        </View>
      </View>
    </CarteFlottante>
  );
}
