#!/usr/bin/env python3
"""Generate placeholder images for Eternal Flowers seed data."""
from pathlib import Path
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    import subprocess
    subprocess.run(["pip3", "install", "pillow"], check=True)
    from PIL import Image, ImageDraw, ImageFont

import math

OUT = Path("/home/jovem/workspace/loja-flores-marina/seed-images")
OUT.mkdir(exist_ok=True)

# Colour palettes inspired by Eternal Flowers brand
PALETTES = {
    "hero": ("#1a1a2e", "#16213e"),
    "colar-1": ("#d4af37", "#f5e6b0"),      # gold
    "colar-2": ("#c9a0dc", "#f0e0f7"),      # lavender
    "brincos-1": ("#e8a0bf", "#fce4ec"),    # rose
    "brincos-2": ("#81c784", "#e8f5e9"),    # sage
    "pulseira-1": ("#90caf9", "#e3f2fd"),   # sky
    "pulseira-2": ("#ffb74d", "#fff3e0"),   # amber
    "portachaves-1": ("#a1887f", "#efebe9"),# warm brown
    "portachaves-2": ("#4db6ac", "#e0f2f1"),# teal
    "moldura-1": ("#ef5350", "#ffebee"),    # coral
    "moldura-2": ("#7986cb", "#e8eaf6"),    # indigo
}

def create_gradient(w, h, c1, c2, filename, text=""):
    """Create a subtle gradient placeholder."""
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    
    r1, g1, b1 = int(c1[1:3],16), int(c1[3:5],16), int(c1[5:7],16)
    r2, g2, b2 = int(c2[1:3],16), int(c2[3:5],16), int(c2[5:7],16)
    
    for y in range(h):
        t = y / h
        r = int(r1 + (r2 - r1) * t)
        g = int(g1 + (g2 - g1) * t)
        b = int(b1 + (b2 - b1) * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))
    
    # Add a subtle flower icon
    cx, cy = w // 2, h // 2
    for angle_deg in range(0, 360, 45):
        rad = math.radians(angle_deg)
        px = cx + int(80 * math.cos(rad))
        py = cy + int(80 * math.sin(rad))
        draw.ellipse([px-20, py-20, px+20, py+20], fill=(255,255,255,40))
    
    draw.ellipse([cx-15, cy-15, cx+15, cy+15], fill=(255,255,255,60))
    
    if text:
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
        except:
            font = ImageFont.load_default()
        # white text, centered
        bbox = draw.textbbox((0,0), text, font=font)
        tw = bbox[2] - bbox[0]
        tx = (w - tw) // 2
        # semi-transparent bg
        draw.rectangle([tx-20, cy+100, tx+tw+20, cy+140], fill=(0,0,0,60))
        draw.text((tx, cy+105), text, fill=(255,255,255), font=font)
    
    img.save(filename, quality=92)
    print(f"  ✓ {filename.name}")

# Homepage hero (1920x1080)
create_gradient(1920, 1080, PALETTES["hero"][0], PALETTES["hero"][1], OUT / "hero.jpg", "Eternal Flowers")

# Product images (800x800 square)
products = [
    ("colar-lagrima", PALETTES["colar-1"], "Lágrima de Orvalho"),
    ("brincos-sorriso", PALETTES["brincos-1"], "Sorriso da Manhã"),
    ("pulseira-abraco", PALETTES["pulseira-1"], "Abraço Eterno"),
    ("portachaves-memoria", PALETTES["portachaves-1"], "Memória Doce"),
    ("moldura-janela", PALETTES["moldura-1"], "Janela para o Jardim"),
    ("colar-beijo", PALETTES["colar-2"], "Beijo de Luz"),
    ("brincos-danca", PALETTES["brincos-2"], "Dança das Pétalas"),
    ("pulseira-raiz", PALETTES["pulseira-2"], "Raiz do Amor"),
    ("portachaves-sussurro", PALETTES["portachaves-2"], "Sussurro da Natureza"),
    ("moldura-eternidade", PALETTES["moldura-2"], "Eternidade em Flor"),
]

for slug, (c1, c2), name in products:
    create_gradient(800, 800, c1, c2, OUT / f"{slug}.jpg", name)

print(f"\n✨ {len(list(OUT.glob('*')))} imagens criadas em {OUT}")