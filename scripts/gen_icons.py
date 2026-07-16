#!/usr/bin/env python3
"""Generate Dinner Decider app icons: a dark square with a neon-gradient die.

Pure stdlib (struct + zlib) — no Pillow, no network fetch. Run:
    python3 scripts/gen_icons.py
Writes icons/icon-192.png, icons/icon-512.png, icons/apple-touch-icon.png.
"""
import os
import struct
import zlib

BG = (10, 10, 20, 255)       # --bg #0a0a14
PIP = (10, 10, 20, 255)      # pips punched in the same dark tone for contrast
PURPLE = (167, 139, 250)     # --purple
PINK = (244, 114, 182)       # --pink
CORAL = (255, 122, 107)      # --coral


def lerp(a, b, t):
    return a + (b - a) * t


def grad_color(t):
    t = min(max(t, 0.0), 1.0)
    if t < 0.5:
        tt = t / 0.5
        c1, c2 = PURPLE, PINK
    else:
        tt = (t - 0.5) / 0.5
        c1, c2 = PINK, CORAL
    return tuple(int(round(lerp(c1[i], c2[i], tt))) for i in range(3))


def rounded_rect_contains(px, py, x0, y0, x1, y1, r):
    if px < x0 + r and py < y0 + r:
        return (px - (x0 + r)) ** 2 + (py - (y0 + r)) ** 2 <= r * r
    if px > x1 - r and py < y0 + r:
        return (px - (x1 - r)) ** 2 + (py - (y0 + r)) ** 2 <= r * r
    if px < x0 + r and py > y1 - r:
        return (px - (x0 + r)) ** 2 + (py - (y1 - r)) ** 2 <= r * r
    if px > x1 - r and py > y1 - r:
        return (px - (x1 - r)) ** 2 + (py - (y1 - r)) ** 2 <= r * r
    return x0 <= px <= x1 and y0 <= py <= y1


def make_icon(size):
    pixels = [[BG for _ in range(size)] for _ in range(size)]

    margin = size * 0.16
    x0, y0, x1, y1 = margin, margin, size - margin, size - margin
    r = size * 0.14
    die_w = x1 - x0

    for y in range(size):
        for x in range(size):
            px, py = x + 0.5, y + 0.5
            if rounded_rect_contains(px, py, x0, y0, x1, y1, r):
                t = (px - x0) / die_w
                cr, cg, cb = grad_color(t)
                pixels[y][x] = (cr, cg, cb, 255)

    pip_r = size * 0.052
    inset = die_w * 0.26
    centers = [
        (x0 + inset, y0 + inset),
        (x1 - inset, y0 + inset),
        (x0 + die_w / 2, y0 + die_w / 2),
        (x0 + inset, y1 - inset),
        (x1 - inset, y1 - inset),
    ]
    for cx, cy in centers:
        y_lo, y_hi = int(cy - pip_r - 1), int(cy + pip_r + 2)
        x_lo, x_hi = int(cx - pip_r - 1), int(cx + pip_r + 2)
        for y in range(max(0, y_lo), min(size, y_hi)):
            for x in range(max(0, x_lo), min(size, x_hi)):
                if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= pip_r * pip_r:
                    pixels[y][x] = PIP

    return pixels


def write_png(path, size, pixels):
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA, no interlace
    raw = bytearray()
    for row in pixels:
        raw.append(0)  # filter type: none
        for (cr, cg, cb, ca) in row:
            raw += bytes((cr, cg, cb, ca))
    idat = zlib.compress(bytes(raw), 9)
    with open(path, "wb") as f:
        f.write(sig)
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", idat))
        f.write(chunk(b"IEND", b""))


def main():
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")
    os.makedirs(out_dir, exist_ok=True)
    for size, name in [(192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")]:
        pixels = make_icon(size)
        path = os.path.join(out_dir, name)
        write_png(path, size, pixels)
        print(f"wrote {path} ({size}x{size})")


if __name__ == "__main__":
    main()
