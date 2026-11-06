import { Pressable, Text, View } from "react-native";
import { SymbolView, type AndroidSymbol } from "expo-symbols";

import type { EtatAffiche } from "@/carte/useCarteVoyage";
import { MenuActions } from "@/composants/MenuActions";
import type { ResumeSens, ResumeVoyage } from "@/domaine/voyages";
import { couleurs, ombreFlottante } from "@/theme/jetons";

const TABULAIRE = { fontVariant: ["tabular-nums" as const] };

/**
 * Rectangle d'un voyage dans Mes trajets (spec 24, D100, §3.1) : liseré (indigo à venir, gris passé), jour, lieux,
 * aller et retour, pastilles ; « ⋮ » ouvre Afficher, Modifier, Supprimer. Toucher le rectangle ouvre le trajet.
 * TalkBack lit le rectangle d'un bloc (`resume.phrase`) ; le menu et la pastille de carte restent à part.
 */
export function RectangleVoyage({
  resume,
  passe,
  carte,
  onAfficher,
  onModifier,
  onSupprimer,
  onEnregistrerCarte,
}: {
  resume: ResumeVoyage;
  passe: boolean;
  carte: EtatAffiche;
  onAfficher: () => void;
  onModifier: () => void;
  onSupprimer: () => void;
  onEnregistrerCarte: () => void;
}) {
  return (
    <View className="flex-row overflow-hidden rounded-bouton border border-bordure-carte bg-fond" style={{ boxShadow: ombreFlottante }}>
      <View style={{ width: 4, backgroundColor: passe ? couleurs["bordure-carte"] : couleurs.primaire }} />
      <View className="flex-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={resume.phrase}
          accessibilityHint="Ouvre le trajet"
          onPress={onAfficher}
          className="gap-2 active:bg-surface"
          style={{ paddingTop: 12, paddingBottom: 10, paddingLeft: 16, paddingRight: 12 }}
        >
          {/* Marge à droite : la place du bouton « ⋮ », posé par-dessus en haut à droite. */}
          <Text className="font-inter-semibold text-badge text-texte-secondaire" style={{ paddingRight: 48 }}>
            {resume.jour}
          </Text>
          <Text numberOfLines={2} className="font-inter-semibold text-titre-carte text-texte" style={{ paddingRight: 32 }}>
            {resume.titre}
          </Text>
          <View className="gap-1" style={{ paddingTop: 4 }}>
            <LigneSens libelle="Aller" sens={resume.aller} />
            {resume.retour ? <LigneSens libelle="Retour" sens={resume.retour} /> : null}
          </View>
        </Pressable>
        <View className="flex-row flex-wrap gap-2" style={{ paddingBottom: 12, paddingLeft: 16, paddingRight: 12 }}>
          <Pastille icone="check_circle" teinte={couleurs.possible} texte="Sans réseau" nom="Disponible sans réseau" />
          <PastilleCarte etat={carte} onEnregistrer={onEnregistrerCarte} />
          <Pastille icone="schedule" teinte={couleurs["prevu-texte"]} texte="Prévu" nom="Horaire prévu, sans suivi en direct" />
        </View>
        <View style={{ position: "absolute", top: 4, right: 4 }}>
          <MenuActions
            nom={`Actions du trajet ${resume.jour}, ${resume.titre}`}
            actions={[
              { icone: "visibility", libelle: "Afficher", onPress: onAfficher },
              { icone: "edit", libelle: "Modifier", onPress: onModifier },
              { icone: "delete", libelle: "Supprimer", onPress: onSupprimer, danger: true },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

function LigneSens({ libelle, sens }: { libelle: string; sens: ResumeSens }) {
  return (
    <View className="flex-row flex-wrap items-baseline gap-x-3">
      <Text className="w-14 font-inter-medium text-badge text-texte-secondaire">{libelle}</Text>
      {sens.possible ? (
        <>
          <Text className="font-inter-bold text-corps text-texte" style={TABULAIRE}>
            {`${sens.depart} → ${sens.arrivee}`}
          </Text>
          <Text className="font-inter text-badge text-texte-secondaire" style={TABULAIRE}>
            {`${sens.duree} · ${sens.changements}`}
          </Text>
        </>
      ) : (
        <Text className="font-inter-medium text-badge text-erreur">{sens.texte}</Text>
      )}
    </View>
  );
}

function Pastille({
  icone,
  teinte,
  texte,
  nom,
  classeTexte = "text-texte-secondaire",
  onPress,
}: {
  icone: AndroidSymbol;
  teinte: string;
  texte: string;
  nom: string;
  classeTexte?: string;
  onPress?: () => void;
}) {
  const contenu = (
    <>
      <SymbolView name={{ android: icone, web: icone }} size={16} tintColor={teinte} style={{ marginRight: 6 }} />
      <Text className={`font-inter-medium text-badge ${classeTexte}`}>{texte}</Text>
    </>
  );
  const classe = "flex-row items-center rounded-full bg-surface px-3 py-1";
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={nom} className={classe}>
        {contenu}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={nom}
      onPress={onPress}
      hitSlop={8}
      className={`${classe} border border-primaire active:bg-primaire-doux`}
    >
      {contenu}
    </Pressable>
  );
}

/** Pastille de la carte (spec 23, D99) ; absente ou en échec, elle se touche pour lancer le téléchargement. */
function PastilleCarte({ etat, onEnregistrer }: { etat: EtatAffiche; onEnregistrer: () => void }) {
  if (!etat) return null;
  switch (etat.etat) {
    case "enregistree":
      return <Pastille icone="check_circle" teinte={couleurs.possible} texte="Carte" nom="Carte enregistrée" />;
    case "enCours":
      return (
        <Pastille
          icone="downloading"
          teinte={couleurs.primaire}
          texte={`Carte ${etat.pourcentage} %`}
          nom={`Carte : téléchargement, ${etat.pourcentage} %`}
        />
      );
    case "absente":
      return (
        <Pastille
          icone="cloud_download"
          teinte={couleurs.primaire}
          texte="Carte absente"
          classeTexte="text-primaire"
          nom="Carte pas encore enregistrée. Enregistrer la carte"
          onPress={onEnregistrer}
        />
      );
    case "echec":
      return (
        <Pastille
          icone="error"
          teinte={couleurs.erreur}
          texte="Carte : échec"
          classeTexte="text-erreur"
          nom="La carte n'a pas pu être enregistrée. Réessayer"
          onPress={onEnregistrer}
        />
      );
    case "tropLourde":
      return <Pastille icone="error" teinte={couleurs.erreur} texte="Carte trop lourde" classeTexte="text-erreur" nom="Carte trop lourde pour être gardée" />;
  }
}
