import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Clé d'appareil (D55) : 32 octets aléatoires en base64url (43 caractères).
 * Le serveur ne connaît que l'empreinte sha256 (hexadécimal) de chaque clé.
 */
const FORMAT_CLE = /^[A-Za-z0-9_-]{43}$/;

export function nouvelleCle(): string {
  return randomBytes(32).toString("base64url");
}

export function empreinte(cle: string): string {
  return createHash("sha256").update(cle, "utf8").digest("hex");
}

/**
 * Empreinte de la clé portée par l'en-tête `Authorization: Bearer <clé>` si elle est autorisée,
 * sinon null (absente, mal formée ou inconnue : même résultat, aucun indice pour l'appelant).
 */
export function empreinteAutorisee(entete: string | undefined, empreintes: readonly string[]): string | null {
  if (!entete) return null;
  const m = /^Bearer ([^\s]+)$/.exec(entete);
  if (!m || !FORMAT_CLE.test(m[1]!)) return null;
  const recue = Buffer.from(empreinte(m[1]!), "hex");
  let trouvee: string | null = null;
  for (const e of empreintes) {
    // Toutes les empreintes sont comparées, en temps constant.
    if (timingSafeEqual(recue, Buffer.from(e, "hex"))) trouvee = e;
  }
  return trouvee;
}
