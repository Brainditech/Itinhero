"""Icône de l'app, icône adaptative Android, écran de démarrage et favicon (spec 53, D138),
et symbole `primaire` du logo affiché en haut des écrans (spec 54, D139).

Dessine le symbole d'Itinhero (le « I » en frise) à partir des mêmes mesures que
design/logo/symbole.svg, relevées sur design/logo/logo.png (validé le 2026-11-02).
Rendu en 4x puis réduit : bords lissés. Même résultat à chaque exécution.

Usage : python scripts/generer-icones.py            (écrit dans assets/images/)
        python scripts/generer-icones.py <dossier>  (pour comparer sans écraser)
"""

import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

PRIMAIRE = (0x37, 0x30, 0xA3, 255)  # jeton `primaire`, design/design-system.md
BLANC = (255, 255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)
SUR = 4  # suréchantillonnage

# Symbole, en unités du SVG : 51 de large, 275 de haut.
LARGEUR_S, HAUTEUR_S = 51.0, 275.0
RONDS = [(26.0, 25.5), (132.0, 9.0), (161.0, 9.0), (249.0, 25.5)]  # (centre y, rayon)
TRAITS = [(26.0, 112.0), (181.0, 249.0)]  # (haut, bas), 18 de large, bouts arrondis
DEMI_TRAIT = 9.0

# Icône adaptative : canevas 108 dp, zone sûre ronde de 66 dp (recommandations Android).
HAUTEUR_ADAPTATIVE = 56 / 108  # symbole de 56 dp
PROPORTION_LOGO = 275 / 350  # hauteur du symbole / côté du carré, sur le logo validé


def dessiner_symbole(img: Image.Image, hauteur: float, couleur) -> tuple[float, float, float, float]:
    """Dessine le symbole centré ; rend sa boîte (x0, y0, x1, y1) en pixels de img."""
    d = ImageDraw.Draw(img)
    e = hauteur / HAUTEUR_S
    cx = img.width / 2
    y0 = (img.height - hauteur) / 2
    for cy, r in RONDS:
        d.ellipse([cx - r * e, y0 + (cy - r) * e, cx + r * e, y0 + (cy + r) * e], fill=couleur)
    for haut, bas in TRAITS:
        d.rounded_rectangle(
            [cx - DEMI_TRAIT * e, y0 + haut * e, cx + DEMI_TRAIT * e, y0 + bas * e],
            radius=DEMI_TRAIT * e,
            fill=couleur,
        )
    return (cx - LARGEUR_S / 2 * e, y0, cx + LARGEUR_S / 2 * e, y0 + hauteur)


def image(cote: int, fond, hauteur_symbole: float, couleur=BLANC, rayon_coin: float = 0) -> tuple[Image.Image, tuple]:
    grand = cote * SUR
    img = Image.new("RGBA", (grand, grand), TRANSPARENT if rayon_coin else fond)
    if rayon_coin:
        ImageDraw.Draw(img).rounded_rectangle([0, 0, grand - 1, grand - 1], radius=rayon_coin * SUR, fill=fond)
    boite = dessiner_symbole(img, hauteur_symbole * SUR, couleur)
    return img.resize((cote, cote), Image.LANCZOS), tuple(v / SUR for v in boite)


def symbole_seul(hauteur: int, couleur) -> Image.Image:
    """Symbole seul sur fond transparent, recadré à sa largeur (logo + nom des écrans)."""
    largeur = math.ceil(hauteur * LARGEUR_S / HAUTEUR_S)
    img = Image.new("RGBA", (largeur * SUR, hauteur * SUR), TRANSPARENT)
    dessiner_symbole(img, hauteur * SUR, couleur)
    return img.resize((largeur, hauteur), Image.LANCZOS)


def dans_zone_sure(boite: tuple, cote: int) -> bool:
    """Les quatre coins de la boîte du symbole sont dans le disque de 66/108 du canevas."""
    rayon = cote * 66 / 108 / 2
    c = cote / 2
    x0, y0, x1, y1 = boite
    return all(math.hypot(x - c, y - c) <= rayon for x in (x0, x1) for y in (y0, y1))


def main() -> None:
    dossier = Path(sys.argv[1] if len(sys.argv) > 1 else "assets/images")
    dossier.mkdir(parents=True, exist_ok=True)
    c = 1024

    icone, _ = image(c, PRIMAIRE, c * PROPORTION_LOGO)
    assert all(a == 255 for a in icone.getchannel("A").getdata()), "icon.png ne doit avoir aucun pixel transparent"
    icone.convert("RGB").save(dossier / "icon.png")

    avant, boite = image(c, TRANSPARENT, c * HAUTEUR_ADAPTATIVE)
    assert dans_zone_sure(boite, c), f"symbole hors de la zone sûre : {boite}"
    avant.save(dossier / "android-icon-foreground.png")
    avant.save(dossier / "android-icon-monochrome.png")  # Android n'en garde que la transparence

    Image.new("RGB", (c, c), PRIMAIRE[:3]).save(dossier / "android-icon-background.png")

    demarrage, _ = image(c, TRANSPARENT, c)
    demarrage.save(dossier / "splash-icon.png")

    favicon, _ = image(48, PRIMAIRE, 48 * 0.72, rayon_coin=10)
    favicon.save(dossier / "favicon.png")

    # 160 px de haut : net jusqu'à une densité de 5 pour un symbole de 32 dp.
    symbole_seul(160, PRIMAIRE).save(dossier / "symbole-primaire.png")

    for nom in ("symbole-primaire", "icon", "android-icon-foreground", "android-icon-background", "android-icon-monochrome", "splash-icon", "favicon"):
        f = dossier / f"{nom}.png"
        with Image.open(f) as im:
            print(f"{f} {im.size[0]}x{im.size[1]} {im.mode}")


if __name__ == "__main__":
    main()
