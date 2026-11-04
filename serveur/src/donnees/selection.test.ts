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

  it("écarte other, update, api, indisponible et autre format", () => {
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
});
