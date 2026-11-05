import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import type { AndroidSymbol } from "expo-symbols";
import type { CameraRef } from "@maplibre/maplibre-react-native";

import { CARTE } from "@/composants/carte-module";
import { iconeMode } from "@/composants/icones-mode";
import type { Point, Possibilite } from "@/domaine/api";
import { arretsDuTrajet, finMarche, pointsEtape, type ArretDeLaCourse } from "@/domaine/etape";
import { boite } from "@/domaine/geo";
import { jetonMode, nomLieuEtape } from "@/domaine/resultat";
import { couleurs } from "@/theme/jetons";

// Carte plein écran de la fenêtre d'une étape (spec 17, §4.2) : l'étape en couleur, le reste du trajet
// en gris clair, et les arrêts marqués (montée et descente avec leur nom, arrêts intermédiaires en ronds).

const GRIS_CONTEXTE = "#B8BCC8";
const AIR = 48;
/** Marge à gauche et à droite : la pastille du nom (220 dp au plus) reste dans l'écran. */
const AIR_COTE = 110;

type Etiquette = Point & { nom: string; couleur: string; icone: AndroidSymbol };

/** Rond de couleur avec une icône blanche, et le nom du lieu dans une pastille au-dessus. */
function Repere({ nom, couleur, icone }: { nom: string; couleur: string; icone: AndroidSymbol }) {
  return (
    <View style={{ alignItems: "center", maxWidth: 220 }}>
      <View
        className="mb-1 rounded-full bg-fond px-2 py-0.5"
        style={{ borderWidth: 1, borderColor: couleurs["bordure-carte"], boxShadow: "0px 1px 4px rgba(20, 22, 31, 0.18)" }}
      >
        <Text numberOfLines={1} className="font-inter-semibold text-xs text-texte">
          {nom}
        </Text>
      </View>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: couleur,
          borderWidth: 2,
          borderColor: couleurs.fond,
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0px 2px 6px rgba(20, 22, 31, 0.25)",
        }}
      >
        <SymbolView name={{ android: icone, web: icone }} size={18} tintColor={couleurs.fond} />
      </View>
    </View>
  );
}

export function CarteEtape({
  possibilite,
  rang,
  choisi,
  margeBas,
  margeHaut,
  recentrer,
  course,
}: {
  possibilite: Possibilite;
  /** Rang de l'étape montrée. */
  rang: number;
  /** Consigne ou arrêt touché dans le panneau : la carte se centre dessus. */
  choisi: Point | null;
  /** Hauteur visible du panneau du bas : la carte cadre l'étape au-dessus. */
  margeBas: number;
  margeHaut: number;
  /** Change à chaque « Recentrer ». */
  recentrer: number;
  /** Tous les arrêts de la course (D87), quand on les a demandés : ceux d'avant et d'après en gris. */
  course: ArretDeLaCourse[] | null;
}) {
  const etape = possibilite.etapes[rang]!;
  const suivante = possibilite.etapes[rang + 1];
  const marche = etape.mode === "marche";
  const couleur = marche ? couleurs.primaire : couleurs[jetonMode(etape.mode)];
  const points = useMemo(() => pointsEtape(etape), [etape]);
  // La carte cadre l'étape, même avec toute la course : vue de loin, les noms de la montée et de la descente
  // se chevauchent (essai du 2026-11-05) ; les autres arrêts restent autour, en gris.
  const cadre = useMemo(() => (points.length > 0 ? boite(points) : null), [points]);
  const camera = useRef<CameraRef>(null);

  const geo = useMemo(() => {
    const ligne = (pts: Point[], props: Record<string, unknown>) => ({
      type: "Feature" as const,
      properties: props,
      geometry: { type: "LineString" as const, coordinates: pts.map((p) => [p.lon, p.lat]) },
    });
    const point = (p: Point, props: Record<string, unknown>) => ({
      type: "Feature" as const,
      properties: props,
      geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
    });
    const contexte = possibilite.etapes
      .map((e, i) => ({ e, i, pts: pointsEtape(e) }))
      .filter((x) => x.i !== rang && x.pts.length >= 2)
      .map((x) => ligne(x.pts, { marche: x.e.mode === "marche" }));
    // Les arrêts de montée et de descente des autres étapes en véhicule : le trajet entier reste lisible.
    const autresArrets = possibilite.etapes
      .filter((e, i) => i !== rang)
      .flatMap((e) => arretsDuTrajet(e).filter((a) => a.role !== "intermediaire"))
      .map((a) => point(a, {}));
    const intermediaires = (course ?? arretsDuTrajet(etape))
      .filter((a) => a.role === "intermediaire")
      .map((a) => point(a, {}));
    // Arrêts de la course hors du trajet, avec leur nom en petit (la carte se lit sans la liste).
    const horsTrajet = (course ?? []).filter((a) => a.role === "avant" || a.role === "apres").map((a) => point(a, { nom: a.nom }));
    const consignes = (marche ? (etape.consignes ?? []) : [])
      .filter((c) => c.manoeuvre !== "depart" && c.manoeuvre !== "arrivee")
      .map((c) => point(c, {}));
    return {
      contexte: { type: "FeatureCollection" as const, features: contexte },
      etape: { type: "FeatureCollection" as const, features: points.length >= 2 ? [ligne(points, {})] : [] },
      autresArrets: { type: "FeatureCollection" as const, features: autresArrets },
      arrets: { type: "FeatureCollection" as const, features: [...intermediaires, ...consignes] },
      horsTrajet: { type: "FeatureCollection" as const, features: horsTrajet },
    };
  }, [possibilite, rang, etape, points, marche, course]);

  // Départ et arrivée de l'étape, marqués avec leur nom.
  const reperes = useMemo((): Etiquette[] => {
    if (marche) {
      const fin = suivante && suivante.mode !== "marche" ? { couleur: couleurs[jetonMode(suivante.mode)], icone: iconeMode(suivante.mode) } : null;
      return [
        { lat: etape.de.lat, lon: etape.de.lon, nom: nomLieuEtape(etape.de), couleur: couleurs.primaire, icone: "directions_walk" },
        { lat: etape.a.lat, lon: etape.a.lon, nom: finMarche(etape, suivante), couleur: fin?.couleur ?? couleurs.primaire, icone: fin?.icone ?? "flag" },
      ];
    }
    const arrets = arretsDuTrajet(etape);
    const montee = arrets.find((a) => a.role === "montee");
    const descente = arrets.find((a) => a.role === "descente");
    const de = montee ?? { ...etape.de, nom: etape.de.nom };
    const a = descente ?? { ...etape.a, nom: etape.a.nom };
    return [
      { lat: de.lat, lon: de.lon, nom: de.nom, couleur, icone: iconeMode(etape.mode) },
      { lat: a.lat, lon: a.lon, nom: a.nom, couleur, icone: "flag" },
    ];
  }, [marche, etape, suivante, couleur]);

  const marges = useMemo(() => ({ top: margeHaut + AIR + 40, bottom: margeBas + AIR, left: AIR_COTE, right: AIR_COTE }), [margeHaut, margeBas]);

  // Recadrer quand le panneau change de hauteur ou sur « Recentrer » ; se centrer sur ce qui est touché.
  useEffect(() => {
    if (choisi) camera.current?.easeTo({ center: [choisi.lon, choisi.lat], zoom: 17.5, padding: marges, duration: 500 });
    else if (cadre) camera.current?.fitBounds(cadre, { padding: marges, duration: 500 });
  }, [choisi, cadre, marges, recentrer]);

  if (!CARTE || !cadre) {
    return <Image source={require("../../assets/images/fond-carte.png")} contentFit="cover" style={StyleSheet.absoluteFill} />;
  }
  const C = CARTE;
  const pointilles = { "line-dasharray": [0.1, 2] };
  return (
    <View style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants">
      <Image source={require("../../assets/images/fond-carte.png")} contentFit="cover" style={StyleSheet.absoluteFill} />
      <C.Map style={StyleSheet.absoluteFill} mapStyle={C.url} touchRotate={false} touchPitch={false} attribution={false} logo={false} compass={false}>
        <C.Camera ref={camera} initialViewState={{ bounds: cadre, padding: marges }} />
        <C.GeoJSONSource id="etape-contexte" data={geo.contexte}>
          <C.Layer
            id="etape-contexte-vehicule"
            type="line"
            filter={["==", ["get", "marche"], false]}
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": GRIS_CONTEXTE, "line-width": 4 }}
          />
          <C.Layer
            id="etape-contexte-marche"
            type="line"
            filter={["==", ["get", "marche"], true]}
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": GRIS_CONTEXTE, "line-width": 4, ...pointilles }}
          />
        </C.GeoJSONSource>
        <C.GeoJSONSource id="etape-autres-arrets" data={geo.autresArrets}>
          <C.Layer
            id="etape-autres-arrets-rond"
            type="circle"
            paint={{ "circle-radius": 5, "circle-color": couleurs.fond, "circle-stroke-color": GRIS_CONTEXTE, "circle-stroke-width": 2.5 }}
          />
        </C.GeoJSONSource>
        <C.GeoJSONSource id="etape-trace" data={geo.etape}>
          <C.Layer
            id="etape-trace-trait"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={marche ? { "line-color": couleur, "line-width": 6, ...pointilles } : { "line-color": couleur, "line-width": 6 }}
          />
        </C.GeoJSONSource>
        <C.GeoJSONSource id="etape-hors-trajet" data={geo.horsTrajet}>
          <C.Layer
            id="etape-hors-trajet-rond"
            type="circle"
            paint={{ "circle-radius": 5, "circle-color": couleurs.fond, "circle-stroke-color": GRIS_CONTEXTE, "circle-stroke-width": 2.5 }}
          />
        </C.GeoJSONSource>
        <C.GeoJSONSource id="etape-arrets" data={geo.arrets}>
          <C.Layer
            id="etape-arrets-rond"
            type="circle"
            paint={{ "circle-radius": marche ? 4 : 6, "circle-color": couleurs.fond, "circle-stroke-color": couleur, "circle-stroke-width": marche ? 2 : 3 }}
          />
        </C.GeoJSONSource>
        {reperes.map((r, i) => (
          <C.Marker key={i} lngLat={[r.lon, r.lat]} anchor="bottom">
            <Repere nom={r.nom} couleur={r.couleur} icone={r.icone} />
          </C.Marker>
        ))}
        {choisi ? (
          <C.Marker lngLat={[choisi.lon, choisi.lat]} anchor="center">
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: couleur, borderWidth: 4, borderColor: couleurs.fond, boxShadow: "0px 2px 6px rgba(20, 22, 31, 0.3)" }} />
          </C.Marker>
        ) : null}
      </C.Map>
    </View>
  );
}
