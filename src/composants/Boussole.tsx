import { useCallback, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import { DeviceMotion } from "expo-sensors";

import {
  capBoussole,
  capFusionne,
  declinaison,
  directionCardinale,
  FILTRE_VIDE,
  filtrerCap,
  rotationSuivante,
  type Direction,
} from "@/domaine/boussole";
import { couleurs } from "@/theme/jetons";

// Bouton « Recentrer » de la fenêtre d'étape, dessiné en boussole (spec 17, D88). La rose tourne avec le
// téléphone ; un appui recentre la carte. Le cap vient du capteur fusionné (gyroscope + boussole) d'expo-sensors :
// mesuré le 2026-11-05, téléphone immobile, il tient à 1° près quand le cap brut d'expo-location tremble de
// 13° et part de 40° à la moindre perturbation magnétique. Sans capteur fusionné, secours : le cap brut filtré
// (`filtrerCap`), qui exige l'autorisation de position ; la fenêtre ne la demande jamais.

const TAILLE = 56;
/** Hauteur de la flèche fixe posée au-dessus du rond. */
const FLECHE = 10;
const RAYON_LETTRE = 18;
const LETTRE = 14;
/** Relevés du capteur fusionné : 10 par seconde suffisent à suivre la marche. */
const INTERVALLE_MS = 100;
/** Écart sous lequel la rose ne bouge pas : capteur fusionné, puis cap brut filtré (réglage mesuré). */
const SEUIL_FUSIONNE = 1.5;
const SEUIL_BRUT = 4;

const LETTRES = [
  { texte: "N", angle: 0 },
  { texte: "E", angle: 90 },
  { texte: "S", angle: 180 },
  { texte: "O", angle: 270 },
] as const;

type Abonnement = { remove: () => void };

/** Écoute le cap du téléphone tant que l'écran est affiché ; direction null sans capteur. */
function useCap(): { rotation: Animated.Value; direction: Direction | null } {
  const [rotation] = useState(() => new Animated.Value(0));
  const [direction, setDirection] = useState<Direction | null>(null);
  const angle = useRef(0);

  useFocusEffect(
    useCallback(() => {
      let fini = false;
      const abonnements: Abonnement[] = [];
      const garder = (a: Abonnement) => (fini ? a.remove() : abonnements.push(a));

      const afficher = (cap: number, seuil: number) => {
        setDirection(directionCardinale(cap));
        const suivante = rotationSuivante(angle.current, cap);
        if (Math.abs(suivante - angle.current) < seuil) return;
        angle.current = suivante;
        Animated.timing(rotation, { toValue: suivante, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      };

      void (async () => {
        try {
          const autorise = (await Location.getForegroundPermissionsAsync()).granted;
          if (await DeviceMotion.isAvailableAsync()) {
            let decl = 0;
            // La déclinaison (nord vrai − magnétique) se lit sur un seul relevé d'expo-location, s'il est permis.
            if (autorise) {
              let lu = false;
              let une: Abonnement | null = null;
              une = await Location.watchHeadingAsync((lecture) => {
                decl = declinaison(lecture);
                lu = true;
                une?.remove();
              });
              if (lu) une.remove();
              else garder(une);
            }
            DeviceMotion.setUpdateInterval(INTERVALLE_MS);
            garder(
              DeviceMotion.addListener((m) => {
                const cap = m.rotation ? capFusionne(m.rotation.alpha, decl) : null;
                if (cap === null) return;
                afficher(cap, SEUIL_FUSIONNE);
              }),
            );
            return;
          }
          if (!autorise || fini) return;
          let filtre = FILTRE_VIDE;
          garder(
            await Location.watchHeadingAsync((lecture) => {
              const brut = capBoussole(lecture);
              if (brut === null) return;
              filtre = filtrerCap(filtre, brut);
              afficher(filtre.lisse!, SEUIL_BRUT);
            }),
          );
        } catch {
          // Pas de capteur (ou web) : la rose reste fixe, nord en haut.
        }
      })();
      return () => {
        fini = true;
        abonnements.forEach((a) => a.remove());
      };
    }, [rotation]),
  );

  return { rotation, direction };
}

export function Boussole({ onPress }: { onPress: () => void }) {
  const { rotation, direction } = useCap();
  const tourne = rotation.interpolate({
    inputRange: [-360, 360],
    outputRange: ["-360deg", "360deg"],
    extrapolate: "extend",
  });
  const libelle = direction
    ? `Recentrer la carte sur l'étape. Vous faites face au ${direction}`
    : "Recentrer la carte sur l'étape. Boussole indisponible";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={libelle}
      onPress={onPress}
      className="items-center"
    >
      {/* Flèche fixe : le sens où pointe le haut du téléphone. Le N sous la flèche ⇒ on fait face au nord. */}
      <View
        importantForAccessibility="no"
        style={{
          width: 0,
          height: 0,
          marginBottom: 2,
          borderLeftWidth: 7,
          borderRightWidth: 7,
          borderBottomWidth: FLECHE,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: couleurs.primaire,
        }}
      />
      <View
        className="items-center justify-center rounded-full bg-fond"
        style={{
          width: TAILLE,
          height: TAILLE,
          boxShadow: "0px 3px 10px rgba(20, 22, 31, 0.22)",
        }}
      >
        <Animated.View
          style={{
            width: TAILLE,
            height: TAILLE,
            transform: [{ rotate: tourne }],
          }}
          importantForAccessibility="no-hide-descendants"
        >
          {/* Traits des directions intermédiaires (NE, SE, SO, NO). */}
          {[45, 135, 225, 315].map((a) => {
            const rad = (a * Math.PI) / 180;
            return (
              <View
                key={a}
                style={{
                  position: "absolute",
                  left: TAILLE / 2 + RAYON_LETTRE * Math.sin(rad) - 1,
                  top: TAILLE / 2 - RAYON_LETTRE * Math.cos(rad) - 3,
                  width: 2,
                  height: 6,
                  borderRadius: 1,
                  backgroundColor: couleurs["bordure-champ"],
                  transform: [{ rotate: `${a}deg` }],
                }}
              />
            );
          })}
          {LETTRES.map(({ texte, angle }) => {
            const rad = (angle * Math.PI) / 180;
            const nord = texte === "N";
            return (
              <Text
                key={texte}
                style={{
                  position: "absolute",
                  left: TAILLE / 2 + RAYON_LETTRE * Math.sin(rad) - LETTRE / 2,
                  top: TAILLE / 2 - RAYON_LETTRE * Math.cos(rad) - LETTRE / 2,
                  width: LETTRE,
                  height: LETTRE,
                  lineHeight: LETTRE,
                  textAlign: "center",
                  fontSize: nord ? 13 : 11,
                  color: nord ? couleurs.erreur : couleurs.texte,
                }}
                className={nord ? "font-inter-bold" : "font-inter-semibold"}
                allowFontScaling={false}
              >
                {texte}
              </Text>
            );
          })}
          {/* Aiguille : rouge vers le nord, grise vers le sud. */}
          <View
            style={{
              position: "absolute",
              left: TAILLE / 2 - 3,
              top: TAILLE / 2 - 9,
              width: 0,
              height: 0,
              borderLeftWidth: 3,
              borderRightWidth: 3,
              borderBottomWidth: 9,
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
              borderBottomColor: couleurs.erreur,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: TAILLE / 2 - 3,
              top: TAILLE / 2,
              width: 0,
              height: 0,
              borderLeftWidth: 3,
              borderRightWidth: 3,
              borderTopWidth: 9,
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
              borderTopColor: couleurs["bordure-champ"],
            }}
          />
        </Animated.View>
      </View>
    </Pressable>
  );
}
