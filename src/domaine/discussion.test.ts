import { describe, expect, it } from "vitest";
import { clientApi, type FetchFlux, type Possibilite } from "./api";
import {
  alertesPossibilite,
  allegerPieces,
  demandeDeProposition,
  lireEvenements,
  messageIssue,
  messagesAEnvoyer,
  MESSAGES_DISCUSSION,
  pucesDepart,
  resumeRecherche,
  type MessageFil,
} from "./discussion";
import type { Demande } from "./demande";

/** Spec 39 §2, §3 et §7. */

describe("lireEvenements (spec 39 §7)", () => {
  it("découpe les événements complets et garde le reste", () => {
    const { evenements, reste } = lireEvenements(
      'event: texte\ndata: {"texte":"Bonjour, "}\n\nevent: texte\ndata: {"texte":"ligne\\nsuivante"}\n\nevent: fin\nda',
    );
    expect(evenements).toEqual([
      { type: "texte", texte: "Bonjour, " },
      { type: "texte", texte: "ligne\nsuivante" },
    ]);
    expect(reste).toBe("event: fin\nda");
    expect(lireEvenements(reste + "ta: {}\n\n").evenements).toEqual([{ type: "fin" }]);
  });

  it("fin de ligne \\r\\n, erreur, bloc illisible ignoré", () => {
    const { evenements } = lireEvenements('event: texte\r\ndata: pas du json\r\n\r\nevent: erreur\r\ndata: {"erreur":"indisponible"}\r\n\r\n');
    expect(evenements).toEqual([{ type: "erreur" }]);
  });
});

const etape = (mode: string, minutes: number, extra: Partial<Possibilite["etapes"][number]> = {}) =>
  ({
    mode,
    duree_minutes: minutes,
    depart: "08:00",
    arrivee: "08:10",
    de: { nom: "A", type: "arret" },
    a: { nom: "B", type: "arret" },
    reservation: null,
    ...extra,
  }) as unknown as Possibilite["etapes"][number];

/** Étapes enchaînées sans attente à partir de 08:00 (pas de fausse nuit dehors). */
function enchainer(etapes: Possibilite["etapes"]): Possibilite["etapes"] {
  let t = 8 * 60;
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return etapes.map((e) => {
    const r = { ...e, depart: hhmm(t), arrivee: hhmm(t + e.duree_minutes) };
    t += e.duree_minutes;
    return r;
  });
}

const possibilite = (etapes: Possibilite["etapes"], extra: Partial<Possibilite> = {}) =>
  ({
    depart: "08:00",
    arrivee: "10:00",
    depart_utc: "2026-11-12T07:00:00Z",
    arrivee_utc: "2026-11-12T09:00:00Z",
    duree_minutes: 120,
    correspondances: 1,
    etapes: enchainer(etapes),
    ...extra,
  }) as unknown as Possibilite;

const DEMANDE: Demande = {
  depart: { type: "domicile" },
  arrivee: { type: "texte", texte: "flers" },
  date: "2026-11-12",
  heure: "10:00",
  sens: "arriver_avant",
  marge: 10,
};

describe("résumé de la recherche (spec 39 §3)", () => {
  it("lieux en texte, modes, correspondances, marche et alertes ; ni horaire ni coordonnée", () => {
    const taxi = possibilite([etape("marche", 18), etape("car", 40), etape("taxi", 20)], { correspondances: 1 });
    const tad = possibilite([etape("marche", 5), etape("transport_a_la_demande", 30, { reservation: "appel" })], {
      arrivee_utc: "2026-11-12T08:30:00Z",
      correspondances: 0,
    });
    const r = resumeRecherche(
      DEMANDE,
      { bout: DEMANDE.depart, choisi: { nom: "12 rue des Lilas, Joigny" } },
      { bout: DEMANDE.arrivee, choisi: { nom: "Flers" } },
      { possibilites: [taxi, tad] } as never,
    );
    expect(r).toEqual({
      depart: "Domicile",
      arrivee: "Flers",
      date: "2026-11-12",
      heure: "10:00",
      sens: "arriver_avant",
      marge: 10,
      possibilites: [
        { modes: ["marche", "transport_a_la_demande"], correspondances: 0, marche_minutes: 5, alertes: ["transport_a_reserver"] },
        { modes: ["marche", "car", "taxi"], correspondances: 1, marche_minutes: 18, alertes: ["taxi_a_reserver", "marche_longue"] },
      ],
    });
    const json = JSON.stringify(r);
    for (const interdit of ["08:00", "\"lat\"", "\"lon\"", "rue des Lilas"]) expect(json).not.toContain(interdit);
  });

  it("sans réservation ni taxi : « sans_reservation »", () => {
    expect(alertesPossibilite(possibilite([etape("marche", 3), etape("train", 60)]))).toEqual(["sans_reservation"]);
  });
});

describe("messages envoyés (spec 39 §3)", () => {
  it("20 derniers, 1 000 caractères au plus, réponses vides laissées de côté", () => {
    const fil: MessageFil[] = Array.from({ length: 25 }, (_, i) =>
      i % 2 === 0 ? { id: i, role: "personne", texte: `question ${i}` } : { id: i, role: "assistant", texte: `réponse ${i}`, etat: "complete" },
    );
    fil.push({ id: 25, role: "assistant", texte: "", etat: "echec", erreur: "x" });
    fil.push({ id: 26, role: "personne", texte: "a".repeat(1500) });
    const m = messagesAEnvoyer(fil);
    expect(m).toHaveLength(20);
    expect(m.at(-1)).toEqual({ role: "personne", texte: "a".repeat(1000) });
    expect(m.some((x) => x.texte === "")).toBe(false);
  });
});

describe("puces et messages (spec 39 §2)", () => {
  it("« Explique-moi mon trajet » seulement avec une recherche", () => {
    expect(pucesDepart(false)).toEqual(["Que faire si je rate une correspondance ?", "Comment réserver un transport à la demande ?"]);
    expect(pucesDepart(true).at(-1)).toBe("Explique-moi mon trajet");
  });
  it("messages d'échec", () => {
    expect(messageIssue({ etat: "indisponible" }, false)).toEqual({ erreur: MESSAGES_DISCUSSION.indisponible, reessayer: false });
    expect(messageIssue({ etat: "injoignable" }, false)).toEqual({ erreur: "Pas de réseau. Votre message n'est pas parti.", reessayer: true });
    expect(messageIssue({ etat: "arretee" }, true)).toBeNull();
  });
});

// ——— Client : lecture du flux ———

const encodeur = new TextEncoder();
function fluxDe(morceaux: string[], { erreurApres }: { erreurApres?: number } = {}): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(c) {
      if (erreurApres !== undefined && i === erreurApres) return c.error(new Error("réseau"));
      if (i >= morceaux.length) return c.close();
      c.enqueue(encodeur.encode(morceaux[i++]!));
    },
  });
}

function client(fetchFlux: FetchFlux) {
  return clientApi({ urlApi: "http://api", cle: "cle", fetch: async () => new Response(), fetchFlux, delaiMs: 1000 });
}
const ok = (body: ReadableStream<Uint8Array>) => ({ status: 200, ok: true, headers: { get: () => null }, body });
const CORPS = { messages: [{ role: "personne" as const, texte: "Bonjour" }] };

describe("client.discussion (spec 39 §7)", () => {
  it("morceaux passés au fil de l'eau, même coupés au milieu d'un événement ; `fin` ⇒ complete", async () => {
    let vu: { url: string; corps: string; auth: string } | undefined;
    const c = client(async (url, init) => {
      vu = { url, corps: init.body, auth: init.headers.authorization! };
      return ok(fluxDe(['event: texte\ndata: {"texte":"Bon', 'jour"}\n\nevent: texte\ndata: {"texte":" !"}\n\n', "event: fin\ndata: {}\n\n"]));
    });
    const recus: string[] = [];
    const issue = await c.discussion(CORPS, { signal: new AbortController().signal, surTexte: (t) => recus.push(t) });
    expect(issue).toEqual({ etat: "complete" });
    expect(recus).toEqual(["Bonjour", " !"]);
    expect(vu).toEqual({ url: "http://api/v1/assistant/discussion", corps: JSON.stringify(CORPS), auth: "Bearer cle" });
  });

  it("caractères accentués coupés entre deux morceaux d'octets", async () => {
    const octets = encodeur.encode('event: texte\ndata: {"texte":"Arrêt à éviter"}\n\nevent: fin\ndata: {}\n\n');
    const c = client(async () =>
      ok(
        new ReadableStream({
          start(ctl) {
            for (let i = 0; i < octets.length; i += 3) ctl.enqueue(octets.slice(i, i + 3));
            ctl.close();
          },
        }),
      ),
    );
    let texte = "";
    await c.discussion(CORPS, { signal: new AbortController().signal, surTexte: (t) => (texte += t) });
    expect(texte).toBe("Arrêt à éviter");
  });

  it("`erreur` ⇒ indisponible ; flux fini sans `fin` ⇒ coupée ; réseau coupé en route ⇒ coupée", async () => {
    const signal = new AbortController().signal;
    const surTexte = () => {};
    expect(await client(async () => ok(fluxDe(['event: erreur\ndata: {"erreur":"indisponible"}\n\n']))).discussion(CORPS, { signal, surTexte })).toEqual({
      etat: "indisponible",
    });
    expect(await client(async () => ok(fluxDe(['event: texte\ndata: {"texte":"a"}\n\n']))).discussion(CORPS, { signal, surTexte })).toEqual({ etat: "coupee" });
    expect(await client(async () => ok(fluxDe(["x"], { erreurApres: 1 }))).discussion(CORPS, { signal, surTexte })).toEqual({ etat: "coupee" });
  });

  it("401, 429, 400, serveur injoignable", async () => {
    const signal = new AbortController().signal;
    const surTexte = () => {};
    const statut = (status: number) => async () => ({ status, ok: false, headers: { get: () => "120" }, body: null });
    expect(await client(statut(401)).discussion(CORPS, { signal, surTexte })).toEqual({ etat: "cle_refusee" });
    expect(await client(statut(429)).discussion(CORPS, { signal, surTexte })).toEqual({ etat: "trop_de_demandes", minutes: 2 });
    expect(await client(statut(400)).discussion(CORPS, { signal, surTexte })).toEqual({ etat: "indisponible" });
    expect(await client(() => Promise.reject(new Error("réseau"))).discussion(CORPS, { signal, surTexte })).toEqual({ etat: "injoignable" });
  });

  it("« Arrêter » ⇒ la connexion est coupée, le texte reçu reste, issue « arretee » (critère 3)", async () => {
    const arret = new AbortController();
    let signalFetch: AbortSignal | undefined;
    const c = client(async (_url, init) => {
      signalFetch = init.signal;
      return ok(
        new ReadableStream({
          start(ctl) {
            ctl.enqueue(encodeur.encode('event: texte\ndata: {"texte":"Début"}\n\n'));
            init.signal.addEventListener("abort", () => ctl.error(new Error("abort")));
          },
        }),
      );
    });
    const recus: string[] = [];
    const issue = c.discussion(CORPS, {
      signal: arret.signal,
      surTexte: (t) => {
        recus.push(t);
        arret.abort();
      },
    });
    expect(await issue).toEqual({ etat: "arretee" });
    expect(recus).toEqual(["Début"]);
    expect(signalFetch?.aborted).toBe(true);
  });

  it("sans `fetchFlux` ⇒ indisponible", async () => {
    const c = clientApi({ urlApi: "http://api", cle: "cle", fetch: async () => new Response() });
    expect(await c.discussion(CORPS, { signal: new AbortController().signal, surTexte: () => {} })).toEqual({ etat: "indisponible" });
  });
});

describe("Spec 45 (D126) : recherche proposée et pièce jointe", () => {
  const PROPOSITION = { depart: "domicile", arrivee: "Gare de Joigny", date: "2026-11-12", heure: "10:00", sens: "arriver_avant" };

  it("l'événement `recherche` est lu et revalidé ; hors schéma ⇒ ignoré", () => {
    const flux = `event: recherche\ndata: ${JSON.stringify(PROPOSITION)}\n\nevent: recherche\ndata: {"arrivee":"x"}\n\nevent: fin\ndata: {}\n\n`;
    expect(lireEvenements(flux).evenements).toEqual([{ type: "recherche", recherche: PROPOSITION }, { type: "fin" }]);
  });

  it("la proposition devient une demande ordinaire : domicile, position, texte ; marge par défaut 10 (D17)", () => {
    expect(demandeDeProposition({ ...PROPOSITION, sens: "arriver_avant" })).toEqual({
      depart: { type: "domicile" },
      arrivee: { type: "texte", texte: "Gare de Joigny" },
      date: "2026-11-12",
      heure: "10:00",
      sens: "arriver_avant",
      marge: 10,
      retour: null,
    });
    expect(demandeDeProposition({ ...PROPOSITION, sens: "partir_a", depart: "ici", marge: 20 })).toMatchObject({ depart: { type: "position" }, marge: 20 });
  });

  it("seule la pièce jointe du dernier message part ; une carte de recherche part résumée côté Assistant", () => {
    const image = { type: "image" as const, media_type: "image/jpeg" as const, donnees: "QUJD", nom: "convocation.jpg" };
    const fil: MessageFil[] = [
      { id: 1, role: "personne", texte: "Voici ma convocation", piece_jointe: image },
      { id: 2, role: "assistant", texte: "Je cherche.", etat: "complete" },
      { id: 3, role: "recherche", proposition: { ...PROPOSITION, sens: "arriver_avant" } },
      { id: 4, role: "personne", texte: "Merci", piece_jointe: { ...image, nom: "billet.jpg" } },
    ];
    expect(messagesAEnvoyer(fil)).toEqual([
      { role: "personne", texte: "Voici ma convocation" },
      { role: "assistant", texte: "Je cherche." },
      {
        role: "assistant",
        texte:
          "[Recherche proposée et lancée par l'app : de domicile à Gare de Joigny, le 2026-11-12, arriver avant 10:00. Les trajets trouvés sont affichés en cartes.]",
      },
      { role: "personne", texte: "Merci", piece_jointe: { type: "image", media_type: "image/jpeg", donnees: "QUJD" } },
    ]);
  });

  it("après une réponse, les pièces envoyées ne gardent que leur nom, et une pièce vidée ne repart pas", () => {
    const image = { type: "image" as const, media_type: "image/jpeg" as const, donnees: "QUJD", nom: "convocation.jpg" };
    const fil: MessageFil[] = [
      { id: 1, role: "personne", texte: "Voici ma convocation", piece_jointe: image },
      { id: 2, role: "assistant", texte: "Bien reçu.", etat: "complete" },
    ];
    const allege = allegerPieces(fil);
    expect(allege[0]).toEqual({ id: 1, role: "personne", texte: "Voici ma convocation", piece_jointe: { ...image, donnees: "" } });
    expect(allege[1]).toBe(fil[1]);
    const suite: MessageFil[] = [{ id: 3, role: "personne", texte: "Et encore", piece_jointe: { ...image, donnees: "" } }];
    expect(messagesAEnvoyer(suite)).toEqual([{ role: "personne", texte: "Et encore" }]);
  });
});
