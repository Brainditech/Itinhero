import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, ScrollView, Text, View, type ScrollViewInstance } from "react-native";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { SymbolView } from "expo-symbols";

import { supprimerCarte } from "@/carte/packs";
import { useCarteVoyage } from "@/carte/useCarteVoyage";
import { Ecran, TAILLE_FLOTTANT } from "@/composants/Ecran";
import { useCartes } from "@/cartes";
import { AFaire } from "@/composants/AFaire";
import { CarteCovoiturage } from "@/composants/CarteCovoiturage";
import { CarteTaxiDirect } from "@/composants/CarteTaxiDirect";
import { EnDirect } from "@/composants/EnDirect";
import { abonnerTrajet, oublierTempsReel } from "@/temps-reel";
import { useClient } from "@/session";
import { BandeauInfo, CarteFlottante, Lien, Puce } from "@/composants/elements";
import { LigneCarte } from "@/composants/LigneCarte";
import { BoutonRepli } from "@/composants/Repli";
import { CartePossibilite } from "@/composants/Trajet";
import { VotreTrajet } from "@/composants/VotreTrajet";
import type { ReponseSens } from "@/domaine/api";
import type { Trajet } from "@/domaine/demande";
import { maintenantAParis } from "@/domaine/demande";
import {
  adresseArrivee,
  bandeauLointain,
  finHoraires,
  horairesDu,
  ligneHoraires,
  montrerHorairesAVenir,
  phraseHorairesAVenir,
  phraseVerdict,
} from "@/domaine/resultat";
import { covoiturageEnTete, type LieuCovoiturage } from "@/domaine/covoiturage";
import { LIBELLES_TRIS, TRIS, trier, type Tri } from "@/domaine/tri";
import { actionsDuTrajet, rappelVeille } from "@/domaine/rappels";
import { bandeauVoyage, champsDepuisRecherche, possibiliteMontree, voyageDePossibilite, type TrisVoyage, type Voyage } from "@/domaine/voyages";
import { useModifierVoyage, useOuvrirFormulaire, useRecherche, type Recherche } from "@/recherche";
import { enregistrerVoyage, supprimerVoyage } from "@/stockage/voyages";
import { annulerRappels, programmerRappels } from "@/rappels";
import { couleurs, ombreFlottante } from "@/theme/jetons";

/**
 * Résultat (phase 3, maquettes 04 et 04b, spec 10 §4.2, spec 14) : « Votre trajet », verdict, les puces de tri
 * (spec 21, D97), puis une carte par possibilité dans l'ordre choisi.
 * Pas de « Moins cher », de prix ni de « Voir le trajet » ici ; toucher une carte déplie ses étapes.
 * Chaque bloc a un chevron qui le replie (spec 14 §11).
 * Avec une fin de rendez-vous (spec 19, D94) : l'aller, puis « Retour », son verdict et ses possibilités.
 * Chaque carte porte une disquette qui enregistre ce trajet seul, dans son sens (spec 24 §8, D102).
 * Un trajet rouvert depuis Mes trajets porte un bandeau et le crayon, sans disquette ni « Modifier la recherche ».
 */
export default function Resultat() {
  const { recherche } = useRecherche();
  const ouvrirFormulaire = useOuvrirFormulaire();
  const modifierVoyage = useModifierVoyage();
  // Issue 0018 : après « Recalculer depuis ici », le Résultat déjà monté reçoit une nouvelle réponse et garde
  // son défilement ; si la page raccourcit (cartes remontées repliées), Android le laisse sous la fin du
  // contenu et l'écran paraît vide. Chaque nouvelle réponse se lit donc depuis le haut.
  const defilement = useRef<ScrollViewInstance>(null);
  const reponseCourante = recherche?.reponse;
  useEffect(() => {
    defilement.current?.scrollTo({ y: 0, animated: false });
  }, [reponseCourante]);
  // Le tri de chaque sens vaut pour cette réponse seulement (D97) ; un trajet rouvert part du tri gardé (D101) ;
  // l'Assistant (spec 37) peut en demander un, avec une copie de la réponse pour que le choix précédent s'efface.
  const triDepart: TrisVoyage = { aller: recherche?.tri ?? recherche?.rouvert?.voyage.tri ?? "arrivee", retour: "arrivee" };
  const [choixTris, setChoixTris] = useState<{ pour: unknown; tris: TrisVoyage }>({ pour: reponseCourante, tris: triDepart });
  const tris = choixTris.pour === reponseCourante ? choixTris.tris : triDepart;
  const enregistrement = useEnregistrement(recherche);

  const depart = recherche?.depart.lieu;
  const arrivee = recherche?.arrivee.lieu;
  // Spec 34 (D112, §3.4) : onglet Trajet ouvert avant toute recherche.
  if (!recherche?.reponse || !depart || !arrivee) return <AucunTrajet />;
  const { reponse, demande, rouvert } = recherche;
  // Spec 47 : les deux bouts pour le lien de covoiturage (commune et point arrondi seulement).
  const lieuDepart: LieuCovoiturage = { ...depart.point, nom: depart.nom, adresse: depart.adresse };
  const lieuArrivee: LieuCovoiturage = {
    ...arrivee.point,
    nom: arrivee.nom,
    adresse: adresseArrivee(demande.arrivee, arrivee.adresse, reponse.arrivee.adresse),
  };
  const toutes = [...reponse.possibilites, ...(reponse.retour?.possibilites ?? [])];
  const du = horairesDu(toutes);
  const horaires = ligneHoraires(du, finHoraires(toutes));
  // Spec 32 : un trajet rouvert garde la date d'aujourd'hui pour le calcul (les horaires enregistrés ne changent pas).
  const aujourdhui = maintenantAParis(new Date()).date;
  const lointain = bandeauLointain(demande.date, aujourdhui, du);
  // Issue 0025 : des réseaux n'ont pas encore publié leurs horaires pour ce jour.
  const aVenir = reponse.horaires_a_venir ?? null;
  const impossible = reponse.verdict === "impossible" || reponse.retour?.verdict === "impossible";
  const bandeauAVenir =
    aVenir && montrerHorairesAVenir(impossible, demande.date, aujourdhui) ? phraseHorairesAVenir(aVenir) : null;
  // Spec 34 (§3.5) : le formulaire de l'onglet Accueil reprend la recherche, même s'il a été fermé entre-temps.
  const modifier = () =>
    ouvrirFormulaire({
      remplace: null,
      champs: champsDepuisRecherche(demande, depart, arrivee, maintenantAParis(new Date()).date),
      reprise: true,
    });
  const choisirTri = (trajet: Trajet, tri: Tri) => {
    setChoixTris({ pour: reponse, tris: { ...tris, [trajet]: tri } });
    AccessibilityInfo.announceForAccessibility(`Trajets classés : ${LIBELLES_TRIS[tri].toLowerCase()}`);
  };

  return (
    <Ecran
      ref={defilement}
      flottant={
        // Spec 49 (D130) : le petit bot flottant en bas à droite ouvre l'Assistant sur ce trajet (spec 45).
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Discuter de ce trajet avec l'Assistant"
          onPress={() => router.navigate({ pathname: "/assistant", params: { sujet: "trajet", jeton: String(Date.now()) } })}
          className="items-center justify-center rounded-full bg-primaire active:bg-primaire-presse"
          style={{ width: TAILLE_FLOTTANT, height: TAILLE_FLOTTANT, boxShadow: ombreFlottante }}
        >
          <SymbolView name={{ android: "smart_toy", web: "smart_toy" }} size={28} tintColor={couleurs.fond} />
        </Pressable>
      }
    >
      {rouvert ? <BandeauInfo texte={bandeauVoyage(rouvert.voyage.enregistre_le)} /> : null}
      {rouvert ? <EnDirect cle={rouvert.cle} voyage={rouvert.voyage} recherche={recherche} /> : null}
      {rouvert ? <AFaireDuVoyage voyage={rouvert.voyage} /> : null}
      {/* Issue 0025 : le bandeau des horaires pas encore publiés dit déjà de revérifier ; un seul des deux. */}
      {bandeauAVenir ? <BandeauInfo texte={bandeauAVenir} /> : lointain ? <BandeauInfo texte={lointain} /> : null}
      <VotreTrajet
        demande={demande}
        depart={{ nom: depart.nom, adresse: depart.adresse }}
        arrivee={{ nom: arrivee.nom, adresse: adresseArrivee(demande.arrivee, arrivee.adresse, reponse.arrivee.adresse) }}
        onModifier={rouvert ? () => modifierVoyage(rouvert.cle, rouvert.voyage) : modifier}
      />
      <Sens
        reponse={reponse}
        trajet="aller"
        destination={arrivee.nom}
        date={demande.date}
        adresse={reponse.arrivee.adresse}
        tri={tris.aller}
        onChoisir={(t) => choisirTri("aller", t)}
        enregistrement={rouvert ? null : enregistrement}
        horairesIncomplets={aVenir !== null}
        covoiturage={rouvert ? null : { de: lieuDepart, a: lieuArrivee }}
      />
      {/* Spec 41 : pas sur un trajet rouvert (il ne garde qu'une possibilité). */}
      {reponse.taxi_direct && !rouvert ? (
        <CarteTaxiDirect
          taxi={reponse.taxi_direct}
          depart={{ ...depart.point, nom: depart.nom }}
          arrivee={{ ...arrivee.point, nom: arrivee.nom }}
        />
      ) : null}

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
            enregistrement={rouvert ? null : enregistrement}
            horairesIncomplets={aVenir !== null}
            covoiturage={rouvert ? null : { de: lieuArrivee, a: lieuDepart }}
          />
        </>
      ) : null}

      {horaires ? (
        <Text className="text-center font-inter-medium text-secondaire text-primaire">{horaires}</Text>
      ) : null}
      {rouvert ? null : (
        <View className="items-center">
          <Lien libelle="Modifier la recherche" onPress={modifier} />
        </View>
      )}
    </Ecran>
  );
}

/** Spec 40 (D121) : « À faire » du trajet rouvert, tiré de la possibilité qu'il montre. */
function AFaireDuVoyage({ voyage }: { voyage: Voyage }) {
  const p = possibiliteMontree(voyage.reponse, voyage.tri);
  if (!p) return null;
  return <AFaire actions={actionsDuTrajet(p, voyage.arrivee.nom, new Date())} veille={rappelVeille(p, voyage.arrivee.nom)} />;
}

type Enregistre = { cle: string; voyage: Voyage; index: number; jeton: number };
/** Par sens : la possibilité enregistrée, l'enregistrement en cours ou l'échec, avec le rang touché. */
type EtatSens = { etat: "enCours" | "echec"; index: number } | ({ etat: "fait" } & Enregistre);
type EtatDisquettes = { pour: unknown; sens: Partial<Record<Trajet, EtatSens>> };

/**
 * Enregistrement d'une possibilité (spec 24 §8, D102) : le sens touché va dans la base du téléphone avec cette
 * seule possibilité. Une autre possibilité du même sens a la même clé et remplace la première (D98, §3.3) ; le
 * trajet modifié part s'il n'a pas été remplacé sur place. L'état vaut pour cette réponse.
 */
function useEnregistrement(recherche: Recherche | null) {
  const db = useSQLiteContext();
  const client = useClient();
  const [etat, setEtat] = useState<EtatDisquettes | null>(null);
  const courant: EtatDisquettes["sens"] = etat && etat.pour === recherche?.reponse ? etat.sens : {};

  async function enregistrer(trajet: Trajet, index: number) {
    if (!recherche) return;
    const pour = recherche.reponse;
    const voyage = voyageDePossibilite(recherche, trajet, index, new Date());
    if (!voyage) return;
    const poser = (e: EtatSens) =>
      setEtat((avant) => ({ pour, sens: { ...(avant && avant.pour === pour ? avant.sens : {}), [trajet]: e } }));
    poser({ etat: "enCours", index });
    try {
      const cle = await enregistrerVoyage(db, voyage);
      const ancien = recherche.remplace;
      // Un échec ici laisse l'ancien trajet dans la liste, sans perdre le nouveau.
      if (ancien && ancien !== cle) {
        await supprimerVoyage(db, ancien)
          .then(() => supprimerCarte(ancien))
          .catch(() => undefined);
        await annulerRappels(ancien).catch(() => undefined);
        await oublierTempsReel(db, client, ancien).catch(() => undefined);
      }
      // Spec 30 : rappels locaux du trajet ; un refus ou un échec n'empêche jamais l'enregistrement.
      await programmerRappels(cle, voyage).catch(() => 0);
      // Spec 42 : alertes poussées quand un projet Expo est configuré ; sinon rien (la relève locale suffit).
      void abonnerTrajet(db, client, cle, voyage).catch(() => 0);
      poser({ etat: "fait", cle, voyage, index, jeton: Date.now() });
      AccessibilityInfo.announceForAccessibility("Trajet enregistré dans Mes trajets");
    } catch {
      poser({ etat: "echec", index });
    }
  }

  return { sens: courant, enregistrer };
}

type Enregistrement = ReturnType<typeof useEnregistrement>;

/** Disquette d'une carte (spec 24 §8) : enregistre ce trajet seul ; une fois fait, une coche verte. */
function Disquette({ etat, onPress }: { etat: EtatSens | undefined; onPress: () => void }) {
  const fait = etat?.etat === "fait";
  const enCours = etat?.etat === "enCours";
  const icone = fait ? "check_circle" : "save";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={fait ? "Trajet enregistré dans Mes trajets. Enregistrer de nouveau" : "Enregistrer ce trajet"}
      accessibilityState={{ disabled: enCours }}
      disabled={enCours}
      onPress={onPress}
      hitSlop={4}
      style={{ minHeight: 48, minWidth: 48 }}
      className="items-center justify-center rounded-full active:bg-primaire-doux"
    >
      <SymbolView name={{ android: icone, web: icone }} size={26} tintColor={fait ? couleurs.possible : couleurs.primaire} />
    </Pressable>
  );
}

/** Dans la carte enregistrée : « Enregistré dans Mes trajets » et la carte de sa zone (spec 23), ou l'échec. */
function EtatEnregistrement({ etat }: { etat: EtatSens }) {
  if (etat.etat === "echec") {
    return (
      <Text accessibilityLiveRegion="polite" className="font-inter-medium text-badge text-erreur">
        Le trajet n&apos;a pas pu être enregistré sur le téléphone.
      </Text>
    );
  }
  if (etat.etat !== "fait") return null;
  return (
    <View className="gap-3 border-t border-bordure-carte pt-3">
      <View className="flex-row items-center gap-3">
        <Text className="flex-1 font-inter-semibold text-badge" style={{ color: couleurs.possible }}>
          Enregistré dans Mes trajets
        </Text>
        <Lien libelle="Voir Mes trajets" onPress={() => router.navigate("/mes-trajets")} />
      </View>
      {/* Clé avec le jeton : enregistrer de nouveau relance le téléchargement de la carte (D99, §3.5). */}
      <CarteEnregistree key={`${etat.cle}-${etat.jeton}`} enregistre={etat} />
    </View>
  );
}

/** La carte de la zone d'un trajet qui vient d'être enregistré : son téléchargement part tout de suite (D99). */
function CarteEnregistree({ enregistre }: { enregistre: Enregistre }) {
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
  return <LigneCarte etat={carte.etat} onEnregistrer={() => carte.lancer(false)} />;
}

/**
 * Un sens du voyage : son verdict, ses puces de tri, puis une carte par possibilité dans l'ordre choisi (D97).
 * Le verdict ne bouge pas avec le tri. Chaque carte garde son rang dans la réponse : l'Étape et le Guidage
 * retrouvent la possibilité par lui, et sa disquette l'enregistre seule (D102) ; pas de disquette sur un
 * trajet rouvert (`enregistrement` nul).
 */
function Sens({
  reponse,
  trajet,
  destination,
  date,
  adresse,
  tri,
  onChoisir,
  enregistrement,
  horairesIncomplets,
  covoiturage,
}: {
  reponse: ReponseSens;
  trajet: Trajet;
  destination: string;
  date: string;
  adresse: string | null;
  tri: Tri;
  onChoisir: (t: Tri) => void;
  enregistrement: Enregistrement | null;
  horairesIncomplets: boolean;
  /** Spec 47 (D50) : nul sur un trajet rouvert. */
  covoiturage: { de: LieuCovoiturage; a: LieuCovoiturage } | null;
}) {
  const { cartes } = useCartes();
  const enTete = covoiturageEnTete(reponse.possibilites);
  const carteCovoiturage = covoiturage ? (
    <CarteCovoiturage de={covoiturage.de} a={covoiturage.a} date={date} possibilites={reponse.possibilites} />
  ) : null;
  const rangees = trier(reponse.possibilites, tri, cartes, trajet);
  const etat = enregistrement?.sens[trajet];
  return (
    <>
      <BlocVerdict reponse={reponse} trajet={trajet} horairesIncomplets={horairesIncomplets} />
      {enTete ? carteCovoiturage : null}
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
          action={
            enregistrement ? (
              <Disquette etat={etat?.index === i ? etat : undefined} onPress={() => void enregistrement.enregistrer(trajet, i)} />
            ) : undefined
          }
          pied={etat?.index === i ? <EtatEnregistrement etat={etat} /> : undefined}
        />
      ))}
      {enTete ? null : carteCovoiturage}
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

function BlocVerdict({
  reponse,
  trajet,
  horairesIncomplets,
}: {
  reponse: ReponseSens;
  trajet: Trajet;
  horairesIncomplets: boolean;
}) {
  const verdict = phraseVerdict(reponse, trajet, horairesIncomplets);
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

/** Onglet Trajet sans recherche en cours (spec 34, D112, §3.4) ; sans bouton, l'onglet Accueil y mène (spec 38, D116). */
function AucunTrajet() {
  return (
    <Ecran>
      <CarteFlottante>
        <Text accessibilityRole="header" className="font-inter-semibold text-titre-carte text-texte">
          {"Aucun trajet pour l'instant."}
        </Text>
        <Text className="mt-2 font-inter text-corps text-texte-secondaire">
          {"Écrivez sur l'Accueil où vous devez être, et quand."}
        </Text>
      </CarteFlottante>
    </Ecran>
  );
}
