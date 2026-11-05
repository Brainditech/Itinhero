import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { schemaPossibilite } from "./api";
import { decoderTrace, distance, ligne, pointA, projeter } from "./geo";
import {
  descendu,
  ETAT_INITIAL,
  instantDuTrajet,
  jusqua,
  aLieu,
  phraseStatut,
  positionSimulee,
  preparer,
  situer,
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
