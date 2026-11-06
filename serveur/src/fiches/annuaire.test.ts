import { describe, expect, it } from "vitest";
import { Annuaire, chiffres, formaterNumero, numeroDansPage, schemaFichierFiches, type Fiche } from "./annuaire.js";
import { ajouterContacts } from "./contacts.js";
import { IndexHoraires } from "../itineraires/horaires-gtfs.js";
import type { PossibiliteAffichee } from "../itineraires/normaliser.js";
import { appTest, ENTETE, MANIFEST_TEST } from "../outils-test.js";
import fichier from "./fiches.json" with { type: "json" };

const BRIENON = { lat: 47.9918, lon: 3.617 };
const fiche = (f: Partial<Fiche> & Pick<Fiche, "id">): Fiche => ({
  type: "taxi",
  nom: "Taxi Exemple",
  numero: "03 86 00 00 01",
  communes: ["Brienon-sur-Armançon"],
  centre: BRIENON,
  rayon_km: 10,
  delai: null,
  url: "https://exemple.fr/taxis",
  lu_le: "2026-11-06",
  valide_le: null,
  ...f,
});

describe("numéros dans une page (spec 41, D49)", () => {
  it("espaces, points, +33 et insécables ignorés ; un autre numéro ne compte pas", () => {
    expect(chiffres("+33 3 86 00 00 01")).toBe("0386000001");
    expect(numeroDansPage("03 86 00 00 01", "<p>Tél&nbsp;: 03.86.00.00.01</p>")).toBe(true);
    expect(numeroDansPage("03 86 00 00 01", "<a href='tel:+33386000001'>+33 (0)3 86 00 00 01</a>")).toBe(true);
    expect(numeroDansPage("03 86 00 00 01", "<p>03 86 00 00 02</p>")).toBe(false);
  });

  it("revue PR #61 : des chiffres épars ne forment pas un numéro ; un numéro plus long non plus", () => {
    expect(numeroDansPage("03 80 11 29 29", "<p>réf. 0380 le 11</p><script>x=2929</script>")).toBe(false);
    expect(numeroDansPage("03 80 11 29 29", "id=1203801129291")).toBe(false);
    expect(numeroDansPage("03 80 11 29 29", "Tél. 03-80-11-29-29 (touche 3)")).toBe(true);
  });

  it("numéro rendu à l'app : « 03 80 11 29 29 » quel que soit son écriture", () => {
    expect(formaterNumero("03.80.11.29.29")).toBe("03 80 11 29 29");
    expect(formaterNumero("+33 3 80 11 29 29")).toBe("03 80 11 29 29");
    expect(formaterNumero("+33811444854")).toBe("08 11 44 48 54");
    expect(formaterNumero("(0)3-80")).toBe("0 3 80");
  });
});

describe("Annuaire (spec 41, critère 1)", () => {
  const pages: Record<string, string> = { "https://a.fr/": "Taxi A : 03 86 00 00 01", "https://b.fr/": "page sans le numéro" };
  const lire = async (url: string) => {
    if (!(url in pages)) throw new Error("injoignable");
    return pages[url]!;
  };
  const annuaire = new Annuaire(
    [
      fiche({ id: "validee", nom: "Taxi Validé", numero: "03 86 11 11 11", url: "https://v.fr/", valide_le: "2026-11-07", delai: "La veille" }),
      fiche({ id: "retrouvee", url: "https://a.fr/" }),
      fiche({ id: "absente", url: "https://b.fr/", numero: "03 86 22 22 22" }),
      fiche({ id: "injoignable", url: "https://c.fr/", numero: "03 86 33 33 33" }),
      fiche({ id: "loin", url: "https://a.fr/", centre: { lat: 49.0, lon: 2.0 } }),
      fiche({ id: "tad", type: "tad", url: "https://a.fr/" }),
    ],
    lire,
  );

  it("validée : affichée sans relire sa page ; candidate : seulement si le numéro est sur sa page", async () => {
    expect(await annuaire.verifierPages("2026-11-08")).toBe(3); // retrouvee, loin, tad
    const taxis = annuaire.contactsPres(BRIENON, "taxi");
    expect(taxis.map((c) => c.nom)).toEqual(["Taxi Validé", "Taxi Exemple"]);
    expect(taxis[0]).toEqual({ nom: "Taxi Validé", numero: "03 86 11 11 11", source: "fiche", url: "https://v.fr/", lu_le: "2026-11-07", verifie: true, delai: "La veille" });
    expect(taxis[1]).toMatchObject({ numero: "03 86 00 00 01", source: "page", verifie: false, url: "https://a.fr/", lu_le: "2026-11-08" });
  });

  it("hors du rayon ou d'un autre type : absente ; page devenue muette ⇒ retirée", async () => {
    expect(annuaire.contactsPres({ lat: 49.0, lon: 2.0 }, "taxi").map((c) => c.lu_le)).toEqual(["2026-11-08"]);
    expect(annuaire.contactsPres(BRIENON, "tad")).toHaveLength(1);
    pages["https://a.fr/"] = "plus rien";
    await annuaire.verifierPages("2026-11-09");
    expect(annuaire.contactsPres(BRIENON, "taxi").map((c) => c.source)).toEqual(["fiche"]);
  });

  it("le fichier versionné passe le schéma", () => {
    expect(() => schemaFichierFiches.parse(fichier)).not.toThrow();
  });
});

describe("Numéro de chaque étape (spec 41, critère 2)", () => {
  const etape = (mode: string, extra: object = {}) =>
    ({
      mode,
      reservation: null,
      exploitant: null,
      de: { ...BRIENON, nom: "Mairie", type: "arret", arret: null },
      source: { type: "osm", jeu: "osm", version: "x" },
      ...extra,
    }) as unknown as PossibiliteAffichee["etapes"][number];
  const possibilite = (etapes: PossibiliteAffichee["etapes"]) => ({ etapes }) as PossibiliteAffichee;
  const annuaire = new Annuaire([fiche({ id: "v", valide_le: "2026-11-07" }), fiche({ id: "t", type: "tad", nom: "TAD", valide_le: "2026-11-07" })]);
  const jeu = MANIFEST_TEST.fichiers.find((f) => f.type === "gtfs")!;
  const horaires = new IndexHoraires({ version: 1, jeux: { [jeu.jeu]: { fin_validite: null, reservations: {}, agences: { Mobigo: "03 80 11 29 29" } } } });
  const gtfs = { type: "gtfs", jeu: jeu.jeu, version: "v", trip_id: "t", date_service: "2026-11-12", fin_validite: null, date_horaires: null };

  it("taxi ⇒ fiche ; réservation ⇒ téléphone de l'exploitant (non vérifié, URL et date du jeu), sinon fiche TAD ; marche ⇒ rien", () => {
    const [p] = ajouterContacts(
      [
        possibilite([
          etape("taxi"),
          etape("bus", { reservation: "appel", exploitant: "Mobigo", source: gtfs }),
          etape("bus", { reservation: "appel", exploitant: "Inconnu", source: gtfs }),
          etape("marche"),
        ]),
      ],
      MANIFEST_TEST,
      annuaire,
      horaires,
    );
    expect(p!.etapes.map((e) => e.contact?.source ?? null)).toEqual(["fiche", "gtfs", "fiche", null]);
    expect(p!.etapes[1]!.contact).toEqual({
      nom: "Mobigo",
      numero: "03 80 11 29 29",
      source: "gtfs",
      url: jeu.url_source,
      lu_le: jeu.date_telechargement,
      verifie: false,
      delai: null,
    });
    expect(p!.etapes[2]!.contact?.nom).toBe("TAD");
  });

  it("sans annuaire ni horaires : aucun numéro", () => {
    const [p] = ajouterContacts([possibilite([etape("taxi")])], MANIFEST_TEST, undefined, undefined);
    expect(p!.etapes[0]!.contact).toBeNull();
  });
});

describe("POST /v1/numeros (spec 41, critère 3)", () => {
  it("numéros autour du point ; type inconnu ⇒ 400 ; sans annuaire ⇒ liste vide", async () => {
    const annuaire = new Annuaire([fiche({ id: "v", valide_le: "2026-11-07" })]);
    const r = await appTest({ annuaire }).inject({ method: "POST", url: "/v1/numeros", headers: ENTETE, payload: { point: BRIENON, type: "taxi" } });
    expect(r.statusCode).toBe(200);
    expect(r.json().numeros).toHaveLength(1);
    const vide = await appTest().inject({ method: "POST", url: "/v1/numeros", headers: ENTETE, payload: { point: BRIENON, type: "tad" } });
    expect(vide.json()).toEqual({ numeros: [] });
    const mauvais = await appTest().inject({ method: "POST", url: "/v1/numeros", headers: ENTETE, payload: { point: BRIENON, type: "bus" } });
    expect(mauvais.statusCode).toBe(400);
  });
});
