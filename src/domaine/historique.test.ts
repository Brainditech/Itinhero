import { describe, expect, it } from "vitest";

import type { MessageFil } from "./discussion";
import { dateDiscussion, discussionAGarder, filDeDiscussion, lireDiscussion, messagesAGarder, titreDiscussion } from "./historique";

const PROPOSITION = { depart: "domicile", arrivee: "Gare de Joigny", date: "2026-11-12", heure: "10:00", sens: "arriver_avant" as const };
const FIL: MessageFil[] = [
  {
    id: 1,
    role: "personne",
    texte: "Voici ma convocation",
    piece_jointe: { type: "pdf", media_type: "application/pdf", donnees: "QUJD", nom: "convocation.pdf" },
  },
  { id: 2, role: "assistant", texte: "Je cherche votre trajet.", etat: "complete" },
  { id: 3, role: "recherche", proposition: PROPOSITION },
  { id: 4, role: "personne", texte: "Et sans voiture ?" },
  { id: 5, role: "assistant", texte: "", etat: "echec", erreur: "Pas de réseau." },
  { id: 6, role: "assistant", texte: "En cours", etat: "ecrit" },
];

describe("ce qui est gardé (spec 48, critère 1)", () => {
  it("le nom de la pièce, jamais son contenu ; ni réponse en échec ni en cours", () => {
    expect(messagesAGarder(FIL)).toEqual([
      { role: "personne", texte: "Voici ma convocation", piece: { type: "pdf", nom: "convocation.pdf" } },
      { role: "assistant", texte: "Je cherche votre trajet." },
      { role: "recherche", proposition: PROPOSITION },
      { role: "personne", texte: "Et sans voiture ?" },
    ]);
    expect(JSON.stringify(discussionAGarder("a", FIL, new Date("2026-11-06T19:45:00Z")))).not.toContain("QUJD");
  });
  it("titre : premier message de la personne, une ligne, 60 caractères au plus", () => {
    expect(titreDiscussion([{ role: "personne", texte: "Bonjour\nje vais à Joigny" }])).toBe("Bonjour je vais à Joigny");
    const long = titreDiscussion([{ role: "personne", texte: "a".repeat(80) }]);
    expect(long).toHaveLength(60);
    expect(long.endsWith("…")).toBe(true);
  });
  it("rien à garder sans question de la personne", () => {
    expect(discussionAGarder("a", [], new Date())).toBeNull();
  });
});

describe("relecture (spec 48, critère 2)", () => {
  it("aller-retour : la discussion rouverte garde ses messages, la pièce sans contenu", () => {
    const d = discussionAGarder("a", FIL, new Date("2026-11-06T19:45:00Z"))!;
    const relue = lireDiscussion(JSON.stringify(d))!;
    expect(relue).toEqual(d);
    const fil = filDeDiscussion(relue, 10);
    expect(fil.map((m) => m.id)).toEqual([10, 11, 12, 13]);
    expect(fil[0]).toEqual({
      id: 10,
      role: "personne",
      texte: "Voici ma convocation",
      piece_jointe: { type: "pdf", media_type: "application/pdf", donnees: "", nom: "convocation.pdf" },
    });
    expect(fil[1]).toEqual({ id: 11, role: "assistant", texte: "Je cherche votre trajet.", etat: "complete" });
  });
  it("une ligne illisible ⇒ null, jamais une erreur", () => {
    expect(lireDiscussion("pas du json")).toBeNull();
    expect(lireDiscussion(JSON.stringify({ id: "a", titre: "t", mise_a_jour: "hier", messages: [] }))).toBeNull();
  });
});

describe("date de la liste", () => {
  it("heure de Paris, jour et mois abrégés", () => {
    expect(dateDiscussion("2026-11-06T19:45:00Z")).toBe("ven. 6 nov., 20:45");
  });
});
