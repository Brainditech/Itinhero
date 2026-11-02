# Prompts d'image — planche des écrans et design system d'Itinhero

> Rédigé par Claude le 2026-11-02 à partir de `PLAN.md` (Prérequis — Maquettes, phases 1 à 7), `docs/decisions/0001-cadrage-v1.md` (D24, D28, A2, A18) et `docs/04-dissection/`.
> Brainditech les donne au générateur d'images (A18), un prompt par image. Les images reviennent dans `design/`.
> Les prompts sont en anglais ; tout le texte visible dans les images est en français et doit être recopié tel quel.
> Contrastes de la palette calculés le 2026-11-02 (formule WCAG 2.x).
> Restructuré le 2026-11-02 : le générateur n'a pas suivi l'ancien Prompt 1, trop long (dates, prix et écrans inventés). Le Prompt 1 ne fixe plus que le style ; le contenu exact de chaque écran est dans les Prompts 3 à 10.

---

## Référence — ce que fait l'app (contexte, à ne pas envoyer au générateur)

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
- Ask the « Assistant » tab, in plain words, to change a search or a saved trip (date, time, margin, starting point, sort, « moins de marche ») or to get advice for a tricky situation. The assistant turns the request into a new search by the engine and shows the result; it never invents a time, a stop, a price or a phone number, and every change waits for the user's confirmation (D31, proposed).

There is no login, no account, no subscription, no payment, no ticket booking, no social feature, no onboarding carousel, no step-by-step live navigation.

Reference scenario used in Prompts 3 to 10: from home in Brienon-sur-Armançon to rendez-vous in Joigny, Thursday 12/11/2026, appointment at 10:00, default margin 10 min. The chosen route: coach (car TER K941) 06:27 Brienon-sur-Armançon Mairie → 06:37 Saint-Florentin-Ville, walk ≈ 2,8 km to the Saint-Florentin-Vergigny station, train 08:50 Saint-Florentin-Vergigny → 09:09 Joigny, walk ≈ 1,1 km to the agency. Schedules come from the 18/10 dataset. No price is published for these legs. « — » stands where a duration is not known; it is never filled.

---

## Prompt 1 — Planche (style seulement)

A 16:9 landscape board showing the nine screens of « Itinhero », an Android app that tells a complete beginner when to leave for an appointment by public transport.
- Flat light-grey background #ECEEF2. Nine identical Android phones (portrait, thin black bezel, punch-hole camera) in a regular grid across the full width: 5 phones on the top row, 4 phones centered on the bottom row; equal gaps, same size, nothing overlapping, nothing cropped.
- A small grey caption above each phone, in this order: « 1 · Accueil », « 2 · Formulaire de repli », « 3 · Confirmation du lieu », « 4 · Résultat », « 5 · Détail », « 6 · Mes trajets », « 7 · Réglages », « 8 · Notifications », « 9 · Assistant ».
- Light mode: white screens, near-black text #14161F, light-grey fields #F4F5F8, cards with 16 dp rounded corners and a thin #D5D8E0 border, no shadow.
- Brand color indigo #3730A3 for the primary button, links and the selected tab. The wordmark « Itinhero » appears top-left of screen 1 only.
- Transport modes: coach violet #7B3FA0, train blue #1F5FA8, walking as a dotted grey line #5B6170.
- Trip details are a vertical timeline: one solid colored block per ride (violet coach, blue train) joined by dotted grey walking segments, times in a left column.
- Large type: one sans-serif family (Inter), a big bold departure time as the first thing read, body text never small, times in tabular figures.
- Exactly one primary action per screen: a single full-width indigo button at the bottom of the content.
- No empty space at the bottom of a screen: content and button reach down to the bottom tab bar (four tabs).
- Screen 8 is an Android lock screen with three app notifications.
- Nothing cluttered: few elements per screen, generous spacing.
- No text is imposed other than « Itinhero » and the nine captions; any other text stays short, legible, correctly spelled French.
- Forbidden: any price or amount in euros; any date; any microphone button or icon; any screen not in the list (no login, account, subscription, onboarding, payment, full-screen map).
- Also forbidden: decorative photos, illustrations, people, gradients, promo banners, and the colors or logos of SNCF Connect, Transit or Mobigo.
Render a crisp, flat, high-resolution product-design board, like a final Figma export.

---

## Prompt 2 — Design system

> Mis à jour le 2026-11-02 d'après les 9 écrans générés et validés un par un (`design/*/0N-*.png`) : cartes flottantes à coins de 24 dp avec ombre douce sur fond de carte voilé, barre d'onglets flottante à 4 onglets, composants de l'Assistant et bandeau hors connexion. Ne pas coller cette note dans le générateur.

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
- Generous spacing on an 8 dp grid; 16 dp side margins. Screens sit on a light muted map background (pale warm-grey land, white roads, pale blue-grey rivers, no labels) under a 70 % white veil; content lives in floating white cards with 24 dp corners, a 1 dp #D5D8E0 border and a soft 12 px shadow. Buttons and timeline blocks have 16 dp corners, fields 12 dp.
- Icons: simple rounded outline icons, 24 dp, one consistent set (car/coach, train, walking person, taxi, phone-call, clock, warning triangle, map pin, home, location arrow, gear, bookmark, bell, crossed cloud, friendly robot face, send arrow).
- Bottom tab bar floating above the bottom edge: white pill with 24 dp corners and soft shadow, four tabs each with an outline icon above its label: « Chercher », « Mes trajets », « Assistant », « Réglages »; the selected tab has an indigo icon and label on a light indigo #ECEBFA pill.
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
- « Barre d'onglets » : the floating white pill with four tabs, icon above label — « Chercher » (selected, indigo on a light indigo #ECEBFA pill), « Mes trajets », « Assistant » (friendly robot-face icon), « Réglages ».
- « Fond et cartes flottantes » : a small swatch of the veiled light map background with one floating white card on it (24 dp corners, soft shadow), labelled « Fond de carte voilé · carte flottante ».
- « Assistant » : a user bubble (indigo fill, white text) « Je voudrais 20 min d'avance au lieu de 10. », an assistant bubble (white card with a small indigo robot-face avatar) « D'accord. Je relance la recherche avec ces réglages : » with the chip « Marge 20 min » outlined in indigo, a suggestion chip « Moins de marche », and the message bar « Écrivez votre demande » with a round indigo send button.
- « Bandeau hors connexion » : dark #1F2937 floating banner with a crossed-cloud icon, white text « Hors connexion · dernier état connu affiché ».
- « Feuille modale » : bottom sheet with grab handle, title « Taxi pour cette étape », line « Aucun numéro connu », button « Fermer ».
- « États » : empty state « Aucun trajet enregistré » with outline bookmark icon and link « Chercher un trajet » ; loading state with skeleton cards and « Recherche en cours… » ; error state with warning icon « Le serveur ne répond pas. » and outlined button « Réessayer » ; stale-data banner « Horaires du 18/10 ».

### 6. Direction

Render a crisp, flat, high-resolution design-system sheet, like a final Figma export: pixel-sharp text, consistent spacing, every component labelled, calm indigo-and-grey identity where times always read in tabular figures.

---

## Prompts 3 à 11 — un écran par image

Chaque prompt est autonome : ses 4 premières lignes (style commun) sont identiques d'un prompt à l'autre.

### Prompt 3 — Écran 1 · Accueil

> Réécrit le 2026-11-02, inspiré de la capture fournie par Brainditech : la mise en page (champ flottant arrondi en haut, éléments posés sur une carte plein écran) est reprise ; son thème sombre et son accent cuivre ne le sont pas (mode clair, indigo, D30). La carte n'est qu'une image de fond, pas une carte interactive (D9 inchangée). Ne pas coller cette note dans le générateur.

A single Android phone, portrait, flat front view, thin black bezel, centered punch-hole camera, status bar showing 06:12, on a plain light-grey background #ECEEF2; no hands, no props, no other screen.
Light mode: white screen, text #14161F, secondary text #4A5063, fields #F4F5F8, cards with 16 dp corners and a 1 dp #D5D8E0 border, no shadow; one sans-serif (Inter), times in tabular figures, body text 18 sp minimum, departure time 40 sp bold.
Palette: primary indigo #3730A3 (primary button, links, selected tab); modes coach #7B3FA0, train #1F5FA8, on-demand #0E7472, taxi #2E2E38, walking = dotted grey #5B6170; statuses on time #15803D, delay #B45309, cancelled #B91C1C, scheduled #3F4654 on #EEF0F3.
Copy every quoted French text word for word and add no other text, number, price or date; exactly one full-width 56 dp primary button at the bottom of the content, no empty space below it, nothing cluttered.

Screen content (exception to the lines above: elements float over a background image, so floating cards get a soft 12 px shadow):
- Background, full-bleed edge to edge behind the status bar: a light, muted, flat map image of a rural area — pale warm-grey land #EEF0F3, white roads, thin pale blue-grey rivers, faint grey commune borders — with a 70 % white veil on top so every text stays AA. No place names, no labels, no pins except one small indigo #3730A3 dot with a white ring, slightly above the center (home). The map is decoration only: no zoom buttons, no compass, no attribution.
- Top-left, just under the status bar, wordmark « Itinhero » in indigo, semibold, 22 sp.
- Below it, a floating white card, full width minus 16 dp margins, 24 dp corner radius: label « Où devez-vous être, et quand ? » in secondary text, then the multiline input text « jeudi 10h RDV à Joigny » in 20 sp, text cursor at the end, 2 lines visible.
- Inside the same card, under a thin divider, a starting-point row: chip « Depuis : Domicile » selected (indigo fill, white text), chip « Depuis ma position » unselected (white, grey border).
- Under the card, on the map veil: text link « Remplir un formulaire à la place » in indigo.
- Primary button « Chercher », full width, indigo, 56 dp, sitting directly above the keyboard, no gap.
- The Android on-screen keyboard is open at the bottom, its microphone key visible (dictation comes from the keyboard, the app has no microphone button). Tab bar hidden by the keyboard.

### Prompt 4 — Écran 2 · Formulaire de repli

> Réécrit le 2026-11-02 pour reprendre le langage visuel de `design/accueil/01-accueil.png` : même fond de carte voilé, mot « Itinhero », carte blanche flottante à coins de 24 dp, bouton indigo. Ajout : la barre d'onglets flottante, inspirée de la capture de référence. Contenu inchangé. Ne pas coller cette note dans le générateur.

A single Android phone, portrait, flat front view, thin black bezel, centered punch-hole camera, status bar showing 06:12, on a plain light-grey background #ECEEF2; no hands, no props, no other screen.
Light mode: white screen, text #14161F, secondary text #4A5063, fields #F4F5F8, cards with 16 dp corners and a 1 dp #D5D8E0 border, no shadow; one sans-serif (Inter), times in tabular figures, body text 18 sp minimum, departure time 40 sp bold.
Palette: primary indigo #3730A3 (primary button, links, selected tab); modes coach #7B3FA0, train #1F5FA8, on-demand #0E7472, taxi #2E2E38, walking = dotted grey #5B6170; statuses on time #15803D, delay #B45309, cancelled #B91C1C, scheduled #3F4654 on #EEF0F3.
Copy every quoted French text word for word and add no other text, number, price or date; exactly one full-width 56 dp primary button at the bottom of the content, no empty space below it, nothing cluttered.

Screen content (exception to the lines above: elements float over a background image, so floating cards get a soft 12 px shadow and 24 dp corners):
- Background, full-bleed edge to edge behind the status bar: a light, muted, flat map image of a rural area — pale warm-grey land #EEF0F3, white roads, thin pale blue-grey rivers, faint grey commune borders — with a 70 % white veil on top so every text stays AA. No place names, no labels, no pins, no zoom buttons, no compass, no attribution.
- Top-left, just under the status bar, wordmark « Itinhero » in indigo, semibold, 22 sp.
- Below it, a small floating card on #F4F5F8 with an indigo info icon: « La compréhension de phrase est indisponible. Remplissez ces champs. »
- Below it, one floating white card, full width minus 16 dp margins, holding the form, each field with its label above in secondary text and its value in a #F4F5F8 field with a 1 dp #8A90A0 outline and 12 dp corners:
  - « Lieu » : « Rendez-vous Joigny »
  - « Date » : « jeudi 12/11/2026 » and « Heure » : « 10:00 », side by side on one row (tabular figures)
  - segmented control, full width: « Arriver avant » (selected, indigo fill, white text) | « Partir à » (white, grey text)
  - « Marge » : « 10 min »
- Primary button « Chercher », full width minus 16 dp margins, indigo, 56 dp, 16 dp corners, directly under the form card.
- Bottom tab bar floating above the bottom edge: white pill, full width minus 16 dp margins, 24 dp corners, soft shadow, four evenly spaced tabs each with an outline icon above its label — « Chercher » (selected: indigo icon and label on a light indigo #ECEBFA pill), « Mes trajets », « Assistant » (friendly robot-face icon) and « Réglages » (grey #4A5063). No keyboard on this screen.
- The map shows only in the margins and between the button and the tab bar; that gap stays small.

### Prompt 5 — Écran 3 · Confirmation du lieu

> Réécrit le 2026-11-02 dans le style de `design/accueil/01-accueil.png` et `02-formulaire-repli.png` (fond de carte voilé, cartes flottantes, barre à 4 onglets). Contenu inchangé. Ne pas coller cette note dans le générateur.

A single Android phone, portrait, flat front view, thin black bezel, centered punch-hole camera, status bar showing 06:12, on a plain light-grey background #ECEEF2; no hands, no props, no other screen.
Light mode: white screen, text #14161F, secondary text #4A5063, fields #F4F5F8, cards with 16 dp corners and a 1 dp #D5D8E0 border, no shadow; one sans-serif (Inter), times in tabular figures, body text 18 sp minimum, departure time 40 sp bold.
Palette: primary indigo #3730A3 (primary button, links, selected tab); modes coach #7B3FA0, train #1F5FA8, on-demand #0E7472, taxi #2E2E38, walking = dotted grey #5B6170; statuses on time #15803D, delay #B45309, cancelled #B91C1C, scheduled #3F4654 on #EEF0F3.
Copy every quoted French text word for word and add no other text, number, price or date; exactly one full-width 56 dp primary button at the bottom of the content, no empty space below it, nothing cluttered.

Screen content (exception to the lines above: elements float over a background image, so floating cards get a soft 12 px shadow and 24 dp corners; same look as the attached Accueil screens):
- Background, full-bleed edge to edge behind the status bar: a light, muted, flat map image of a rural area — pale warm-grey land #EEF0F3, white roads, thin pale blue-grey rivers, faint grey commune borders — with a 70 % white veil on top so every text stays AA. No place names, no labels, no zoom buttons, no compass, no attribution.
- Top-left, just under the status bar, wordmark « Itinhero » in indigo, semibold, 22 sp.
- Below it, title « Quel lieu ? » in 22 sp semibold, and under it the recap line in secondary text: « Jeudi 12/11 · arriver avant 10:00 · marge 10 min · depuis Domicile »
- Two floating white candidate cards, full width minus 16 dp margins, stacked with 12 dp between them, each with a map-pin icon on the left, its name in 20 sp semibold, its detail in secondary text, and a radio button on the right:
  - « rendez-vous » / « 19 Route de Chamvres, 89300 Joigny » — selected: 2 dp indigo border, filled indigo radio
  - « Joigny » / « Commune, 89300 » — unselected: thin #D5D8E0 border, empty radio
- Under the cards, centered text link « Saisir l'adresse moi-même » in indigo.
- Primary button « C'est ce lieu », full width minus 16 dp margins, indigo, 56 dp, 16 dp corners, 24 dp above the tab bar.
- Bottom tab bar floating above the bottom edge: white pill, full width minus 16 dp margins, 24 dp corners, soft shadow, four evenly spaced tabs each with an outline icon above its label — « Chercher » (selected: indigo icon and label on a light indigo #ECEBFA pill), « Mes trajets », « Assistant » (friendly robot-face icon) and « Réglages » (grey #4A5063). No keyboard on this screen.

### Prompt 6 — Écran 4 · Résultat

> Réécrit le 2026-11-02 dans le style des écrans 1 à 3 (fond de carte voilé, cartes flottantes, barre à 4 onglets). Contenu inchangé. Ne pas coller cette note dans le générateur.

A single Android phone, portrait, flat front view, thin black bezel, centered punch-hole camera, status bar showing 06:12, on a plain light-grey background #ECEEF2; no hands, no props, no other screen.
Light mode: white screen, text #14161F, secondary text #4A5063, fields #F4F5F8, cards with 16 dp corners and a 1 dp #D5D8E0 border, no shadow; one sans-serif (Inter), times in tabular figures, body text 18 sp minimum, departure time 40 sp bold.
Palette: primary indigo #3730A3 (primary button, links, selected tab); modes coach #7B3FA0, train #1F5FA8, on-demand #0E7472, taxi #2E2E38, walking = dotted grey #5B6170; statuses on time #15803D, delay #B45309, cancelled #B91C1C, scheduled #3F4654 on #EEF0F3.
Copy every quoted French text word for word and add no other text, number, price or date; exactly one full-width 56 dp primary button at the bottom of the content, no empty space below it, nothing cluttered.

Screen content (exception to the lines above: elements float over a background image, so floating cards get a soft 12 px shadow and 24 dp corners; same look as the attached screens):
- Background, full-bleed edge to edge behind the status bar: a light, muted, flat map image of a rural area — pale warm-grey land #EEF0F3, white roads, thin pale blue-grey rivers, faint grey commune borders — with a 70 % white veil on top so every text stays AA. No place names, no labels, no pins, no zoom buttons, no compass, no attribution.
- Top-left, just under the status bar, wordmark « Itinhero » in indigo, semibold, 22 sp.
- Verdict card, floating white, full width minus 16 dp margins, with a 6 dp left bar in #15803D: small label « Jeudi 12/11 » in secondary text; on the next line a green #15803D check-circle icon and the word « Possible » in 24 sp semibold green; then « Départ 06:27 » in 40 sp bold, the largest text on the screen; then, in 18 sp, « À faire : être sur place avant 09:50 (rendez-vous 10:00, marge 10 min). Arrivée en gare de Joigny à 09:09, puis ≈ 1,1 km à pied. »
- Row of sort chips, horizontally scrollable, the last one cut by the screen edge: « Arrivée la plus tôt » (selected, indigo fill, white text), « Moins cher », « Moins de marche », « Sans réservation » (white, grey border).
- Possibility card 1, floating white, selected with a 2 dp indigo border: « 06:27 → 09:09 Joigny » in 20 sp semibold, tabular figures; under it a thin horizontal strip of mode segments in order — violet #7B3FA0 bar with a white coach icon, dotted grey walk, blue #1F5FA8 bar with a white train icon, dotted grey walk; under it « Car · Marche · Train · Marche » in secondary text; an amber #B45309 row with a warning-triangle icon « ⚠ Marche de plus de 15 min »; and a badge « Prix non publié » (transparent pill, 1.5 dp dashed grey #8A90A0 border, euro icon).
- Possibility card 2, floating white, thin #D5D8E0 border: taxi icon in graphite #2E2E38, « Taxi de bout en bout » in 20 sp semibold, « Durée de route estimée, hors attente : — » in secondary text, badge « Prix non publié » (same dashed pill), secondary text « Aucun numéro connu ».
- Small secondary footer text, centered: « Horaires du 18/10 ».
- Primary button « Voir le trajet », full width minus 16 dp margins, indigo, 56 dp, 16 dp corners, 24 dp above the tab bar.
- Bottom tab bar floating above the bottom edge: white pill, full width minus 16 dp margins, 24 dp corners, soft shadow, four evenly spaced tabs each with an outline icon above its label — « Chercher » (selected: indigo icon and label on a light indigo #ECEBFA pill), « Mes trajets », « Assistant » (friendly robot-face icon) and « Réglages » (grey #4A5063). No keyboard on this screen.

### Prompt 7 — Écran 5 · Détail (frise verticale et carte)

> Réécrit le 2026-11-02 dans le style des écrans 1 à 4 (cartes flottantes, barre à 4 onglets). Ici la carte n'est pas un fond décoratif : c'est la carte du trajet (D9). Contenu inchangé. Ne pas coller cette note dans le générateur.

A single Android phone, portrait, flat front view, thin black bezel, centered punch-hole camera, status bar showing 06:12, on a plain light-grey background #ECEEF2; no hands, no props, no other screen.
Light mode: white screen, text #14161F, secondary text #4A5063, fields #F4F5F8, cards with 16 dp corners and a 1 dp #D5D8E0 border, no shadow; one sans-serif (Inter), times in tabular figures, body text 18 sp minimum, departure time 40 sp bold.
Palette: primary indigo #3730A3 (primary button, links, selected tab); modes coach #7B3FA0, train #1F5FA8, on-demand #0E7472, taxi #2E2E38, walking = dotted grey #5B6170; statuses on time #15803D, delay #B45309, cancelled #B91C1C, scheduled #3F4654 on #EEF0F3.
Copy every quoted French text word for word and add no other text, number, price or date; exactly one full-width 56 dp primary button at the bottom of the content, no empty space below it, nothing cluttered.

Screen content (exception to the lines above: floating cards get a soft 12 px shadow and 24 dp corners; same look as the attached screens):
- Top 30 % of the screen, edge to edge behind the status bar: the trip map, light minimal style (pale warm-grey land #EEF0F3, white roads, pale blue-grey rivers), showing four numbered round stop pins 1 to 4 for Brienon-sur-Armançon Mairie, Saint-Florentin-Ville, Saint-Florentin-Vergigny and Joigny, without name labels; the coach leg as a solid violet #7B3FA0 line from 1 to 2, the walk as a dotted grey #5B6170 line from 2 to 3, the train leg as a solid blue #1F5FA8 line from 3 to 4; tiny attribution text « © OpenStreetMap » bottom-right of the map.
- Header card, floating white, overlapping the bottom edge of the map by 24 dp, full width minus 16 dp margins: « Partez à 06:27 » in 40 sp bold, the largest text on the screen; under it « Arrivée gare de Joigny 09:09 » in 20 sp; then « puis ≈ 1,1 km à pied jusqu'à rendez-vous » in secondary text.
- Under it, on white, the vertical timeline, with a left column of times in tabular figures aligned to each event and a vertical line joining the blocks:
  - « 06:27 » next to a solid violet #7B3FA0 block with 16 dp corners and white text: coach icon, « Car TER K941 » with a dotted underline on « Car TER » (glossary term on first use), « Montez à Brienon-sur-Armançon Mairie », a white pill badge « Horaire prévu, sans suivi en direct » with an outline clock icon, a white pill badge « Prix non publié »; inside the bottom of the block « 06:37 · Descendez à Saint-Florentin-Ville ».
  - A dotted grey #5B6170 vertical line with a walking icon: « ≈ 2,8 km à pied jusqu'à la gare de Saint-Florentin-Vergigny », an amber #B45309 row with a warning-triangle icon « Marche de plus de 15 min », and under it a small graphite #2E2E38 taxi icon with « Taxi pour cette étape : aucun numéro connu » in secondary text.
  - « 08:50 » next to a solid blue #1F5FA8 block with 16 dp corners and white text: train icon, « Train », « Montez à Saint-Florentin-Vergigny », a white pill badge « Prix non publié »; inside the bottom of the block « 09:09 · Descendez à Joigny ».
  - A dotted grey vertical line with a walking icon: « ≈ 1,1 km à pied jusqu'à rendez-vous ».
  - End point: indigo map-pin icon, « Rendez-vous Joigny » in 20 sp semibold, « Rendez-vous 10:00 » in secondary text.
- Primary button « Enregistrer ce trajet », full width minus 16 dp margins, indigo, 56 dp, 16 dp corners, 24 dp above the tab bar.
- Bottom tab bar floating above the bottom edge: white pill, full width minus 16 dp margins, 24 dp corners, soft shadow, four evenly spaced tabs each with an outline icon above its label — « Chercher » (selected: indigo icon and label on a light indigo #ECEBFA pill), « Mes trajets », « Assistant » (friendly robot-face icon) and « Réglages » (grey #4A5063). No keyboard on this screen.
- If everything does not fit, the timeline may continue below the fold; never shrink text below 16 sp.

### Prompt 8 — Écran 6 · Mes trajets

> Réécrit le 2026-11-02 dans le style des écrans 1 à 5 (fond de carte voilé, cartes flottantes, barre à 4 onglets). Contenu inchangé. Ne pas coller cette note dans le générateur.

A single Android phone, portrait, flat front view, thin black bezel, centered punch-hole camera, status bar showing 06:12, on a plain light-grey background #ECEEF2; no hands, no props, no other screen.
Light mode: white screen, text #14161F, secondary text #4A5063, fields #F4F5F8, cards with 16 dp corners and a 1 dp #D5D8E0 border, no shadow; one sans-serif (Inter), times in tabular figures, body text 18 sp minimum, departure time 40 sp bold.
Palette: primary indigo #3730A3 (primary button, links, selected tab); modes coach #7B3FA0, train #1F5FA8, on-demand #0E7472, taxi #2E2E38, walking = dotted grey #5B6170; statuses on time #15803D, delay #B45309, cancelled #B91C1C, scheduled #3F4654 on #EEF0F3.
Copy every quoted French text word for word and add no other text, number, price or date; exactly one full-width 56 dp primary button at the bottom of the content, no empty space below it, nothing cluttered.

Screen content (exception to the lines above: elements float over a background image, so floating cards get a soft 12 px shadow and 24 dp corners; same look as the attached screens):
- Background, full-bleed edge to edge behind the status bar: a light, muted, flat map image of a rural area — pale warm-grey land #EEF0F3, white roads, thin pale blue-grey rivers, faint grey commune borders — with a 70 % white veil on top so every text stays AA. No place names, no labels, no pins, no zoom buttons, no compass, no attribution.
- Top-left, just under the status bar, wordmark « Itinhero » in indigo, semibold, 22 sp.
- Offline banner, floating, full width minus 16 dp margins, 16 dp corners, dark #1F2937 fill, white text, with a crossed-cloud icon: « Hors connexion · dernier état connu affiché »
- Title « Mes trajets » in 22 sp semibold.
- One saved trip card, floating white, full width minus 16 dp margins: small label « Jeudi 12/11 » in secondary text; « Départ 06:27 » in 40 sp bold, the largest text on the screen; « Brienon-sur-Armançon → Rendez-vous Joigny » in 18 sp; a badge « Horaire prévu, sans suivi en direct » (text #3F4654 on #EEF0F3, outline clock icon); a thin divider; two rows each with a green #15803D check icon: « Disponible sans réseau » and « Carte enregistrée »; a thin divider; a row with an indigo bell icon: « Rappels : la veille · avant le départ ».
- Primary button « Ouvrir le trajet », full width minus 16 dp margins, indigo, 56 dp, 16 dp corners, 24 dp above the tab bar.
- Bottom tab bar floating above the bottom edge: white pill, full width minus 16 dp margins, 24 dp corners, soft shadow, four evenly spaced tabs each with an outline icon above its label — « Chercher », « Mes trajets » (selected: indigo icon and label on a light indigo #ECEBFA pill), « Assistant » (friendly robot-face icon) and « Réglages » (grey #4A5063). No keyboard on this screen.

### Prompt 9 — Écran 7 · Réglages

> Réécrit le 2026-11-02 dans le style des écrans 1 à 6 (fond de carte voilé, cartes flottantes, barre à 4 onglets). Contenu inchangé. Ne pas coller cette note dans le générateur.

A single Android phone, portrait, flat front view, thin black bezel, centered punch-hole camera, status bar showing 06:12, on a plain light-grey background #ECEEF2; no hands, no props, no other screen.
Light mode: white screen, text #14161F, secondary text #4A5063, fields #F4F5F8, cards with 16 dp corners and a 1 dp #D5D8E0 border, no shadow; one sans-serif (Inter), times in tabular figures, body text 18 sp minimum, departure time 40 sp bold.
Palette: primary indigo #3730A3 (primary button, links, selected tab); modes coach #7B3FA0, train #1F5FA8, on-demand #0E7472, taxi #2E2E38, walking = dotted grey #5B6170; statuses on time #15803D, delay #B45309, cancelled #B91C1C, scheduled #3F4654 on #EEF0F3.
Copy every quoted French text word for word and add no other text, number, price or date; exactly one full-width 56 dp primary button at the bottom of the content, no empty space below it, nothing cluttered.

Screen content (exception to the lines above: elements float over a background image, so floating cards get a soft 12 px shadow and 24 dp corners; same look as the attached screens):
- Background, full-bleed edge to edge behind the status bar: a light, muted, flat map image of a rural area — pale warm-grey land #EEF0F3, white roads, thin pale blue-grey rivers, faint grey commune borders — with a 70 % white veil on top so every text stays AA. No place names, no labels, no pins, no zoom buttons, no compass, no attribution.
- Top-left, just under the status bar, wordmark « Itinhero » in indigo, semibold, 22 sp.
- Title « Réglages » in 22 sp semibold.
- One floating white card, full width minus 16 dp margins, holding three sections separated by thin dividers, each section with its heading in 16 sp secondary text:
  - « Domicile » : indigo outline home icon, « Brienon-sur-Armançon » in 18 sp, and on the right the text link « Modifier » in indigo.
  - « Cartes de réduction » : a checked indigo checkbox with « Carte TRAIN Mobigo Solidaire » in 18 sp, and under it in secondary text « −75 % sur les trains Mobigo · le prix affiché devient celui que vous payez ».
  - « Position » : « Depuis ma position » in 18 sp with an Android switch turned off on the right (grey track), and under it in secondary text « Utilisée seulement quand l'app est ouverte, à votre demande. »
- Under the card, a footer note in secondary text with a small lock icon: « Vos réglages et vos trajets enregistrés sont gardés sur ce téléphone. Pour vous alerter, le serveur garde seulement le trajet suivi, jusqu'au lendemain. »
- Primary button « Enregistrer », full width minus 16 dp margins, indigo, 56 dp, 16 dp corners, 24 dp above the tab bar.
- Bottom tab bar floating above the bottom edge: white pill, full width minus 16 dp margins, 24 dp corners, soft shadow, four evenly spaced tabs each with an outline icon above its label — « Chercher », « Mes trajets », « Assistant » (friendly robot-face icon) and « Réglages » (selected: indigo icon and label on a light indigo #ECEBFA pill; others grey #4A5063). No keyboard on this screen.

### Prompt 10 — Écran 8 · Notifications (alertes de retard, phase 7)

> Réécrit le 2026-11-02 : fond d'écran verrouillé repris du motif de carte des écrans 1 à 7, cartes de notification précisées. Contenu inchangé. Ne pas coller cette note dans le générateur.

A single Android phone, portrait, flat front view, thin black bezel, centered punch-hole camera, status bar showing 06:12, on a plain light-grey background #ECEEF2; no hands, no props, no other screen.
Light mode: white screen, text #14161F, secondary text #4A5063, fields #F4F5F8, cards with 16 dp corners and a 1 dp #D5D8E0 border, no shadow; one sans-serif (Inter), times in tabular figures, body text 18 sp minimum, departure time 40 sp bold.
Palette: primary indigo #3730A3 (primary button, links, selected tab); modes coach #7B3FA0, train #1F5FA8, on-demand #0E7472, taxi #2E2E38, walking = dotted grey #5B6170; statuses on time #15803D, delay #B45309, cancelled #B91C1C, scheduled #3F4654 on #EEF0F3.
Copy every quoted French text word for word and add no other text, number, price or date; exactly one full-width 56 dp primary button at the bottom of the content, no empty space below it, nothing cluttered.

Screen content (exception to the lines above: this is the Android lock screen, so no app button and no tab bar; the notification cards are white):
- Android lock screen. Wallpaper: dark slate #1F2937 with the same faint map line pattern as the attached screens (thin lighter roads and rivers, no labels, no photo). Large white clock « 06:12 » in tabular figures, under it the date « jeudi 12 novembre ».
- Three stacked Android notifications from « Itinhero », each a white card with 24 dp corners, full width minus 16 dp margins, 8 dp between cards; header row with the small app icon (a plain indigo #3730A3 rounded square with a white « I ») and « Itinhero » in secondary text; then a status icon, the title in 18 sp semibold and the body in 16 sp. Example alerts from a simulated real-time feed, in this order:
  - red crossed-circle icon, title « Train 08:50 supprimé », body « Saint-Florentin-Vergigny → Joigny, jeudi 12/11. Ouvrez Itinhero pour voir les autres possibilités. »
  - amber clock icon, title « Retard de 5 min », body « Train 08:50 Saint-Florentin-Vergigny → Joigny. »
  - amber warning icon, title « Correspondance menacée », body « Le temps pour rejoindre le train de 08:50 devient plus court que la marche calculée. »

### Prompt 11 — Écran 9 · Assistant

> Ajouté le 2026-11-02 à la demande de Brainditech (D31, proposée). L'exemple de conversation n'utilise que des valeurs du scénario de référence : l'assistant reformule la demande en nouvelle recherche, il n'annonce aucun résultat qu'il n'a pas. Ne pas coller cette note dans le générateur.

A single Android phone, portrait, flat front view, thin black bezel, centered punch-hole camera, status bar showing 06:12, on a plain light-grey background #ECEEF2; no hands, no props, no other screen.
Light mode: white screen, text #14161F, secondary text #4A5063, fields #F4F5F8, cards with 16 dp corners and a 1 dp #D5D8E0 border, no shadow; one sans-serif (Inter), times in tabular figures, body text 18 sp minimum, departure time 40 sp bold.
Palette: primary indigo #3730A3 (primary button, links, selected tab); modes coach #7B3FA0, train #1F5FA8, on-demand #0E7472, taxi #2E2E38, walking = dotted grey #5B6170; statuses on time #15803D, delay #B45309, cancelled #B91C1C, scheduled #3F4654 on #EEF0F3.
Copy every quoted French text word for word and add no other text, number, price or date; exactly one full-width 56 dp primary button at the bottom of the content, no empty space below it, nothing cluttered.

Screen content (exception to the lines above: elements float over a background image, so floating cards get a soft 12 px shadow and 24 dp corners; same look as the attached screens):
- Background, full-bleed edge to edge behind the status bar: a light, muted, flat map image of a rural area — pale warm-grey land #EEF0F3, white roads, thin pale blue-grey rivers, faint grey commune borders — with a 70 % white veil on top so every text stays AA. No place names, no labels, no pins, no zoom buttons, no compass, no attribution.
- Top-left, just under the status bar, wordmark « Itinhero » in indigo, semibold, 22 sp.
- Below it, title « Assistant » in 22 sp semibold, and under it, secondary text « Je relance les recherches pour vous. Je n'invente aucun horaire. »
- A small floating context card on #F4F5F8 with an indigo bookmark icon: « Trajet suivi : jeudi 12/11 · départ 06:27 · Brienon-sur-Armançon → Rendez-vous Joigny »
- Chat thread, large text:
  - User bubble, right-aligned, indigo #3730A3 fill, white text, 20 dp corners: « Je voudrais 20 min d'avance au lieu de 10. »
  - Assistant bubble, left-aligned, white floating card with a small indigo robot-face avatar: « D'accord. Je relance la recherche avec ces réglages : » followed, inside the same bubble, by a recap row of chips « Jeudi 12/11 », « Arriver avant 10:00 », « Marge 20 min » (this chip highlighted with an indigo outline), « Depuis Domicile ».
- Primary button « Relancer la recherche », full width minus 16 dp margins, indigo, 56 dp, 16 dp corners, directly under the assistant bubble; under it, a text link « Annuler » in indigo.
- Row of three suggestion chips (white, grey border), horizontally scrollable: « Changer l'heure », « Moins de marche », « Partir d'ailleurs ».
- Message bar just above the tab bar: white floating pill with placeholder « Écrivez votre demande » in secondary text and a round indigo send button with a white arrow icon (no microphone icon: dictation comes from the keyboard).
- Bottom tab bar floating above the bottom edge: white pill, full width minus 16 dp margins, 24 dp corners, soft shadow, four evenly spaced tabs each with an outline icon above its label — « Chercher », « Mes trajets », « Assistant » (selected: indigo friendly robot-face icon and label on a light indigo #ECEBFA pill) and « Réglages » (grey #4A5063). No keyboard on this screen.

---

## Prompt 12 — Logo

> Ajouté le 2026-11-02 (case « Logo » des prérequis). Idée : le « I » d'Itinhero dessiné comme la frise verticale de l'app (arrêt de départ, trajet en car, marche en pointillé, trajet en train, arrivée). Couleurs de D30, aucune forme ni couleur des concurrents. Ne pas coller cette note dans le générateur.

A 16:9 landscape logo sheet for « Itinhero », an Android app that tells a complete beginner when to leave for an appointment by public transport. Flat light-grey background #ECEEF2, everything centered on a regular grid, nothing overlapping, nothing cropped.
- The symbol: a capital « I » drawn as a vertical trip timeline — a small round stop dot at the top, a short solid violet #7B3FA0 segment, a short dotted segment, a short solid blue #1F5FA8 segment, and a slightly larger round end dot at the bottom; thick rounded strokes, perfectly vertical, geometric, simple enough to read at 24 px.
- Left, large: the Android app icon — the symbol in white on a plain indigo #3730A3 rounded square (adaptive icon, symbol inside the central safe zone), flat, no gradient, no shadow.
- Center: the same icon at three small sizes side by side (large, medium, small) to show it stays readable.
- Right: the horizontal lockup — the symbol in indigo #3730A3 followed by the word « Itinhero » in Inter Semibold, indigo, on white; and under it the same lockup in white on indigo #3730A3.
- No other text, no tagline, no map pin, no train or bus pictogram, no arrow, no globe, no gradient, no 3D, no shadow; no colors, shapes or logos of SNCF Connect, Transit, Mobigo or any transport brand.
Render a crisp, flat, vector-like brand sheet, like a final Figma export.

---

## Relances

Valent pour tous les prompts. Après chaque image, envoyer d'abord :

> Critique this image like a senior product designer: list each defect against the brief above.

Puis, pour chaque relance :
1. **Nommer le défaut** précisément (écran, bloc, texte ou couleur fautif, et ce que le brief exigeait).
2. **Garder ce qui marche** : dire explicitement ce qui ne doit pas changer (grille, cadres, palette, écrans déjà justes).
3. **Ne refaire que la partie fautive** : une relance = une correction ciblée, pas une nouvelle génération de toute la planche.
