import { describe, expect, it } from "vitest";
import { empreinte, empreinteAutorisee, nouvelleCle } from "./cle.js";
import { Limites } from "./limites.js";
import { appTest, CLE_TEST, ENTETE } from "../outils-test.js";

const moteurVide = { plan: async () => ({ itineraries: [] }), geocoder: async () => [] };

describe("clé d'appareil (D55)", () => {
  it("nouvelle clé : 43 caractères base64url, empreinte de 64 caractères hexadécimaux", () => {
    const c = nouvelleCle();
    expect(c).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(empreinte(c)).toMatch(/^[0-9a-f]{64}$/);
    expect(nouvelleCle()).not.toBe(c);
  });

  it("empreinteAutorisee : seule une clé connue, au bon format, passe", () => {
    const e = empreinte(CLE_TEST);
    expect(empreinteAutorisee(`Bearer ${CLE_TEST}`, [e])).toBe(e);
    expect(empreinteAutorisee(undefined, [e])).toBeNull();
    expect(empreinteAutorisee("Bearer ", [e])).toBeNull();
    expect(empreinteAutorisee(`Basic ${CLE_TEST}`, [e])).toBeNull();
    expect(empreinteAutorisee(`Bearer ${CLE_TEST}x`, [e])).toBeNull();
    expect(empreinteAutorisee(`Bearer ${nouvelleCle()}`, [e])).toBeNull();
    expect(empreinteAutorisee(`Bearer ${CLE_TEST}`, [])).toBeNull();
  });
});

describe("contrôle d'accès des routes /v1 (critère 2)", () => {
  const appels = [
    { method: "GET" as const, url: "/v1/lieux?q=Joigny" },
    { method: "POST" as const, url: "/v1/itineraires", payload: {} },
  ];
  const mauvaisEntetes = [{}, { authorization: "Bearer " }, { authorization: "Bearer abc" }, { authorization: `Bearer ${nouvelleCle()}` }];

  it("sans clé, clé vide, mal formée ou inconnue ⇒ 401, même corps", async () => {
    const app = appTest({ moteur: moteurVide });
    for (const a of appels) {
      for (const headers of mauvaisEntetes) {
        const r = await app.inject({ ...a, headers });
        expect(r.statusCode, `${a.url} ${JSON.stringify(headers)}`).toBe(401);
        expect(r.json()).toEqual({ erreur: "cle_invalide" });
      }
    }
  });

  it("clé valide ⇒ la route répond", async () => {
    const app = appTest({ moteur: moteurVide });
    const r = await app.inject({ method: "GET", url: "/v1/lieux?q=Joigny", headers: ENTETE });
    expect(r.statusCode).toBe(200);
  });

  it("empreinte retirée de la liste ⇒ 401", async () => {
    const app = appTest({ moteur: moteurVide, acces: { empreintes: [empreinte(nouvelleCle())], limites: new Limites(10, 10) } });
    const r = await app.inject({ method: "GET", url: "/v1/lieux?q=Joigny", headers: ENTETE });
    expect(r.statusCode).toBe(401);
  });
});

describe("limites de débit (D56, critère 3)", () => {
  it("la (N+1)e requête de la minute ⇒ 429 minute avec Retry-After, la minute suivante ⇒ 200", async () => {
    let t = new Date("2026-11-12T09:00:10Z");
    const app = appTest({ moteur: moteurVide, parMinute: 2, parJour: 100, maintenant: () => t });
    const appel = () => app.inject({ method: "GET", url: "/v1/lieux?q=Joigny", headers: ENTETE });
    expect((await appel()).statusCode).toBe(200);
    expect((await appel()).statusCode).toBe(200);
    const refus = await appel();
    expect(refus.statusCode).toBe(429);
    expect(refus.json()).toEqual({ erreur: "trop_de_requetes", fenetre: "minute" });
    expect(refus.headers["retry-after"]).toBe("50");
    t = new Date("2026-11-12T09:01:00Z");
    expect((await appel()).statusCode).toBe(200);
  });

  it("limite du jour ⇒ 429 jour jusqu'à minuit heure de Paris", async () => {
    let t = new Date("2026-11-12T22:00:00Z"); // 23:00 à Paris
    const app = appTest({ moteur: moteurVide, parMinute: 5, parJour: 3, maintenant: () => t });
    const appel = () => app.inject({ method: "GET", url: "/v1/lieux?q=Joigny", headers: ENTETE });
    for (let i = 0; i < 3; i++) {
      t = new Date(t.getTime() + 60_000);
      expect((await appel()).statusCode).toBe(200);
    }
    const refus = await appel();
    expect(refus.statusCode).toBe(429);
    expect(refus.json().fenetre).toBe("jour");
    expect(refus.headers["retry-after"]).toBe(String(57 * 60)); // 23:03 ⇒ minuit
    t = new Date("2026-11-12T23:00:00Z"); // minuit à Paris
    expect((await appel()).statusCode).toBe(200);
  });

  it("deux clés ont des compteurs séparés ; une clé inconnue n'est pas comptée", () => {
    const l = new Limites(1, 10, () => new Date("2026-11-12T09:00:00Z"));
    expect(l.compter("a")).toBeNull();
    expect(l.compter("a")?.fenetre).toBe("minute");
    expect(l.compter("b")).toBeNull();
  });

  it("une clé inconnue ne consomme pas la limite d'une clé valide", async () => {
    const app = appTest({ moteur: moteurVide, parMinute: 1, parJour: 10 });
    for (let i = 0; i < 3; i++) await app.inject({ method: "GET", url: "/v1/lieux?q=Joigny" });
    expect((await app.inject({ method: "GET", url: "/v1/lieux?q=Joigny", headers: ENTETE })).statusCode).toBe(200);
  });
});
