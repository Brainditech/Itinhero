import { describe, expect, it } from "vitest";
import { filtreFlux, filtrerTexte, REMPLACEMENTS } from "./filtre.js";

const H = REMPLACEMENTS.heure;
const P = REMPLACEMENTS.prix;
const N = REMPLACEMENTS.numero;

/** Spec 39 §5 et critère 6. */
describe("filtrerTexte (spec 39 §5)", () => {
  it.each([
    ["Le car part à 14:48.", `Le car part à ${H}.`],
    ["Le car part à 14h48.", `Le car part à ${H}.`],
    ["Rendez-vous à 14 h devant la gare.", `Rendez-vous à ${H} devant la gare.`],
    ["Partez à 9h.", `Partez à ${H}.`],
    ["Le dernier passe vers 22 heures.", `Le dernier passe vers ${H}.`],
    ["de 9 h à 10 h", `de ${H} à ${H}`],
    ["Arrivez avant 8 h 45, c'est plus sûr.", `Arrivez avant ${H}, c'est plus sûr.`],
    ["Le train de 7 h 12 est souvent plein.", `Le train de ${H} est souvent plein.`],
  ])("heure : %s", (entree, attendu) => expect(filtrerTexte(entree)).toBe(attendu));

  it.each([
    ["Le billet coûte 12 €.", `Le billet coûte ${P}.`],
    ["Comptez 12,50 euros.", `Comptez ${P}.`],
    ["Environ €8 le trajet.", `Environ ${P} le trajet.`],
    ["3 EUR le ticket", `${P} le ticket`],
  ])("prix : %s", (entree, attendu) => expect(filtrerTexte(entree)).toBe(attendu));

  it.each([
    ["Appelez le 03 86 12 34 56.", `Appelez le ${N}.`],
    ["Appelez le 0386123456.", `Appelez le ${N}.`],
    ["Appelez le +33 3 86 12 34 56.", `Appelez le ${N}.`],
    ["Appelez le 03.86.12.34.56 avant.", `Appelez le ${N} avant.`],
  ])("numéro : %s", (entree, attendu) => expect(filtrerTexte(entree)).toBe(attendu));

  it("coordonnées retirées", () => {
    expect(filtrerTexte("Le point 47.98, 3.39 est la gare.")).toBe("Le point  est la gare.");
  });

  it.each([
    "Gardez 20 minutes de marge.",
    "Le trajet dure 1 h 30.",
    "Il y a 1 h 30 de trajet.",
    "Comptez 2 h de route.",
    "Partez 1 h plus tôt.",
    "Le car met environ 45 min.",
    "Vous aurez 2 correspondances et 10 min à pied.",
    "En 2026, la ligne 3 dessert Joigny.",
    "Prévoyez plus de 2 h d'attente.",
  ])("durée ou nombre gardés : %s", (texte) => expect(filtrerTexte(texte)).toBe(texte));
});

/** Toutes les découpes d'un texte en morceaux de taille `n`, et en deux morceaux à chaque position. */
function decoupes(texte: string): string[][] {
  const r: string[][] = [];
  for (const n of [1, 2, 3, 5, 7, 13]) {
    const m: string[] = [];
    for (let i = 0; i < texte.length; i += n) m.push(texte.slice(i, i + n));
    r.push(m);
  }
  for (let i = 1; i < texte.length; i++) r.push([texte.slice(0, i), texte.slice(i)]);
  return r;
}

function enFlux(morceaux: string[]): string {
  const f = filtreFlux();
  return morceaux.map((m) => f.pousser(m)).join("") + f.finir();
}

const LONG = [
  "Bonjour ! Pour aller à Flers, votre premier car part à 14:48 de la gare. ",
  "Si vous le ratez, appelez le 03 86 12 34 56 ou touchez « Recalculer depuis ici ». ",
  "Le billet coûte 12,50 euros. Comptez 1 h 30 de trajet et gardez 20 minutes de marge. ",
  "Le taxi vient vers 9 h, réservez-le la veille au +33 3 86 12 34 56. ",
  "Le point de rendez-vous est 47.98, 3.39. Prévoyez plus de 2 h d'attente à Paris. ",
  "Le train de 7 h 12 passe ensuite, avant 8 h 45, pour environ 8 € seulement.",
].join("");

describe("filtreFlux (spec 39 §5, critère 6)", () => {
  it("rend le même texte que le filtre du texte entier, quelle que soit la découpe", () => {
    const attendu = filtrerTexte(LONG);
    for (const morceaux of decoupes(LONG)) expect(enFlux(morceaux)).toBe(attendu);
  });

  it("aucune heure, aucun prix ni numéro n'arrive, même coupé entre deux morceaux", () => {
    for (const morceaux of decoupes(LONG)) {
      const sortie = enFlux(morceaux);
      for (const interdit of ["14:48", "14h48", "86 12 34", "12,50", "47.98", "9 h", "7 h 12", "8 h 45", "8 €"]) {
        expect(sortie).not.toContain(interdit);
      }
      expect(sortie).toContain("1 h 30 de trajet");
      expect(sortie).toContain("20 minutes de marge");
    }
  });

  it("laisse partir le texte au fil de l'eau (pas tout à la fin)", () => {
    const f = filtreFlux();
    let parti = "";
    for (const c of LONG) parti += f.pousser(c);
    expect(parti.length).toBeGreaterThan(LONG.length / 2);
  });
});
