# Prompts d'image — planche des écrans et design system d'Itinhero

> Rédigé par Claude le 2026-11-02 à partir de `PLAN.md` (Prérequis — Maquettes, phases 1 à 7), `docs/decisions/0001-cadrage-v1.md` (D24, D28, A2, A18) et `docs/04-dissection/`.
> Brainditech les donne au générateur d'images (A18), un prompt par image. Les images reviennent dans `design/`.
> Les prompts sont en anglais ; tout le texte visible dans les images est en français et doit être recopié tel quel.
> Contrastes de la palette calculés le 2026-11-02 (formule WCAG 2.x).

---

## Prompt 1 — Planche des écrans

### 1. The app

Itinhero is an Android app that tells a complete beginner, in one sentence, whether they can reach a fixed-time appointment by public transport from a rural village, and exactly when to leave.

What the app lets the user do (and nothing else):
- Type or dictate (with the Android keyboard's own microphone key) one sentence such as « jeudi 10h RDV à Joigny ».
- Use a plain form instead (place, date, time, « Arriver avant » / « Partir à », margin) when the sentence cannot be understood.
- Start from home by default, or « Depuis ma position ».
- Confirm the destination when several places match.
- Read a verdict for the exact day asked (« possible » or « impossible »), with the departure time and the safety margin (10 min by default) stated in the sentence.
- Sort the possibilities: arrivée la plus tôt, moins cher, moins de marche, sans réservation.
- Compare every possibility, including a door-to-door taxi; each price comes from a source or reads « prix non publié ».
- Open a trip as a vertical timeline (one block per leg) with a map of the stops and the walking path.
- See a warning on any walk longer than 15 min, with a taxi option for that leg (or « aucun numéro connu »).
- Save a trip on the phone and open it without network.
- Get local reminders (the day before, the booking deadline, « partez dans N min »).
- Get a push alert when a ride is cancelled, delayed by 5 min or more, or when a connection becomes shorter than the computed walk.
- Set home, tick owned discount cards (the displayed price becomes the price actually paid).

There is no login, no account, no subscription, no payment, no ticket booking, no social feature, no onboarding carousel, no step-by-step live navigation.

### 2. Presentation

- One 16:9 landscape board, flat light-grey background (#ECEEF2), no perspective, no hands, no desk, no shadows heavier than a soft 8 px blur.
- Eight identical Android phone frames (modern flat-edged Android phone, thin black bezel, centered punch-hole camera, 9:19.5 screen, Android status bar showing 06:12, battery, network), arranged in a regular grid of 2 rows × 4 columns spread across the full width of the board, equal gaps, all frames the same size, perfectly aligned, nothing overlapping, nothing cropped.
- Above each phone, a small grey caption with its number and name (« 1 · Accueil »…).
- All text must be real, correctly spelled French, sharp and legible; no lorem ipsum, no fake glyphs. If space is tight, show fewer elements rather than smaller text.

### 3. Design Style

Decisions:
- On every screen, the first thing the eye lands on is the trip verdict and the departure time. The departure time is the largest text on the screen (about 40 sp, bold); the verdict sentence sits right next to it (about 24 sp).
- The user is a complete beginner: exactly one primary action per screen, shown as a single full-width filled button (56 dp high) at the bottom of the content; every other action is a text link or an outlined button.
- Large type everywhere: body text 18 sp minimum, secondary text 16 sp minimum, no text under 14 sp (status-bar and map attribution excepted).
- Light mode first: white screens, dark text. No dark-mode screen on this board.
- Contrast AA everywhere: 4.5:1 for text, 3:1 for icons and borders. Layouts must survive system font scaling to 200 % (A2): no text inside fixed-height pills that would clip, labels wrap instead of truncating.
- Color is never the only signal: every mode has an icon and a word, every status has an icon and a word.
- Generous spacing on an 8 dp grid; 16 dp side margins; cards with 16 dp corner radius and a 1 dp border (#D5D8E0), no drop shadow.
- Icons: simple rounded outline icons, 24 dp, one consistent set (car/coach, train, walking person, taxi, phone-call, clock, warning triangle, map pin, home, location arrow, gear, bookmark).
- Bottom tab bar with three tabs: « Chercher », « Mes trajets », « Réglages ».
- Wordmark: the word « Itinhero » set in the UI typeface, semibold, primary color, top-left of the Accueil screen only. No pictorial logo (the logo is a separate later step).

NOT:
- not cluttered: no more than one card group and one primary button visible per screen section;
- no decorative photo, no illustration of a city, no people, no mascot, no 3D render;
- no travel-agency or booking-site look: no promo banners, no hotel or car-rental tiles, no « dès 19 € » price teasers, no stars or reviews;
- no gradient backgrounds, no glassmorphism, no neon;
- no full-screen map as the entry point;
- no colors, logos, icons or typefaces of SNCF Connect, Transit or Mobigo (no dark navy-and-cyan theme, no Transit green, no Mobigo green-and-orange), no Uber logo;
- no invented numbers: any value not listed below must not appear.

### 4. Color Palette

Our own identity (indigo brand, neutral greys, distinct mode hues kept away from status hues). All pairs below pass WCAG AA (ratio measured).

Base:
- Background #FFFFFF · surface (grouped areas, form fields) #F4F5F8 · board background #ECEEF2
- Text primary #14161F (18.0:1 on white) · text secondary #4A5063 (8.0:1 on white, 7.4:1 on #F4F5F8)
- Border #8A90A0 for field outlines (3.2:1) · divider and card border #D5D8E0 (decorative only)
- Primary (brand, primary button, links, selected tab) #3730A3, white text on it (9.9:1) · pressed #2A2480

Transport modes (used as solid block fill in the timeline with white text, and as icon color on white):
- Train: #1F5FA8 (6.4:1 with white)
- Car (coach, « car TER »): #7B3FA0 (6.9:1)
- Transport à la demande: #0E7472 (5.6:1)
- Marche: #5B6170 (6.2:1), drawn as a dotted line, never as a solid block
- Taxi: #2E2E38 (13.4:1)

Statuses (pill badge: dark text on light tint, with icon):
- « À l'heure » (live, on time): text #166534 on #DCFCE7 (6.5:1), icon of radio waves; plain text variant #15803D on white (5.0:1)
- « Retard » : text #92400E on #FEF3C7 (6.4:1), clock icon with « + » ; plain variant #B45309 on white (5.0:1). Also used for the ⚠ long-walk warning.
- « Supprimé » : text #991B1B on #FEE2E2 (6.8:1), crossed-circle icon; plain variant #B91C1C on white (6.5:1)
- « Horaire prévu, sans suivi en direct » : text #3F4654 on #EEF0F3 (8.3:1), outline clock icon (no waves)
- « Prix non publié » : text #374151 on white (10.3:1), transparent pill with a 1.5 dp dashed border #8A90A0, euro icon
- Offline banner: white text on #1F2937 (14.7:1)

### 5. Typography

- One sans-serif family only: Inter (Regular 400, Medium 500, Semibold 600, Bold 700).
- All times and durations use tabular figures (Inter « tnum »), so 06:27, 08:50 and 09:09 align in columns. Time format 24 h with a colon: « 06:27 ».
- Scale: departure time 40 sp Bold · verdict 24 sp Semibold · screen title 22 sp Semibold · card title 20 sp Semibold · body 18 sp Regular · secondary 16 sp Regular · badge 14 sp Medium.
- Sentence case everywhere, no all-caps labels.

### 6. Screens

Reference scenario everywhere: from home in Brienon-sur-Armançon to rendez-vous in Joigny, Thursday 12/11/2026, appointment at 10:00, default margin 10 min. The chosen route: coach (car TER K941) 06:27 Brienon-sur-Armançon Mairie → 06:37 Saint-Florentin-Ville, walk ≈ 2,8 km to the Saint-Florentin-Vergigny station, train 08:50 Saint-Florentin-Vergigny → 09:09 Joigny, walk ≈ 1,1 km to the agency. Schedules come from the 18/10 dataset. No price is published for these legs. Show « — » where a duration is not known; never fill it.

**1 · Accueil**
- Top-left wordmark « Itinhero ».
- Large multiline text field (surface #F4F5F8, 2 lines visible) labelled « Où devez-vous être, et quand ? », already filled with « jeudi 10h RDV à Joigny », text cursor at the end.
- Below it, a starting-point row: chip « Depuis : Domicile » selected, chip « Depuis ma position » unselected.
- Text link « Remplir un formulaire à la place ».
- Primary button « Chercher ».
- The Android on-screen keyboard is open at the bottom, its microphone key visible (dictation comes from the keyboard, the app has no microphone button). Tab bar hidden by the keyboard.

**2 · Accueil — formulaire de repli**
- Info banner (surface #F4F5F8, info icon): « La compréhension de phrase est indisponible. Remplissez ces champs. »
- Field « Lieu » : « Rendez-vous Joigny »
- Field « Date » : « jeudi 12/11/2026 »
- Field « Heure » : « 10:00 »
- Segmented control: « Arriver avant » (selected) | « Partir à »
- Field « Marge » : « 10 min »
- Primary button « Chercher ». Tab bar « Chercher » selected.

**3 · Confirmation du lieu**
- Title « Quel lieu ? »
- Recap line under the title, secondary text: « Jeudi 12/11 · arriver avant 10:00 · marge 10 min · depuis Domicile »
- Radio list of two candidate cards:
  - « rendez-vous » / « 19 Route de Chamvres, 89300 Joigny » (selected, primary border)
  - « Joigny » / « Commune, 89300 »
- Text link « Saisir l'adresse moi-même »
- Primary button « C'est ce lieu ». Tab bar « Chercher » selected.

**4 · Résultat**
- Verdict card at the top, white with a 4 dp left bar in #15803D: small label « Jeudi 12/11 », the word « Possible » next to a check icon, then the departure time « Départ 06:27 » in 40 sp Bold, then the sentence « À faire : être sur place avant 09:50 (rendez-vous 10:00, marge 10 min). Arrivée en gare de Joigny à 09:09, puis ≈ 1,1 km à pied. »
- Horizontally scrollable sort chips: « Arrivée la plus tôt » (selected), « Moins cher », « Moins de marche », « Sans réservation ».
- Possibility card 1: « 06:27 → 09:09 Joigny » (tabular), a thin horizontal strip of mode segments (car violet, dotted walk, train blue, dotted walk) with mode icons, line « Car · Marche · Train · Marche », amber row « ⚠ Marche de plus de 15 min », badge « Prix non publié ».
- Possibility card 2: taxi icon, « Taxi de bout en bout », « Durée de route estimée, hors attente : — », badge « Prix non publié », secondary text « Aucun numéro connu ».
- Small secondary footer text « Horaires du 18/10 ».
- Primary button « Voir le trajet » (opens card 1). Tab bar « Chercher » selected.

**5 · Détail — frise verticale et carte**
- Header card: « Partez à 06:27 » (40 sp Bold) and « Arrivée gare de Joigny 09:09 » (20 sp), secondary line « puis ≈ 1,1 km à pied jusqu'à rendez-vous ».
- Map strip (about 25 % of the screen height), light minimal map style: numbered stop pins (Brienon-sur-Armançon Mairie, Saint-Florentin-Ville, Saint-Florentin-Vergigny, Joigny), the walking path as a dotted grey line, the coach and train legs as solid lines in their mode colors; tiny attribution text « © OpenStreetMap » bottom-right.
- Vertical timeline below, with a left column of tabular times aligned to each event:
  - « 06:27 » · solid violet block (white text): coach icon, « Car TER K941 » with a dotted underline on « Car TER » (glossary term on first use), « Montez à Brienon-sur-Armançon Mairie », badge « Horaire prévu, sans suivi en direct », badge « Prix non publié », then « 06:37 · Descendez à Saint-Florentin-Ville ».
  - Dotted grey walking segment: walking icon, « ≈ 2,8 km à pied jusqu'à la gare de Saint-Florentin-Vergigny », amber warning row « ⚠ Marche de plus de 15 min », below it a small taxi row « Taxi pour cette étape : aucun numéro connu ».
  - « 08:50 » · solid blue block (white text): train icon, « Train », « Montez à Saint-Florentin-Vergigny », badge « Prix non publié », then « 09:09 · Descendez à Joigny ».
  - Dotted grey walking segment: « ≈ 1,1 km à pied jusqu'à rendez-vous ».
  - End point: map-pin icon, « Rendez-vous Joigny », « Rendez-vous 10:00 ».
- Primary button « Enregistrer ce trajet ». Tab bar « Chercher » selected.

**6 · Mes trajets**
- Title « Mes trajets ».
- Offline banner across the top (white on #1F2937): « Hors connexion · dernier état connu affiché »
- One saved trip card: « Jeudi 12/11 », « Départ 06:27 » in 40 sp Bold, « Brienon-sur-Armançon → Rendez-vous Joigny », badge « Horaire prévu, sans suivi en direct », two small check rows « Disponible sans réseau » and « Carte enregistrée », then a reminders block « Rappels : la veille · avant le départ ».
- Primary button « Ouvrir le trajet ». Tab bar « Mes trajets » selected.

**7 · Réglages**
- Title « Réglages ».
- Section « Domicile » : home icon, « Brienon-sur-Armançon », text link « Modifier ».
- Section « Cartes de réduction » : checkbox row checked « Carte TRAIN Mobigo Solidaire », secondary text « −75 % sur les trains Mobigo · le prix affiché devient celui que vous payez ».
- Section « Position » : switch « Depuis ma position » off, secondary text « Utilisée seulement quand l'app est ouverte, à votre demande. »
- Footer note, secondary text with a lock icon: « Vos réglages et vos trajets enregistrés sont gardés sur ce téléphone. Pour vous alerter, le serveur garde seulement le trajet suivi, jusqu'au lendemain. »
- Primary button « Enregistrer ». Tab bar « Réglages » selected.

**8 · Notifications (alertes de retard, phase 7)**
- Android lock screen, plain dark-grey wallpaper (no photo), clock « 06:12 », date « jeudi 12 novembre ».
- Three stacked Android notifications from « Itinhero » (small app icon = a plain indigo #3730A3 rounded square with a white « I »), example alerts from a simulated real-time feed:
  - red crossed-circle icon, title « Train 08:50 supprimé », body « Saint-Florentin-Vergigny → Joigny, jeudi 12/11. Ouvrez Itinhero pour voir les autres possibilités. »
  - amber clock icon, title « Retard de 5 min », body « Train 08:50 Saint-Florentin-Vergigny → Joigny. »
  - amber warning icon, title « Correspondance menacée », body « Le temps pour rejoindre le train de 08:50 devient plus court que la marche calculée. »

### 7. Direction

Render a crisp, flat, high-resolution product-design board, like a final Figma export: pixel-sharp text, consistent spacing, identical phone frames, calm indigo-and-grey interface where the verdict and the departure time are always the first thing you read.

---

## Prompt 2 — Design system

### 1. Subject and presentation

The design system of Itinhero, an Android app that tells a complete beginner whether they can reach a fixed-time appointment by public transport from a rural village, and exactly when to leave.

- One separate 16:9 landscape image: a single full-width white sheet titled « Design System · Itinhero », on a flat light-grey background (#ECEEF2), no phone frames, no perspective, no mock-up props.
- Components grouped under small grey headings, laid out in a regular grid of equal columns, each group in its own area, generous gaps, nothing overlapping, nothing cropped.
- All text must be real, correctly spelled French, sharp and legible; no lorem ipsum, no fake glyphs.

### 2. Design Style

Decisions:
- On every screen, the first thing the eye lands on is the trip verdict and the departure time. The departure time is the largest text on the screen (about 40 sp, bold); the verdict sentence sits right next to it (about 24 sp).
- The user is a complete beginner: exactly one primary action per screen, shown as a single full-width filled button (56 dp high) at the bottom of the content; every other action is a text link or an outlined button.
- Large type everywhere: body text 18 sp minimum, secondary text 16 sp minimum, no text under 14 sp (status-bar and map attribution excepted).
- Light mode first: white surfaces, dark text. No dark-mode variant on this sheet.
- Contrast AA everywhere: 4.5:1 for text, 3:1 for icons and borders. Layouts must survive system font scaling to 200 % (A2): no text inside fixed-height pills that would clip, labels wrap instead of truncating.
- Color is never the only signal: every mode has an icon and a word, every status has an icon and a word.
- Generous spacing on an 8 dp grid; 16 dp side margins; cards with 16 dp corner radius and a 1 dp border (#D5D8E0), no drop shadow.
- Icons: simple rounded outline icons, 24 dp, one consistent set (car/coach, train, walking person, taxi, phone-call, clock, warning triangle, map pin, home, location arrow, gear, bookmark).
- Bottom tab bar with three tabs: « Chercher », « Mes trajets », « Réglages ».
- Wordmark: the word « Itinhero » set in the UI typeface, semibold, primary color. No pictorial logo (the logo is a separate later step).

NOT:
- not cluttered;
- no decorative photo, no illustration of a city, no people, no mascot, no 3D render;
- no travel-agency or booking-site look: no promo banners, no hotel or car-rental tiles, no « dès 19 € » price teasers, no stars or reviews;
- no gradient backgrounds, no glassmorphism, no neon;
- no colors, logos, icons or typefaces of SNCF Connect, Transit or Mobigo (no dark navy-and-cyan theme, no Transit green, no Mobigo green-and-orange), no Uber logo;
- no invented numbers: any value not listed below must not appear.

### 3. Color Palette

Our own identity (indigo brand, neutral greys, distinct mode hues kept away from status hues). All pairs below pass WCAG AA (ratio measured).

Base:
- Background #FFFFFF · surface (grouped areas, form fields) #F4F5F8 · board background #ECEEF2
- Text primary #14161F (18.0:1 on white) · text secondary #4A5063 (8.0:1 on white, 7.4:1 on #F4F5F8)
- Border #8A90A0 for field outlines (3.2:1) · divider and card border #D5D8E0 (decorative only)
- Primary (brand, primary button, links, selected tab) #3730A3, white text on it (9.9:1) · pressed #2A2480

Transport modes (used as solid block fill in the timeline with white text, and as icon color on white):
- Train: #1F5FA8 (6.4:1 with white)
- Car (coach, « car TER »): #7B3FA0 (6.9:1)
- Transport à la demande: #0E7472 (5.6:1)
- Marche: #5B6170 (6.2:1), drawn as a dotted line, never as a solid block
- Taxi: #2E2E38 (13.4:1)

Statuses (pill badge: dark text on light tint, with icon):
- « À l'heure » (live, on time): text #166534 on #DCFCE7 (6.5:1), icon of radio waves; plain text variant #15803D on white (5.0:1)
- « Retard » : text #92400E on #FEF3C7 (6.4:1), clock icon with « + » ; plain variant #B45309 on white (5.0:1). Also used for the ⚠ long-walk warning.
- « Supprimé » : text #991B1B on #FEE2E2 (6.8:1), crossed-circle icon; plain variant #B91C1C on white (6.5:1)
- « Horaire prévu, sans suivi en direct » : text #3F4654 on #EEF0F3 (8.3:1), outline clock icon (no waves)
- « Prix non publié » : text #374151 on white (10.3:1), transparent pill with a 1.5 dp dashed border #8A90A0, euro icon
- Offline banner: white text on #1F2937 (14.7:1)

### 4. Typography

- One sans-serif family only: Inter (Regular 400, Medium 500, Semibold 600, Bold 700).
- All times and durations use tabular figures (Inter « tnum »), so 06:27, 08:50 and 09:09 align in columns. Time format 24 h with a colon: « 06:27 ».
- Scale: departure time 40 sp Bold · verdict 24 sp Semibold · screen title 22 sp Semibold · card title 20 sp Semibold · body 18 sp Regular · secondary 16 sp Regular · badge 14 sp Medium.
- Sentence case everywhere, no all-caps labels.

### 5. Sheet content

- « Couleurs » : swatches with hex labels — primary #3730A3, text #14161F, text secondary #4A5063, surface #F4F5F8, border #8A90A0; modes train #1F5FA8, car #7B3FA0, transport à la demande #0E7472, marche #5B6170, taxi #2E2E38; statuses #15803D, #B45309, #B91C1C, #3F4654.
- « Typographie » : « 06:27 » 40 sp Bold, « Possible » 24 sp Semibold, « Titre d'écran » 22 sp, « Texte courant » 18 sp, « Texte secondaire » 16 sp, « Badge » 14 sp, label « Inter · chiffres tabulaires ».
- « Boutons » : primary filled « Chercher », outlined « Modifier », text link « Saisir l'adresse moi-même », disabled primary.
- « Champs » : empty text field with label « Lieu », focused field (primary 2 dp outline), field with error text « Ce champ est obligatoire. » in #B91C1C.
- « Puces » : sort chip selected / unselected, starting-point chip.
- « Carte d'itinéraire » : one compact possibility card — « 06:27 → 09:09 Joigny » (tabular), a thin horizontal strip of mode segments (car violet, dotted walk, train blue, dotted walk) with mode icons, line « Car · Marche · Train · Marche », amber row « ⚠ Marche de plus de 15 min », badge « Prix non publié ».
- « Blocs de la frise » : one block per mode — Train (blue block), Car (violet block), Transport à la demande (teal block with an extra line « Réserver avant — »), Marche (dotted grey segment), Taxi (graphite block with a call button « Appeler »).
- « Badges d'état » : « À l'heure », « Retard + 5 min », « Supprimé », « Horaire prévu, sans suivi en direct », « Prix non publié », « ⚠ Marche de plus de 15 min ».
- « Barre d'onglets » : « Chercher », « Mes trajets », « Réglages », first selected.
- « Feuille modale » : bottom sheet with grab handle, title « Taxi pour cette étape », line « Aucun numéro connu », button « Fermer ».
- « États » : empty state « Aucun trajet enregistré » with outline bookmark icon and link « Chercher un trajet » ; loading state with skeleton cards and « Recherche en cours… » ; error state with warning icon « Le serveur ne répond pas. » and outlined button « Réessayer » ; stale-data banner « Horaires du 18/10 ».

### 6. Direction

Render a crisp, flat, high-resolution design-system sheet, like a final Figma export: pixel-sharp text, consistent spacing, every component labelled, calm indigo-and-grey identity where times always read in tabular figures.

---

## Relances

Valent pour les deux prompts. Après chaque image, envoyer d'abord :

> Critique this image like a senior product designer: list each defect against the brief above.

Puis, pour chaque relance :
1. **Nommer le défaut** précisément (écran, bloc, texte ou couleur fautif, et ce que le brief exigeait).
2. **Garder ce qui marche** : dire explicitement ce qui ne doit pas changer (grille, cadres, palette, écrans déjà justes).
3. **Ne refaire que la partie fautive** : une relance = une correction ciblée, pas une nouvelle génération de toute la planche.
