/**
 * Glossaire (spec 51, D134, D10) : explications fixes, versionnées, à relire par Brainditech. Un mot n'est marqué
 * qu'à sa première occurrence dans les étapes d'un trajet. Claude n'écrit aucun de ces textes à l'exécution.
 */
export const GLOSSAIRE: Record<string, string> = {
  TER: "Train express régional : le train de la région, qui s'arrête aussi dans les petites gares.",
  RER: "Réseau express régional : train d'Île-de-France qui traverse Paris et s'arrête souvent, comme un métro.",
  Car: "Autocar entre les villes et les villages. À l'arrêt, faites signe au conducteur pour qu'il s'arrête.",
  Tram: "Tramway : un train léger qui roule sur des rails, dans la rue.",
  "Transport à la demande": "Bus ou minibus qui ne passe que si on l'a réservé avant, par téléphone ou sur internet.",
  "Train de banlieue": "Train qui relie Paris aux villes autour.",
};

export type Morceau = { texte: string; terme?: string };

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Les plus longs d'abord : « Train de banlieue » avant un mot plus court qui y serait contenu.
const TERMES = Object.keys(GLOSSAIRE).sort((a, b) => b.length - a.length);
// Mot entier, majuscules respectées : « Car » et jamais « carte » ni « Carrefour ».
const MOTIF = new RegExp(`(?<![\\p{L}\\p{N}])(${TERMES.map(echapper).join("|")})(?![\\p{L}\\p{N}])`, "gu");

/** Découpe chaque titre en morceaux ; un mot du glossaire n'est marqué qu'à sa première occurrence dans la liste. */
export function decouperGlossaire(titres: string[]): Morceau[][] {
  const vus = new Set<string>();
  return titres.map((titre) => {
    const morceaux: Morceau[] = [];
    let debut = 0;
    for (const m of titre.matchAll(MOTIF)) {
      const terme = m[1];
      if (vus.has(terme)) continue;
      vus.add(terme);
      if (m.index > debut) morceaux.push({ texte: titre.slice(debut, m.index) });
      morceaux.push({ texte: terme, terme });
      debut = m.index + terme.length;
    }
    if (debut < titre.length || morceaux.length === 0) morceaux.push({ texte: titre.slice(debut) });
    return morceaux;
  });
}
