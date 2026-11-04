import { describe, expect, it } from "vitest";
import { choisirRessources, etiquette, schemaListeJeux, type JeuTdg } from "./selection.js";

function ressource(id: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    format: "GTFS",
    is_available: true,
    type: "main",
    title: `R${id}`,
    url: `https://exemple.fr/${id}.zip`,
    updated: "2026-10-29T10:00:00Z",
    ...extra,
  };
}

function jeu(slug: string, resources: unknown[], type = "public-transit"): JeuTdg {
  return schemaListeJeux.parse([
    { id: slug, slug, title: slug, type, licence: "lov2", publisher: { name: "Prod" }, resources },
  ])[0]!;
}

describe("choisirRessources", () => {
  it("garde les GTFS principaux disponibles, avec leur licence et leur date", () => {
    const r = choisirRessources([jeu("idfm", [ressource(1)])]);
    expect(r).toEqual([
      {
        etiquette: "r1",
        jeu: "idfm",
        titre: "R1",
        producteur: "Prod",
        url: "https://exemple.fr/1.zip",
        licence: "lov2",
        miseAJour: "2026-10-29",
      },
    ]);
  });

  it("avec un GTFS principal disponible : écarte other, update, api, indisponible et autre format", () => {
    const r = choisirRessources([
      jeu("x", [
        ressource(1, { type: "other" }),
        ressource(2, { type: "update" }),
        ressource(3, { type: "api" }),
        ressource(4, { is_available: false }),
        ressource(5, { format: "NeTEx" }),
        ressource(6),
      ]),
    ]);
    expect(r.map((x) => x.etiquette)).toEqual(["r6"]);
  });

  it("garde toutes les ressources principales d'un jeu à plusieurs fichiers", () => {
    const r = choisirRessources([jeu("mobigo", [ressource(10), ressource(11)])]);
    expect(r.map((x) => x.etiquette)).toEqual(["r10", "r11"]);
  });

  it("ignore les jeux qui ne sont pas du transport public et les ressources en double", () => {
    const r = choisirRessources([
      jeu("velos", [ressource(20)], "vehicles-sharing"),
      jeu("a", [ressource(21)]),
      jeu("b", [ressource(21)]),
    ]);
    expect(r.map((x) => x.etiquette)).toEqual(["r21"]);
  });

  it("licence absente ⇒ notspecified", () => {
    const j = schemaListeJeux.parse([
      { id: "x", slug: "x", title: "x", type: "public-transit", licence: null, resources: [ressource(30)] },
    ]);
    expect(choisirRessources(j)[0]?.licence).toBe("notspecified");
  });
});

describe("etiquette", () => {
  it("ne contient jamais de « _ », séparateur de MOTIS", () => {
    expect(etiquette(83970)).toBe("r83970");
    expect(etiquette(83970)).not.toContain("_");
  });

  describe("repli quand aucun GTFS principal n'est disponible (D59)", () => {
    it("Lyon TCL : officiel indisponible ⇒ la version « modifiée » disponible", () => {
      const r = choisirRessources([
        jeu("tcl", [
          ressource(1, { type: "other", is_available: false, title: "GTFS officiel" }),
          ressource(2, { type: "other", title: "GTFS modifié" }),
          ressource(3, { type: "other", format: "SIRI Lite" }),
        ]),
      ]);
      expect(r.map((x) => x.etiquette)).toEqual(["r2"]);
    });

    it("préfère le format GTFS à un zip, main à other à api, et l'officiel au « modifié »", () => {
      const lia = choisirRessources([
        jeu("lia", [
          ressource(1, { format: "zip", title: "2023-bus-hiver.zip", url: "https://x.fr/gtfs-1.zip" }),
          ressource(2, { type: "other", title: "Offre LiA format GTFS" }),
        ]),
      ]);
      expect(lia.map((x) => x.etiquette)).toEqual(["r2"]);
      const bbc = choisirRessources([jeu("bbc", [ressource(4, { type: "api" }), ressource(5, { type: "other", title: "GTFS modifié" }), ressource(6, { type: "other" })])]);
      expect(bbc.map((x) => x.etiquette)).toEqual(["r6"]);
    });

    it("un zip qui se dit GTFS est pris ; update, temps réel et zip quelconque jamais", () => {
      expect(choisirRessources([jeu("z", [ressource(1, { format: "zip", title: "GTFS 2026" })])]).map((x) => x.etiquette)).toEqual(["r1"]);
      expect(
        choisirRessources([
          jeu("n", [ressource(1, { type: "update" }), ressource(2, { format: "gtfs-rt" }), ressource(3, { format: "zip", title: "plan.zip", url: "https://x.fr/plan.zip" })]),
        ]),
      ).toEqual([]);
    });
  });
});

