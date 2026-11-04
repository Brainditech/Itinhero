import { createContext, use, useMemo, type ReactNode } from "react";

import { clientApi, type ClientApi } from "@/domaine/api";

// Session de l'app (spec 10) : adresse de l'API (EXPO_PUBLIC_API_URL) et clé d'appareil (D64).
// Une seule source pour le client : chaque écran appelle l'API par lui.

type Session = {
  urlApi: string;
  /** Client authentifié ; null tant qu'aucune clé n'est enregistrée. */
  client: ClientApi | null;
  /** Garde la clé après vérification par le serveur. */
  garderCle: (cle: string) => Promise<void>;
  /** Efface la clé (401, ou « Remplacer la clé ») : l'écran de la clé revient. */
  oublierCle: () => Promise<void>;
};

const ContexteSession = createContext<Session | null>(null);

export function FournisseurSession({
  urlApi,
  cle,
  garderCle,
  oublierCle,
  children,
}: {
  urlApi: string;
  cle: string | null;
  garderCle: (cle: string) => Promise<void>;
  oublierCle: () => Promise<void>;
  children: ReactNode;
}) {
  const valeur = useMemo<Session>(
    () => ({
      urlApi,
      client: cle ? clientApi({ urlApi, cle, fetch: (url, init) => fetch(url, init) }) : null,
      garderCle,
      oublierCle,
    }),
    [urlApi, cle, garderCle, oublierCle],
  );
  return <ContexteSession value={valeur}>{children}</ContexteSession>;
}

export function useSession(): Session {
  const s = use(ContexteSession);
  if (!s) throw new Error("useSession hors de FournisseurSession");
  return s;
}

/** Client authentifié ; l'écran qui l'appelle n'est ouvert que si la clé existe (Stack.Protected). */
export function useClient(): ClientApi {
  const { client } = useSession();
  if (!client) throw new Error("Aucune clé d'appareil : l'écran de la clé aurait dû s'ouvrir.");
  return client;
}
