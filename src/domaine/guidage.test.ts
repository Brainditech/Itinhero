import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { schemaPossibilite } from "./api";
import { destinationMarche } from "./consignes";
import { decoderTrace, distance, ligne, pointA, projeter } from "./geo";
import {
  descendu,
  ETAT_INITIAL,
  instantDuTrajet,
  jusqua,
  aLieu,
  lieuMontee,
  minutesEnTexte,
  nomLieuVehicule,
  phraseMarche,
  phraseTrajetVehicule,
  statutAVenir,
  phraseStatut,
  textesVehicule,
  titreDescente,
  positionFraiche,
  positionSimulee,
  preparer,
  situer,
  vehiculeMinuscule,
  vitesseMarche,
  type EtatGuidage,
  type Situation,
} from "./guidage";

/**
 * Spec 12, §6 : Brienon → tribunal administratif de Dijon, samedi 14/11/2026, réponse du MOTIS national
 * enregistrée pour la spec 11 et normalisée par le serveur (`serveur/src/itineraires/__exemples__/`).
 */
const POSSIBILITE = schemaPossibilite.parse(
  JSON.parse(readFileSync(path.join(__dirname, "__exemples__/possibilite-brienon-dijon.json"), "utf8")),
);
const parcours = preparer(POSSIBILITE);
const heure = (hhmm: string) => instantDuTrajet(POSSIBILITE, hhmm);

/** Fait marcher le long de l'étape k, de `pas` mètres en `pas` mètres, une seconde par mètre. */
function marcher(k: number, depart: number, pas = 5) {
  let etat: EtatGuidage = { ...ETAT_INITIAL, etape: k };
  const g = parcours.etapes[k]!;
  const dites: { metres: number; phrase: string }[] = [];
  let derniere: Situation | null = null;
  for (let m = 0; m <= g.ligne.longueur + pas; m += pas) {
    const s = situer(parcours, etat, positionSimulee(parcours, k, m), depart + m * 1000);
    s.annonces.forEach((phrase) => dites.push({ metres: m, phrase }));
    etat = s.etat;
    derniere = s;
  }
  return { etat, dites, derniere: derniere! };
}

describe("géométrie", () => {
  it("projection sur un tracé : abscisse et écart", () => {
    const l = ligne([
      { lat: 47, lon: 5 },
      { lat: 47.001, lon: 5 },
    ]);
    const p = projeter(l, { lat: 47.0005, lon: 5.0004 });
    expect(p.abscisse).toBeCloseTo(l.longueur / 2, 0);
    expect(p.ecart).toBeCloseTo(30, 0);
    expect(distance(pointA(l, 50), l.points[0]!)).toBeCloseTo(50, 0);
  });
  it("le tracé de la marche gare → tribunal se décode", () => {
    const e = POSSIBILITE.etapes[4]!;
    expect(decoderTrace(e.trace!).length).toBeGreaterThan(20);
  });
});

describe("critère 1 — marche gare de Dijon → tribunal", () => {
  const k = 4;
  const g = parcours.etapes[k]!;
  const { etat, dites } = marcher(k, heure("10:24"));

  it("chaque manœuvre est annoncée à 150 m, à 40 m et au point de manœuvre", () => {
    for (const c of g.consignes.filter((x) => x.consigne.manoeuvre !== "depart" && x.consigne.manoeuvre !== "arrivee")) {
      const autour = dites.filter((d) => d.metres <= c.abscisse && d.metres > c.abscisse - 160);
      // Une manœuvre à moins de 150 m de la précédente n'a pas toujours son annonce à 150 m.
      expect(autour.some((d) => /^Dans 40 m|^Dans 3\d m|^Dans 4\d m/.test(d.phrase) || !d.phrase.startsWith("Dans"))).toBe(true);
    }
    const premiere = g.consignes[1]!;
    const sienne = dites.filter((d) => d.metres <= premiere.abscisse + 5 && d.metres >= premiere.abscisse - 155);
    expect(sienne.map((d) => d.phrase)).toEqual([
      expect.stringMatching(/^Dans 1[45]0 m, prenez légèrement à gauche avenue Maréchal Foch$/),
      expect.stringMatching(/^Dans (40|30) m, prenez légèrement à gauche avenue Maréchal Foch$/),
      "Prenez légèrement à gauche avenue Maréchal Foch",
    ]);
  });
  it("l'arrivée est détectée et dite, aucun écart signalé", () => {
    expect(etat.etape).toBe(5);
    expect(dites.some((d) => d.phrase === "Tribunal administratif de Dijon est sur votre gauche")).toBe(true);
    expect(dites.some((d) => d.phrase.includes("éloignez"))).toBe(false);
  });
  it("trois annonces au plus par manœuvre, jamais deux fois de suite la même", () => {
    expect(dites.length).toBeLessThanOrEqual(3 * g.consignes.length + 1);
    dites.forEach((d, i) => i > 0 && expect(d.phrase).not.toBe(dites[i - 1]!.phrase));
    expect(dites.map((d) => d.phrase)).toContain("Dans 150 m, arrivée à Tribunal administratif de Dijon");
  });
  it("après la dernière étape, le guidage est fini", () => {
    expect(situer(parcours, etat, null, heure("10:45")).vue.type).toBe("fin");
  });
});

describe("critère 2 — écart au chemin (D75)", () => {
  const k = 4;
  const depart = heure("10:30");
  function ecartPendant(metres: number, secondes: number) {
    let etat: EtatGuidage = { ...ETAT_INITIAL, etape: k };
    let s: Situation | null = null;
    for (let t = 0; t <= secondes; t++) {
      s = situer(parcours, etat, positionSimulee(parcours, k, 400, metres), depart + t * 1000);
      etat = s.etat;
    }
    return s!;
  }
  it("à 60 m pendant 20 s ⇒ « Vous vous éloignez du chemin », flèche vers le tracé", () => {
    const s = ecartPendant(60, 20);
    expect(s.ecart?.metres).toBeGreaterThan(40);
    expect(distance(s.ecart!.vers, positionSimulee(parcours, k, 400)!)).toBeLessThan(30);
  });
  it("à 60 m pendant 10 s ⇒ rien encore", () => {
    expect(ecartPendant(60, 10).ecart).toBeNull();
  });
  it("à 30 m ⇒ rien", () => {
    expect(ecartPendant(30, 60).ecart).toBeNull();
  });
});

describe("critère 3 — étape en bus (803)", () => {
  const k = 1;
  const g = parcours.etapes[k]!;
  it("à l'arrêt avant le passage : attente, « à l'arrêt », minutes jusqu'au bus", () => {
    const s = situer(parcours, { ...ETAT_INITIAL, etape: k }, positionSimulee(parcours, k, 0), heure("08:19"));
    expect(s.vue).toMatchObject({ type: "attente", minutes: 6, aLArret: true });
  });
  it("dans le bus : arrêts restants, puis « Descendez au prochain arrêt » à l'avant-dernier arrêt, avec vibration", () => {
    let etat: EtatGuidage = { ...ETAT_INITIAL, etape: k };
    const vues: string[] = [];
    let vibre = 0;
    const dites: string[] = [];
    for (let m = 0; m <= g.ligne.longueur; m += 50) {
      const t = g.departMs + (m / g.ligne.longueur) * (g.arriveeMs - g.departMs);
      const s = situer(parcours, etat, positionSimulee(parcours, k, m), t);
      etat = s.etat;
      vues.push(s.vue.type === "vehicule" ? `vehicule:${s.vue.restants.length}` : s.vue.type);
      if (s.vibrer) vibre++;
      dites.push(...s.annonces);
    }
    expect(vues).toContain("vehicule:3");
    expect(vues).toContain("vehicule:2");
    const iDescente = vues.indexOf("descente");
    const avantDernier = g.arrets[g.arrets.length - 2]!;
    // Annoncée quand le car est à l'avant-dernier arrêt (30 m près), jamais avant.
    expect(iDescente * 50).toBeGreaterThan(avantDernier.abscisse - 50);
    expect(vues.slice(0, iDescente)).not.toContain("descente");
    expect(vibre).toBe(1);
    expect(dites).toContain("Descendez au prochain arrêt : Saint-Florentin-Vergigny, 3 rue de la Gare");
    expect(etat.etape).toBe(2); // descente détectée près de l'arrêt
  });
  it("« Je suis descendu » passe à la marche suivante", () => {
    expect(descendu({ ...ETAT_INITIAL, etape: 1, aBord: true })).toMatchObject({ etape: 2, aBord: false });
  });
  it("sans position, les arrêts passés se lisent à l'heure prévue", () => {
    const s = situer(parcours, { ...ETAT_INITIAL, etape: k, aBord: true }, null, heure("08:40"));
    expect(s.vue.type === "vehicule" || s.vue.type === "descente").toBe(true);
  });
});

describe("statut horaire", () => {
  it("en avance, pressez le pas", () => {
    // Marche de 14 min (943 m) à Saint-Florentin avant le TER de 09:10.
    const a = situer(parcours, { ...ETAT_INITIAL, etape: 2 }, positionSimulee(parcours, 2, 10), heure("08:50"));
    expect(a.vue.type === "marche" && phraseStatut(a.vue.statut)).toBe("En avance de 6 min");
    const b = situer(parcours, { ...ETAT_INITIAL, etape: 2 }, positionSimulee(parcours, 2, 10), heure("09:08"));
    expect(b.vue.type === "marche" && phraseStatut(b.vue.statut)).toBe("Pressez le pas : TER K7 dans 2 min");
  });
});

describe("phrases du bas", () => {
  it("jusqu'à", () => {
    expect(jusqua("arrêt Mairie")).toBe("Jusqu'à l'arrêt Mairie");
    expect(jusqua("gare de Dijon")).toBe("Jusqu'à la gare de Dijon");
    expect(jusqua("Tribunal administratif de Dijon")).toBe("Jusqu'à Tribunal administratif de Dijon");
    expect(aLieu("arrêt Brienon-sur-Armançon Mairie")).toBe("à l'arrêt Brienon-sur-Armançon Mairie");
  });
});

describe("heures du trajet", () => {
  it("une heure juste avant le départ reste le même jour ; après minuit, le lendemain", () => {
    const depart = Date.parse(POSSIBILITE.depart_utc);
    expect(instantDuTrajet(POSSIBILITE, POSSIBILITE.depart)).toBe(depart);
    const avant = instantDuTrajet(POSSIBILITE, "08:13");
    expect(POSSIBILITE.depart).toBe("08:14");
    expect((depart - avant) / 60_000).toBe(1);
    expect(instantDuTrajet(POSSIBILITE, "00:10") - depart).toBeGreaterThan(0);
  });
});

// ——— Régressions de la relecture de la PR #20 ———

describe("PR #20, défaut 3 — train direct, sans arrêt intermédiaire", () => {
  // Le TER K7 Saint-Florentin → Dijon sans ses 4 arrêts intermédiaires : un direct, courant dans l'Yonne.
  const direct = preparer({ ...possibiliteSansArrets() });
  const k = 3;
  const g = direct.etapes[k]!;
  it("pas de « Descendez au prochain arrêt » à la montée, ni de vibration", () => {
    const etat: EtatGuidage = { ...ETAT_INITIAL, etape: k, aBord: true };
    const s = situer(direct, etat, positionSimulee(direct, k, 200), g.departMs + 60_000);
    expect(s.vue.type).toBe("vehicule");
    expect(s.vibrer).toBe(false);
    expect(s.annonces).toEqual([]);
  });
  it("annoncée une fois, à l'approche de l'arrivée (1 km), avec vibration", () => {
    let etat: EtatGuidage = { ...ETAT_INITIAL, etape: k };
    const vues: { m: number; vue: string }[] = [];
    let vibre = 0;
    for (let m = 0; m <= g.ligne.longueur; m += 250) {
      const t = g.departMs + (m / g.ligne.longueur) * (g.arriveeMs - g.departMs);
      const s = situer(direct, etat, positionSimulee(direct, k, m), t);
      etat = s.etat;
      vues.push({ m, vue: s.vue.type });
      if (s.vibrer) vibre++;
    }
    const premiere = vues.find((v) => v.vue === "descente")!;
    expect(g.ligne.longueur - premiere.m).toBeLessThanOrEqual(1000);
    expect(g.ligne.longueur - premiere.m).toBeGreaterThan(50);
    expect(vibre).toBe(1);
  });
  it("sans position : annoncée 2 min avant l'arrivée prévue, pas avant", () => {
    const etat: EtatGuidage = { ...ETAT_INITIAL, etape: k, aBord: true };
    expect(situer(direct, etat, null, g.arriveeMs - 10 * 60_000).vue.type).toBe("vehicule");
    expect(situer(direct, etat, null, g.arriveeMs - 90_000).vue.type).toBe("descente");
  });
});

function possibiliteSansArrets() {
  return { ...POSSIBILITE, etapes: POSSIBILITE.etapes.map((e, i) => (i === 3 ? { ...e, arrets: [] } : e)) };
}

describe("PR #20, défaut 4 — pas d'arrivée loin du chemin", () => {
  // Marche gare → tribunal en ligne droite (étape sans tracé) : une position de côté se projette au bout du tracé.
  const droit = preparer({ ...POSSIBILITE, etapes: POSSIBILITE.etapes.map((e, i) => (i === 4 ? { ...e, trace: null } : e)) });
  const k = 4;
  const g = droit.etapes[k]!;
  it("au niveau de la fin du tracé mais à 200 m de côté : ni arrivée, ni étape suivante ; l'écart est signalé", () => {
    let etat: EtatGuidage = { ...ETAT_INITIAL, etape: k, abscisse: g.ligne.longueur - 20 };
    let s: Situation | null = null;
    const dites: string[] = [];
    for (let t = 0; t <= 20; t++) {
      s = situer(droit, etat, positionSimulee(droit, k, g.ligne.longueur, 200), heure("10:44") + t * 1000);
      etat = s.etat;
      dites.push(...s.annonces);
    }
    expect(s!.etat.etape).toBe(k);
    expect(dites.some((d) => /est sur votre|est devant vous/.test(d))).toBe(false);
    expect(s!.vue.type).toBe("marche");
    expect(s!.ecart?.metres).toBeGreaterThan(150);
    expect(dites).toContain("Vous vous éloignez du chemin");
  });
  it("au bout du tracé, sur le chemin : arrivée", () => {
    const s = situer(droit, { ...ETAT_INITIAL, etape: k, abscisse: g.ligne.longueur - 20 }, positionSimulee(droit, k, g.ligne.longueur), heure("10:44"));
    expect(s.etat.etape).toBe(k + 1);
  });
});

describe("PR #20, défaut 5 — bus raté", () => {
  const k = 1;
  const g = parcours.etapes[k]!;
  it("encore à l'arrêt 5 min après le départ prévu : toujours en attente, véhicule peut-être passé", () => {
    const s = situer(parcours, { ...ETAT_INITIAL, etape: k }, positionSimulee(parcours, k, 0), g.departMs + 5 * 60_000);
    expect(s.etat.aBord).toBe(false);
    expect(s.vue).toMatchObject({ type: "attente", aLArret: true, rate: true });
  });
  it("avant le départ prévu, pas « raté »", () => {
    const s = situer(parcours, { ...ETAT_INITIAL, etape: k }, positionSimulee(parcours, k, 0), g.departMs - 60_000);
    expect(s.vue).toMatchObject({ type: "attente", rate: false });
  });
  it("sans position, l'heure fait toujours passer à bord", () => {
    expect(situer(parcours, { ...ETAT_INITIAL, etape: k }, null, g.departMs + 5 * 60_000).etat.aBord).toBe(true);
  });
  it("parti avec le bus (80 m sur la ligne) : à bord", () => {
    expect(situer(parcours, { ...ETAT_INITIAL, etape: k }, positionSimulee(parcours, k, 300), g.departMs + 60_000).etat.aBord).toBe(true);
  });
});

describe("PR #20, défaut 6 — sans GPS, la marche peut être passée à la main", () => {
  it("sans position, la vue de marche le dit, et « étape suivante » passe à l'étape d'après", () => {
    const s = situer(parcours, ETAT_INITIAL, null, heure("08:14"));
    expect(s.vue).toMatchObject({ type: "marche", sansPosition: true });
    const suite = situer(parcours, descendu(s.etat), null, heure("08:16"));
    expect(suite.etat.etape).toBe(1);
    expect(suite.vue.type).toBe("attente");
  });
  it("avec position, sansPosition est faux", () => {
    expect(situer(parcours, { ...ETAT_INITIAL, etape: 2 }, positionSimulee(parcours, 2, 10), heure("08:50")).vue).toMatchObject({ sansPosition: false });
  });
});

describe("PR #20, mineurs — taxi et vitesse", () => {
  it("un taxi s'écrit « taxi », sans sa durée", () => {
    const taxi = { ...POSSIBILITE.etapes[1]!, mode: "taxi" as const, duree_minutes: 12, ligne: null };
    expect(vehiculeMinuscule(taxi)).toBe("taxi");
  });
  it("vitesse de marche : d'après l'étape, sinon 1,2 m/s", () => {
    const e = POSSIBILITE.etapes[2]!;
    expect(vitesseMarche(e)).toBeCloseTo(e.distance_metres! / (e.duree_minutes * 60));
    expect(vitesseMarche({ ...e, distance_metres: null })).toBe(1.2);
  });
});

describe("relecture, A et B — signal perdu sous terre", () => {
  const k = 1;
  const g = parcours.etapes[k]!;
  const releve = { point: positionSimulee(parcours, k, 0)!, recuA: g.departMs - 60_000 };
  it("un relevé de plus de 10 s ne compte plus comme position", () => {
    expect(positionFraiche(releve, releve.recuA + 5_000)).toEqual(releve.point);
    expect(positionFraiche(releve, releve.recuA + 11_000)).toBeNull();
    expect(positionFraiche(null, 0)).toBeNull();
  });
  it("dernier relevé pris à l'arrêt du métro, puis plus rien : l'heure fait passer à bord, pas « raté »", () => {
    const t = g.departMs + 5 * 60_000;
    const s = situer(parcours, { ...ETAT_INITIAL, etape: k }, positionFraiche(releve, t), t);
    expect(s.etat.aBord).toBe(true);
  });
  it("relevé figé pendant une marche : sansPosition, donc « Étape suivante » possible", () => {
    const r = { point: positionSimulee(parcours, 2, 10)!, recuA: heure("08:50") };
    const t = heure("08:50") + 30_000;
    expect(situer(parcours, { ...ETAT_INITIAL, etape: 2 }, positionFraiche(r, t), t).vue).toMatchObject({ sansPosition: true });
  });
});

describe("relecture, tour 2 — signal perdu en pleine marche", () => {
  it("à 800 m, sans position : la marche reste à 800 m, pas au début", () => {
    const k = 4;
    const avec = situer(parcours, { ...ETAT_INITIAL, etape: k, abscisse: 790 }, positionSimulee(parcours, k, 800), heure("10:35"));
    const sans = situer(parcours, avec.etat, null, heure("10:35") + 12_000);
    expect(sans.abscisse).toBeCloseTo(avec.abscisse!, 0);
    expect(sans.vue.type === "marche" && sans.vue.restanteMetres).toBeCloseTo(avec.vue.type === "marche" ? avec.vue.restanteMetres : -1, 0);
    expect(sans.vue.type === "marche" && sans.vue.prochaine.index).toBe(avec.vue.type === "marche" && avec.vue.prochaine.index);
  });
});

// ——— Essai sur le téléphone du 2026-11-05 (issue 0017) ———

describe("issue 0017 — taxi guidé comme un taxi, pas comme un bus", () => {
  // Le bus Brienon → Saint-Florentin remplacé par un taxi : même tracé, aucun arrêt.
  const taxi = preparer({ ...POSSIBILITE, etapes: POSSIBILITE.etapes.map((e, i) => (i === 1 ? { ...e, mode: "taxi" as const, arrets: [] } : e)) });
  const k = 1;
  const g = taxi.etapes[k]!;
  it("en route : « En taxi », jusqu'au lieu de dépose, heure d'arrivée ; ni « arrêt » ni « descente »", () => {
    const s = situer(taxi, { ...ETAT_INITIAL, etape: k }, positionSimulee(taxi, k, 500), g.departMs + 60_000);
    expect(s.vue.type).toBe("vehicule");
    const t = textesVehicule(g.etape, s.vue.type === "vehicule" ? s.vue.restants : []);
    expect(t.titre).toBe("En taxi");
    expect(`${t.titre} ${t.sousTitre} ${t.bande}`).not.toMatch(/Prochain arrêt|Sans arrêt|[Dd]escente/);
    // Le lieu d'un taxi est dit tel quel : jamais « l'arrêt … ».
    expect(t.sousTitre).toBe(jusqua(g.etape.a.nom));
    expect(g.etape.de.type).toBe("arret");
    expect(nomLieuVehicule(g.etape, g.etape.de)).toBe(g.etape.de.nom);
    // Une gare de dépose garde son nom de gare.
    const gare = { ...g.etape.a, nom: "Laroche - Migennes", type: "gare" as const };
    expect(nomLieuVehicule(g.etape, gare)).toBe("gare de Laroche - Migennes");
    expect(t.bande).toBe(`Arrivée prévue à ${g.etape.arrivee}`);
  });
  it("à l'approche : « Vous arrivez », dit une seule fois", () => {
    const etat: EtatGuidage = { ...ETAT_INITIAL, etape: k, aBord: true, abscisse: g.ligne.longueur - 600 };
    const s = situer(taxi, etat, positionSimulee(taxi, k, g.ligne.longueur - 500), g.arriveeMs - 60_000);
    expect(s.vue.type).toBe("descente");
    expect(titreDescente(g.etape)).toBe("Vous arrivez");
    expect(s.annonces).toEqual([`Vous arrivez : ${g.etape.a.nom}`]);
    expect(situer(taxi, s.etat, positionSimulee(taxi, k, g.ligne.longueur - 400), g.arriveeMs - 50_000).annonces).toEqual([]);
  });
  it("la marche qui mène au taxi ne dit pas « arrêt »", () => {
    // La marche 0 de l'exemple fait 1 m : sans position, elle reste affichée.
    const s = situer(taxi, ETAT_INITIAL, null, heure("08:14"));
    expect(s.vue.type === "marche" && s.vue.destination).toBe(g.etape.de.nom);
    expect(phraseMarche(taxi.etapes[0]!.etape, g.etape)).toContain(`jusqu'à ${g.etape.de.nom},`);
    expect(phraseMarche(taxi.etapes[0]!.etape)).toContain(`jusqu'à l'arrêt ${g.etape.de.nom}`);
    // « Voir le chemin » : la consigne d'arrivée dit le même lieu.
    expect(destinationMarche(taxi.etapes[0]!.etape, g.etape)).toBe(g.etape.de.nom);
    expect(destinationMarche(taxi.etapes[0]!.etape)).toBe(`arrêt ${g.etape.de.nom}`);
  });
  it("« Ensuite » à la descente d'un bus suivi d'une marche vers un taxi : pas « arrêt »", () => {
    // TER K7 (3), puis la marche (4) qui mène à un taxi (5) : le serveur type sa fin en « arrêt ».
    const priseEnCharge = { ...POSSIBILITE.etapes[4]!.a, nom: "Place Darcy", type: "arret" as const };
    const etapes = POSSIBILITE.etapes.map((e, i) => (i === 4 ? { ...e, a: priseEnCharge } : e));
    const p = preparer({ ...POSSIBILITE, etapes: [...etapes, { ...POSSIBILITE.etapes[1]!, mode: "taxi" as const, arrets: [], de: priseEnCharge }] });
    const k = 3;
    const gk = p.etapes[k]!;
    const s = situer(p, { ...ETAT_INITIAL, etape: k, aBord: true }, null, gk.arriveeMs - 60_000);
    expect(s.vue.type === "descente" && s.vue.ensuite).toMatch(/jusqu'à Place Darcy$/);
  });
  it("détail : « De l'arrêt … à l'arrêt … » avec ses articles ; un taxi dit ses lieux tels quels", () => {
    const bus = POSSIBILITE.etapes[1]!;
    expect(phraseTrajetVehicule(bus, "10 min")).toBe(`De l'arrêt ${bus.de.nom} à l'arrêt ${bus.a.nom}, arrivée ${bus.arrivee} (10 min)`);
    expect(phraseTrajetVehicule(g.etape, "12 min")).toBe(`De ${g.etape.de.nom} à ${g.etape.a.nom}, arrivée ${g.etape.arrivee} (12 min)`);
    const train = POSSIBILITE.etapes[3]!;
    expect(phraseTrajetVehicule(train, "1 h")).toMatch(/^De la gare .+ à la gare /);
  });
  it("en attente : « Vous êtes au point de rendez-vous », pas « à l'arrêt »", () => {
    expect(lieuMontee(g.etape).ici).toBe("Vous êtes au point de rendez-vous");
    expect(lieuMontee(g.etape).loin("300 m")).toBe("Le point de rendez-vous est à 300 m");
  });
});

describe("issue 0017 — train direct : pas de « Prochain arrêt » égal à la descente", () => {
  it("la bande donne l'heure d'arrivée", () => {
    const e = POSSIBILITE.etapes[3]!;
    const seul = { nom: e.a.nom, passage: e.arrivee, point: { lat: e.a.lat, lon: e.a.lon }, abscisse: 1, descente: true };
    expect(textesVehicule(e, [seul]).bande).toBe(`Arrivée prévue à ${e.arrivee}`);
    expect(textesVehicule(e, [{ ...seul, nom: "Tonnerre", descente: false }, seul]).bande).toBe("Prochain arrêt : Tonnerre");
  });
});

describe("issue 0017 — gare, arrêt, article", () => {
  it("montée en gare : « Vous êtes à la gare » ; au bus : « à l'arrêt »", () => {
    expect(lieuMontee(POSSIBILITE.etapes[3]!).ici).toBe("Vous êtes à la gare");
    expect(lieuMontee(POSSIBILITE.etapes[1]!).ici).toBe("Vous êtes à l'arrêt");
  });
  it("le type du lieu décide, pas son nom : « Paris Gare de Lyon » est une gare", () => {
    const e = POSSIBILITE.etapes[3]!;
    expect(lieuMontee({ ...e, de: { ...e.de, nom: "Paris Gare de Lyon", type: "gare" } }).ici).toBe("Vous êtes à la gare");
    expect(lieuMontee({ ...e, de: { ...e.de, nom: "Châtelet", type: "station" } }).ici).toBe("Vous êtes à la station");
  });
  it("transport à la demande sans arrêts : guidé comme un taxi ; avec arrêts, comme un bus", () => {
    const bus = POSSIBILITE.etapes[1]!;
    const tad = { ...bus, mode: "transport_a_la_demande" as const, arrets: [] };
    expect(lieuMontee(tad).ici).toBe("Vous êtes au point de rendez-vous");
    expect(titreDescente(tad)).toBe("Vous arrivez");
    expect(textesVehicule(tad, []).sousTitre).toBe(jusqua(bus.a.nom));
    const tadLigne = { ...tad, arrets: bus.arrets };
    expect(bus.arrets?.length).toBeGreaterThan(0);
    expect(titreDescente(tadLigne)).toBe("Descendez au prochain arrêt");
  });
  it("« Gare de Joigny », nom d'un lieu choisi, prend son article", () => {
    expect(aLieu("Gare de Joigny")).toBe("à la gare de Joigny");
    expect(jusqua("Arrêt Mairie")).toBe("Jusqu'à l'arrêt Mairie");
  });
  it("correspondance de 0 m dans la gare : pas de « 0 m »", () => {
    const e = { ...POSSIBILITE.etapes[2]!, distance_metres: 0, duree_minutes: 2 };
    expect(phraseMarche(e)).not.toContain("0 m");
    expect(phraseMarche(e)).toMatch(/^2 min jusqu'à la gare/);
    expect(phraseMarche(POSSIBILITE.etapes[2]!)).toMatch(/^\d+ min, [\d,]+ k?m jusqu'à la gare/);
  });
});

describe("issue 0017 — trajet d'un autre jour", () => {
  it("plus de 12 h avant le départ : la date et l'heure, pas « En avance de 10189 min »", () => {
    const t = Date.parse(POSSIBILITE.depart_utc) - 7 * 86_400_000;
    const s = situer(parcours, ETAT_INITIAL, null, t);
    expect(s.vue.type === "marche" && phraseStatut(s.vue.statut)).toBe(`Départ prévu le 14/11 à ${POSSIBILITE.depart}`);
  });
  it("le jour même, plus de 12 h avant : l'heure seule", () => {
    const p = preparer({ ...POSSIBILITE, depart: "23:00", depart_utc: "2026-11-14T22:00:00.000Z" });
    const s = situer(p, ETAT_INITIAL, null, Date.parse("2026-11-14T07:00:00.000Z"));
    expect(s.vue.type === "marche" && phraseStatut(s.vue.statut)).toBe("Départ prévu à 23:00");
  });
  it("demain matin ouvert la veille au soir (10 h avant) : à venir, avec la date", () => {
    const t = Date.parse(POSSIBILITE.depart_utc) - 10 * 3_600_000;
    expect(statutAVenir(POSSIBILITE, t)).toEqual({ type: "a_venir", date: "14/11", heure: POSSIBILITE.depart });
    // Une heure avant, même la veille d'un départ après minuit : l'avance ordinaire.
    expect(statutAVenir(POSSIBILITE, Date.parse(POSSIBILITE.depart_utc) - 60 * 60_000)).toBeNull();
  });
  it("trajet à venir qui commence par un véhicule : la situation le dit aussi", () => {
    const t = Date.parse(POSSIBILITE.depart_utc) - 7 * 86_400_000;
    const s = situer(parcours, { ...ETAT_INITIAL, etape: 1 }, null, t);
    expect(s.vue.type).toBe("attente");
    expect(s.aVenir && phraseStatut(s.aVenir)).toBe(`Départ prévu le 14/11 à ${POSSIBILITE.etapes[1]!.depart}`);
    expect(situer(parcours, { ...ETAT_INITIAL, etape: 1 }, null, heure("08:20")).aVenir).toBeNull();
  });
  it("en attente d'un véhicule à venir : l'heure du véhicule, pas celle du départ de chez soi", () => {
    const t = Date.parse(POSSIBILITE.depart_utc) - 7 * 86_400_000;
    const s = situer(parcours, { ...ETAT_INITIAL, etape: 1 }, null, t);
    expect(s.aVenir?.heure).toBe(POSSIBILITE.etapes[1]!.depart);
    expect(POSSIBILITE.etapes[1]!.depart).not.toBe(POSSIBILITE.depart);
  });
  it("durées longues lisibles", () => {
    expect(minutesEnTexte(45)).toBe("45 min");
    expect(minutesEnTexte(125)).toBe("2 h 05");
    expect(minutesEnTexte(10189)).toBe("7 j 01 h");
    expect(phraseStatut({ type: "avance", minutes: 75 })).toBe("En avance de 1 h 15");
  });
});
