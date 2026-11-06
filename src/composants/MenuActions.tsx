import { useRef, useState } from "react";
import { Modal, Pressable, Text, View, useWindowDimensions, type ViewInstance } from "react-native";
import { SymbolView, type AndroidSymbol } from "expo-symbols";

import { couleurs, ombreFlottante } from "@/theme/jetons";

export type ActionMenu = { icone: AndroidSymbol; libelle: string; onPress: () => void; danger?: boolean };

const HAUTEUR_LIGNE = 48;
const MARGE = 8;

/**
 * Bouton rond et son petit menu flottant (spec 24, D100, §3.2), posé sous le bouton, ou au-dessus s'il n'y a
 * pas la place. Toucher à côté ou le bouton Retour d'Android le ferme. L'action part une fois le menu fermé.
 * Une seule action : le bouton la lance directement, sans menu (la disquette, spec 24 §7.2, D101).
 */
export function MenuActions({
  nom,
  actions,
  icone = "more_vert",
  teinte = couleurs["texte-secondaire"],
  desactive = false,
}: {
  nom: string;
  actions: ActionMenu[];
  icone?: AndroidSymbol;
  teinte?: string;
  desactive?: boolean;
}) {
  const bouton = useRef<ViewInstance>(null);
  const { width, height } = useWindowDimensions();
  // Position du menu dans la fenêtre ; null : fermé.
  const [pos, setPos] = useState<{ droite: number; haut: number } | null>(null);
  const hauteurMenu = actions.length * HAUTEUR_LIGNE + 2 * MARGE;

  function ouvrir() {
    if (actions.length === 1) {
      actions[0]!.onPress();
      return;
    }
    bouton.current?.measureInWindow((x, y, l, h) => {
      const dessous = y + h;
      const haut = dessous + hauteurMenu + MARGE > height ? Math.max(MARGE, y - hauteurMenu) : dessous;
      setPos({ droite: Math.max(MARGE, width - (x + l)), haut });
    });
  }

  const fermer = () => setPos(null);

  return (
    <>
      <View ref={bouton} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nom}
          accessibilityState={actions.length === 1 ? { disabled: desactive } : { expanded: pos !== null, disabled: desactive }}
          onPress={ouvrir}
          disabled={desactive}
          hitSlop={4}
          style={{ minHeight: 48, minWidth: 48 }}
          className="items-center justify-center rounded-full active:bg-primaire-doux"
        >
          <SymbolView name={{ android: icone, web: icone }} size={24} tintColor={teinte} />
        </Pressable>
      </View>
      <Modal transparent visible={pos !== null} animationType="fade" onRequestClose={fermer} statusBarTranslucent navigationBarTranslucent>
        <Pressable accessibilityLabel="Fermer le menu" onPress={fermer} style={{ flex: 1 }}>
          {pos ? (
            <View
              accessibilityRole="menu"
              className="rounded-bouton border border-bordure-carte bg-fond"
              style={{ position: "absolute", minWidth: 208, top: pos.haut, right: pos.droite, paddingVertical: MARGE, boxShadow: ombreFlottante }}
            >
              {actions.map((a) => (
                <Pressable
                  key={a.libelle}
                  accessibilityRole="menuitem"
                  onPress={() => {
                    fermer();
                    a.onPress();
                  }}
                  style={{ minHeight: HAUTEUR_LIGNE }}
                  className="flex-row items-center gap-3 px-4 active:bg-surface"
                >
                  <SymbolView
                    name={{ android: a.icone, web: a.icone }}
                    size={22}
                    tintColor={a.danger ? couleurs.erreur : couleurs.primaire}
                  />
                  <Text className={`font-inter-medium text-corps ${a.danger ? "text-erreur" : "text-texte"}`}>{a.libelle}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}
