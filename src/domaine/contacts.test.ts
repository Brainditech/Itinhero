import { describe, expect, it } from "vitest";

import { lienTel, texteSource } from "./contacts";
import { lienUber, lienUberEntre } from "./uber";
import type { Etape } from "./api";

const base = { nom: "Taxi A", numero: "+33 3 86 00 00 01", url: "https://www.mairie-exemple.fr/taxis", lu_le: "2026-11-06", delai: null };

describe("Source d'un numéro (spec 41, invariant 16)", () => {
  it("fiche validée, exploitant « non vérifié », page « non vérifié » avec son site et sa date", () => {
    expect(texteSource({ ...base, source: "fiche", verifie: true, lu_le: "2026-11-07" })).toBe("Fiche validée le 07/11/2026");
    expect(texteSource({ ...base, source: "gtfs", verifie: false, lu_le: "2026-11-04" })).toBe(
      "Non vérifié : numéro publié par l'exploitant avec ses horaires, lu le 04/11/2026",
    );
    expect(texteSource({ ...base, source: "page", verifie: false })).toBe("Non vérifié : lu sur www.mairie-exemple.fr le 06/11/2026");
    expect(texteSource({ ...base, source: "page", verifie: false, url: "pas une url" })).toBe("Non vérifié : lu sur une page publique le 06/11/2026");
  });

  it("lien tel: sans espaces", () => {
    expect(lienTel("+33 3 86 00 00 01")).toBe("tel:+33386000001");
    expect(lienTel("03.86.00.00.01")).toBe("tel:0386000001");
  });
});

describe("Uber (spec 41)", () => {
  const lieu = (nom: string, lat: number, lon: number) => ({ nom, lat, lon, type: "arret" as const, arret: null });
  const etape = (mode: string, duree: number) => ({ mode, duree_minutes: duree, de: lieu("A", 48, 3.5), a: lieu("B", 48.1, 3.6) }) as unknown as Etape;
  it("marche de plus de 15 min ⇒ lien ; 15 min ou bus ⇒ rien ; bout en bout entre deux lieux", () => {
    expect(lienUber(etape("marche", 16))).toContain("https://m.uber.com/looking?pickup=");
    expect(lienUber(etape("marche", 15))).toBeNull();
    expect(lienUber(etape("bus", 40))).toBeNull();
    expect(decodeURIComponent(lienUberEntre({ nom: "Domicile", lat: 47.99, lon: 3.61 }, { nom: "Gare de Flers", lat: 48.74, lon: -0.57 }))).toBe(
      'https://m.uber.com/looking?pickup={"latitude":47.99,"longitude":3.61,"addressLine1":"Domicile"}&drop[0]={"latitude":48.74,"longitude":-0.57,"addressLine1":"Gare de Flers"}',
    );
  });
});
