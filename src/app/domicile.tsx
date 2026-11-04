import { useState } from "react";
import { Keyboard, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { SymbolView } from "expo-symbols";

import { Ecran } from "@/composants/Ecran";
import { BoutonPrincipal, CarteErreur, CarteFlottante, ChampTexte, Lien } from "@/composants/elements";
import { messageEchec, type Candidat } from "@/domaine/api";
import { LIEU_MIN_RECHERCHE } from "@/domaine/demande";
import { domicileDepuisCandidat } from "@/domaine/domicile";
import { detailCandidat } from "@/domaine/resultat";
import { useClient, useSession } from "@/session";
import { enregistrerDomicileEnBase } from "@/stockage/reglages";
import { couleurs, ombreFlottante } from "@/theme/jetons";

/**
 * Choix du domicile (D65), ouvert par « Modifier » dans Réglages : recherche par `GET /v1/lieux`,
 * puis le candidat touché est gardé dans SQLite, sur le téléphone seulement (invariant 6).
 */
export default function ChoixDomicile() {
  const db = useSQLiteContext();
  const client = useClient();
  const { oublierCle } = useSession();
  const [texte, setTexte] = useState("");
  const [erreurChamp, setErreurChamp] = useState<string | undefined>();
  const [erreur, setErreur] = useState<string | undefined>();
  const [candidats, setCandidats] = useState<Candidat[] | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function chercher() {
    if (enCours) return;
    Keyboard.dismiss();
    setErreur(undefined);
    const q = texte.trim();
    if (q.length < LIEU_MIN_RECHERCHE) {
      setErreurChamp("Indiquez votre adresse ou votre commune.");
      return;
    }
    setEnCours(true);
    try {
      const r = await client.lieux(q);
      if (r.etat === "cle_refusee") {
        await oublierCle();
        return;
      }
      if (r.etat !== "ok") {
        setErreur(messageEchec(r));
        return;
      }
      setCandidats(r.donnees.slice(0, 8));
      if (r.donnees.length === 0) setErreurChamp(`Aucun lieu trouvé pour « ${q} ». Essayez avec la commune.`);
    } catch {
      setErreur("La recherche a échoué.");
    } finally {
      setEnCours(false);
    }
  }

  async function choisir(c: Candidat) {
    try {
      await enregistrerDomicileEnBase(db, domicileDepuisCandidat(c));
      router.back();
    } catch {
      setErreur("Le domicile n'a pas pu être enregistré sur le téléphone.");
    }
  }

  return (
    <Ecran
      onglets={false}
      bas={<BoutonPrincipal libelle={enCours ? "Recherche en cours…" : "Chercher"} onPress={chercher} desactive={enCours} />}
    >
      <Text accessibilityRole="header" className="font-inter-bold text-titre-ecran text-texte">
        Domicile
      </Text>
      <CarteFlottante>
        <ChampTexte
          libelle="Adresse ou commune"
          valeur={texte}
          onChange={(t) => {
            setTexte(t);
            setErreurChamp(undefined);
          }}
          erreur={erreurChamp}
          longueurMax={200}
          autoFocus
          onValider={chercher}
        />
      </CarteFlottante>
      {erreur ? <CarteErreur message={erreur} onReessayer={chercher} /> : null}
      {candidats && candidats.length > 0 ? (
        <View className="gap-3">
          <Text className="font-inter text-secondaire text-texte-secondaire">Touchez votre domicile :</Text>
          {candidats.map((c) => (
            <Pressable
              key={`${c.nom}-${c.lat}-${c.lon}`}
              accessibilityRole="button"
              onPress={() => choisir(c)}
              className="flex-row items-center gap-4 rounded-carte border border-bordure-carte bg-fond p-5 active:bg-primaire-doux"
              style={{ boxShadow: ombreFlottante }}
            >
              <SymbolView name={{ android: "home", web: "home" }} size={26} tintColor={couleurs.primaire} />
              <View className="flex-1">
                <Text className="font-inter-semibold text-corps text-texte">{c.nom}</Text>
                {detailCandidat(c) ? (
                  <Text className="font-inter text-secondaire text-texte-secondaire">{detailCandidat(c)}</Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View className="items-center">
        <Lien libelle="Annuler" onPress={() => router.back()} />
      </View>
    </Ecran>
  );
}
