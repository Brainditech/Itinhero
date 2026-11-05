import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { CARTE } from "@/composants/carte-module";
import { Fleche } from "@/composants/Fleches";
import { Chevron } from "@/composants/Repli";
import type { Etape } from "@/domaine/api";
import { consignesAMontrer, destinationMarche, distanceConsigne, libelleVoirChemin, phraseConsigne } from "@/domaine/consignes";
import { boite, decoderTrace } from "@/domaine/geo";
import { couleurs } from "@/theme/jetons";

/**
 * « Voir le chemin (N consignes) » d'une étape à pied (spec 11, §4.2) : la carte du tracé de MOTIS
 * (marche en pointillés) et la liste des consignes ; toucher une consigne centre la carte sur son point.
 */
export function CheminAPied({ etape }: { etape: Etape }) {
  const consignes = consignesAMontrer(etape);
  const [ouvert, setOuvert] = useState(false);
  const [choisie, setChoisie] = useState<number | null>(null);
  if (consignes.length === 0) return null;
  const destination = destinationMarche(etape);
  return (
    <View className="gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: ouvert }}
        onPress={() => setOuvert((o) => !o)}
        hitSlop={8}
        className="min-h-12 flex-row items-center gap-1 self-start"
      >
        <Text className="font-inter-medium text-badge text-primaire">
          {ouvert ? "Replier le chemin" : libelleVoirChemin(consignes.length)}
        </Text>
        <Chevron ouvert={ouvert} />
      </Pressable>
      {ouvert ? (
        <>
          <CarteChemin etape={etape} centre={choisie === null ? null : consignes[choisie]!} />
          <View>
            {consignes.map((c, i) => {
              const d = distanceConsigne(c);
              const active = i === choisie;
              return (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityHint="Centre la carte sur ce point"
                  onPress={() => setChoisie(i)}
                  className={`min-h-12 flex-row items-center gap-3 rounded-champ px-2 py-2 ${active ? "bg-primaire-doux" : ""}`}
                >
                  <Fleche manoeuvre={c.manoeuvre} taille={24} couleur={couleurs.primaire} />
                  <View className="flex-1">
                    <Text className="font-inter-medium text-badge text-texte">{phraseConsigne(c, destination)}</Text>
                    {d ? <Text className="font-inter text-badge text-texte-secondaire">{d}</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

/** Petite carte du tracé d'une marche, avec un point par consigne. */
function CarteChemin({ etape, centre }: { etape: Etape; centre: { lat: number; lon: number } | null }) {
  const points = useMemo(() => (etape.trace ? decoderTrace(etape.trace) : []), [etape.trace]);
  const geo = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry: { type: "LineString" as const, coordinates: points.map((p) => [p.lon, p.lat]) },
        },
        ...(etape.consignes ?? []).map((c) => ({
          type: "Feature" as const,
          properties: { arrivee: c.manoeuvre === "arrivee" },
          geometry: { type: "Point" as const, coordinates: [c.lon, c.lat] },
        })),
      ],
    }),
    [points, etape.consignes],
  );
  if (!CARTE || points.length < 2) return null;
  const [o, s, e, n] = boite(points);
  const cadre = { padding: { top: 24, bottom: 24, left: 24, right: 24 }, duration: 400 };
  return (
    <View className="h-56 overflow-hidden rounded-champ border border-bordure-carte">
      <CARTE.Map style={{ flex: 1 }} mapStyle={CARTE.url} touchRotate={false} touchPitch={false} attribution={false} logo={false} compass={false}>
        {centre ? (
          <CARTE.Camera center={[centre.lon, centre.lat]} zoom={18} {...cadre} />
        ) : (
          <CARTE.Camera bounds={[o, s, e, n]} {...cadre} />
        )}
        <CARTE.GeoJSONSource id={`chemin-${etape.depart}`} data={geo}>
          <CARTE.Layer
            id={`chemin-trait-${etape.depart}`}
            type="line"
            filter={["==", ["geometry-type"], "LineString"]}
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": couleurs.primaire, "line-width": 5, "line-dasharray": [0.1, 2] }}
          />
          <CARTE.Layer
            id={`chemin-points-${etape.depart}`}
            type="circle"
            filter={["==", ["geometry-type"], "Point"]}
            paint={{ "circle-radius": 5, "circle-color": couleurs.fond, "circle-stroke-color": couleurs.primaire, "circle-stroke-width": 2.5 }}
          />
        </CARTE.GeoJSONSource>
      </CARTE.Map>
      <View className="absolute bottom-1 right-1 rounded-champ bg-fond/80 px-2 py-0.5">
        <Text className="font-inter text-xs text-texte-secondaire">© OpenMapTiles © OpenStreetMap</Text>
      </View>
    </View>
  );
}
