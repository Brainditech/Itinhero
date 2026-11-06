import { describe, expect, it } from "vitest";
import { deciderJeu, messageNuit, type Ancien, type Nouveau } from "./nuit.js";

/** Spec 44 (D125, invariant 14) : un nouveau fichier ne remplace l'ancien qu'après ses contrôles. */
const AUJ = "2026-11-06";
const ancien: Ancien = { sha256: "a".repeat(64), fin_validite: "2027-08-31", temoins: ["BRIENON SUR ARMANCON-MAIRIE"] };
const lu = (n: Partial<Extract<Nouveau, { etat: "lu" }>> = {}): Nouveau => ({
  etat: "lu",
  sha256: "b".repeat(64),
  controle: { ok: true },
  fin_validite: "2027-09-30",
  temoins: ["BRIENON SUR ARMANCON-MAIRIE"],
  ...n,
});

describe("Ingestion nocturne, décision par jeu (spec 44, critère 1)", () => {
  it("même fichier ⇒ inchangé ; bon fichier ⇒ remplacé ; nouveau jeu sain ⇒ ajouté", () => {
    expect(deciderJeu(ancien, lu({ sha256: ancien.sha256 }), AUJ).etat).toBe("inchange");
    expect(deciderJeu(ancien, lu(), AUJ)).toEqual({ etat: "remplace", raison: null });
    expect(deciderJeu(null, lu({ temoins: [] }), AUJ).etat).toBe("nouveau");
  });

  it("fichier cassé ou injoignable ⇒ l'ancien est gardé, avec la raison ; sans ancien ⇒ écarté", () => {
    expect(deciderJeu(ancien, lu({ controle: { ok: false, raison: "stops.txt absent" } }), AUJ)).toEqual({ etat: "ancien_garde", raison: "stops.txt absent" });
    expect(deciderJeu(ancien, { etat: "echec", raison: "téléchargement : HTTP 500" }, AUJ)).toEqual({ etat: "ancien_garde", raison: "téléchargement : HTTP 500" });
    expect(deciderJeu(null, { etat: "echec", raison: "HTTP 404" }, AUJ).etat).toBe("ecarte");
  });

  it("horaires finis, couverture en recul sous J+30, arrêt témoin perdu ⇒ ancien gardé", () => {
    expect(deciderJeu(ancien, lu({ fin_validite: "2026-11-01" }), AUJ).raison).toBe("horaires finis (2026-11-01)");
    expect(deciderJeu(ancien, lu({ fin_validite: "2026-11-20" }), AUJ).raison).toBe("couverture en recul : 2026-11-20 au lieu de 2027-08-31");
    expect(deciderJeu(ancien, lu({ temoins: [] }), AUJ).raison).toBe("arrêt témoin absent : BRIENON SUR ARMANCON-MAIRIE");
  });

  it("une couverture plus courte mais au-delà de J+30 est acceptée (changement de service)", () => {
    expect(deciderJeu(ancien, lu({ fin_validite: "2026-12-12" }), AUJ).etat).toBe("remplace");
  });
});

describe("Message Sentry de la nuit (spec 50)", () => {
  it("nomme les jeux non mis à jour et leur raison, rien d'autre", () => {
    expect(
      messageNuit([
        { etiquette: "mobigo", etat: "ancien_garde", raison: "arrêt témoin absent : Brienon Mairie" },
        { etiquette: "ter", etat: "ecarte", raison: null },
      ]),
    ).toBe("ingestion : 2 jeu(x) non mis à jour — mobigo ancien_garde (arrêt témoin absent : Brienon Mairie) ; ter ecarte");
  });
});
