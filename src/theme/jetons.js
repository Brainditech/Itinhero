// Jetons du design system (design/design-system.md, D30). Source unique :
// lue par tailwind.config.js (classes NativeWind) et par le code quand une
// couleur doit passer en prop (icônes). Toute valeur changée passe par une décision.

const couleurs = {
  fond: "#FFFFFF",
  surface: "#F4F5F8",
  texte: "#14161F",
  "texte-secondaire": "#4A5063",
  "bordure-champ": "#8A90A0",
  "bordure-carte": "#D5D8E0",
  primaire: "#3730A3",
  "primaire-presse": "#2A2480",
  "primaire-doux": "#ECEBFA",
  sombre: "#1F2937",
  "mode-train": "#1F5FA8",
  "mode-car": "#7B3FA0",
  "mode-tad": "#0E7472",
  "mode-marche": "#5B6170",
  "mode-taxi": "#2E2E38",
  "desactive-fond": "#E4E6EC",
  "desactive-texte": "#8A90A0",
  erreur: "#B91C1C",
};

const polices = {
  inter: ["Inter_400Regular"],
  "inter-medium": ["Inter_500Medium"],
  "inter-semibold": ["Inter_600SemiBold"],
  "inter-bold": ["Inter_700Bold"],
};

const tailles = {
  "heure-depart": "40px",
  verdict: "24px",
  "titre-ecran": "22px",
  "titre-carte": "20px",
  corps: "18px",
  secondaire: "16px",
  badge: "14px",
};

const rayons = {
  carte: "24px",
  bouton: "16px",
  champ: "12px",
  bulle: "20px",
};

// Ombre des cartes flottantes : flou 12, décalage vertical 4, #14161F à 8 %.
const ombreFlottante = "0px 4px 12px rgba(20, 22, 31, 0.08)";

// Voile blanc posé sur le fond de carte (opacité), à ajuster à l'œil.
const voile = 0.3;

module.exports = { couleurs, polices, tailles, rayons, ombreFlottante, voile };
