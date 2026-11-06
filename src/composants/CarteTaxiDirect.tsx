import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";

import { Numero } from "@/composants/AFaire";
import { Lien } from "@/composants/elements";
import type { Contact, Point } from "@/domaine/api";
import { formaterDuree } from "@/domaine/resultat";
import { lienUberEntre } from "@/domaine/uber";
import { useClient } from "@/session";
import { couleurs, ombreFlottante } from "@/theme/jetons";

type TaxiDirect = { duree_minutes: number; distance_metres: number | null; depart: string; arrivee: string };

/**
 * Taxi de bout en bout (spec 41, D122, D48) : durée de route estimée par MOTIS, hors attente ; jamais de prix
 * (invariant 5). Uber pré-rempli et numéros de taxi près du départ.
 */
export function CarteTaxiDirect({
  taxi,
  depart,
  arrivee,
}: {
  taxi: TaxiDirect;
  depart: Point & { nom: string };
  arrivee: Point & { nom: string };
}) {
  const client = useClient();
  const [numeros, setNumeros] = useState<Contact[] | "attente" | "echec" | null>(null);
  const km = taxi.distance_metres === null ? "" : ` · ${Math.round(taxi.distance_metres / 1000)} km`;
  const duree = formaterDuree(taxi.duree_minutes);
  return (
    <View
      className="gap-2 rounded-bouton border border-bordure-carte bg-fond p-4"
      style={{ boxShadow: ombreFlottante }}
      accessibilityLabel={`Taxi de bout en bout, ${taxi.depart} à ${taxi.arrivee}, ${duree} de route estimée, hors attente. Prix non publié.`}
    >
      <View className="flex-row items-center gap-2">
        <SymbolView name={{ android: "local_taxi", web: "local_taxi" }} size={22} tintColor={couleurs.primaire} />
        <Text className="font-inter-semibold text-titre-carte text-texte">Taxi de bout en bout</Text>
      </View>
      <Text className="font-inter-semibold text-corps text-texte">{`${taxi.depart} → ${taxi.arrivee}`}</Text>
      <Text className="font-inter text-secondaire text-texte">{`${duree} de route estimée, hors attente${km}.`}</Text>
      <Text className="font-inter text-secondaire text-texte-secondaire">Prix non publié.</Text>
      <View className="items-start">
        <Lien
          libelle="Commander un Uber"
          onPress={() => void Linking.openURL(lienUberEntre({ ...depart }, { ...arrivee })).catch(() => undefined)}
        />
      </View>
      {numeros === null ? (
        <View className="items-start">
          <Lien
            libelle="Numéros de taxi près du départ"
            onPress={() => {
              setNumeros("attente");
              void client.numeros({ lat: depart.lat, lon: depart.lon }, "taxi").then((r) => setNumeros(r.etat === "ok" ? r.donnees : "echec"));
            }}
          />
        </View>
      ) : numeros === "attente" ? (
        <Text className="font-inter text-secondaire text-texte-secondaire">Recherche des numéros…</Text>
      ) : numeros === "echec" ? (
        <Text className="font-inter text-secondaire text-erreur">Numéros indisponibles sans connexion au serveur.</Text>
      ) : numeros.length === 0 ? (
        <Numero contact={null} />
      ) : (
        numeros.map((c) => <Numero key={`${c.nom}-${c.numero}`} contact={c} />)
      )}
    </View>
  );
}
