import { describe, expect, it, vi } from "vitest";

import { clientApi, type Comprehension } from "./api";
import { champsDepuisComprehension } from "./comprendre";

const MAINTENANT = { date: "2026-11-06", heure: "09:41" };
const VIDE: Comprehension = { lieu_texte: null, depart_texte: null, date: null, heure: null, sens: null, marge: null, fin_rdv: null };

describe("champsDepuisComprehension (spec 28, critère 9)", () => {
  it("« jeudi 10h RDV France Travail Joigny jusqu'à 11h30 » ⇒ formulaire complet, départ de l'Accueil", () => {
    const c = { ...VIDE, lieu_texte: "France Travail Joigny", date: "2026-11-12", heure: "10:00", sens: "arriver" as const, fin_rdv: "11:30" };
    expect(champsDepuisComprehension(c, { type: "domicile" }, MAINTENANT)).toEqual({
      depart: { type: "domicile" },
      arrivee: { type: "texte", texte: "France Travail Joigny" },
      date: "2026-11-12",
      heure: "10:00",
      sens: "arriver_avant",
      marge: "10",
      retour: "11:30",
    });
  });
  it("départ dit ⇒ texte ; marge dite ⇒ gardée ; « partir »", () => {
    const c = { ...VIDE, lieu_texte: "Dijon", depart_texte: "gare de Sens", heure: "07:15", sens: "partir" as const, marge: 20 };
    expect(champsDepuisComprehension(c, { type: "position" }, MAINTENANT)).toMatchObject({
      depart: { type: "texte", texte: "gare de Sens" },
      sens: "partir_a",
      marge: "20",
      date: "2026-11-06",
    });
  });
  it("rien de dit ⇒ arrivée vide, aujourd'hui, partir maintenant", () => {
    expect(champsDepuisComprehension(VIDE, { type: "domicile" }, MAINTENANT)).toMatchObject({
      arrivee: { type: "texte", texte: "" },
      date: "2026-11-06",
      heure: "09:41",
      sens: "partir_a",
      retour: null,
    });
  });
  it("heure dite sans sens ⇒ arriver avant ; fin avant l'heure ⇒ pas de retour", () => {
    const c = { ...VIDE, lieu_texte: "Joigny", heure: "14:00", fin_rdv: "13:00" };
    expect(champsDepuisComprehension(c, { type: "domicile" }, MAINTENANT)).toMatchObject({ sens: "arriver_avant", retour: null });
  });
});

describe("clientApi.comprendre (spec 28, critère 10)", () => {
  it("POST de la phrase seule ; 200 ⇒ ok ; 503 ⇒ erreur_serveur (le formulaire s'ouvre)", async () => {
    const c = { ...VIDE, lieu_texte: "Joigny" };
    const ok = vi.fn(async (_u: string, _i: RequestInit) => new Response(JSON.stringify({ comprehension: c }), { status: 200 }));
    expect(await clientApi({ urlApi: "http://x", cle: "k", fetch: ok }).comprendre("jeudi Joigny")).toEqual({ etat: "ok", donnees: c });
    expect(ok.mock.calls[0]![0]).toBe("http://x/v1/comprendre");
    expect(JSON.parse(ok.mock.calls[0]![1].body as string)).toEqual({ phrase: "jeudi Joigny" });
    const ko = vi.fn(async () => new Response(JSON.stringify({ erreur: "plafond_atteint" }), { status: 503 }));
    expect(await clientApi({ urlApi: "http://x", cle: "k", fetch: ko }).comprendre("jeudi Joigny")).toEqual({ etat: "erreur_serveur" });
  });
});
