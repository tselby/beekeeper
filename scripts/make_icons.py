"""Generate the toolbar icons (yellow hive cell with a check) with no dependencies.

    python3 scripts/make_icons.py
"""
import math
import os
import struct
import zlib

YELLOW = (247, 218, 33)
DARK = (18, 18, 18)
SIZES = (16, 32, 48, 128)
SAMPLES = 4  # supersampling per axis for anti-aliasing


def hexagon(size):
    c, r = size / 2, size * 0.49
    # Pointy-top, like the cells on the game board.
    return [(c + r * math.cos(math.radians(90 + 60 * i)), c + r * math.sin(math.radians(90 + 60 * i))) for i in range(6)]


def inside(pt, poly):
    x, y = pt
    hit = False
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            hit = not hit
    return hit


def seg_dist(p, a, b):
    (px, py), (ax, ay), (bx, by) = p, a, b
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def edge_dist(p, poly):
    return min(seg_dist(p, a, b) for a, b in zip(poly, poly[1:] + poly[:1]))


def render(size):
    poly = hexagon(size)
    border = max(1.0, size * 0.055)
    check = [(size * 0.29, size * 0.52), (size * 0.44, size * 0.67), (size * 0.72, size * 0.37)]
    stroke = max(1.1, size * 0.085)
    rows = []
    for y in range(size):
        row = bytearray([0])  # PNG filter: none
        for x in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(SAMPLES):
                for sx in range(SAMPLES):
                    p = (x + (sx + 0.5) / SAMPLES, y + (sy + 0.5) / SAMPLES)
                    if not inside(p, poly):
                        continue
                    on_check = min(seg_dist(p, check[0], check[1]), seg_dist(p, check[1], check[2])) <= stroke / 2
                    col = DARK if on_check or edge_dist(p, poly) <= border else YELLOW
                    acc[0] += col[0]
                    acc[1] += col[1]
                    acc[2] += col[2]
                    acc[3] += 1
            n = acc[3]
            if n:
                row += bytes([acc[0] // n, acc[1] // n, acc[2] // n, round(255 * n / SAMPLES ** 2)])
            else:
                row += bytes(4)
        rows.append(bytes(row))
    return rows


def png(size, rows):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + chunk(b"IEND", b"")


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")
    os.makedirs(out, exist_ok=True)
    for s in SIZES:
        with open(os.path.join(out, f"icon{s}.png"), "wb") as f:
            f.write(png(s, render(s)))
        print(f"icons/icon{s}.png")
