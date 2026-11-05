import type { z } from "zod";

import { schemaReponseItineraires, type ReponseItineraires } from "./api";

/**
 * Réponse de `/v1/itineraires` relevée sur le MOTIS national le 2026-11-04 (Châtelet → Pont de Rungis), réduite.
 * Relevée avant la marge de D68 : la montée est donc sans marge. Champs de l'issue 0010 ajoutés à la main.
 */
const BRUTE: z.input<typeof schemaReponseItineraires> = {
  verdict: "possible",
  demande: { date: "2026-11-13", heure: "07:00", sens: "partir", marge: null, limite: null },
  arrivee: { nom: "Pont de Rungis", adresse: null },
  possibilites: [
    {
      depart: "07:01",
      arrivee: "07:30",
      depart_utc: "2026-11-13T06:01:00.000Z",
      arrivee_utc: "2026-11-13T06:30:00.000Z",
      duree_minutes: 29,
      correspondances: 0,
      montee: { arriver_a: "07:05", vehicule: "07:05", marge_minutes: 0 },
      etapes: [
        {
          mode: "marche",
          mode_motis: "WALK",
          ligne: null,
          direction: null,
          numero: null,
          reservation: null,
          exploitant: null,
          de: { nom: "Départ", type: "depart", arret: null, lat: 48.85835, lon: 2.34849 },
          a: { nom: "Châtelet", type: "station", arret: "IDFM:21959", lat: 48.859865, lon: 2.346175 },
          depart: "07:01",
          arrivee: "07:05",
          duree_minutes: 4,
          distance_metres: 58,
          etat: "prevu",
          source: { type: "osm", jeu: "osm", version: "2026-11-04" },
        },
        {
          mode: "metro",
          mode_motis: "SUBWAY",
          ligne: "14",
          direction: "Aéroport d'Orly",
          numero: null,
          reservation: null,
          exploitant: "RATP",
          de: { nom: "Châtelet", type: "station", arret: "IDFM:21959", lat: 48.859865, lon: 2.346175 },
          a: { nom: "Thiais - Orly (Pont de Rungis)", type: "station", arret: "IDFM:490833", lat: 48.747188, lon: 2.372761 },
          depart: "07:05",
          arrivee: "07:27",
          duree_minutes: 22,
          distance_metres: null,
          etat: "prevu",
          source: {
            type: "gtfs",
            jeu: "r80921",
            version: "2026-10-29",
            trip_id: "IDFM:RATP:COU_RATP_14JOFOX02_2026_Pl1404Pl1410-4",
            date_service: "2026-11-13",
            fin_validite: "2026-12-31",
          },
        },
        {
          mode: "marche",
          mode_motis: "WALK",
          ligne: null,
          direction: null,
          numero: null,
          reservation: null,
          exploitant: null,
          de: { nom: "Thiais - Orly (Pont de Rungis)", type: "station", arret: "IDFM:490833", lat: 48.747188, lon: 2.372761 },
          a: { nom: "Arrivée", type: "arrivee", arret: null, lat: 48.74803, lon: 2.37267 },
          depart: "07:27",
          arrivee: "07:30",
          duree_minutes: 3,
          distance_metres: 133,
          etat: "prevu",
          source: { type: "osm", jeu: "osm", version: "2026-11-04" },
        },
      ],
    },
  ],
};

/** Lue par le schéma de l'app : sans tracé ni consignes (relevée avant la spec 11), ils valent null. */
export const REPONSE_CHATELET: ReponseItineraires = schemaReponseItineraires.parse(BRUTE);
