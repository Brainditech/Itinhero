import { describe, expect, it, vi } from "vitest";

import { clientApi, type Candidat, type Comprehension } from "./api";
import { appliquerLieux, champsDepuisComprehension, lieuDeLaPhrase } from "./comprendre";
import { boutDuCandidat, MESSAGES_SUGGESTIONS } from "./suggestions";

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

describe("lieux de la phrase (spec 35, D113, critère 4)", () => {
  const lieu = (nom: string, code_postal: string, transport?: "train"): Candidat => ({
    nom,
    lat: 48.74,
    lon: -0.57,
    type: transport ? "arret" : "lieu",
    commune: "Flers",
    code_postal,
    ...(transport ? { transport } : {}),
  });
  const GARE = lieu("Flers", "61100", "train");
  const SOMME = lieu("Flers", "80360");
  const champs = champsDepuisComprehension({ ...VIDE, lieu_texte: "flers" }, { type: "domicile" }, MAINTENANT);

  it("un seul lieu ⇒ écrit dans le champ", () => {
    const r = lieuDeLaPhrase({ etat: "ok", donnees: [GARE] }, null);
    expect(r).toEqual({ etat: "retenu", bout: boutDuCandidat(GARE) });
    expect(appliquerLieux(champs, { arrivee: r })).toEqual({ champs: { ...champs, arrivee: boutDuCandidat(GARE) }, aChoisir: {}, erreurs: {} });
  });

  it("plusieurs ⇒ la liste (5 au plus) sous le champ, texte gardé", () => {
    const six = [GARE, SOMME, GARE, SOMME, GARE, SOMME];
    const r = lieuDeLaPhrase({ etat: "ok", donnees: six }, null);
    expect(r).toEqual({ etat: "choisir", candidats: six.slice(0, 5) });
    expect(appliquerLieux(champs, { arrivee: r })).toEqual({
      champs,
      aChoisir: { arrivee: six.slice(0, 5) },
      erreurs: { arrivee: MESSAGES_SUGGESTIONS.choisir },
    });
  });

  it("zone dite ⇒ seuls les lieux de la zone ; un seul reste ⇒ écrit", () => {
    expect(lieuDeLaPhrase({ etat: "ok", donnees: [SOMME, GARE] }, "basse normandie")).toEqual({ etat: "retenu", bout: boutDuCandidat(GARE) });
  });

  it("aucun ⇒ message sous le champ ; recherche impossible ⇒ texte seul, sans message", () => {
    const aucun = lieuDeLaPhrase({ etat: "ok", donnees: [] }, null);
    expect(appliquerLieux(champs, { arrivee: aucun }).erreurs).toEqual({ arrivee: MESSAGES_SUGGESTIONS.aucun("flers") });
    const panne = lieuDeLaPhrase({ etat: "injoignable" }, null);
    expect(panne).toEqual({ etat: "inconnu" });
    expect(appliquerLieux(champs, { arrivee: panne })).toEqual({ champs, aChoisir: {}, erreurs: {} });
  });
});
