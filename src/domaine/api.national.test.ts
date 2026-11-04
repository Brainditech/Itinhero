import { describe, expect, it } from "vitest";

import { clientApi, type ClientApi } from "./api";
import { versRequeteItineraires } from "./demande";
import { libelleEtape, phraseVerdict, resumePossibilite } from "./resultat";

/**
 * Le client de l'app contre une vraie API reliée au MOTIS national du PC (spec 10, §10), jamais en CI.
 * Mêmes appels, mêmes schémas et mêmes textes que l'app sur le téléphone.
 * Lancer une API avec une clé jetable, puis : ITINHERO_API_URL=… ITINHERO_CLE_ESSAI=… npm run test:national
 */
const URL_API = process.env.ITINHERO_API_URL;
const CLE = process.env.ITINHERO_CLE_ESSAI;

function client(): ClientApi {
  if (!URL_API || !CLE) throw new Error("ITINHERO_API_URL et ITINHERO_CLE_ESSAI sont requises (le test échoue au lieu d'être sauté).");
  return clientApi({ urlApi: URL_API, cle: CLE, fetch: globalThis.fetch });
}

const BRIENON_MAIRIE = { lat: 47.9918, lon: 3.617 };
const PLACE_DU_CHATELET = { lat: 48.85835, lon: 2.34849 };

async function lieu(q: string, proche: { lat: number; lon: number }) {
  const r = await client().lieux(q, proche);
  if (r.etat !== "ok") throw new Error(`lieux « ${q} » : ${r.etat}`);
  return r.donnees;
}

describe("app ⇄ API nationale", () => {
  it("France Travail Joigny depuis Brienon, arriver avant 10:00 le jeudi 12/11 : possible", async () => {
    const candidats = await lieu("France Travail Joigny", BRIENON_MAIRIE);
    expect(candidats[0]!.commune).toBe("Joigny");

    const demande = { lieu_texte: "France Travail Joigny", date: "2026-11-12", heure: "10:00", sens: "arriver_avant" as const, marge: 10 };
    const r = await client().itineraires(versRequeteItineraires(demande, BRIENON_MAIRIE, candidats[0]!));
    expect(r.etat).toBe("ok");
    if (r.etat !== "ok") return;
    const v = phraseVerdict(r.donnees);
    expect(v.possible).toBe(true);
    // Toutes les possibilités arrivent avant la limite (09:50) et le même jour.
    for (const p of r.donnees.possibilites) expect(p.arrivee <= "09:50").toBe(true);
    console.log(`Joigny : ${v.titre}, départ ${v.heureDepart}. ${v.detail}\n  ${r.donnees.possibilites.map(resumePossibilite).join("\n  ")}`);
  });

  it("le même trajet le dimanche 15/11 : impossible, sans aucune heure", async () => {
    const [arrivee] = await lieu("France Travail Joigny", BRIENON_MAIRIE);
    const demande = { lieu_texte: "x", date: "2026-11-15", heure: "10:00", sens: "arriver_avant" as const, marge: 10 };
    const r = await client().itineraires(versRequeteItineraires(demande, BRIENON_MAIRIE, arrivee!));
    expect(r.etat).toBe("ok");
    if (r.etat !== "ok") return;
    expect(phraseVerdict(r.donnees)).toMatchObject({ possible: false, heureDepart: null });
  });

  it("Châtelet → Orly, partir à 07:00 le vendredi 13/11 : métro 14 direct (issue 0008)", async () => {
    const candidats = await lieu("Pont de Rungis", PLACE_DU_CHATELET);
    const rungis = candidats.find((c) => /rungis/i.test(c.nom));
    expect(rungis, candidats.map((c) => c.nom).join(", ")).toBeDefined();
    const demande = { lieu_texte: "x", date: "2026-11-13", heure: "07:00", sens: "partir_a" as const, marge: 0 };
    const r = await client().itineraires(versRequeteItineraires(demande, PLACE_DU_CHATELET, rungis!));
    expect(r.etat).toBe("ok");
    if (r.etat !== "ok") return;
    const resumes = r.donnees.possibilites.map(resumePossibilite);
    const direct = r.donnees.possibilites.find(
      (p) => p.correspondances === 0 && p.duree_minutes <= 35 && p.etapes.some((e) => libelleEtape(e) === "Métro 14"),
    );
    expect(direct, resumes.join("\n")).toBeDefined();
    console.log(`Châtelet : ${phraseVerdict(r.donnees).detail}\n  ${resumes.join("\n  ")}`);
  });

  it("une clé inconnue ⇒ cle_refusee", async () => {
    const faux = clientApi({ urlApi: URL_API!, cle: "x".repeat(43), fetch: globalThis.fetch });
    expect(await faux.lieux("Paris")).toEqual({ etat: "cle_refusee" });
  });

  it("une API arrêtée ⇒ injoignable", async () => {
    const eteinte = clientApi({ urlApi: "http://127.0.0.1:9", cle: CLE!, fetch: globalThis.fetch, delaiMs: 3000 });
    expect(await eteinte.lieux("Paris")).toEqual({ etat: "injoignable" });
  });
});
