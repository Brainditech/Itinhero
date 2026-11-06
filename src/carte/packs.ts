import type { OfflinePack, OfflinePackStatus } from "@maplibre/maplibre-react-native";

import { CARTE, PACKS_POSSIBLES } from "@/composants/carte-module";
import { etatCarte, lireMetaPack, zonesVoyage, type EtatCarte, type MetaPack, type ZoneCarte } from "@/domaine/pack-carte";
import type { Voyage } from "@/domaine/voyages";

// Pack de carte de la zone du trajet (spec 23, D99) : un pack MapLibre par zone, rangés par voyage dans leurs
// métadonnées. Aucune zone ni coordonnée n'est journalisée (invariant 10).

/** OpenFreeMap : au plus 50 Mo par téléchargement. */
const TAILLE_MAX_OCTETS = 50_000_000;

/** Vrai si l'app peut garder la carte d'un voyage (development build avec le module réseau, style présent). */
export function cartePossible(): boolean {
  return PACKS_POSSIBLES;
}

function gestionnaire() {
  if (!CARTE || !PACKS_POSSIBLES) throw new Error("carte hors ligne indisponible");
  return CARTE.OfflineManager;
}

type PackLu = { pack: OfflinePack; meta: MetaPack };

async function packsDuVoyage(cle: string): Promise<PackLu[]> {
  const packs = await gestionnaire().getPacks();
  return packs.flatMap((pack) => {
    const meta = lireMetaPack(pack.metadata);
    return meta && meta.voyage === cle ? [{ pack, meta }] : [];
  });
}

/** État de la carte d'un voyage, ou null si l'app ne peut pas garder de carte (rien à afficher). */
export async function etatCarteVoyage(cle: string): Promise<EtatCarte | null> {
  if (!PACKS_POSSIBLES) return null;
  // Téléchargement suivi par cette session : son avancée fait foi (entre deux zones, ou pendant qu'un voyage
  // remplacé perd ses anciens packs, la base seule dirait « absente » ou « enregistrée »).
  const suivi = enCours.get(cle);
  if (suivi) return { etat: "enCours", pourcentage: suivi.dernier };
  const packs = await packsDuVoyage(cle);
  const lus = await Promise.all(packs.map(async ({ pack, meta }) => ({ meta, statut: await pack.status() })));
  return etatCarte(lus);
}

/** Supprime les packs du voyage (voyage supprimé, ou remplacé par un nouvel enregistrement). */
export async function supprimerCarte(cle: string): Promise<void> {
  if (!PACKS_POSSIBLES) return;
  const om = gestionnaire();
  for (const { pack } of await packsDuVoyage(cle)) {
    om.removeListener(pack.id);
    await om.deletePack(pack.id);
  }
}

export class CarteTropLourde extends Error {}

type Suivi = {
  /** Écouteurs à donner à MapLibre (création ou reprise du pack). */
  surProgres: (p: OfflinePack, s: OfflinePackStatus) => void;
  surErreur: (p: OfflinePack) => void;
  /** Le pack est connu : on relit aussi son état toutes les 1,5 s. */
  lier: (pack: OfflinePack) => void;
  fin: Promise<void>;
};

/**
 * Suit un pack jusqu'au bout : complet ⇒ ok ; erreur ⇒ mis en pause (à reprendre) ; plus de 50 Mo ⇒ supprimé.
 * MapLibre n'envoie pas le premier état d'un pack, ni rien entre deux événements espacés : on relit donc aussi
 * l'état régulièrement (un pack dont tout est déjà en base est complet tout de suite).
 */
function suivi(progression: (pourcentage: number) => void): Suivi {
  const om = gestionnaire();
  let lie: OfflinePack | null = null;
  let minuterie: ReturnType<typeof setInterval> | null = null;
  let fini = false;
  let resoudre!: () => void;
  let rejeter!: (e: Error) => void;
  const fin = new Promise<void>((ok, ko) => {
    resoudre = ok;
    rejeter = ko;
  });
  const finir = (erreur?: Error) => {
    if (fini) return;
    fini = true;
    if (minuterie) clearInterval(minuterie);
    if (lie) om.removeListener(lie.id);
    if (erreur) rejeter(erreur);
    else resoudre();
  };
  const lire = (p: OfflinePack, s: OfflinePackStatus) => {
    if (fini) return;
    if (s.completedResourceSize > TAILLE_MAX_OCTETS) {
      fini = true;
      if (minuterie) clearInterval(minuterie);
      om.removeListener(p.id);
      om.deletePack(p.id).then(
        () => rejeter(new CarteTropLourde()),
        () => rejeter(new CarteTropLourde()),
      );
      return;
    }
    progression(s.percentage);
    if (s.state === "complete") finir();
  };
  // MapLibre réessaie seul après une erreur réseau ; on met le pack en pause pour qu'il ne tourne pas sans fin.
  const surErreur = (p: OfflinePack) => {
    if (fini) return;
    p.pause().then(
      () => finir(new Error("téléchargement interrompu")),
      () => finir(new Error("téléchargement interrompu")),
    );
  };
  const lier = (pack: OfflinePack) => {
    lie = pack;
    if (fini) return;
    minuterie = setInterval(() => {
      pack.status().then(
        (s) => lire(pack, s),
        // Pack supprimé pendant le téléchargement (voyage supprimé) : on s'arrête.
        () => finir(new Error("pack introuvable")),
      );
    }, 1500);
  };
  return { surProgres: lire, surErreur, lier, fin };
}

async function creer(zone: ZoneCarte, meta: MetaPack, progression: (p: number) => void): Promise<void> {
  const s = suivi(progression);
  const pack = await gestionnaire().createPack(
    { mapStyle: CARTE!.url, bounds: zone.bornes, minZoom: zone.zoomMin, maxZoom: zone.zoomMax, metadata: meta },
    s.surProgres,
    s.surErreur,
  );
  s.lier(pack);
  await s.fin;
}

async function reprendre(pack: OfflinePack, progression: (p: number) => void): Promise<void> {
  const s = suivi(progression);
  await gestionnaire().addListener(pack.id, s.surProgres, s.surErreur);
  s.lier(pack);
  await pack.resume();
  await s.fin;
}

const enCours = new Map<string, { promesse: Promise<void>; ecouteurs: Set<(p: number) => void>; dernier: number }>();

/**
 * Télécharge la carte du voyage, zone après zone (D99, §3.2). `remplacer` : le voyage vient d'être enregistré de
 * nouveau, ses anciens packs partent d'abord. Sinon (« Réessayer », « Enregistrer la carte ») : les zones
 * complètes restent, les autres reprennent ou sont créées. Un seul téléchargement par voyage à la fois.
 */
export function enregistrerCarte(
  cle: string,
  voyage: Voyage,
  { remplacer, progression }: { remplacer: boolean; progression?: (pourcentage: number) => void },
): Promise<void> {
  const deja = enCours.get(cle);
  if (deja) {
    if (progression) deja.ecouteurs.add(progression);
    return deja.promesse;
  }
  const ecouteurs = new Set<(p: number) => void>(progression ? [progression] : []);
  const annoncer = (p: number) => {
    const pourcentage = Math.max(0, Math.min(100, Math.floor(p)));
    const courant = enCours.get(cle);
    if (courant) courant.dernier = pourcentage;
    ecouteurs.forEach((f) => f(pourcentage));
  };

  const promesse = (async () => {
    if (remplacer) await supprimerCarte(cle);
    const zones = zonesVoyage(voyage);
    const existants = await packsDuVoyage(cle);
    for (const [i, zone] of zones.entries()) {
      const meta: MetaPack = { voyage: cle, version: 1, zone: i, total: zones.length };
      const avant = (i * 100) / zones.length;
      const dansZone = (p: number) => annoncer(avant + p / zones.length);
      const present = existants.find((e) => e.meta.zone === i && e.meta.total === zones.length);
      if (present) {
        const statut = await present.pack.status();
        if (statut.state === "complete") continue;
        await reprendre(present.pack, dansZone);
      } else {
        await creer(zone, meta, dansZone);
      }
    }
    annoncer(100);
  })();

  enCours.set(cle, { promesse, ecouteurs, dernier: 0 });
  promesse.then(
    () => enCours.delete(cle),
    () => enCours.delete(cle),
  );
  return promesse;
}

/** Vrai si cette session télécharge la carte du voyage. */
export function carteEnCours(cle: string): boolean {
  return enCours.has(cle);
}
