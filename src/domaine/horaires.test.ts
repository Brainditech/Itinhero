import { describe, expect, it } from "vitest";

import type { Etape, Possibilite } from "./api";
import { REPONSE_CHATELET } from "./reponse-chatelet";
import { bandeauLointain, horairesDu, ligneHoraires } from "./resultat";

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
    expect(ligneHoraires("21/09/2026", "31/08/2027")).toBe("Horaires du 21/09/2026, valables jusqu'au 31/08/2027");
    expect(ligneHoraires("21/09/2026", null)).toBe("Horaires du 21/09/2026");
    expect(ligneHoraires(null, "31/08/2027")).toBe("Horaires valables jusqu'au 31/08/2027");
    expect(ligneHoraires(null, null)).toBeNull();
  });
});

describe("bandeau au-delà de 7 jours (spec 32, critère 3)", () => {
  it("à 7 jours : rien ; à 8 jours : le bandeau, avec la date des horaires", () => {
    expect(bandeauLointain("2026-11-13", "2026-11-06", "21/09/2026")).toBeNull();
    expect(bandeauLointain("2026-11-14", "2026-11-06", "21/09/2026")).toBe(
      "Trajet dans plus de 7 jours. Horaires du 21/09/2026 : ils peuvent changer d'ici là. Revérifiez la veille.",
    );
    expect(bandeauLointain("2026-12-24", "2026-11-06", null)).toMatch(/^Trajet dans plus de 7 jours\. Horaires connus aujourd'hui/);
  });
});
