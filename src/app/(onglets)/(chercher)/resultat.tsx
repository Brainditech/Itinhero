import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ScrollView, Text, View, type ScrollViewInstance } from "react-native";
import { Redirect, router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { SymbolView, type AndroidSymbol } from "expo-symbols";

import { supprimerCarte } from "@/carte/packs";
import { useCarteVoyage } from "@/carte/useCarteVoyage";
import { Ecran } from "@/composants/Ecran";
import { BandeauInfo, Lien, Puce } from "@/composants/elements";
import { LigneCarte } from "@/composants/LigneCarte";
import { MenuActions } from "@/composants/MenuActions";
import { BoutonRepli } from "@/composants/Repli";
import { CartePossibilite } from "@/composants/Trajet";
import { VotreTrajet } from "@/composants/VotreTrajet";
import type { ReponseSens } from "@/domaine/api";
import type { Trajet } from "@/domaine/demande";
import { adresseArrivee, finHoraires, phraseVerdict } from "@/domaine/resultat";
import { LIBELLES_TRIS, TRIS, trier, type Tri } from "@/domaine/tri";
import {
  bandeauVoyage,
  choixPossibles,
  peutEnregistrer,
  voyagesDepuisRecherche,
  type ChoixEnregistrement,
  type TrisVoyage,
  type Voyage,
} from "@/domaine/voyages";
import { useModifierVoyage, useRecherche, type Recherche } from "@/recherche";
import { enregistrerVoyage, supprimerVoyage } from "@/stockage/voyages";
import { couleurs, ombreFlottante } from "@/theme/jetons";

/**
 * Résultat (phase 3, maquettes 04 et 04b, spec 10 §4.2, spec 14) : « Votre trajet », verdict, les puces de tri
 * (spec 21, D97), puis une carte par possibilité dans l'ordre choisi.
 * Pas de « Moins cher », de prix ni de « Voir le trajet » ici ; toucher une carte déplie ses étapes.
 * Chaque bloc a un chevron qui le replie (spec 14 §11).
 * Avec une fin de rendez-vous (spec 19, D94) : l'aller, puis « Retour », son verdict et ses possibilités.
 * La disquette de « Votre trajet » enregistre l'aller, le retour ou les deux, chacun avec son tri (spec 24 §7, D101).
 * Un trajet rouvert depuis Mes trajets porte un bandeau et le crayon, sans disquette ni « Modifier la recherche ».
 */
export default function Resultat() {
  const { recherche } = useRecherche();
  const modifierVoyage = useModifierVoyage();
  // Issue 0018 : après « Recalculer depuis ici », le Résultat déjà monté reçoit une nouvelle réponse et garde
  // son défilement ; si la page raccourcit (cartes remontées repliées), Android le laisse sous la fin du
  // contenu et l'écran paraît vide. Chaque nouvelle réponse se lit donc depuis le haut.
  const defilement = useRef<ScrollViewInstance>(null);
  const reponseCourante = recherche?.reponse;
  useEffect(() => {
    defilement.current?.scrollTo({ y: 0, animated: false });
  }, [reponseCourante]);
  // Le tri de chaque sens vaut pour cette réponse seulement (D97) ; un trajet rouvert part du tri gardé (D101).
  const triDepart: TrisVoyage = { aller: recherche?.rouvert?.voyage.tri ?? "arrivee", retour: "arrivee" };
  const [choixTris, setChoixTris] = useState<{ pour: unknown; tris: TrisVoyage }>({ pour: reponseCourante, tris: triDepart });
  const tris = choixTris.pour === reponseCourante ? choixTris.tris : triDepart;
  const enregistrement = useEnregistrement(recherche, tris);

  const depart = recherche?.depart.lieu;
  const arrivee = recherche?.arrivee.lieu;
  if (!recherche?.reponse || !depart || !arrivee) return <Redirect href="/formulaire" />;
  const { reponse, demande, rouvert } = recherche;
  const horaires = finHoraires([...reponse.possibilites, ...(reponse.retour?.possibilites ?? [])]);
  const modifier = () => router.dismissTo("/formulaire");
  const choisirTri = (trajet: Trajet, tri: Tri) => {
    setChoixTris({ pour: reponse, tris: { ...tris, [trajet]: tri } });
    AccessibilityInfo.announceForAccessibility(`Trajets classés : ${LIBELLES_TRIS[tri].toLowerCase()}`);
  };

  return (
    <Ecran ref={defilement}>
      {rouvert ? <BandeauInfo texte={bandeauVoyage(rouvert.voyage.enregistre_le)} /> : null}
      <VotreTrajet
        demande={demande}
        depart={{ nom: depart.nom, adresse: depart.adresse }}
        arrivee={{ nom: arrivee.nom, adresse: adresseArrivee(demande.arrivee, arrivee.adresse, reponse.arrivee.adresse) }}
        onModifier={rouvert ? () => modifierVoyage(rouvert.cle, rouvert.voyage) : modifier}
        action={!rouvert && peutEnregistrer(reponse) ? <Disquette enregistrement={enregistrement} reponse={reponse} /> : undefined}
      />
      {rouvert ? null : <EtatEnregistrement enregistrement={enregistrement} />}
      <Sens
        reponse={reponse}
        trajet="aller"
        destination={arrivee.nom}
        date={demande.date}
        adresse={reponse.arrivee.adresse}
        tri={tris.aller}
        onChoisir={(t) => choisirTri("aller", t)}
      />

      {reponse.retour ? (
        <>
          <Text accessibilityRole="header" className="mt-2 font-inter-semibold text-titre-carte text-texte">
            {`Retour vers ${depart.nom}`}
          </Text>
          {/* L'adresse de l'IGN est celle de l'arrivée de l'aller : au retour, on garde celle connue du départ. */}
          <Sens
            reponse={reponse.retour}
            trajet="retour"
            destination={depart.nom}
            date={demande.date}
            adresse={depart.adresse}
            tri={tris.retour}
            onChoisir={(t) => choisirTri("retour", t)}
          />
        </>
      ) : null}

      {horaires ? (
        <Text className="text-center font-inter-medium text-secondaire text-primaire">{`Horaires valables jusqu'au ${horaires}`}</Text>
      ) : null}
      {rouvert ? null : (
        <View className="items-center">
          <Lien libelle="Modifier la recherche" onPress={modifier} />
        </View>
      )}
    </Ecran>
  );
}

type Enregistre = { cle: string; voyage: Voyage };
type EtatDisquette =
  { pour: unknown; etat: "enCours" | "echec" } | { pour: unknown; etat: "fait"; enregistres: Enregistre[]; jeton: number };

/**
 * Enregistrement des trajets (spec 24 §7, D101) : chaque sens choisi va dans la base du téléphone avec son tri ;
 * le même trajet remplace l'ancien (D98, §3.3), et le trajet modifié part s'il n'a pas été remplacé sur place.
 * L'état vaut pour cette réponse : une nouvelle réponse remet la disquette.
 */
function useEnregistrement(recherche: Recherche | null, tris: TrisVoyage) {
  const db = useSQLiteContext();
  const [etat, setEtat] = useState<EtatDisquette | null>(null);
  const courant = etat && etat.pour === recherche?.reponse ? etat : null;

  async function enregistrer(choix: ChoixEnregistrement) {
    if (!recherche) return;
    const pour = recherche.reponse;
    const voyages = voyagesDepuisRecherche(recherche, choix, tris, new Date());
    if (voyages.length === 0) return;
    setEtat({ pour, etat: "enCours" });
    try {
      const enregistres: Enregistre[] = [];
      for (const voyage of voyages) enregistres.push({ cle: await enregistrerVoyage(db, voyage), voyage });
      const ancien = recherche.remplace;
      // Un échec ici laisse l'ancien trajet dans la liste, sans perdre les nouveaux.
      if (ancien && !enregistres.some((e) => e.cle === ancien)) {
        await supprimerVoyage(db, ancien)
          .then(() => supprimerCarte(ancien))
          .catch(() => undefined);
      }
      setEtat({ pour, etat: "fait", enregistres, jeton: Date.now() });
      AccessibilityInfo.announceForAccessibility(
        enregistres.length > 1 ? "Aller et retour enregistrés dans Mes trajets" : "Trajet enregistré dans Mes trajets",
      );
    } catch {
      setEtat({ pour, etat: "echec" });
    }
  }

  return { etat: courant, enregistrer };
}

type Enregistrement = ReturnType<typeof useEnregistrement>;

const ACTIONS_CHOIX: Record<ChoixEnregistrement, { icone: AndroidSymbol; libelle: string }> = {
  aller_retour: { icone: "sync_alt", libelle: "Aller et retour" },
  aller: { icone: "arrow_forward", libelle: "Aller seulement" },
  retour: { icone: "arrow_back", libelle: "Retour seulement" },
};

/** Disquette à la place du chevron de « Votre trajet » (spec 24 §7.2) : un toucher, ou le choix du sens. */
function Disquette({ enregistrement, reponse }: { enregistrement: Enregistrement; reponse: Recherche["reponse"] }) {
  const { etat, enregistrer } = enregistrement;
  const fait = etat?.etat === "fait";
  const choix = choixPossibles(reponse);
  return (
    <MenuActions
      nom={fait ? "Trajet enregistré. Enregistrer de nouveau" : "Enregistrer le trajet"}
      icone={fait ? "check_circle" : "save"}
      teinte={fait ? couleurs.possible : couleurs.primaire}
      desactive={etat?.etat === "enCours"}
      actions={choix.map((c) => ({ ...ACTIONS_CHOIX[c], onPress: () => void enregistrer(c) }))}
    />
  );
}

/** Sous « Votre trajet » : « Enregistré dans Mes trajets » et la carte de chaque trajet (spec 23), ou l'échec. */
function EtatEnregistrement({ enregistrement }: { enregistrement: Enregistrement }) {
  const { etat } = enregistrement;
  if (etat?.etat === "echec") {
    return (
      <Text accessibilityLiveRegion="polite" className="font-inter-medium text-badge text-erreur">
        Le trajet n&apos;a pas pu être enregistré sur le téléphone.
      </Text>
    );
  }
  if (etat?.etat !== "fait") return null;
  const plusieurs = etat.enregistres.length > 1;
  return (
    <View className="gap-3 rounded-bouton border border-bordure-carte bg-fond p-4">
      <View className="flex-row items-center gap-3">
        <SymbolView name={{ android: "check_circle", web: "check_circle" }} size={24} tintColor={couleurs.possible} />
        <Text className="flex-1 font-inter-medium text-corps text-texte">Enregistré dans Mes trajets</Text>
        <Lien libelle="Voir Mes trajets" onPress={() => router.navigate("/mes-trajets")} />
      </View>
      {etat.enregistres.map((e) => (
        // Clé avec le jeton : enregistrer de nouveau relance le téléchargement de la carte (D99, §3.5).
        <CarteEnregistree
          key={`${e.cle}-${etat.jeton}`}
          enregistre={e}
          libelle={plusieurs ? (e.voyage.trajet === "retour" ? "Retour" : "Aller") : null}
        />
      ))}
    </View>
  );
}

/** La carte de la zone d'un trajet qui vient d'être enregistré : son téléchargement part tout de suite (D99). */
function CarteEnregistree({ enregistre, libelle }: { enregistre: Enregistre; libelle: string | null }) {
  const carte = useCarteVoyage(enregistre.cle, enregistre.voyage);
  const { lancer } = carte;
  const lance = useRef(false);
  useEffect(() => {
    if (lance.current) return;
    lance.current = true;
    // Le même trajet enregistré de nouveau : ses anciens packs sont remplacés (D99, §3.5).
    lancer(true);
  }, [lancer]);
  if (!carte.etat) return null;
  return (
    <View className="gap-1">
      {libelle ? <Text className="font-inter-medium text-badge text-texte-secondaire">{libelle}</Text> : null}
      <LigneCarte etat={carte.etat} onEnregistrer={() => carte.lancer(false)} />
    </View>
  );
}

/**
 * Un sens du voyage : son verdict, ses puces de tri, puis une carte par possibilité dans l'ordre choisi (D97).
 * Le verdict ne bouge pas avec le tri. Chaque carte garde son rang dans la réponse : l'Étape et le Guidage
 * retrouvent la possibilité par lui. Le tri est tenu par le Résultat : la disquette l'enregistre (D101).
 */
function Sens({
  reponse,
  trajet,
  destination,
  date,
  adresse,
  tri,
  onChoisir,
}: {
  reponse: ReponseSens;
  trajet: Trajet;
  destination: string;
  date: string;
  adresse: string | null;
  tri: Tri;
  onChoisir: (t: Tri) => void;
}) {
  const rangees = trier(reponse.possibilites, tri);
  return (
    <>
      <BlocVerdict reponse={reponse} trajet={trajet} />
      {reponse.possibilites.length >= 2 ? <PucesTri tri={tri} onChoisir={onChoisir} /> : null}
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
