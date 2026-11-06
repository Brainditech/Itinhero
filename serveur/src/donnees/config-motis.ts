/**
 * Configuration MOTIS v2.11.4 nationale (spec 08), et ses flux temps réel (spec 42, D123).
 * docs/setup.md du tag v2.11.4 : `rt: [{url}]` par jeu, `update_interval` (s) pour la relève.
 */
export const TEMPS_REEL: Record<string, string[]> = {
  // transport.data.gouv.fr, jeu « horaires-sncf » : GTFS-RT des TER, Intercités et TGV (R3 : cars TER à constater).
  "horaires-sncf": ["https://proxy.transport.data.gouv.fr/resource/sncf-gtfs-rt-trip-updates"],
};

/** Relève du temps réel, en secondes. */
export const RELEVE_TEMPS_REEL_SECONDES = 60;

export function configMotis(jeux: { etiquette: string; jeu: string }[], osm: string): string {
  const lignes = jeux
    .map((c) => {
      const rt = TEMPS_REEL[c.jeu];
      const flux = rt ? `\n      rt:\n${rt.map((u) => `        - url: ${u}`).join("\n")}` : "";
      return `    ${c.etiquette}:  # ${c.jeu.slice(0, 60)}\n      path: /donnees/gtfs/${c.etiquette}.zip${flux}`;
    })
    .join("\n");
  return `# Configuration MOTIS v2.11.4 nationale, générée par serveur/src/donnees/config-motis.ts (spec 08, spec 42).
# Ne pas modifier à la main : relancer \`npm run donnees:nationales\` ou \`npm run donnees:config\`.
server:
  port: 8080
osm: /donnees/osm/${osm}
timetable:
  first_day: TODAY
  num_days: 90
  max_footpath_length: 50      # D42
  merge_dupes_intra_src: true
  merge_dupes_inter_src: true
  update_interval: ${RELEVE_TEMPS_REEL_SECONDES}          # spec 42 : relève du GTFS-RT
  datasets:
${lignes}
street_routing: true
osr_footpath: true
geocoding: true
`;
}
