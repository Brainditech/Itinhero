"""Fond de carte décoratif d'Itinhero (design/design-system.md, « Fond d'écran »).

Carte rurale inventée, sans libellé : terre #EEF0F3, routes blanches,
rivières bleu-gris pâle, limites de communes gris pâle. Aucune donnée réelle
(pas d'OSM, donc pas d'attribution). Graine fixe : même image à chaque exécution.

Usage : python scripts/generer-fond-carte.py assets/images/fond-carte.png
(--voile : aperçu avec le voile blanc à 70 %, pour comparer à une maquette ;
l'app applique le voile elle-même, jeton `voile` de src/theme/jetons.js.)
"""

import math
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

GRAINE = 20261102
LARGEUR, HAUTEUR = 1080, 2400
ECHELLE = 2  # dessin en 2x puis réduction : traits lissés

TERRE = (0xEE, 0xF0, 0xF3)
ROUTE = (0xFF, 0xFF, 0xFF)
RIVIERE = (0xC6, 0xDA, 0xE8)
LIMITE = (0xD6, 0xDA, 0xE2)

rng = np.random.default_rng(GRAINE)
L, H = LARGEUR * ECHELLE, HAUTEUR * ECHELLE


def lisser(points, passes=3):
    """Chaikin : adoucit une ligne brisée."""
    for _ in range(passes):
        nouveaux = [points[0]]
        for (x0, y0), (x1, y1) in zip(points, points[1:]):
            nouveaux.append((0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1))
            nouveaux.append((0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1))
        nouveaux.append(points[-1])
        points = nouveaux
    return points


def sinueuse(depart, angle, longueur, pas, tortuosite):
    """Marche au cap qui dérive doucement : rivière ou route de campagne."""
    x, y = depart
    points = [(x, y)]
    cap = angle
    derive = 0.0
    for _ in range(int(longueur / pas)):
        derive = 0.8 * derive + rng.normal(0, tortuosite)
        angle += derive + 0.08 * (cap - angle)
        x += math.cos(angle) * pas
        y += math.sin(angle) * pas
        points.append((x, y))
    return lisser(points)


def trait(dessin, points, couleur, epaisseur):
    dessin.line(points, fill=couleur, width=epaisseur, joint="curve")
    r = epaisseur / 2
    for x, y in (points[0], points[-1]):
        dessin.ellipse((x - r, y - r, x + r, y + r), fill=couleur)


def limites_communes(image):
    """Cellules de Voronoï déformées : contours irréguliers de communes."""
    n = 34
    germes = np.column_stack([rng.uniform(-0.1, 1.1, n) * L, rng.uniform(-0.05, 1.05, n) * H])
    f = 4  # calcul sur une grille réduite, puis agrandi
    gx, gy = np.meshgrid(np.arange(0, L, f, dtype=np.float32), np.arange(0, H, f, dtype=np.float32))
    # Déformation lente (somme de sinus) pour des limites qui ondulent
    dx = np.zeros_like(gx)
    dy = np.zeros_like(gy)
    for amplitude, fmin, fmax in ((90, 0.0012, 0.003), (35, 0.006, 0.012), (12, 0.02, 0.04)):
        for _ in range(3):
            fr = rng.uniform(fmin, fmax)
            ph = rng.uniform(0, 2 * math.pi, 4)
            dx += amplitude * np.sin(gy * fr + ph[0]) * np.cos(gx * fr * 0.7 + ph[2])
            dy += amplitude * np.sin(gx * fr + ph[1]) * np.cos(gy * fr * 0.7 + ph[3])
    px, py = gx + dx, gy + dy
    etiquettes = np.zeros(gx.shape, dtype=np.int16)
    meilleure = np.full(gx.shape, np.inf, dtype=np.float32)
    for i, (sx, sy) in enumerate(germes):
        d = (px - sx) ** 2 + (py - sy) ** 2
        plus_proche = d < meilleure
        meilleure[plus_proche] = d[plus_proche]
        etiquettes[plus_proche] = i
    bord = np.zeros(gx.shape, dtype=bool)
    bord[:, 1:] |= etiquettes[:, 1:] != etiquettes[:, :-1]
    bord[1:, :] |= etiquettes[1:, :] != etiquettes[:-1, :]
    masque = Image.fromarray((bord * 255).astype(np.uint8)).resize((L, H), Image.BILINEAR)
    masque = masque.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    image.paste(Image.new("RGB", (L, H), LIMITE), (0, 0), masque)
    return germes


def main():
    sortie = sys.argv[1]
    image = Image.new("RGB", (L, H), TERRE)
    germes = limites_communes(image)
    dessin = ImageDraw.Draw(image)

    # Rivières : une grande, deux affluents, quelques ruisseaux
    grande = sinueuse((-100, H * 0.70), -0.45, L * 2.2, 30, 0.03)
    trait(dessin, grande, RIVIERE, 18)
    for _ in range(2):
        x, y = grande[int(rng.uniform(0.2, 0.8) * len(grande))]
        cap = -math.pi / 2 + rng.uniform(-0.6, 0.6) if rng.random() < 0.5 else math.pi / 2 + rng.uniform(-0.6, 0.6)
        trait(dessin, sinueuse((x, y), cap, H * 0.45, 26, 0.035), RIVIERE, 10)
    for _ in range(5):
        trait(dessin, sinueuse((rng.uniform(0, L), rng.uniform(0, H)), rng.uniform(0, 2 * math.pi), 600, 22, 0.04), RIVIERE, 6)

    # Routes : villages aux germes des communes, reliés aux voisins proches
    villages = []
    while len(villages) < 26:
        v = (rng.uniform(-0.05, 1.05) * L, rng.uniform(-0.03, 1.03) * H)
        if all((v[0] - a) ** 2 + (v[1] - b) ** 2 > 380 ** 2 for a, b in villages):
            villages.append(v)
    deja = set()
    for i, (x0, y0) in enumerate(villages):
        voisins = sorted(range(len(villages)), key=lambda j: (villages[j][0] - x0) ** 2 + (villages[j][1] - y0) ** 2)[1:3]
        for j in voisins:
            if (j, i) in deja:
                continue
            deja.add((i, j))
            x1, y1 = villages[j]
            n = 8
            points = [(x0, y0)]
            for k in range(1, n):
                t = k / n
                points.append((x0 + (x1 - x0) * t + rng.normal(0, 22), y0 + (y1 - y0) * t + rng.normal(0, 22)))
            points.append((x1, y1))
            principale = rng.random() < 0.35
            trait(dessin, lisser(points), ROUTE, 14 if principale else 8)
    # Chemins secondaires autour des villages
    for x, y in villages:
        for _ in range(int(rng.integers(1, 3))):
            trait(dessin, sinueuse((x, y), rng.uniform(0, 2 * math.pi), rng.uniform(200, 450), 20, 0.03), ROUTE, 5)
    # Une grande route qui traverse l'écran
    trait(dessin, sinueuse((L * 0.3, -100), math.pi / 2 - 0.15, H * 1.2, 40, 0.008), ROUTE, 18)

    image = image.resize((LARGEUR, HAUTEUR), Image.LANCZOS)
    if "--voile" in sys.argv:
        image = Image.blend(image, Image.new("RGB", image.size, (255, 255, 255)), 0.7)
    image.save(sortie, optimize=True)


if __name__ == "__main__":
    main()
