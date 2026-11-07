import type { Contact } from "./api";

/** « 03 86 … » ⇒ « tel:0386… » (chiffres et + seulement). */
export const lienTel = (numero: string) => `tel:${numero.replace(/[^0-9+]/g, "")}`;

/**
 * Source d'un numéro, dite sous le bouton « Appeler » (spec 41, invariant 16) : fiche validée par Brainditech, ou
 * « Non vérifié » avec l'origine et la date de lecture (fichier de l'exploitant, page publique).
 */
export function texteSource(c: Contact): string {
  const date = c.lu_le ? ` le ${c.lu_le.split("-").reverse().join("/")}` : "";
  if (c.source === "gtfs") return `Non vérifié : numéro publié par l'exploitant avec ses horaires${date ? `, lu${date}` : ""}`;
  const lieu = siteDe(c.url);
  // Fiche validée : la date de validation et le site d'où elle vient (critère de fin de v1, invariant 16).
  if (c.source === "fiche") return `Fiche validée${date}${lieu ? `, source : ${lieu}` : ""}`;
  return `Non vérifié : lu sur ${lieu ?? "une page publique"}${date}`;
}

/** « www.pagesjaunes.fr », ou null pour une URL absente ou illisible. */
export function siteDe(url: string | null | undefined): string | null {
  try {
    return url ? new URL(url).hostname : null;
  } catch {
    return null;
  }
}
