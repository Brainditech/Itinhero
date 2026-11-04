import { useId, useState, type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SymbolView } from "expo-symbols";

import { couleurs, ombreFlottante } from "@/theme/jetons";

/** Mot « Itinhero » en haut à gauche de chaque écran. */
export function MotItinhero() {
  return (
    <Text accessibilityRole="header" className="font-inter-semibold text-titre-ecran text-primaire">
      Itinhero
    </Text>
  );
}

/** Carte blanche flottante : coins 24, bordure fine, ombre douce. */
export function CarteFlottante({ children }: { children: ReactNode }) {
  return (
    <View className="rounded-carte border border-bordure-carte bg-fond p-5" style={{ boxShadow: ombreFlottante }}>
      {children}
    </View>
  );
}

/** Bouton principal : un seul par écran, plein indigo, 56 dp ; désactivé pendant une recherche (design system). */
export function BoutonPrincipal({
  libelle,
  onPress,
  desactive = false,
}: {
  libelle: string;
  onPress: () => void;
  desactive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: desactive, busy: desactive }}
      disabled={desactive}
      onPress={onPress}
      className={`min-h-14 items-center justify-center rounded-bouton px-4 ${
        desactive ? "bg-desactive-fond" : "bg-primaire active:bg-primaire-presse"
      }`}
    >
      <Text className={`font-inter-semibold text-titre-carte ${desactive ? "text-desactive-texte" : "text-fond"}`}>
        {libelle}
      </Text>
    </Pressable>
  );
}

/** Bouton secondaire : contour 1,5 dp indigo, texte indigo (design system). */
export function BoutonSecondaire({ libelle, onPress }: { libelle: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-12 items-center justify-center rounded-bouton bg-fond px-4 active:bg-primaire-doux"
      style={{ borderWidth: 1.5, borderColor: couleurs.primaire }}
    >
      <Text className="font-inter-semibold text-corps text-primaire">{libelle}</Text>
    </Pressable>
  );
}

/** État d'erreur (design system) : icône, texte, et « Réessayer » si l'action peut être rejouée. */
export function CarteErreur({ message, onReessayer }: { message: string; onReessayer?: () => void }) {
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="gap-3 rounded-bouton border border-bordure-carte bg-fond p-4"
    >
      <View className="flex-row items-center gap-3">
        <SymbolView name={{ android: "error", web: "error" }} size={24} tintColor={couleurs.erreur} />
        <Text className="flex-1 font-inter-medium text-corps text-texte">{message}</Text>
      </View>
      {onReessayer ? <BoutonSecondaire libelle="Réessayer" onPress={onReessayer} /> : null}
    </View>
  );
}

/** Puce à choix : active pleine indigo, inactive blanche à contour. */
export function Puce({ libelle, active, onPress }: { libelle: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      className={`min-h-12 justify-center rounded-full border px-4 ${
        active ? "border-primaire bg-primaire" : "border-bordure-carte bg-fond"
      }`}
    >
      <Text className={`font-inter-medium text-badge ${active ? "text-fond" : "text-texte"}`}>{libelle}</Text>
    </Pressable>
  );
}

/** Lien texte indigo. */
export function Lien({ libelle, onPress }: { libelle: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} className="min-h-12 items-center justify-center">
      <Text className="font-inter-medium text-badge text-primaire">{libelle}</Text>
    </Pressable>
  );
}

// ——— Formulaire (spec 02) ———

/** Contour d'un champ : 1 dp gris ; actif 2 dp indigo ; erreur 2 dp rouge (design system). */
function classeCadre(actif: boolean, erreur?: string) {
  const contour = erreur ? "border-2 border-erreur" : actif ? "border-2 border-primaire" : "border border-bordure-champ";
  return `min-h-14 flex-row items-center rounded-champ bg-surface px-4 ${contour}`;
}

/** Libellé au-dessus, cadre, message d'erreur dessous (lu par TalkBack quand il apparaît). */
function Champ({
  libelle,
  idLibelle,
  erreur,
  children,
}: {
  libelle: string;
  idLibelle: string;
  erreur?: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text nativeID={idLibelle} className="font-inter text-secondaire text-texte-secondaire">
        {libelle}
      </Text>
      {children}
      {erreur ? (
        <Text accessibilityLiveRegion="polite" className="font-inter-medium text-badge text-erreur">
          {erreur}
        </Text>
      ) : null}
    </View>
  );
}

/** Champ de saisie au clavier, avec un suffixe facultatif (« min »). */
export function ChampTexte({
  libelle,
  valeur,
  onChange,
  erreur,
  suffixe,
  numerique,
  longueurMax,
  onFocus,
  onBlur,
  masque,
  autoFocus,
  onValider,
  brut,
}: {
  libelle: string;
  valeur: string;
  onChange: (texte: string) => void;
  erreur?: string;
  suffixe?: string;
  numerique?: boolean;
  longueurMax?: number;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Saisie masquée (clé d'appareil). */
  masque?: boolean;
  autoFocus?: boolean;
  /** Touche « Entrée » du clavier. */
  onValider?: () => void;
  /** Ni majuscule automatique ni correction (clé, adresse). */
  brut?: boolean;
}) {
  const id = useId();
  const [actif, setActif] = useState(false);
  return (
    <Champ libelle={libelle} idLibelle={id} erreur={erreur}>
      <View className={classeCadre(actif, erreur)}>
        <TextInput
          accessibilityLabelledBy={id}
          value={valeur}
          onChangeText={onChange}
          onFocus={() => {
            setActif(true);
            onFocus?.();
          }}
          onBlur={() => {
            setActif(false);
            onBlur?.();
          }}
          keyboardType={numerique ? "number-pad" : "default"}
          maxLength={longueurMax}
          secureTextEntry={masque}
          autoFocus={autoFocus}
          onSubmitEditing={onValider}
          returnKeyType={onValider ? "search" : undefined}
          autoCapitalize={brut ? "none" : undefined}
          autoCorrect={brut ? false : undefined}
          className="flex-1 py-3 font-inter text-corps text-texte"
          cursorColor={couleurs.primaire}
          selectionColor={couleurs["primaire-doux"]}
        />
        {suffixe ? <Text className="ml-2 font-inter text-corps text-texte-secondaire">{suffixe}</Text> : null}
      </View>
    </Champ>
  );
}

/** Champ qu'on touche pour ouvrir un sélecteur d'Android (date, heure). */
export function ChampTouchable({
  libelle,
  valeur,
  onPress,
  erreur,
}: {
  libelle: string;
  valeur: string;
  onPress: () => void;
  erreur?: string;
}) {
  const id = useId();
  return (
    <Champ libelle={libelle} idLibelle={id} erreur={erreur}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${libelle} : ${valeur}`}
        accessibilityHint="Ouvre le sélecteur"
        onPress={onPress}
        className={classeCadre(false, erreur)}
      >
        <Text className="font-inter text-corps text-texte">{valeur}</Text>
      </Pressable>
    </Champ>
  );
}

/** Sélecteur à deux choix côte à côte ; le choix actif est plein indigo. */
export function SelecteurDeuxChoix<T extends string>({
  choix,
  valeur,
  onChange,
}: {
  choix: readonly [{ valeur: T; libelle: string }, { valeur: T; libelle: string }];
  valeur: T;
  onChange: (valeur: T) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" className="flex-row overflow-hidden rounded-bouton border border-bordure-carte">
      {choix.map((c) => {
        const actif = c.valeur === valeur;
        return (
          <Pressable
            key={c.valeur}
            accessibilityRole="radio"
            accessibilityState={{ checked: actif }}
            onPress={() => onChange(c.valeur)}
            className={`min-h-12 flex-1 items-center justify-center px-2 py-2 ${actif ? "bg-primaire" : "bg-fond"}`}
          >
            <Text className={`text-center font-inter-medium text-corps ${actif ? "text-fond" : "text-texte"}`}>
              {c.libelle}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Bandeau d'information : pastille ⓘ indigo et texte secondaire, sur `surface`. */
export function BandeauInfo({ texte }: { texte: string }) {
  return (
    <View
      accessibilityRole="alert"
      className="flex-row items-center gap-3 rounded-bouton border border-bordure-carte bg-surface p-4"
    >
      <View className="h-8 w-8 items-center justify-center rounded-full bg-primaire">
        <SymbolView name={{ android: "info", web: "info" }} size={18} tintColor={couleurs.fond} />
      </View>
      <Text className="flex-1 font-inter text-secondaire text-texte-secondaire">{texte}</Text>
    </View>
  );
}
