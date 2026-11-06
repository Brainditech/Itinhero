import { requireOptionalNativeModule } from "expo";

import type { PieceJointe } from "@/domaine/discussion";

/**
 * Pièces jointes de l'Assistant (spec 45, D126) : une photo (galerie ou appareil), réduite à 1600 px de large en JPEG
 * pour tenir sous 1,5 Mo, ou un PDF de 2 Mo au plus. Rien n'est gardé : la pièce part avec le message, puis s'oublie.
 * Les modules natifs n'existent qu'après le development build de la spec 45 : sans eux, le bouton ne s'affiche pas.
 */
export const LARGEUR_IMAGE = 1600;
export const IMAGE_MAX_OCTETS = 1_500_000;
export const PDF_MAX_OCTETS = 2_000_000;

export type PieceChoisie = PieceJointe & { nom: string };
export type IssuePiece = { etat: "ok"; piece: PieceChoisie } | { etat: "annule" } | { etat: "trop_lourd" } | { etat: "refuse" };

type Modules = {
  picker: typeof import("expo-image-picker");
  manipulateur: typeof import("expo-image-manipulator");
  documents: typeof import("expo-document-picker");
  fichiers: typeof import("expo-file-system");
};
let modules: Modules | null | undefined;

function charger(): Modules | null {
  if (modules === undefined) {
    const presents = ["ExponentImagePicker", "ExpoImageManipulator", "ExpoDocumentPicker"].every((n) => requireOptionalNativeModule(n));
    if (!presents) {
      modules = null;
      return null;
    }
    try {
      modules = {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- chargement paresseux voulu (module natif absent)
        picker: require("expo-image-picker") as Modules["picker"],
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- idem
        manipulateur: require("expo-image-manipulator") as Modules["manipulateur"],
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- idem
        documents: require("expo-document-picker") as Modules["documents"],
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- idem
        fichiers: require("expo-file-system") as Modules["fichiers"],
      };
    } catch {
      modules = null;
    }
  }
  return modules;
}

export function piecesJointesDisponibles(): boolean {
  return charger() !== null;
}

/** Taille réelle d'un texte base64. */
export const octetsBase64 = (b64: string) => Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);

/** Revue : toute erreur native (image illisible, pas d'appareil photo, fichier inaccessible) ⇒ « refuse », jamais une promesse rejetée. */
async function sansErreur(f: () => Promise<IssuePiece>): Promise<IssuePiece> {
  try {
    return await f();
  } catch {
    return { etat: "refuse" };
  }
}

export function choisirPhoto(source: "galerie" | "appareil"): Promise<IssuePiece> {
  return sansErreur(() => photo(source));
}

export function choisirPdf(): Promise<IssuePiece> {
  return sansErreur(pdf);
}

async function photo(source: "galerie" | "appareil"): Promise<IssuePiece> {
  const m = charger();
  if (!m) return { etat: "refuse" };
  if (source === "appareil" && !(await m.picker.requestCameraPermissionsAsync()).granted) return { etat: "refuse" };
  const options = { mediaTypes: ["images" as const], quality: 1, allowsEditing: false };
  const r = source === "galerie" ? await m.picker.launchImageLibraryAsync(options) : await m.picker.launchCameraAsync(options);
  if (r.canceled || !r.assets[0]) return { etat: "annule" };
  const a = r.assets[0];
  // Revue : le côté le plus long ramené à 1600 px (un scan en hauteur aussi), par l'API non dépréciée du SDK 58.
  const contexte = m.manipulateur.ImageManipulator.manipulate(a.uri);
  if (Math.max(a.width, a.height) > LARGEUR_IMAGE) {
    contexte.resize(a.width >= a.height ? { width: LARGEUR_IMAGE } : { height: LARGEUR_IMAGE });
  }
  const rendue = await contexte.renderAsync();
  const reduite = await rendue.saveAsync({ compress: 0.7, format: m.manipulateur.SaveFormat.JPEG, base64: true });
  if (!reduite.base64) return { etat: "refuse" };
  if (octetsBase64(reduite.base64) > IMAGE_MAX_OCTETS) return { etat: "trop_lourd" };
  return { etat: "ok", piece: { type: "image", media_type: "image/jpeg", donnees: reduite.base64, nom: a.fileName ?? "Photo" } };
}

/** Octets ⇒ base64, par morceaux (pas de pile trop profonde pour `String.fromCharCode`). */
function versBase64(octets: Uint8Array): string {
  let binaire = "";
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(binaire);
}

async function pdf(): Promise<IssuePiece> {
  const m = charger();
  if (!m) return { etat: "refuse" };
  const r = await m.documents.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true, multiple: false });
  if (r.canceled || !r.assets[0]) return { etat: "annule" };
  const a = r.assets[0];
  if ((a.size ?? 0) > PDF_MAX_OCTETS) return { etat: "trop_lourd" };
  const octets = await new m.fichiers.File(a.uri).bytes();
  if (octets.length > PDF_MAX_OCTETS) return { etat: "trop_lourd" };
  return { etat: "ok", piece: { type: "pdf", media_type: "application/pdf", donnees: versBase64(octets), nom: a.name } };
}
