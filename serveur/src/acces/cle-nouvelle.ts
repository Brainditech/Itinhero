import { empreinte, nouvelleCle } from "./cle.js";

/**
 * `npm run cle:nouvelle` (D55) : lancé par Brainditech, jamais par Claude.
 * La clé va sur le téléphone (spec 10) ; l'empreinte va dans CLES_APPAREILS du .env.
 */
const cle = nouvelleCle();
console.log(`Clé (à saisir sur le téléphone, à ne jamais versionner) : ${cle}`);
console.log(`Empreinte (à ajouter à CLES_APPAREILS, séparée par une virgule) : ${empreinte(cle)}`);
