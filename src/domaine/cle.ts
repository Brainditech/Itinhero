// Clé d'appareil (D55, D64) : 32 octets en base64url, soit 43 caractères sans remplissage.

const FORMAT = /^[A-Za-z0-9_-]{43}$/;

export const MESSAGES_CLE = {
  vide: "Saisissez la clé.",
  format: "Cette clé n'a pas le bon format : 43 lettres, chiffres, - ou _.",
  refusee: "Cette clé est refusée par le serveur.",
  injoignable: "Le serveur ne répond pas. La clé n'est pas enregistrée.",
  erreur: "La vérification a échoué. La clé n'est pas enregistrée.",
  tropDeDemandes: "Trop de demandes. Réessayez dans une minute.",
} as const;

/** Retire les espaces (copier-coller) puis vérifie le format ; ne recopie jamais la clé dans le message. */
export function normaliserCle(saisie: string): { ok: true; cle: string } | { ok: false; message: string } {
  const cle = saisie.replace(/\s+/g, "");
  if (cle === "") return { ok: false, message: MESSAGES_CLE.vide };
  if (!FORMAT.test(cle)) return { ok: false, message: MESSAGES_CLE.format };
  return { ok: true, cle };
}
