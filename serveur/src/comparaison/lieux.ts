import { appNationale } from "../national/app-nationale.js";

/**
 * Comparaison des recherches de lieux (spec 09), par la route `/v1/lieux`, MOTIS national + IGN.
 * Usage : npm run build && node dist/comparaison/lieux.js
 */
const PARIS = "48.8566,2.3522";
const CAS: [string, string | undefined][] = [
  ["Tour Eiffel", PARIS], ["Sacré-Cœur", PARIS], ["Place de la République", PARIS], ["10 rue de Rivoli", PARIS],
  ["Aéroport d'Orly", PARIS], ["Gare d'Auxerre", "47.80,3.57"], ["19 route de Chamvres Joigny", undefined],
  ["Cathédrale de Strasbourg", "48.58,7.75"], ["tribunal judiciaire Dijon", undefined], ["Hôpital de Sens", undefined],
  ["restaurant chinois", PARIS], ["docteur Martin", undefined], ["mairie de Brienon", undefined], ["Châtelet", PARIS],
  ["Gare de Lyon", PARIS], ["Mont-Saint-Michel", undefined], ["pharmacie", "47.80,3.57"],
  ["restaurant chinois", "48.8295,2.3561"], ["pizzeria", "47.80,3.57"], ["boulangerie", "47.9918,3.617"], ["médecin", "47.9918,3.617"],
];
const { app, entete } = await appNationale();
for (const [q, proche] of CAS) {
  const qs = new URLSearchParams({ q, ...(proche ? { proche } : {}) });
  const r = await app.inject({ method: "GET", url: `/v1/lieux?${qs}`, headers: entete });
  const c = (r.json().candidats ?? []) as { nom: string; commune: string | null; source: string; type: string }[];
  console.log(`== ${q}${proche ? ` (près de ${proche})` : ""}`);
  for (const x of c.slice(0, 3)) console.log(`   ${x.source.padEnd(5)} ${x.type.padEnd(7)} ${x.nom} — ${x.commune ?? "?"}`);
}
await app.close();
