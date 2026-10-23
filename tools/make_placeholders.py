"""Generate placeholder defect photos for the demo projects.

Reads every project listed in data/projects.json and writes one JPEG per
defect to the path in its "photo" field. Each image is a grey concrete-like
texture with a simple drawing of the defect type and a label.

Usage (from the repo root):
    pip install pillow
    python tools/make_placeholders.py

Replace the generated files with real photos at any time; see README.md.
"""

import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
W, H = 800, 600

TYPE_LABELS = {
    "cracking": "Cracking",
    "delamination": "Delamination",
    "spalling": "Spalling",
    "efflorescence": "Efflorescence",
    "exposed_rebar": "Exposed rebar",
}

FONT_CANDIDATES = [
    "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]


def load_font(size):
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def concrete(rng):
    base = rng.randint(150, 178)
    img = Image.new("L", (W, H), base)
    noise = Image.effect_noise((W, H), 28).filter(ImageFilter.GaussianBlur(1.2))
    img = Image.blend(img, noise, 0.35)
    draw = ImageDraw.Draw(img)
    # aggregate speckles and small air voids
    for _ in range(900):
        x, y = rng.randrange(W), rng.randrange(H)
        r = rng.choice([1, 1, 1, 2, 2, 3])
        shade = base + rng.randint(-45, 25)
        draw.ellipse((x - r, y - r, x + r, y + r), fill=max(0, min(255, shade)))
    return img.convert("RGB")


def crack_path(rng, x, y, steps, dx, dy):
    pts = [(x, y)]
    for _ in range(steps):
        x += dx + rng.randint(-14, 14)
        y += dy + rng.randint(-14, 14)
        pts.append((x, y))
    return pts


def draw_cracking(img, rng):
    d = ImageDraw.Draw(img)
    main = crack_path(rng, 120, 90, 24, 24, 18)
    d.line(main, fill=(48, 48, 48), width=4, joint="curve")
    for i in range(4, len(main) - 4, 6):
        x, y = main[i]
        d.line(crack_path(rng, x, y, 6, rng.choice([-18, 18]), 16), fill=(70, 70, 70), width=2)


def draw_delamination(img, rng):
    d = ImageDraw.Draw(img, "RGBA")
    d.ellipse((210, 150, 590, 420), fill=(90, 90, 90, 40), outline=(60, 60, 60, 160), width=3)
    # sounding marks, as an inspector would chalk them
    d.rectangle((230, 170, 570, 400), outline=(30, 90, 190, 200), width=4)
    for x in range(250, 560, 40):
        d.line((x, 180, x + 20, 390), fill=(30, 90, 190, 90), width=2)


def draw_spalling(img, rng):
    d = ImageDraw.Draw(img)
    cx, cy = 400, 300
    pts = []
    for i in range(18):
        a = i / 18 * 6.283
        r = rng.randint(110, 170)
        pts.append((cx + r * 1.3 * math.cos(a), cy + r * math.sin(a)))
    d.polygon(pts, fill=(118, 112, 104), outline=(70, 66, 60))
    inner = [(cx + (x - cx) * 0.6, cy + (y - cy) * 0.6) for x, y in pts]
    d.polygon(inner, fill=(96, 90, 84))
    for _ in range(160):
        x = cx + rng.randint(-150, 150)
        y = cy + rng.randint(-100, 100)
        d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=(140, 132, 120))


def draw_efflorescence(img, rng):
    d = ImageDraw.Draw(img, "RGBA")
    d.line((0, 200, W, 230), fill=(80, 80, 80, 200), width=3)
    for _ in range(26):
        x = rng.randint(60, W - 60)
        length = rng.randint(80, 300)
        d.line((x, 210, x + rng.randint(-20, 20), 210 + length), fill=(250, 250, 245, 120), width=rng.randint(6, 18))
    img.paste(img.filter(ImageFilter.GaussianBlur(2)), (0, 0))


def draw_exposed_rebar(img, rng):
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((90, 210, 710, 400), radius=40, fill=(110, 104, 98))
    for y in (260, 345):
        d.line((70, y, 730, y), fill=(128, 62, 28), width=22)
        for x in range(80, 730, 26):
            d.line((x, y - 11, x + 12, y + 11), fill=(96, 44, 20), width=4)
        d.line((70, y - 6, 730, y - 6), fill=(168, 92, 50), width=4)


PAINTERS = {
    "cracking": draw_cracking,
    "delamination": draw_delamination,
    "spalling": draw_spalling,
    "efflorescence": draw_efflorescence,
    "exposed_rebar": draw_exposed_rebar,
}


def make_image(defect, out_path):
    rng = random.Random(defect["id"])
    img = concrete(rng)
    PAINTERS[defect["type"]](img, rng)

    d = ImageDraw.Draw(img, "RGBA")
    label = f'{defect["id"]}  {TYPE_LABELS[defect["type"]]}'
    font = load_font(30)
    small = load_font(18)
    d.rounded_rectangle((20, H - 86, 20 + d.textlength(label, font=font) + 32, H - 20), radius=12, fill=(21, 25, 30, 200))
    d.text((36, H - 80), label, font=font, fill=(255, 255, 255))
    d.text((36, H - 44), "PLACEHOLDER PHOTO", font=small, fill=(200, 204, 210))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, "JPEG", quality=72, optimize=True, progressive=True)


def main():
    index = json.loads((ROOT / "data/projects.json").read_text())
    for entry in index["projects"]:
        project = json.loads((ROOT / entry["file"]).read_text())
        for defect in project["defects"]:
            out = ROOT / defect["photo"]
            make_image(defect, out)
            print("wrote", out.relative_to(ROOT))


if __name__ == "__main__":
    main()
