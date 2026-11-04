import { z } from "zod";

// Variables lues par l'app au build (spec 10, §4.1 ; invariant 11 côté app).
// Expo n'inline `process.env.EXPO_PUBLIC_*` qu'écrit en toutes lettres : l'appelant passe l'objet.

const schemaUrlApi = z
  .string()
  .trim()
  .min(1)
  .refine((texte) => {
    try {
      const u = new URL(texte);
      return (
        (u.protocol === "http:" || u.protocol === "https:") &&
        u.hostname !== "" &&
        (u.pathname === "" || u.pathname === "/") &&
        !texte.endsWith("/") &&
        u.search === "" &&
        u.hash === "" &&
        u.username === "" &&
        u.password === ""
      );
    } catch {
      return false;
    }
  });

export type Environnement = { urlApi: string };

export type LectureEnvironnement = { ok: true; env: Environnement } | { ok: false; message: string };

/** Valide les variables de l'app ; le message nomme la variable, jamais sa valeur. */
export function lireEnvironnement(brut: { EXPO_PUBLIC_API_URL?: string }): LectureEnvironnement {
  const valeur = brut.EXPO_PUBLIC_API_URL;
  if (valeur === undefined || valeur.trim() === "") {
    return { ok: false, message: "EXPO_PUBLIC_API_URL est absente." };
  }
  const lu = schemaUrlApi.safeParse(valeur);
  if (!lu.success) {
    return {
      ok: false,
      message: "EXPO_PUBLIC_API_URL est mal formée : http:// ou https://, une machine et un port, sans chemin ni / final.",
    };
  }
  return { ok: true, env: { urlApi: lu.data } };
}
