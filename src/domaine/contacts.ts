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
  if (c.source === "fiche") return `Fiche validée${date}`;
  let site = "une page publique";
  try {
    if (c.url) site = new URL(c.url).hostname;
  } catch {
    // URL illisible : on garde « une page publique ».
  }
  return `Non vérifié : lu sur ${site}${date}`;
}
