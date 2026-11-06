import { describe, expect, it } from "vitest";

import type { Etape, Possibilite } from "./api";
import { REPONSE_CHATELET } from "./reponse-chatelet";
import { bandeauLointain, horairesDu, ligneHoraires, montrerHorairesAVenir, phraseHorairesAVenir, phraseVerdict } from "./resultat";

const BASE = REPONSE_CHATELET.possibilites[0]!;
const avec = (dates: (string | null)[]): Possibilite => ({
  ...BASE,
  etapes: dates.map(
    (d): Etape => ({
      ...BASE.etapes[0]!,
      source: { type: "gtfs", jeu: "r1", version: "v", trip_id: "t", date_service: "2026-11-13", fin_validite: null, date_horaires: d },
    }),
  ),
});

describe("« Horaires du JJ/MM » (spec 32, critère 2)", () => {
  it("la date la plus ancienne parmi les jeux ; aucune ⇒ null", () => {
    expect(horairesDu([avec(["2026-10-30", "2026-09-21"]), avec(["2026-10-18"])])).toBe("21/09/2026");
    expect(horairesDu([avec([null])])).toBeNull();
  });
  it("ligne : début et fin, ou ce qui est connu", () => {
    expect(ligneHoraires("21/09/2026", "31/08/2027")).toBe("Horaires publiés le 21/09/2026, valables jusqu'au 31/08/2027");
    expect(ligneHoraires("21/09/2026", null)).toBe("Horaires publiés le 21/09/2026");
    expect(ligneHoraires(null, "31/08/2027")).toBe("Horaires valables jusqu'au 31/08/2027");
    expect(ligneHoraires(null, null)).toBeNull();
  });
});

describe("bandeau au-delà de 7 jours (spec 32, critère 3)", () => {
  it("à 7 jours : rien ; à 8 jours : le bandeau, avec la date des horaires", () => {
    expect(bandeauLointain("2026-11-13", "2026-11-06", "21/09/2026")).toBeNull();
    expect(bandeauLointain("2026-11-14", "2026-11-06", "21/09/2026")).toBe(
      "Trajet dans plus de 7 jours. Horaires publiés le 21/09/2026 : ils peuvent changer d'ici là. Revérifiez la veille.",
    );
    expect(bandeauLointain("2026-12-24", "2026-11-06", null)).toMatch(/^Trajet dans plus de 7 jours\. Horaires connus aujourd'hui/);
  });
});

describe("Horaires pas encore publiés (issue 0025)", () => {
  it("phrase : nombre, réseaux nommés, premier jour sans horaires", () => {
    expect(phraseHorairesAVenir({ nombre: 140, reseaux: ["Île-de-France Mobilités", "SNCF"], des_le: "2026-12-03" })).toBe(
      "Les horaires de 140 réseaux, dont Île-de-France Mobilités et SNCF, ne sont pas encore publiés à partir du 03/12/2026 : " +
        "les trajets qui les empruntent n'apparaissent pas. Revérifiez plus près de la date.",
    );
    expect(phraseHorairesAVenir({ nombre: 1, reseaux: ["SNCF"], des_le: "2026-12-13" })).toContain("Les horaires d'un réseau (SNCF) ne sont");
    expect(phraseHorairesAVenir({ nombre: 2, reseaux: [], des_le: "2026-12-13" })).toContain("Les horaires de 2 réseaux ne sont");
  });

  it("montré si un sens est impossible ou au-delà de 7 jours, pas sinon", () => {
    expect(montrerHorairesAVenir(true, "2026-11-08", "2026-11-06")).toBe(true);
    expect(montrerHorairesAVenir(false, "2026-11-13", "2026-11-06")).toBe(false);
    expect(montrerHorairesAVenir(false, "2026-11-14", "2026-11-06")).toBe(true);
  });

  it("« Impossible » ne dit plus « aucun trajet ce jour-là » quand des horaires manquent", () => {
    const r = {
      verdict: "impossible" as const,
      demande: { date: "2026-12-28", heure: "15:00", sens: "arriver" as const, marge: 10, limite: "14:50" },
      arrivee: { nom: null, adresse: null },
      possibilites: [],
    };
    expect(phraseVerdict(r).detail).toBe("Aucun trajet ce jour-là pour arriver avant 14:50.");
    expect(phraseVerdict(r, "aller", true).detail).toBe(
      "Aucun trajet trouvé ce jour-là pour arriver avant 14:50 : certains horaires de ce jour ne sont pas encore publiés.",
    );
    expect(phraseVerdict({ ...r, demande: { ...r.demande, sens: "partir", heure: "17:00" } }, "retour", true).detail).toBe(
      "Aucun retour trouvé ce jour-là après 17:00 : certains horaires de ce jour ne sont pas encore publiés.",
    );
  });
});
