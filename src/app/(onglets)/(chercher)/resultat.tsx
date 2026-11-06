import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ScrollView, Text, View, type ScrollViewInstance } from "react-native";
import { Redirect, router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { SymbolView } from "expo-symbols";

import { supprimerCarte } from "@/carte/packs";
import { useCarteVoyage } from "@/carte/useCarteVoyage";
import { Ecran } from "@/composants/Ecran";
import { BandeauInfo, BoutonPrincipal, Lien, Puce } from "@/composants/elements";
import { LigneCarte } from "@/composants/LigneCarte";
import { BoutonRepli } from "@/composants/Repli";
import { CartePossibilite } from "@/composants/Trajet";
import { VotreTrajet } from "@/composants/VotreTrajet";
import type { ReponseSens } from "@/domaine/api";
import type { Trajet } from "@/domaine/demande";
import { adresseArrivee, finHoraires, phraseVerdict } from "@/domaine/resultat";
import { LIBELLES_TRIS, TRIS, trier, type Tri } from "@/domaine/tri";
import { bandeauVoyage, peutEnregistrer, voyageDepuisRecherche, type Voyage } from "@/domaine/voyages";
import { useRecherche, type Recherche } from "@/recherche";
import { enregistrerVoyage, supprimerVoyage } from "@/stockage/voyages";
import { couleurs, ombreFlottante } from "@/theme/jetons";

/**
 * Résultat (phase 3, maquettes 04 et 04b, spec 10 §4.2, spec 14) : « Votre trajet », verdict, les puces de tri
 * (spec 21, D97), puis une carte par possibilité dans l'ordre choisi.
 * Pas de « Moins cher », de prix ni de « Voir le trajet » ici ; toucher une carte déplie ses étapes.
 * Chaque bloc a un chevron qui le replie (spec 14 §11).
 * Avec une fin de rendez-vous (spec 19, D94) : l'aller, puis « Retour », son verdict et ses possibilités.
 * En bas, « Enregistrer ce voyage » (spec 22, D98) ; un voyage rouvert depuis Mes trajets porte un bandeau,
 * sans « Enregistrer » ni « Modifier la recherche ».
 */
export default function Resultat() {
  const { recherche } = useRecherche();
  // Issue 0018 : après « Recalculer depuis ici », le Résultat déjà monté reçoit une nouvelle réponse et garde
  // son défilement ; si la page raccourcit (cartes remontées repliées), Android le laisse sous la fin du
  // contenu et l'écran paraît vide. Chaque nouvelle réponse se lit donc depuis le haut.
  const defilement = useRef<ScrollViewInstance>(null);
  const reponseCourante = recherche?.reponse;
  useEffect(() => {
    defilement.current?.scrollTo({ y: 0, animated: false });
  }, [reponseCourante]);
  const depart = recherche?.depart.lieu;
  const arrivee = recherche?.arrivee.lieu;
  if (!recherche?.reponse || !depart || !arrivee) return <Redirect href="/formulaire" />;
  const { reponse, demande } = recherche;
  const horaires = finHoraires([...reponse.possibilites, ...(reponse.retour?.possibilites ?? [])]);
  const modifier = () => router.dismissTo("/formulaire");

  const rouvert = recherche.enregistre_le;

  return (
    <Ecran ref={defilement}>
      {rouvert ? <BandeauInfo texte={bandeauVoyage(rouvert)} /> : null}
      <VotreTrajet
        demande={demande}
        depart={{ nom: depart.nom, adresse: depart.adresse }}
        arrivee={{ nom: arrivee.nom, adresse: adresseArrivee(demande.arrivee, arrivee.adresse, reponse.arrivee.adresse) }}
        onModifier={rouvert ? undefined : modifier}
      />
      <Sens reponse={reponse} trajet="aller" destination={arrivee.nom} date={demande.date} adresse={reponse.arrivee.adresse} />

      {reponse.retour ? (
        <>
          <Text accessibilityRole="header" className="mt-2 font-inter-semibold text-titre-carte text-texte">
            {`Retour vers ${depart.nom}`}
          </Text>
          {/* L'adresse de l'IGN est celle de l'arrivée de l'aller : au retour, on garde celle connue du départ. */}
          <Sens reponse={reponse.retour} trajet="retour" destination={depart.nom} date={demande.date} adresse={depart.adresse} />
        </>
      ) : null}

      {horaires ? (
        <Text className="text-center font-inter-medium text-secondaire text-primaire">{`Horaires valables jusqu'au ${horaires}`}</Text>
      ) : null}
      {rouvert ? null : (
        <>
          {peutEnregistrer(reponse) ? <EnregistrerVoyage recherche={recherche} /> : null}
          <View className="items-center">
            <Lien libelle="Modifier la recherche" onPress={modifier} />
          </View>
        </>
      )}
    </Ecran>
  );
}

/**
 * « Enregistrer ce voyage » (D98, §3.2) : tout le voyage va dans la base du téléphone ; la même recherche
 * remplace l'ancien. L'état vaut pour cette réponse : une nouvelle réponse remet le bouton.
 * Puis la carte de la zone du voyage se télécharge (spec 23, D99), avec son état sous « Enregistré ».
 */
function EnregistrerVoyage({ recherche }: { recherche: Recherche }) {
  const db = useSQLiteContext();
  const [etat, setEtat] = useState<{ pour: Recherche["reponse"]; etat: "enCours" | "fait" | "echec" } | null>(null);
  const courant = etat?.pour === recherche.reponse ? etat.etat : null;
  const [enregistre, setEnregistre] = useState<{ cle: string; voyage: Voyage } | null>(null);
  const carte = useCarteVoyage(enregistre?.cle ?? null, enregistre?.voyage ?? null);

  async function enregistrer() {
    const voyage = voyageDepuisRecherche(recherche, new Date());
    if (!voyage) return;
    setEtat({ pour: recherche.reponse, etat: "enCours" });
    try {
      const cle = await enregistrerVoyage(db, voyage);
      // « Modifier » (spec 24, D100) : le voyage d'origine part, avec sa carte, s'il n'a pas été remplacé sur place.
      const ancien = recherche.remplace;
      // Un échec ici laisse l'ancien voyage dans la liste, sans perdre le nouveau.
      if (ancien && ancien !== cle) {
        await supprimerVoyage(db, ancien)
          .then(() => supprimerCarte(ancien))
          .catch(() => undefined);
      }
      setEtat({ pour: recherche.reponse, etat: "fait" });
      AccessibilityInfo.announceForAccessibility("Voyage enregistré dans Mes trajets");
      // Le même voyage enregistré de nouveau : ses anciens packs sont remplacés (D99, §3.5).
      setEnregistre({ cle, voyage });
      carte.lancer(true, cle, voyage);
    } catch {
      setEtat({ pour: recherche.reponse, etat: "echec" });
    }
  }

  if (courant === "fait") {
    return (
      <View className="gap-3 rounded-bouton border border-bordure-carte bg-fond p-4">
        <View className="flex-row items-center gap-3">
          <SymbolView name={{ android: "check_circle", web: "check_circle" }} size={24} tintColor={couleurs.possible} />
          <Text className="flex-1 font-inter-medium text-corps text-texte">Enregistré dans Mes trajets</Text>
          <Lien libelle="Voir Mes trajets" onPress={() => router.navigate("/mes-trajets")} />
        </View>
        <LigneCarte etat={carte.etat} onEnregistrer={() => carte.lancer(false)} />
      </View>
    );
  }
  return (
    <View className="gap-2">
      <BoutonPrincipal
        libelle={courant === "enCours" ? "Enregistrement…" : "Enregistrer ce voyage"}
        onPress={enregistrer}
        desactive={courant === "enCours"}
      />
      {courant === "echec" ? (
        <Text accessibilityLiveRegion="polite" className="font-inter-medium text-badge text-erreur">
          Le voyage n&apos;a pas pu être enregistré sur le téléphone.
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Un sens du voyage : son verdict, ses puces de tri, puis une carte par possibilité dans l'ordre choisi (D97).
 * Le verdict ne bouge pas avec le tri. Chaque carte garde son rang dans la réponse : l'Étape et le Guidage
 * retrouvent la possibilité par lui.
 */
function Sens({
  reponse,
  trajet,
  destination,
  date,
  adresse,
}: {
  reponse: ReponseSens;
  trajet: Trajet;
  destination: string;
  date: string;
  adresse: string | null;
}) {
  // Le choix vaut pour cette réponse seulement : une nouvelle réponse repart d'« Arrivée la plus tôt » (D97).
  const [choix, setChoix] = useState<{ pour: ReponseSens; tri: Tri }>({ pour: reponse, tri: "arrivee" });
  const tri = choix.pour === reponse ? choix.tri : "arrivee";
  const rangees = trier(reponse.possibilites, tri);
  const choisir = (t: Tri) => {
    setChoix({ pour: reponse, tri: t });
    AccessibilityInfo.announceForAccessibility(`Trajets classés : ${LIBELLES_TRIS[t].toLowerCase()}`);
  };
  return (
    <>
      <BlocVerdict reponse={reponse} trajet={trajet} />
      {reponse.possibilites.length >= 2 ? <PucesTri tri={tri} onChoisir={choisir} /> : null}
      {rangees.length === 0 && reponse.possibilites.length > 0 ? (
        <Text className="font-inter text-corps text-texte">Aucun trajet sans réservation ce jour-là.</Text>
      ) : null}
      {rangees.map(({ possibilite: p, index: i }) => (
        <CartePossibilite
          key={`${trajet}-${p.depart_utc}-${p.arrivee_utc}-${i}`}
          possibilite={p}
          index={i}
          trajet={trajet}
          destination={destination}
          date={date}
          adresse={adresse}
        />
      ))}
    </>
  );
}

/**
 * Rangée de puces (maquette 04, D97) : défile de côté jusqu'aux bords de l'écran, la dernière coupée par le bord.
 * TalkBack la lit comme un groupe de boutons radio.
 */
function PucesTri({ tri, onChoisir }: { tri: Tri; onChoisir: (t: Tri) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="radiogroup"
      accessibilityLabel="Classer les trajets"
      className="-mx-4"
      contentContainerClassName="gap-2 px-4"
    >
      {TRIS.map((t) => (
        <Puce key={t} libelle={LIBELLES_TRIS[t]} active={t === tri} onPress={() => onChoisir(t)} />
      ))}
    </ScrollView>
  );
}

function BlocVerdict({ reponse, trajet }: { reponse: ReponseSens; trajet: Trajet }) {
  const verdict = phraseVerdict(reponse, trajet);
  // Replié au départ (spec 14), sauf « Impossible » : aucune carte dessous ne dit pourquoi (issue 0021).
  const [verdictOuvert, setVerdictOuvert] = useState(() => verdict.etat === "impossible");
  // Vert seulement pour « Possible » ; une nuit dehors est en orange avec le triangle (spec 15, D79).
  const teinte = verdict.etat === "possible" ? couleurs.possible : verdict.etat === "nuit" ? couleurs.avertissement : couleurs.erreur;
  const iconeVerdict = verdict.etat === "possible" ? "check_circle" : verdict.etat === "nuit" ? "warning" : "cancel";
  return (
    <View
      accessibilityRole="summary"
      className="overflow-hidden rounded-carte border border-bordure-carte bg-fond"
      style={{ boxShadow: ombreFlottante }}
    >
      <View className="flex-row">
        <View style={{ width: 6, backgroundColor: teinte }} />
        <View className={`flex-1 gap-2 py-5 pl-5 pr-1 ${verdictOuvert ? "" : "pb-3 pt-3"}`}>
          <View className="flex-row items-center gap-2">
            <SymbolView name={{ android: iconeVerdict, web: iconeVerdict }} size={28} tintColor={teinte} />
            <View className="flex-1 flex-row flex-wrap items-baseline gap-x-3">
              <Text className="font-inter-bold text-verdict" style={{ color: teinte }}>
                {verdict.titre}
              </Text>
              {!verdictOuvert && verdict.heureDepart ? (
                <Text className="font-inter-semibold text-corps text-texte" style={{ fontVariant: ["tabular-nums"] }}>
                  {`Départ ${verdict.heureDepart}`}
                </Text>
              ) : null}
            </View>
            <BoutonRepli
              ouvert={verdictOuvert}
              nom={trajet === "retour" ? "Verdict du retour" : "Verdict"}
              onPress={() => setVerdictOuvert((o) => !o)}
            />
          </View>
          {verdictOuvert ? (
            <>
              {verdict.heureDepart ? (
                <Text className="font-inter-bold text-heure-depart text-texte" style={{ fontVariant: ["tabular-nums"] }}>
                  {`Départ ${verdict.heureDepart}`}
                </Text>
              ) : null}
              <Text className="pr-4 font-inter text-corps text-texte">{verdict.detail}</Text>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}
