import "../../global.css";

import { useCallback, useEffect, useState } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";

import { ConfigurationIncomplete } from "@/composants/ConfigurationIncomplete";
import { lireEnvironnement } from "@/domaine/environnement";
import { FournisseurSession } from "@/session";
import { preparerNotifications } from "@/rappels";
import { inscrireReleve } from "@/temps-reel";
import { effacerCle, enregistrerCle, lireCle } from "@/stockage/cle";
import { migrer, NOM_BASE } from "@/stockage/reglages";

SplashScreen.preventAutoHideAsync();

// Lue une fois au démarrage (spec 10, §4.3). Expo n'inline la variable qu'écrite en toutes lettres.
const ENVIRONNEMENT = lireEnvironnement({ EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL });

// Spec 30 : les rappels s'affichent aussi app ouverte.
preparerNotifications();

export default function RootLayout() {
  const [policesChargees, erreurPolices] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  // undefined : pas encore lue ; null : aucune clé enregistrée.
  const [cle, setCle] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    lireCle().then(setCle, () => setCle(null));
  }, []);

  // Spec 42 (D123) : relève de fond de l'état des trajets du moment, une fois la clé connue.
  useEffect(() => {
    if (cle) void inscrireReleve();
  }, [cle]);

  const pret = (policesChargees || !!erreurPolices) && cle !== undefined;
  useEffect(() => {
    if (pret) SplashScreen.hideAsync();
  }, [pret]);

  const garderCle = useCallback(async (nouvelle: string) => {
    await enregistrerCle(nouvelle);
    setCle(nouvelle);
  }, []);
  const oublierCle = useCallback(async () => {
    await effacerCle();
    setCle(null);
  }, []);

  if (!pret) return null;

  if (!ENVIRONNEMENT.ok) return <ConfigurationIncomplete message={ENVIRONNEMENT.message} />;

  // D64 : sans clé, seul l'écran de la clé est ouvert ; avec, l'app entière, et plus l'écran de la clé.
  return (
    <SQLiteProvider databaseName={NOM_BASE} onInit={migrer}>
      <FournisseurSession urlApi={ENVIRONNEMENT.env.urlApi} cle={cle} garderCle={garderCle} oublierCle={oublierCle}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={!!cle}>
            <Stack.Screen name="(onglets)" />
            <Stack.Screen name="domicile" />
          </Stack.Protected>
          <Stack.Protected guard={!cle}>
            <Stack.Screen name="cle" />
          </Stack.Protected>
        </Stack>
      </FournisseurSession>
    </SQLiteProvider>
  );
}
