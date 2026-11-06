import { Linking, Pressable, Text, View } from "react-native";
import { SymbolView, type AndroidSymbol } from "expo-symbols";

import type { Contact } from "@/domaine/api";
import { lienTel, texteSource } from "@/domaine/contacts";
import type { Action } from "@/domaine/rappels";
import { couleurs, ombreFlottante } from "@/theme/jetons";

const ICONES: Record<Action["type"], AndroidSymbol> = { taxi: "local_taxi", reserver: "call", partir: "directions_walk" };

/**
 * « À faire » d'un trajet enregistré (spec 40, D121) : appeler le taxi, réserver, partir, chacun avec son rappel.
 * Tiré de l'instantané : s'affiche sans réseau. Un rappel passé grise sa ligne.
 */
export function AFaire({ actions, veille }: { actions: Action[]; veille: string | null }) {
  if (actions.length === 0) return null;
  return (
    <View className="gap-3 rounded-bouton border border-bordure-carte bg-fond p-4" style={{ boxShadow: ombreFlottante }}>
      <Text accessibilityRole="header" className="font-inter-semibold text-titre-carte text-texte">
        À faire
      </Text>
      {actions.map((a) => (
        <View
          key={a.cle}
          className="flex-row gap-3"
          style={{ opacity: a.passe ? 0.55 : 1 }}
          accessible
          accessibilityLabel={[a.titre, a.detail, a.delai, a.passe ? `${a.rappel}, passé` : a.rappel].filter(Boolean).join(". ")}
        >
          <SymbolView name={{ android: ICONES[a.type], web: ICONES[a.type] }} size={24} tintColor={couleurs.primaire} />
          <View className="flex-1 gap-1">
            <Text className="font-inter-semibold text-corps text-texte">{a.titre}</Text>
            <Text className="font-inter text-secondaire text-texte">{a.detail}</Text>
            {a.delai ? <Text className="font-inter text-secondaire text-texte-secondaire">{a.delai}</Text> : null}
            <Text className="font-inter-medium text-secondaire text-texte-secondaire">{a.passe ? `${a.rappel} (passé)` : a.rappel}</Text>
            {a.type !== "partir" ? <Numero contact={a.contact} /> : null}
          </View>
        </View>
      ))}
      {veille ? <Text className="font-inter text-secondaire text-texte-secondaire">{`Et un ${veille.charAt(0).toLowerCase()}${veille.slice(1)}.`}</Text> : null}
    </View>
  );
}

export function Numero({ contact }: { contact: Contact | null }) {
  if (!contact) return <Text className="font-inter text-secondaire text-texte-secondaire">Aucun numéro connu.</Text>;
  return (
    <View className="gap-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Appeler ${contact.nom}, ${contact.numero}`}
        onPress={() => void Linking.openURL(lienTel(contact.numero)).catch(() => undefined)}
        className="flex-row items-center gap-2 self-start rounded-full bg-primaire-doux px-4 active:opacity-70"
        style={{ minHeight: 48 }}
      >
        <SymbolView name={{ android: "call", web: "call" }} size={20} tintColor={couleurs.primaire} />
        <Text className="font-inter-semibold text-corps text-primaire">{`${contact.nom} · ${contact.numero}`}</Text>
      </Pressable>
      <Text className={`font-inter text-badge ${contact.verifie ? "text-texte-secondaire" : "text-avertissement"}`}>{texteSource(contact)}</Text>
    </View>
  );
}
