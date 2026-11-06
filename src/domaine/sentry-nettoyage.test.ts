import { describe, expect, it } from "vitest";

import { cheminSeul, masquerTexte, nettoyerEvenement, nettoyerMiette } from "./sentry-nettoyage";

// Spec 50, critère 1 : un événement chargé de données de trajet ressort sans aucune d'elles.
const charge = () => ({
  event_id: "abc",
  message: "Échec pour « rendez-vous gare de Joigny » à 47.9918, 3.6170",
  user: { id: "x", ip_address: "{{auto}}" },
  extra: { phrase: "rendez-vous gare de Joigny" },
  request: {
    url: "http://localhost:3000/v1/lieux?q=Joigny&lat=47.9918&lon=3.617",
    headers: { authorization: "Bearer secret" },
    data: { depart: { lat: 47.9918, lon: 3.617 } },
    cookies: { a: "b" },
    query_string: "q=Joigny",
  },
  exception: { values: [{ type: "TypeError", value: "fetch http://localhost:3000/v1/lieux?q=Joigny a échoué (47.99181)", stacktrace: { frames: [{ function: "chercher" }] } }] },
  breadcrumbs: [
    { category: "console", message: "domicile : 18 Boulevard Maréchal de Lattre de Tassigny" },
    { category: "fetch", type: "http", data: { method: "GET", url: "http://localhost:3000/v1/lieux?q=Joigny", status_code: 200, request_body_size: 12 } },
    { category: "navigation", data: { from: "/resultat?arrivee=Joigny", to: "/assistant?trajet=1" } },
    { category: "ui.click", message: "Chercher", data: { texte: "Joigny" } },
  ],
  contexts: { device: { model: "SM-S911B" }, os: { name: "Android" } },
});

describe("nettoyerEvenement (spec 50)", () => {
  it("ne laisse ni phrase, ni lieu, ni coordonnée, ni en-tête, ni utilisateur", () => {
    const sortie = JSON.stringify(nettoyerEvenement(charge()));
    for (const interdit of ["Joigny", "47.99", "3.617", "Boulevard", "Bearer", "secret", "{{auto}}", "phrase", "depart", "q="]) {
      expect(sortie, interdit).not.toContain(interdit);
    }
  });

  it("remplace l'utilisateur par l'IP fictive, pour que Sentry ne déduise aucune ville (issue 0030)", () => {
    expect(nettoyerEvenement(charge()).user).toEqual({ ip_address: "0.0.0.0" });
  });

  it("garde la pile, le type d'erreur, le chemin et les contextes techniques", () => {
    const e = nettoyerEvenement(charge());
    expect(e.exception?.values?.[0]?.type).toBe("TypeError");
    expect(e.exception?.values?.[0]?.stacktrace).toEqual({ frames: [{ function: "chercher" }] });
    expect(e.request).toEqual({ url: "/v1/lieux" });
    expect(e.contexts).toEqual({ device: { model: "SM-S911B" }, os: { name: "Android" } });
    expect(e.event_id).toBe("abc");
  });

  it("ne garde des miettes réseau que méthode, code et chemin ; supprime celles de la console", () => {
    const miettes = nettoyerEvenement(charge()).breadcrumbs!;
    expect(miettes).toHaveLength(3);
    expect(miettes[0]).toEqual({ category: "fetch", type: "http", data: { method: "GET", status_code: 200, url: "/v1/lieux" } });
    expect(miettes[1]).toEqual({ category: "navigation", data: { from: "/resultat", to: "/assistant" } });
    expect(miettes[2]).toEqual({ category: "ui.click", message: "Chercher" });
  });
});

describe("outils de nettoyage", () => {
  it("cheminSeul réduit une URL à son chemin, même relative", () => {
    expect(cheminSeul("https://api.exemple.fr/v1/itineraires?x=1#y")).toBe("/v1/itineraires");
    expect(cheminSeul("/resultat?arrivee=Joigny")).toBe("/resultat");
  });

  it("masquerTexte masque les citations entre guillemets", () => {
    expect(masquerTexte("lieux « France Travail Joigny » : erreur_serveur")).toBe("lieux «…» : erreur_serveur");
    expect(masquerTexte('texte "gare de Sens" refusé')).toBe('texte "…" refusé');
  });

  it("masquerTexte masque coordonnées et courriels, garde les heures et les codes", () => {
    expect(masquerTexte("à 47.9918, -3.6170 pour a.b@c.fr")).toBe("à [coord], [coord] pour [courriel]");
    expect(masquerTexte("délai 12.5 s, code 503, 10:00")).toBe("délai 12.5 s, code 503, 10:00");
  });

  it("nettoyerMiette supprime la console", () => {
    expect(nettoyerMiette({ category: "console", message: "x" })).toBeNull();
  });
});
