import { useId, useState, type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SymbolView, type AndroidSymbol } from "expo-symbols";

import type { Candidat } from "@/domaine/api";
import type { Bout } from "@/domaine/demande";
import { detailCandidat } from "@/domaine/resultat";
import { annonceSuggestions, iconeCandidat, MESSAGES_SUGGESTIONS, type EtatSuggestions, type IconeLieu } from "@/domaine/suggestions";
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

/** Puce à choix, avec une icône facultative : active pleine indigo, inactive blanche à contour. */
export function Puce({
  libelle,
  active,
  onPress,
  icone,
}: {
  libelle: string;
  active: boolean;
  onPress: () => void;
  icone?: AndroidSymbol;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      className={`min-h-12 flex-row items-center gap-2 rounded-full border px-4 ${
        active ? "border-primaire bg-primaire" : "border-bordure-carte bg-fond"
      }`}
    >
      {icone ? (
        <SymbolView name={{ android: icone, web: icone }} size={20} tintColor={active ? couleurs.fond : couleurs.primaire} />
      ) : null}
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
function classeCadre(actif: boolean, erreur?: string, marges = "px-4") {
  const contour = erreur ? "border-2 border-erreur" : actif ? "border-2 border-primaire" : "border border-bordure-champ";
  return `min-h-14 flex-row items-center rounded-champ bg-surface ${marges} ${contour}`;
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

const CHOIX_BOUT = [
  { type: "domicile", icone: "home", libelle: "Domicile" },
  { type: "position", icone: "my_location", libelle: "Ma position" },
] as const satisfies readonly { type: Bout["type"]; icone: AndroidSymbol; libelle: string }[];

/**
 * Champ Départ ou Arrivée (spec 13, §4.1 ; spec 18) : texte tapé au clavier, lieu choisi dans les suggestions,
 * ou Domicile / Ma position choisis par les icônes de droite. Domicile et position s'affichent en étiquette ;
 * la toucher l'efface et ouvre le clavier. Un lieu choisi montre son nom (modifiable) et sa ligne de détail.
 */
export function ChampLieu({
  libelle,
  nomCourt,
  bout,
  onChange,
  erreur,
  longueurMax,
  detail,
  suggestions = { etat: "ferme" },
  onChoisir,
  onActif,
}: {
  libelle: string;
  /** « départ », « arrivée » : lu par TalkBack (« Mettre Domicile en départ »). */
  nomCourt: string;
  bout: Bout;
  onChange: (bout: Bout) => void;
  erreur?: string;
  longueurMax: number;
  /** Ligne sous le champ d'un lieu choisi (« Arrêt, Auxerre, 89000 »). */
  detail?: string;
  suggestions?: EtatSuggestions;
  onChoisir?: (c: Candidat) => void;
  /** Le champ prend ou perd le clavier. */
  onActif?: (actif: boolean) => void;
}) {
  const id = useId();
  const [actif, setActif] = useState(false);
  // Le clavier ne s'ouvre seul qu'après avoir touché une étiquette, jamais à l'ouverture de l'écran.
  const [focaliser, setFocaliser] = useState(false);
  const choix = CHOIX_BOUT.find((c) => c.type === bout.type);
  const tape = bout.type === "texte" ? bout.texte : bout.type === "lieu" ? bout.nom : null;
  return (
    <View className="gap-2">
      <Champ libelle={libelle} idLibelle={id} erreur={erreur}>
        <View className={classeCadre(actif, erreur, "pl-4 pr-1")}>
          {tape !== null ? (
            <TextInput
              accessibilityLabelledBy={id}
              value={tape}
              // Une lettre changée dans un lieu choisi en refait un texte : le lieu est oublié (D91).
              onChangeText={(texte) => onChange({ type: "texte", texte })}
              onFocus={() => {
                setActif(true);
                onActif?.(true);
                setFocaliser(false); // une seule fois : ⇅ ou un retour au texte n'ouvrent pas le clavier
              }}
              onBlur={() => {
                setActif(false);
                onActif?.(false);
              }}
              autoFocus={focaliser}
              // Sans le clavier, un nom long se lit par son début (« Gare d'Auxerre-… »), pas par sa fin.
              selection={actif ? undefined : { start: 0 }}
              maxLength={longueurMax}
              className="flex-1 py-3 font-inter text-corps text-texte"
              cursorColor={couleurs.primaire}
              selectionColor={couleurs["primaire-doux"]}
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${libelle} : ${choix?.libelle ?? ""}`}
              accessibilityHint="Efface et ouvre le clavier"
              onPress={() => {
                setFocaliser(true);
                onChange({ type: "texte", texte: "" });
              }}
              className="min-h-12 flex-1 flex-row items-center"
            >
              <View className="flex-row items-center gap-2 rounded-full bg-primaire-doux px-3 py-1">
                {choix ? <SymbolView name={{ android: choix.icone, web: choix.icone }} size={18} tintColor={couleurs.primaire} /> : null}
                <Text className="font-inter-medium text-corps text-primaire">{choix?.libelle}</Text>
              </View>
            </Pressable>
          )}
          {CHOIX_BOUT.map((c) => {
            const choisi = bout.type === c.type;
            return (
              <Pressable
                key={c.type}
                accessibilityRole="button"
                accessibilityLabel={`Mettre ${c.libelle} en ${nomCourt}`}
                accessibilityState={{ selected: choisi }}
                onPress={() => onChange({ type: c.type })}
                className="h-12 w-12 items-center justify-center rounded-full active:bg-primaire-doux"
              >
                <SymbolView
                  name={{ android: c.icone, web: c.icone }}
                  size={24}
                  tintColor={choisi ? couleurs.primaire : couleurs["texte-secondaire"]}
                />
              </Pressable>
            );
          })}
        </View>
        {bout.type === "lieu" && detail ? (
          // pl : aligné sur le texte du champ (bordure + marge interne du cadre).
          <Text className="pl-[22px] pr-4 font-inter text-secondaire text-texte-secondaire">{detail}</Text>
        ) : null}
      </Champ>
      <ListeSuggestions suggestions={suggestions} onChoisir={(c) => onChoisir?.(c)} />
    </View>
  );
}

/** Ce qu'est le lieu d'un coup d'œil, dans un rond : gare, « M » du métro, bus, adresse… (D92). Le libellé lu est sur la ligne. */
function IconeDuLieu({ icone }: { icone: IconeLieu }) {
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      className="h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primaire-doux"
    >
      {icone === "M" ? (
        <Text className="font-inter-bold text-corps text-primaire">M</Text>
      ) : (
        <SymbolView name={{ android: icone, web: icone }} size={22} tintColor={couleurs.primaire} />
      )}
    </View>
  );
}

/** Liste des lieux suggérés sous un champ (spec 18, §4.1). */
function ListeSuggestions({ suggestions, onChoisir }: { suggestions: EtatSuggestions; onChoisir: (c: Candidat) => void }) {
  if (suggestions.etat === "ferme") return null;
  const candidats = suggestions.etat === "ok" || suggestions.etat === "attente" ? suggestions.candidats : [];
  const message =
    suggestions.etat === "vide"
      ? MESSAGES_SUGGESTIONS.aucun(suggestions.texte)
      : suggestions.etat === "echec"
        ? MESSAGES_SUGGESTIONS.indisponibles
        : suggestions.etat === "attente" && candidats.length === 0
          ? MESSAGES_SUGGESTIONS.attente
          : null;
  const annonce = annonceSuggestions(suggestions);
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityLabel={annonce || undefined}
      className="overflow-hidden rounded-champ border border-bordure-carte bg-fond"
    >
      {message ? (
        <Text className="px-4 py-3 font-inter text-secondaire text-texte-secondaire">{message}</Text>
      ) : null}
      {candidats.map((c, i) => {
        const detail = detailCandidat(c);
        return (
          <Pressable
            key={`${c.nom}-${c.lat}-${c.lon}`}
            accessibilityRole="button"
            accessibilityLabel={[c.nom, detail.replaceAll(" · ", ", ")].filter(Boolean).join(", ")}
            onPress={() => onChoisir(c)}
            className={`min-h-12 flex-row items-center gap-3 px-4 py-2 active:bg-primaire-doux ${i > 0 ? "border-t border-bordure-carte" : ""}`}
          >
            {/* Ce qu'est le lieu d'un coup d'œil : gare, métro, bus, adresse… (D92). */}
            <IconeDuLieu icone={iconeCandidat(c)} />
            <View className="flex-1">
              <Text className="font-inter-medium text-corps text-texte" numberOfLines={2}>
                {c.nom}
              </Text>
              {detail ? (
                <Text className="font-inter text-secondaire text-texte-secondaire" numberOfLines={3}>
                  {detail}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** ⇅ entre le Départ et l'Arrivée : échange les deux (spec 13, §4.1). */
export function BoutonEchange({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Échanger le départ et l'arrivée"
      onPress={onPress}
      className="h-12 w-12 items-center justify-center rounded-full border border-bordure-carte bg-fond active:bg-primaire-doux"
    >
      <SymbolView name={{ android: "swap_vert", web: "swap_vert" }} size={24} tintColor={couleurs.primaire} />
    </Pressable>
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
