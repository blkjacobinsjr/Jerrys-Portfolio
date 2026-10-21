"""Put a real app screenshot on the green screen of a generated hand-and-iPhone photo.

The photo's display is flat chroma green. Its four edges are fitted as lines,
the screenshot is warped onto the quad they meet in, and the green itself is
the matte, so the bezel's rounded corners, the Dynamic Island and any finger
over the edge stay on top. Usage:

    python3 tools/compose-phone.py hand.png screen.png out.webp [top_pad_hex]

top_pad_hex pads a screenshot that has no status bar with that colour.
"""
import sys
from PIL import Image, ImageFilter

SCREEN_RATIO = 2556 / 1179  # iPhone 15/16 Pro display


def greenness(p):
    r, g, b = p[:3]
    return g - max(r, b)


def fit_line(points):
    """Least squares x = a*y + c (or y = a*x + c); points are (t, v)."""
    n = len(points)
    st = sum(t for t, _ in points)
    sv = sum(v for _, v in points)
    stt = sum(t * t for t, _ in points)
    stv = sum(t * v for t, v in points)
    a = (n * stv - st * sv) / (n * stt - st * st)
    return a, (sv - a * st) / n


def edges(mask, w, h):
    px = mask.load()
    left, right, top, bottom = [], [], [], []
    ys = [y for y in range(h) if any(px[x, y] for x in range(0, w, 4))]
    xs = [x for x in range(w) if any(px[x, y] for y in range(0, h, 4))]
    y0, y1 = ys[0], ys[-1]
    x0, x1 = xs[0], xs[-1]
    # Sample the middle 60% of each side, clear of the rounded corners.
    for y in range(int(y0 + 0.2 * (y1 - y0)), int(y1 - 0.2 * (y1 - y0)), 3):
        row = [x for x in range(w) if px[x, y]]
        if row:
            left.append((y, row[0]))
            right.append((y, row[-1]))
    for x in range(int(x0 + 0.2 * (x1 - x0)), int(x1 - 0.2 * (x1 - x0)), 3):
        col = [y for y in range(h) if px[x, y]]
        if col:
            top.append((x, col[0]))
            bottom.append((x, col[-1]))
    return fit_line(left), fit_line(right), fit_line(top), fit_line(bottom)


def meet(vertical, horizontal):
    """x = a*y + c meets y = b*x + d."""
    a, c = vertical
    b, d = horizontal
    y = (b * c + d) / (1 - a * b)
    return a * y + c, y


def solve(m, v):
    n = len(v)
    for i in range(n):
        p = max(range(i, n), key=lambda r: abs(m[r][i]))
        m[i], m[p], v[i], v[p] = m[p], m[i], v[p], v[i]
        for r in range(i + 1, n):
            f = m[r][i] / m[i][i]
            m[r] = [x - f * y for x, y in zip(m[r], m[i])]
            v[r] -= f * v[i]
    out = [0.0] * n
    for i in range(n - 1, -1, -1):
        out[i] = (v[i] - sum(m[i][j] * out[j] for j in range(i + 1, n))) / m[i][i]
    return out


def perspective(dst, src):
    """Coefficients mapping output (dst) points back to input (src) points."""
    m, v = [], []
    for (x, y), (u, w) in zip(dst, src):
        m.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); v.append(u)
        m.append([0, 0, 0, x, y, 1, -w * x, -w * y]); v.append(w)
    return solve(m, v)


def main(hand_path, screen_path, out_path, pad=None):
    hand = Image.open(hand_path).convert('RGBA')
    w, h = hand.size
    pixels = hand.load()
    soft = Image.new('L', (w, h))
    sp = soft.load()
    for y in range(h):
        for x in range(w):
            p = pixels[x, y]
            if p[3] > 200:
                sp[x, y] = max(0, min(255, (greenness(p) - 40) * 4))
    hard = soft.point(lambda v: 255 if v > 127 else 0)
    left, right, top, bottom = edges(hard, w, h)
    quad = [meet(left, top), meet(right, top), meet(right, bottom), meet(left, bottom)]

    screen = Image.open(screen_path).convert('RGB')
    if pad:
        sw, sh = screen.size
        target = round(sw * SCREEN_RATIO)
        padded = Image.new('RGB', (sw, target), pad)
        padded.paste(screen, (0, round(sw * 0.137)))
        screen = padded
    sw, sh = screen.size
    coeffs = perspective(quad, [(0, 0), (sw, 0), (sw, sh), (0, sh)])
    warped = screen.transform((w, h), Image.PERSPECTIVE, coeffs, Image.BICUBIC)

    # The matte grows 2px under the bezel so no green fringe survives.
    matte = soft.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(0.8))
    out = hand.copy()
    out.paste(warped, (0, 0), matte)
    out.save(out_path, 'WEBP', quality=86, method=6)
    print(out_path, [tuple(round(c) for c in q) for q in quad])


if __name__ == '__main__':
    main(*sys.argv[1:])
