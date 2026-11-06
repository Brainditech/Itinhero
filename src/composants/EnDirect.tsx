import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { SymbolView } from "expo-symbols";

import { BoutonSecondaire } from "@/composants/elements";
import type { EtatCourse } from "@/domaine/api";
import { libelleEtape } from "@/domaine/resultat";
import { etapesSuivies, libelleEtat } from "@/domaine/temps-reel";
import { possibiliteMontree, type Voyage } from "@/domaine/voyages";
import { useDeroulerRecherche, type Recherche } from "@/recherche";
import { useClient } from "@/session";
import { releverTrajet, trajetEnCours } from "@/temps-reel";
import { couleurs, ombreFlottante } from "@/theme/jetons";

const TEINTES = { prevu: couleurs["prevu-texte"], direct: couleurs.possible, retard: couleurs.avertissement, supprime: couleurs.erreur };

/**
 * « En direct » d'un trajet rouvert (spec 42, D123) : l'état de chaque véhicule, relevé chaque minute tant que le
 * trajet est en cours (3 h avant le départ jusqu'à l'arrivée). Sans réseau ni flux : rien (l'horaire reste « prévu »).
 * Un véhicule supprimé propose une autre solution depuis son arrêt de montée (D51), sans rien remplacer.
 */
export function EnDirect({ cle, voyage, recherche }: { cle: string; voyage: Voyage; recherche: Recherche }) {
  const db = useSQLiteContext();
  const client = useClient();
  const { recalculer } = useDeroulerRecherche();
  const [etats, setEtats] = useState<EtatCourse[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const p = possibiliteMontree(voyage.reponse, voyage.tri);

  useEffect(() => {
    let actif = true;
    const relever = async () => {
      if (!trajetEnCours(voyage, new Date())) return;
      const lus = await releverTrajet(db, client, cle, voyage).catch(() => null);
      if (actif && lus) setEtats(lus);
    };
    void relever();
    const minuterie = setInterval(() => void relever(), 60_000);
    return () => {
      actif = false;
      clearInterval(minuterie);
    };
  }, [db, client, cle, voyage]);

  if (!p || !etats) return null;
  const suivies = etapesSuivies(p);
  if (suivies.length === 0) return null;
  return (
    <View className="gap-3 rounded-bouton border border-bordure-carte bg-fond p-4" style={{ boxShadow: ombreFlottante }}>
      <Text accessibilityRole="header" className="font-inter-semibold text-titre-carte text-texte">
        En direct
      </Text>
      {suivies.map(({ etape, course }) => {
        const etat = etats.find((e) => e.course === course);
        const l = libelleEtat(etat);
        return (
          <View key={course} className="gap-2">
            <View className="flex-row items-center gap-2" accessible accessibilityLabel={`${libelleEtape(etape)} de ${etape.depart} : ${l.texte}`}>
              <SymbolView name={{ android: l.ton === "supprime" ? "cancel" : l.ton === "retard" ? "warning" : "schedule", web: "schedule" }} size={20} tintColor={TEINTES[l.ton]} />
              <Text className="flex-1 font-inter text-corps text-texte">{`${libelleEtape(etape)} de ${etape.depart}`}</Text>
              <Text className="font-inter-semibold text-secondaire" style={{ color: TEINTES[l.ton] }}>
                {l.texte}
              </Text>
            </View>
            {l.ton === "supprime" ? (
              <BoutonSecondaire
                libelle="Chercher une autre solution"
                onPress={() => {
                  setMessage(null);
                  void recalculer(recherche, "aller", { lat: etape.de.lat, lon: etape.de.lon }).then((e) => setMessage(e?.message ?? null));
                }}
              />
            ) : null}
          </View>
        );
      })}
      {message ? <Text className="font-inter text-secondaire text-erreur">{message}</Text> : null}
    </View>
  );
}
