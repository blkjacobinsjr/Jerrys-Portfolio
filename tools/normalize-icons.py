"""Trim generated 3D icons to their alpha bounds and place them on a shared
canvas, bottom-aligned, so a row of them reads like Peng Zheng's timeline strip.

usage: python3 tools/normalize-icons.py <in_dir> <out_dir> name [name...]
"""
import sys
from pathlib import Path
from PIL import Image

CANVAS = 960
BOX_W, BOX_H = 900, 860
BASELINE = 940


def normalize(src: Path, dst: Path) -> None:
    im = Image.open(src).convert('RGBA')
    bbox = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    if not bbox:
        raise SystemExit(f'{src} is fully transparent')
    im = im.crop(bbox)
    scale = min(BOX_W / im.width, BOX_H / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    out = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    out.paste(im, ((CANVAS - im.width) // 2, BASELINE - im.height), im)
    out.save(dst, 'WEBP', quality=90, method=6, alpha_quality=100)


if __name__ == '__main__':
    src_dir, dst_dir, *names = sys.argv[1:]
    for name in names:
        normalize(Path(src_dir, f'{name}.png'), Path(dst_dir, f'{name}.webp'))
        print('ok', name)
