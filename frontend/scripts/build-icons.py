"""Rasterises the Wall.ia brand files with headless Chrome (or Edge) + Pillow.

- public/favicon.svg  -> favicon PNGs, favicon.ico, apple-touch, mstile, logo.png
- docs/brand/og.html  -> public/og.png (1200x630)
- docs/brand/comunicacao/*.html -> PNG next to each HTML (LinkedIn pieces)

The SVG/HTML files are the source of truth; this script only takes pictures of them.
Run from the repo root:  python frontend/scripts/build-icons.py   (needs Pillow and Chrome or Edge)
Set CHROME=/path/to/chrome if it is not in a standard location.
"""
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

FRONT = Path(__file__).resolve().parents[1]
PUBLIC = FRONT / 'public'
BRAND = FRONT.parent / 'docs' / 'brand'
INK = '#0A1519'

CANDIDATES = [
    os.environ.get('CHROME'),
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    shutil.which('google-chrome'),
    shutil.which('chromium'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]


def chrome():
    for path in CANDIDATES:
        if path and Path(path).exists():
            return path
    raise SystemExit('Chrome/Edge not found: set CHROME=/path/to/chrome')


def shoot(source, out, width, height, transparent=False):
    with tempfile.TemporaryDirectory() as profile:
        args = [chrome(), '--headless=new', '--disable-gpu', '--hide-scrollbars', f'--user-data-dir={profile}',
                f'--window-size={width},{height}', f'--screenshot={out}', '--virtual-time-budget=3000']
        if transparent:
            args.append('--default-background-color=00000000')
        subprocess.run(args + [Path(source).resolve().as_uri()], check=True, capture_output=True)
    with Image.open(out) as img:
        if img.size != (width, height):
            img.crop((0, 0, width, height)).save(out)


def padded(mark, size, padding):
    tile = Image.new('RGBA', (size, size), INK)
    inner = round(size * (1 - 2 * padding))
    offset = (size - inner) // 2
    tile.alpha_composite(mark.resize((inner, inner), Image.LANCZOS), (offset, offset))
    return tile.convert('RGB')


def main():
    icons = PUBLIC / 'favicon'
    with tempfile.TemporaryDirectory() as tmp:
        big = Path(tmp) / 'mark.png'
        shoot(PUBLIC / 'favicon.svg', big, 1024, 1024, transparent=True)
        mark = Image.open(big).convert('RGBA')
        for name, size in [('favicon-16x16.png', 16), ('favicon-32x32.png', 32),
                           ('android-chrome-192x192.png', 192), ('android-chrome-512x512.png', 512)]:
            mark.resize((size, size), Image.LANCZOS).save(icons / name)
        mark.resize((64, 64), Image.LANCZOS).save(icons / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
        # iOS and Windows tiles need an opaque, padded square.
        padded(mark, 180, 0.12).save(icons / 'apple-touch-icon.png')
        padded(mark, 150, 0.2).save(icons / 'mstile-150x150.png')
        padded(mark, 512, 0.12).save(PUBLIC / 'logo.png')
    shoot(BRAND / 'og.html', PUBLIC / 'og.png', 1200, 630)
    for page in sorted((BRAND / 'comunicacao').glob('*.html')):
        width, height = (1584, 396) if 'capa' in page.stem else (1200, 1200)
        shoot(page, page.with_suffix('.png'), width, height)
    print('icons, og.png and LinkedIn pieces written')


if __name__ == '__main__':
    main()
