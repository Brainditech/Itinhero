# Issue 0004 — Formulaire : « Chercher » caché par le clavier, retour d'Android qui quitte l'app

> Ouverte le 2026-11-03. État : **close le 2026-11-03.** Analyse approuvée par Brainditech (« ok »), corrections appliquées, constatées sur son téléphone : « Chercher » visible au-dessus du clavier (capture adb 21:53), retour vers l'Accueil après le lien profond (Brainditech : « c'est bon »).
> Branche : `phase-1/formulaire-repli` (spec 02), constaté par Brainditech sur son téléphone (development build) avant la PR.

## A. « Chercher » caché par le clavier

### Reproduction

1. Ouvrir le formulaire (avec le bandeau : `itinhero://formulaire?raison=indisponible`).
2. Toucher le champ Lieu : le clavier s'ouvre.
3. Le bouton « Chercher » est sous le clavier ; seul son bord dépasse (capture de Brainditech, 2026-11-03 21:37).

### Hypothèse (une seule)

« Chercher » est **dans** la liste qui défile (`ScrollView`, `formulaire.tsx`). Quand le clavier s'ouvre, la liste rétrécit jusqu'au haut du clavier, comme prévu, et le bouton, dernier élément de la liste, passe sous le bord : il faut faire défiler pour le voir.

### Correction proposée

Sortir « Chercher » de la liste et le poser juste dessous, comme sur l'Accueil. Clavier fermé, il reste collé sous la carte du formulaire (maquette). Clavier ouvert, c'est la liste qui rétrécit, et le bouton reste posé sur le clavier.

## B. Le retour d'Android quitte l'app (elle passe en arrière-plan)

### Reproduction

1. Ouvrir le formulaire par le lien profond `itinhero://formulaire?raison=indisponible` (test du bandeau).
2. Appuyer sur le bouton retour d'Android.
3. L'app disparaît de l'écran (arrière-plan) au lieu de revenir à l'Accueil.

### Hypothèse (une seule)

Ouvert par un lien profond, le formulaire est le **seul** écran de la pile `(chercher)` : l'Accueil n'est pas dessous, donc le retour n'a rien à dépiler et Android met l'app en arrière-plan. La pile n'a pas d'écran par défaut (`anchor`).

Vérification : par le lien « Remplir un formulaire à la place » de l'Accueil, le retour doit, lui, revenir à l'Accueil (l'Accueil est alors dans la pile).

### Correction proposée

Doc Expo Router (« Router settings », lue le 2026-11-03) : `export const unstable_settings = { anchor: "index" }` dans `src/app/(onglets)/(chercher)/_layout.tsx`. « Deep linking directly to `/other` … still shows a back arrow that leads to `/` » : ouvert par lien profond, le formulaire a l'Accueil dessous. (`initialRouteName` est déprécié au profit d'`anchor`.)

## Test de régression

Navigation et clavier natifs : pas de test vitest possible. Preuve : constat de Brainditech sur le téléphone (clavier ouvert : « Chercher » visible ; lien profond puis retour : Accueil).
