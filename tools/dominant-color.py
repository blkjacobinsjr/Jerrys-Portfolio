"""Print each diorama's most prominent saturated colour as hex, for the stop glow.

Quantises opaque pixels, weights each bucket by count x saturation, and returns
the winning bucket's mean colour. usage: python3 tools/dominant-color.py src/assets/icons/*.webp
"""
import colorsys
import sys
from collections import defaultdict
from pathlib import Path
from PIL import Image


def dominant(path: Path) -> str:
    im = Image.open(path).convert('RGBA')
    im.thumbnail((160, 160))
    buckets: dict[tuple[int, int, int], list[tuple[int, int, int]]] = defaultdict(list)
    for r, g, b, a in im.getdata():
        if a < 200:
            continue
        buckets[(r // 32, g // 32, b // 32)].append((r, g, b))

    def score(pixels: list[tuple[int, int, int]]) -> float:
        r, g, b = (sum(c) / len(pixels) / 255 for c in zip(*pixels))
        _, s, v = colorsys.rgb_to_hsv(r, g, b)
        # Colour beats area: a small red awning outranks a large beige wall.
        return len(pixels) ** 0.5 * s**2 * v

    best = max(buckets.values(), key=score)
    r, g, b = (round(sum(c) / len(best)) for c in zip(*best))
    return f'#{r:02x}{g:02x}{b:02x}'


if __name__ == '__main__':
    for arg in sys.argv[1:]:
        print(Path(arg).stem, dominant(Path(arg)))
