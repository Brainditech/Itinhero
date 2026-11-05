import { useMemo } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import type { AndroidSymbol } from "expo-symbols";

import { CARTE } from "@/composants/carte-module";
import { iconeMode } from "@/composants/icones-mode";
import type { Point } from "@/domaine/api";
import { cap as capEntre, distance, pointA, portion } from "@/domaine/geo";
import type { Parcours, Situation } from "@/domaine/guidage";
import { jetonMode } from "@/domaine/resultat";
import { couleurs } from "@/theme/jetons";

// Carte du guidage (spec 12, §4.2) : suit la position, tournée dans le sens du chemin ;
// tracé restant en couleur, tracé fait en gris ; arrêt de montée et de descente épinglés.

const GRIS_FAIT = "#A9AEBB";
const PAS_TRACE_METRES = 5;

type Trait = { coords: number[][]; couleur: string; marche: boolean };

/** Tracé fait et tracé restant, pour l'étape `k` à l'abscisse `a` (m) de son tracé. */
function traits(parcours: Parcours, k: number, a: number): { faits: Trait[]; restants: Trait[] } {
  const faits: Trait[] = [];
  const restants: Trait[] = [];
  parcours.etapes.forEach((g, i) => {
    const marche = g.etape.mode === "marche";
    const couleur = marche ? couleurs.primaire : couleurs[jetonMode(g.etape.mode)];
    const tout = g.ligne.points.map((p) => [p.lon, p.lat]);
    if (i < k) faits.push({ coords: tout, couleur: GRIS_FAIT, marche });
    else if (i > k) restants.push({ coords: tout, couleur, marche });
    else {
      const vers = (pts: Point[]) => pts.map((p) => [p.lon, p.lat]);
      if (a > 0) faits.push({ coords: vers(portion(g.ligne, 0, a)), couleur: GRIS_FAIT, marche });
      restants.push({ coords: a > 0 ? vers(portion(g.ligne, a, g.ligne.longueur)) : tout, couleur, marche });
    }
  });
  return { faits, restants };
}

const collection = (ts: Trait[]) => ({
  type: "FeatureCollection" as const,
  features: ts
    .filter((t) => t.coords.length >= 2)
    .map((t) => ({
      type: "Feature" as const,
      properties: { couleur: t.couleur, marche: t.marche },
      geometry: { type: "LineString" as const, coordinates: t.coords },
    })),
});

const pointsGeo = (arrets: { point: Point }[]) => ({
  type: "FeatureCollection" as const,
  features: arrets.map((a) => ({
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Point" as const, coordinates: [a.point.lon, a.point.lat] },
  })),
});

/** Épingle en goutte : rond de couleur avec une icône blanche, pointe en bas. */
function Epingle({ couleur, icone }: { couleur: string; icone: AndroidSymbol }) {
  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: couleur,
          borderWidth: 2,
          borderColor: couleurs.fond,
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0px 2px 6px rgba(20, 22, 31, 0.25)",
        }}
      >
        <SymbolView name={{ android: icone, web: icone }} size={24} tintColor={couleurs.fond} />
      </View>
      <View
        style={{
          width: 0,
          height: 0,
          marginTop: -2,
          borderLeftWidth: 8,
          borderRightWidth: 8,
          borderTopWidth: 10,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: couleur,
        }}
      />
    </View>
  );
}

/** Point de position : rond plein, liseré blanc, faisceau vers l'avant (la carte est tournée dans le sens de la marche). */
function PointPosition({ faisceau, estimee }: { faisceau: number | null; estimee: boolean }) {
  return (
    <View style={{ width: 120, height: 120, alignItems: "center", justifyContent: "center" }}>
      {faisceau !== null && !estimee ? (
        <View
          style={{
            position: "absolute",
            top: 6,
            width: 0,
            height: 0,
            borderLeftWidth: 20,
            borderRightWidth: 20,
            borderBottomWidth: 54,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderBottomColor: "rgba(55, 48, 163, 0.28)",
            transform: [{ rotate: `${faisceau}deg` }],
            transformOrigin: "50% 100%",
          }}
        />
      ) : null}
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          // Sans position, le point gris dit « là où le guidage vous croit », pas « vous êtes ici ».
          backgroundColor: estimee ? couleurs["texte-secondaire"] : couleurs.primaire,
          opacity: estimee ? 0.6 : 1,
          borderWidth: 4,
          borderColor: couleurs.fond,
          boxShadow: "0px 2px 6px rgba(20, 22, 31, 0.3)",
        }}
      />
    </View>
  );
}

/** Flèche de l'écart (D75) : pointillé orange de la position vers le chemin, pointe au bout. */
function PointeEcart({ angle }: { angle: number }) {
  return (
    <View style={{ transform: [{ rotate: `${angle}deg` }] }}>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 8,
          borderRightWidth: 8,
          borderBottomWidth: 14,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: couleurs.avertissement,
        }}
      />
    </View>
  );
}

/**
 * Cadre qui met `bas` en bas et `haut` en haut de la zone libre entre le bandeau et la carte du bas :
 * cap de l'un vers l'autre, zoom tel que leur distance tienne dans 80 % de la hauteur libre (tuiles de 512 px).
 */
function cadrer(bas: Point, haut: Point, marges: { haut: number; bas: number }) {
  const libre = Math.max(200, Dimensions.get("window").height - marges.haut - marges.bas);
  const metresParPixel = (distance(bas, haut) * 1.25) / libre;
  const zoom = Math.log2((40_075_016 * Math.cos((bas.lat * Math.PI) / 180)) / (512 * metresParPixel));
  return {
    cap: capEntre(bas, haut),
    zoom: Math.max(8, Math.min(17.5, zoom)),
    centre: { lat: (bas.lat + haut.lat) / 2, lon: (bas.lon + haut.lon) / 2 },
  };
}

export function CarteGuidage({
  parcours,
  situation,
  position,
  nordEnHaut,
  marges,
}: {
  parcours: Parcours;
  situation: Situation;
  position: Point | null;
  nordEnHaut: boolean;
  /** Place prise par le bandeau du haut et la carte du bas : la position se cale entre les deux. */
  marges: { haut: number; bas: number };
}) {
  const s = situation;
  const k = s.etat.etape;
  // La situation change chaque seconde : le tracé n'est recoupé qu'au changement d'étape ou tous les 5 m (batterie).
  const abscissePas = Math.round((s.abscisse ?? 0) / PAS_TRACE_METRES) * PAS_TRACE_METRES;
  const { faitsGeo, restantsGeo } = useMemo(() => {
    const t = traits(parcours, k, abscissePas);
    return { faitsGeo: collection(t.faits), restantsGeo: collection(t.restants) };
  }, [parcours, k, abscissePas]);
  const g = s.courante;
  // Prochaine étape en véhicule (montée) et l'étape en véhicule en cours (descente).
  const vehicule = g && g.etape.mode !== "marche" ? g : (parcours.etapes.slice(k + 1).find((x) => x.etape.mode !== "marche") ?? null);
  const enVehicule = g !== null && g.etape.mode !== "marche" && s.vue.type !== "attente";
  const couleurVehicule = vehicule ? couleurs[jetonMode(vehicule.etape.mode)] : couleurs.primaire;
  const arrets = enVehicule && g ? g.arrets.filter((a) => !a.descente && a.abscisse > (s.abscisse ?? 0)) : [];
  const cleArrets = `${k}:${arrets.map((a) => a.abscisse).join(",")}`;
  // Même liste d'arrêts ⇒ même objet : la source n'est pas renvoyée à la carte chaque seconde.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- la clé résume la liste
  const arretsGeo = useMemo(() => pointsGeo(arrets), [cleArrets]);
  // Sans position : le point reste sur le tracé, là où le guidage nous croit (dernière abscisse connue).
  const ici = position ?? (g ? pointA(g.ligne, s.abscisse ?? 0) : null);
  // Dans le véhicule (maquettes 03 et 04) : la position en bas, l'arrêt visé en haut (troisième arrêt restant ou descente).
  const vise = enVehicule && g ? (arrets[2]?.point ?? { lat: g.etape.a.lat, lon: g.etape.a.lon }) : null;
  const cadreVehicule = ici && vise && distance(ici, vise) > 30 ? cadrer(ici, vise, marges) : null;
  const capCarte = nordEnHaut ? 0 : (cadreVehicule?.cap ?? s.cap ?? 0);
  const zoom = cadreVehicule?.zoom ?? (enVehicule ? 15 : 17.3);
  const centre = cadreVehicule?.centre ?? ici;

  if (!CARTE || !ici) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <Image source={require("../../assets/images/fond-carte.png")} contentFit="cover" style={StyleSheet.absoluteFill} />
      </View>
    );
  }
  const angleEcart = s.ecart ? capEntre(ici, s.ecart.vers) - capCarte : 0;
  return (
    <View style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants">
      <Image source={require("../../assets/images/fond-carte.png")} contentFit="cover" style={StyleSheet.absoluteFill} />
      <CARTE.Map style={StyleSheet.absoluteFill} mapStyle={CARTE.url} attribution={false} logo={false} compass={false} touchPitch={false}>
        <CARTE.Camera
          center={centre ? [centre.lon, centre.lat] : [ici.lon, ici.lat]}
          zoom={zoom}
          bearing={capCarte}
          pitch={0}
          padding={{ top: marges.haut, bottom: marges.bas, left: 0, right: 0 }}
          duration={600}
        />
        <CARTE.GeoJSONSource id="guidage-faits" data={faitsGeo}>
          <CARTE.Layer
            id="guidage-faits-trait"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": GRIS_FAIT, "line-width": 6, "line-dasharray": [0, 2] }}
          />
        </CARTE.GeoJSONSource>
        <CARTE.GeoJSONSource id="guidage-restants" data={restantsGeo}>
          <CARTE.Layer
            id="guidage-vehicules"
            type="line"
            filter={["==", ["get", "marche"], false]}
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": ["get", "couleur"], "line-width": 6 }}
          />
          <CARTE.Layer
            id="guidage-marche"
            type="line"
            filter={["==", ["get", "marche"], true]}
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": couleurs.primaire, "line-width": 7, "line-dasharray": [0, 1.8] }}
          />
        </CARTE.GeoJSONSource>
        {s.ecart ? (
          <CARTE.GeoJSONSource
            id="guidage-ecart"
            data={{
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: [[ici.lon, ici.lat], [s.ecart.vers.lon, s.ecart.vers.lat]] },
            }}
          >
            <CARTE.Layer
              id="guidage-ecart-trait"
              type="line"
              layout={{ "line-cap": "butt" }}
              paint={{ "line-color": couleurs.avertissement, "line-width": 4, "line-dasharray": [2, 1.5] }}
            />
          </CARTE.GeoJSONSource>
        ) : null}
        <CARTE.GeoJSONSource
          id="guidage-arrets"
          data={arretsGeo}
        >
          <CARTE.Layer
            id="guidage-arrets-rond"
            type="circle"
            paint={{ "circle-radius": 8, "circle-color": couleurs.fond, "circle-stroke-color": couleurVehicule, "circle-stroke-width": 3 }}
          />
        </CARTE.GeoJSONSource>
        {s.ecart ? (
          <CARTE.Marker lngLat={[s.ecart.vers.lon, s.ecart.vers.lat]} anchor="center">
            <PointeEcart angle={angleEcart} />
          </CARTE.Marker>
        ) : null}
        {vehicule && !enVehicule ? (
          // À l'arrêt, l'épingle se pose juste au-dessus du point de position (maquette 02).
          <CARTE.Marker
            lngLat={[vehicule.etape.de.lon, vehicule.etape.de.lat]}
            anchor="bottom"
            offset={s.vue.type === "attente" && s.vue.aLArret ? [0, -18] : [0, 0]}
          >
            <Epingle couleur={couleurVehicule} icone={iconeMode(vehicule.etape.mode)} />
          </CARTE.Marker>
        ) : null}
        {enVehicule && g ? (
          <CARTE.Marker lngLat={[g.etape.a.lon, g.etape.a.lat]} anchor="bottom">
            <Epingle couleur={couleurVehicule} icone="flag" />
          </CARTE.Marker>
        ) : null}
        <CARTE.Marker lngLat={[ici.lon, ici.lat]} anchor="center">
          <PointPosition faisceau={s.cap === null || s.vue.type === "attente" ? null : s.cap - capCarte} estimee={position === null} />
        </CARTE.Marker>
      </CARTE.Map>
    </View>
  );
}
