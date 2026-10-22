# Draws the app icon (an open book with one word highlighted) and writes the PNGs
# used for the home-screen icon, manifest and favicon. Needs Pillow:
#
#   python3 tools/make_icons.py

from pathlib import Path

from PIL import Image, ImageDraw

BLUE = "#2f6fde"
DARK_BLUE = "#1f4fa8"
PAGE = "#ffffff"
LINE = "#c9d6f2"
HIGHLIGHT = "#ffd43b"

S = 1024          # design canvas
SUPER = 4         # draw large, then downscale for smooth edges
OUT = Path(__file__).resolve().parent.parent / "icons"


def draw():
    k = SUPER
    img = Image.new("RGB", (S * k, S * k), BLUE)
    d = ImageDraw.Draw(img)

    def rect(x0, y0, x1, y1, fill, r):
        d.rounded_rectangle((x0 * k, y0 * k, x1 * k, y1 * k), radius=r * k, fill=fill)

    # Book: shadow, then two pages with a gap for the spine.
    rect(160, 290, 864, 790, DARK_BLUE, 48)
    rect(160, 250, 500, 760, PAGE, 44)
    rect(524, 250, 864, 760, PAGE, 44)

    # Lines of "text" on each page; one word on the left page is highlighted.
    lines_left = [(220, 440), (0, 0), (220, 400), (220, 330)]
    lines_right = [(584, 804), (584, 760), (584, 804), (584, 700)]
    ys = [340, 450, 560, 660]
    for (x0, x1), y in zip(lines_left, ys):
        if x1:
            rect(x0, y, x1, y + 44, LINE, 22)
    for (x0, x1), y in zip(lines_right, ys):
        rect(x0, y, x1, y + 44, LINE, 22)

    # Highlighted word (second line, left page) with the rest of the line after it.
    rect(206, ys[1] - 16, 346, ys[1] + 60, HIGHLIGHT, 30)
    rect(232, ys[1] + 6, 320, ys[1] + 38, DARK_BLUE, 16)
    rect(370, ys[1], 440, ys[1] + 44, LINE, 22)

    return img.resize((S, S), Image.LANCZOS)


def main():
    OUT.mkdir(exist_ok=True)
    icon = draw()
    for size, name in [(180, "apple-touch-icon.png"), (192, "icon-192.png"),
                       (512, "icon-512.png"), (32, "favicon-32.png")]:
        icon.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
        print("wrote", OUT / name)


if __name__ == "__main__":
    main()
