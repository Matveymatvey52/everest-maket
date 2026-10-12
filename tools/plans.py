"""Генератор SVG-планировок для макета Everest.

Каждая планировка задаётся комнатами в метрах (x, y, ширина, высота, тип, подпись).
Площадь считается из размеров. Окна и двери — отрезки на стенах.
Запуск: python3 -I tools/plans.py  →  assets/img/plans/*.svg
"""
import math
import os
import sys

S = 100  # пикселей на метр
EXT = 22  # толщина наружной стены
INT = 9   # толщина перегородки
INK = "#1d2a24"
LINE = "#9aa59f"
FILL = "#ffffff"
WET = "#eef3f1"
FONT = "Manrope, 'Helvetica Neue', Arial, sans-serif"

NAMES = {
    "living": "Гостиная",
    "kitchen": "Кухня",
    "kl": "Кухня-гостиная",
    "bed": "Спальня",
    "master": "Мастер-спальня",
    "kid": "Детская",
    "hall": "Прихожая",
    "bath": "Санузел",
    "wc": "С/у",
    "studio": "Студия",
    "ward": "Гардеробная",
    "terrace": "Терраса",
    "balcony": "Лоджия",
}


def fmt(a):
    return f"{a:.1f}".replace(".", ",")


def furniture(t, x, y, w, h, flip=False):
    """Мебель внутри комнаты. Координаты в пикселях."""
    out = []
    st = f'fill="none" stroke="{LINE}" stroke-width="3"'
    if t in ("bed", "master", "kid"):
        bw, bh = (160, 200) if t != "kid" else (90, 190)
        bx = x + w / 2 - bw / 2
        by = y + 26
        out.append(f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" rx="8" {st}/>')
        if t != "kid":
            out.append(f'<rect x="{bx+12}" y="{by+12}" width="{bw/2-18}" height="34" rx="8" {st}/>')
            out.append(f'<rect x="{bx+bw/2+6}" y="{by+12}" width="{bw/2-18}" height="34" rx="8" {st}/>')
        else:
            out.append(f'<rect x="{bx+12}" y="{by+12}" width="{bw-24}" height="30" rx="8" {st}/>')
        out.append(f'<line x1="{bx}" y1="{by+62}" x2="{bx+bw}" y2="{by+62}" stroke="{LINE}" stroke-width="3"/>')
    elif t in ("living",):
        sw = min(230, w - 60)
        sx = x + w / 2 - sw / 2
        sy = y + h - 120
        out.append(f'<rect x="{sx}" y="{sy}" width="{sw}" height="90" rx="12" {st}/>')
        out.append(f'<rect x="{sx+10}" y="{sy+10}" width="{sw-20}" height="30" rx="8" {st}/>')
        out.append(f'<circle cx="{x+w/2}" cy="{sy-70}" r="34" {st}/>')
    elif t in ("kl", "kitchen", "studio"):
        # кухонный гарнитур вдоль правой стены
        cx = x + w - 66 if not flip else x + 6
        ch = min(h - 80, 300 if t != "kitchen" else h - 60)
        cy = y + 30
        out.append(f'<rect x="{cx}" y="{cy}" width="60" height="{ch}" {st}/>')
        out.append(f'<circle cx="{cx+30}" cy="{cy+50}" r="16" {st}/>')
        for i in range(2):
            for j in range(2):
                out.append(f'<circle cx="{cx+18+i*24}" cy="{cy+ch-70+j*26}" r="8" {st}/>')
        # стол со стульями
        tx = x + (w * 0.42 if not flip else w * 0.58)
        ty = y + (h * 0.42 if t != "studio" else h * 0.70)
        out.append(f'<circle cx="{tx}" cy="{ty}" r="38" {st}/>')
        for a in range(4):
            ang = a * math.pi / 2 + math.pi / 4
            out.append(f'<circle cx="{tx+math.cos(ang)*62:.1f}" cy="{ty+math.sin(ang)*62:.1f}" r="15" {st}/>')
        if t == "kl" and w > 330 and h > 330:
            sw = min(220, w - 120)
            sx = x + 30 if not flip else x + w - sw - 30
            out.append(f'<rect x="{sx}" y="{y+h-112}" width="{sw}" height="84" rx="12" {st}/>')
        if t == "studio":
            out.append(f'<rect x="{x+26}" y="{y+26}" width="150" height="200" rx="8" {st}/>')
            out.append(f'<rect x="{x+38}" y="{y+38}" width="56" height="32" rx="8" {st}/>')
            out.append(f'<rect x="{x+108}" y="{y+38}" width="56" height="32" rx="8" {st}/>')
    elif t in ("bath",):
        out.append(f'<rect x="{x+12}" y="{y+12}" width="{min(170, w-24)}" height="75" rx="20" {st}/>')
        out.append(f'<ellipse cx="{x+w-40}" cy="{y+h-46}" rx="20" ry="28" {st}/>')
        out.append(f'<rect x="{x+12}" y="{y+h-62}" width="60" height="48" rx="10" {st}/>')
    elif t in ("wc",):
        out.append(f'<ellipse cx="{x+w/2}" cy="{y+h-46}" rx="20" ry="28" {st}/>')
        out.append(f'<rect x="{x+w/2-30}" y="{y+16}" width="60" height="42" rx="10" {st}/>')
    elif t in ("hall",):
        out.append(f'<rect x="{x+12}" y="{y+12}" width="{min(w-24, 200)}" height="56" {st}/>')
        for i in range(1, 4):
            xx = x + 12 + i * min(w - 24, 200) / 4
            out.append(f'<line x1="{xx}" y1="{y+12}" x2="{xx}" y2="{y+68}" stroke="{LINE}" stroke-width="2"/>')
    elif t == "ward":
        for i in range(3):
            out.append(f'<line x1="{x+20}" y1="{y+40+i*50}" x2="{x+w-20}" y2="{y+40+i*50}" stroke="{LINE}" stroke-width="2"/>')
    return out


def plan(name, rooms, outline, windows, doors, entry, extra=None):
    xs = [r[0] for r in rooms] + [r[0] + r[2] for r in rooms]
    ys = [r[1] for r in rooms] + [r[1] + r[3] for r in rooms]
    minx, miny = min(xs + [p[0] for p in outline]), min(ys + [p[1] for p in outline])
    maxx, maxy = max(xs + [p[0] for p in outline]), max(ys + [p[1] for p in outline])
    pad = 0.55
    vb = (minx - pad) * S, (miny - pad) * S, (maxx - minx + 2 * pad) * S, (maxy - miny + 2 * pad) * S
    el = []
    total = 0.0
    # заливка комнат
    for (x, y, w, h, t, *_rest) in rooms:
        fill = WET if t in ("bath", "wc") else ("#f6f7f4" if t in ("terrace", "balcony") else FILL)
        el.append(f'<rect x="{x*S}" y="{y*S}" width="{w*S}" height="{h*S}" fill="{fill}"/>')
    for (x, y, w, h, t, *rest) in rooms:
        flip = bool(rest and rest[0] == "flip")
        el += furniture(t, x * S, y * S, w * S, h * S, flip)
    # перегородки
    for (x, y, w, h, t, *_rest) in rooms:
        dash = ' stroke-dasharray="10 8"' if t in ("terrace", "balcony") else ""
        el.append(f'<rect x="{x*S}" y="{y*S}" width="{w*S}" height="{h*S}" fill="none" stroke="{INK}" stroke-width="{INT}"{dash}/>')
    # наружный контур
    pts = " ".join(f"{px*S},{py*S}" for px, py in outline)
    el.append(f'<polygon points="{pts}" fill="none" stroke="{INK}" stroke-width="{EXT}" stroke-linejoin="miter"/>')
    # окна: разрыв в стене + три тонкие линии
    for (x1, y1, x2, y2) in windows:
        if y1 == y2:
            el.append(f'<rect x="{x1*S}" y="{y1*S-EXT/2-1}" width="{(x2-x1)*S}" height="{EXT+2}" fill="#fff"/>')
            for k in (-EXT / 2, 0, EXT / 2):
                el.append(f'<line x1="{x1*S}" y1="{y1*S+k}" x2="{x2*S}" y2="{y2*S+k}" stroke="{INK}" stroke-width="2.5"/>')
        else:
            el.append(f'<rect x="{x1*S-EXT/2-1}" y="{y1*S}" width="{EXT+2}" height="{(y2-y1)*S}" fill="#fff"/>')
            for k in (-EXT / 2, 0, EXT / 2):
                el.append(f'<line x1="{x1*S+k}" y1="{y1*S}" x2="{x2*S+k}" y2="{y2*S}" stroke="{INK}" stroke-width="2.5"/>')
    # двери: (x, y, ориентация стены 'h'|'v', ширина, направление створки)
    for (x, y, ori, wd, sw) in doors:
        W = wd * S
        X, Y = x * S, y * S
        th = INT + 3
        if ori == "h":
            el.append(f'<rect x="{X}" y="{Y-th/2}" width="{W}" height="{th}" fill="#fff"/>')
            dy = W if sw == "down" else -W
            el.append(f'<line x1="{X}" y1="{Y}" x2="{X}" y2="{Y+dy}" stroke="{INK}" stroke-width="3"/>')
            sweep = 0 if sw == "down" else 1
            el.append(f'<path d="M {X} {Y+dy} A {W} {W} 0 0 {sweep} {X+W} {Y}" fill="none" stroke="{LINE}" stroke-width="2"/>')
        else:
            el.append(f'<rect x="{X-th/2}" y="{Y}" width="{th}" height="{W}" fill="#fff"/>')
            dx = W if sw == "right" else -W
            el.append(f'<line x1="{X}" y1="{Y}" x2="{X+dx}" y2="{Y}" stroke="{INK}" stroke-width="3"/>')
            sweep = 1 if sw == "right" else 0
            el.append(f'<path d="M {X+dx} {Y} A {W} {W} 0 0 {sweep} {X} {Y+W}" fill="none" stroke="{LINE}" stroke-width="2"/>')
    # вход в квартиру
    ex, ey, eori = entry
    if eori == "h":
        el.append(f'<rect x="{ex*S}" y="{ey*S-EXT/2-1}" width="{0.9*S}" height="{EXT+2}" fill="#fff"/>')
        el.append(f'<path d="M {ex*S+45} {ey*S+30} l 0 -60 m -16 16 l 16 -16 l 16 16" fill="none" stroke="#b8975e" stroke-width="4" transform="rotate(180 {ex*S+45} {ey*S})"/>')
    else:
        el.append(f'<rect x="{ex*S-EXT/2-1}" y="{ey*S}" width="{EXT+2}" height="{0.9*S}" fill="#fff"/>')
    # подписи
    for (x, y, w, h, t, *rest) in rooms:
        a = w * h
        if t not in ("terrace", "balcony"):
            total += a
        label = NAMES[t]
        cx, cy = (x + w / 2) * S, (y + h / 2) * S
        small = w < 2.0 or h < 2.0
        fs = 26 if not small else 21
        if t in ("bath", "wc", "hall", "ward") or small:
            el.append(f'<text x="{cx}" y="{cy+8}" font-size="{fs+4}" font-weight="700" text-anchor="middle" fill="{INK}" font-family="{FONT}" paint-order="stroke" stroke="#fff" stroke-width="10" stroke-linejoin="round">{fmt(a)}</text>')
        else:
            el.append(f'<text x="{cx}" y="{cy-6}" font-size="{fs}" text-anchor="middle" fill="#55625b" font-family="{FONT}" paint-order="stroke" stroke="#fff" stroke-width="10" stroke-linejoin="round">{label}</text>')
            el.append(f'<text x="{cx}" y="{cy+30}" font-size="{fs+6}" font-weight="700" text-anchor="middle" fill="{INK}" font-family="{FONT}" paint-order="stroke" stroke="#fff" stroke-width="10" stroke-linejoin="round">{fmt(a)}</text>')
    if extra:
        el.append(extra)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb[0]:.0f} {vb[1]:.0f} {vb[2]:.0f} {vb[3]:.0f}" '
           f'role="img" aria-label="Планировка, {fmt(total)} м²">' + "".join(el) + "</svg>")
    return svg, total


def rect_outline(w, h):
    return [(0, 0), (w, 0), (w, h), (0, h)]


PLANS = {}

# Студия 28 м²
PLANS["studio-28"] = dict(
    rooms=[(0, 0, 4.0, 4.6, "studio"), (0, 4.6, 2.1, 2.6, "hall"), (2.1, 4.6, 1.9, 2.6, "bath")],
    outline=rect_outline(4.0, 7.2), windows=[(0.5, 0, 3.5, 0)],
    doors=[(2.1, 5.0, "v", 0.7, "right"), (0.4, 4.6, "h", 0.9, "down")], entry=(0.6, 7.2, "h"))

PLANS["studio-29"] = dict(
    rooms=[(0, 0, 4.2, 4.5, "studio", "flip"), (2.0, 4.5, 2.2, 2.4, "hall"), (0, 4.5, 2.0, 2.4, "bath")],
    outline=rect_outline(4.2, 6.9), windows=[(0.6, 0, 3.6, 0)],
    doors=[(2.0, 4.9, "v", 0.7, "left"), (2.6, 4.5, "h", 0.9, "down")], entry=(2.8, 6.9, "h"))

PLANS["1k-32"] = dict(
    rooms=[(0, 0, 3.1, 3.5, "kitchen"), (3.1, 0, 3.4, 3.5, "bed"), (0, 3.5, 3.6, 1.9, "hall"), (3.6, 3.5, 2.9, 1.9, "bath")],
    outline=rect_outline(6.5, 5.4), windows=[(0.6, 0, 2.5, 0), (3.8, 0, 5.8, 0)],
    doors=[(1.2, 3.5, "h", 0.8, "up"), (3.7, 3.5, "h", 0.8, "up"), (3.6, 3.9, "v", 0.7, "right")], entry=(0.4, 5.4, "h"))

PLANS["1k-38"] = dict(
    rooms=[(0, 0, 3.2, 3.9, "bed"), (3.2, 0, 3.4, 3.9, "kl"), (0, 3.9, 3.6, 1.9, "hall"), (3.6, 3.9, 3.0, 1.9, "bath")],
    outline=rect_outline(6.6, 5.8), windows=[(0.5, 0, 2.7, 0), (3.6, 0, 6.1, 0)],
    doors=[(2.3, 3.9, "h", 0.8, "up"), (3.7, 3.9, "h", 0.9, "up"), (3.6, 4.4, "v", 0.7, "right")], entry=(0.5, 5.8, "h"))

PLANS["1k-42"] = dict(
    rooms=[(0, 0, 3.3, 3.9, "bed"), (3.3, 0, 3.7, 3.9, "kl"), (0, 3.9, 4.2, 2.1, "hall"), (4.2, 3.9, 2.8, 2.1, "bath")],
    outline=rect_outline(7.0, 6.0), windows=[(0.5, 0, 2.8, 0), (3.8, 0, 6.5, 0)],
    doors=[(2.4, 3.9, "h", 0.8, "up"), (3.5, 3.9, "h", 0.9, "up"), (4.2, 4.5, "v", 0.7, "right")], entry=(0.5, 6.0, "h"))

PLANS["e2-40"] = dict(
    rooms=[(0, 0, 3.0, 3.8, "bed"), (3.0, 0, 3.7, 3.8, "kl"), (0, 3.8, 4.0, 2.2, "hall"), (4.0, 3.8, 2.7, 2.2, "bath")],
    outline=rect_outline(6.7, 6.0), windows=[(0.2, 0, 2.8, 0), (3.2, 0, 6.5, 0)],
    doors=[(2.1, 3.8, "h", 0.8, "up"), (3.2, 3.8, "h", 0.9, "up"), (4.0, 4.4, "v", 0.7, "right")], entry=(0.5, 6.0, "h"))

PLANS["e2-44"] = dict(
    rooms=[(0, 0, 3.2, 3.8, "bed"), (3.2, 0, 4.4, 3.8, "kl"), (0, 3.8, 4.4, 2.0, "hall"), (4.4, 3.8, 3.2, 2.0, "bath")],
    outline=rect_outline(7.6, 5.8), windows=[(0.5, 0, 2.7, 0), (3.7, 0, 7.1, 0)],
    doors=[(2.3, 3.8, "h", 0.8, "up"), (3.4, 3.8, "h", 0.9, "up"), (4.4, 4.4, "v", 0.7, "right")], entry=(0.5, 5.8, "h"))

PLANS["2k-50"] = dict(
    rooms=[(0, 0, 2.9, 3.9, "bed"), (2.9, 0, 2.9, 3.9, "kl"), (5.8, 0, 2.6, 3.9, "kid"), (0, 3.9, 5.5, 2.0, "hall"), (5.5, 3.9, 2.9, 2.0, "bath")],
    outline=rect_outline(8.4, 5.9), windows=[(0.4, 0, 2.5, 0), (3.3, 0, 5.4, 0), (6.2, 0, 8.0, 0)],
    doors=[(1.9, 3.9, "h", 0.8, "up"), (3.0, 3.9, "h", 0.9, "up"), (6.0, 3.9, "h", 0.8, "up"), (5.5, 4.5, "v", 0.7, "right")],
    entry=(0.5, 5.9, "h"))

PLANS["2k-54"] = dict(
    rooms=[(0, 0, 2.9, 4.3, "bed"), (2.9, 0, 3.0, 4.3, "kl"), (5.9, 0, 2.5, 4.3, "kid"), (0, 4.3, 5.5, 2.1, "hall"), (5.5, 4.3, 2.9, 2.1, "bath")],
    outline=rect_outline(8.4, 6.4), windows=[(0.4, 0, 2.5, 0), (3.3, 0, 5.5, 0), (6.3, 0, 8.0, 0)],
    doors=[(1.9, 4.3, "h", 0.8, "up"), (3.0, 4.3, "h", 0.9, "up"), (6.1, 4.3, "h", 0.8, "up"), (5.5, 4.9, "v", 0.7, "right")],
    entry=(0.5, 6.4, "h"))

PLANS["e3-57"] = dict(
    rooms=[(0, 0, 3.0, 4.2, "bed"), (3.0, 0, 3.6, 4.2, "kl"), (6.6, 0, 2.4, 4.2, "kid"),
           (0, 4.2, 5.0, 2.2, "hall"), (5.0, 4.2, 2.2, 2.2, "bath"), (7.2, 4.2, 1.8, 2.2, "wc")],
    outline=rect_outline(9.0, 6.4), windows=[(0.4, 0, 2.6, 0), (3.4, 0, 6.2, 0), (6.9, 0, 8.7, 0)],
    doors=[(2.0, 4.2, "h", 0.8, "up"), (3.2, 4.2, "h", 0.9, "up"), (6.8, 4.2, "h", 0.8, "up"), (5.0, 4.8, "v", 0.7, "right")],
    entry=(0.6, 6.4, "h"))

PLANS["3k-82"] = dict(
    rooms=[(0, 0, 3.2, 4.6, "bed"), (3.2, 0, 4.0, 4.6, "living"), (7.2, 0, 3.2, 4.6, "kid"),
           (0, 4.6, 3.6, 3.3, "kitchen"), (3.6, 4.6, 3.0, 3.3, "hall"), (6.6, 4.6, 1.9, 3.3, "bath"), (8.5, 4.6, 1.9, 3.3, "wc")],
    outline=rect_outline(10.4, 7.9), windows=[(0.5, 0, 2.7, 0), (3.7, 0, 6.7, 0), (7.7, 0, 9.9, 0), (0, 5.2, 0, 7.3)],
    doors=[(2.2, 4.6, "h", 0.8, "up"), (4.6, 4.6, "h", 0.9, "up"), (7.4, 4.6, "h", 0.8, "up"), (3.6, 5.2, "v", 0.8, "left"),
           (6.6, 6.6, "v", 0.7, "right")],
    entry=(4.6, 7.9, "h"))

PLANS["4k-100"] = dict(
    rooms=[(0, 0, 3.8, 4.8, "master"), (3.8, 0, 4.6, 4.8, "kl"), (8.4, 0, 2.6, 4.8, "kid"),
           (0, 4.8, 3.3, 4.3, "bed"), (3.3, 4.8, 3.4, 4.3, "hall"), (6.7, 4.8, 2.0, 4.3, "bath"), (8.7, 4.8, 2.3, 4.3, "bath")],
    outline=rect_outline(11.0, 9.1), windows=[(0.5, 0, 3.3, 0), (4.3, 0, 7.9, 0), (8.8, 0, 10.6, 0), (0, 5.4, 0, 8.4), (11.0, 5.8, 11.0, 7.2)],
    doors=[(2.8, 4.8, "h", 0.8, "up"), (4.6, 4.8, "h", 0.9, "up"), (8.6, 4.8, "h", 0.8, "up"), (3.3, 5.3, "v", 0.8, "left"),
           (6.7, 7.6, "v", 0.7, "right"), (8.7, 5.2, "v", 0.7, "left")],
    entry=(4.6, 9.1, "h"))

PLANS["ph-146"] = dict(
    rooms=[(0, -1.4, 7.0, 1.4, "terrace"), (0, 0, 7.0, 5.2, "kl"), (7.0, 0, 3.6, 5.2, "master"), (10.6, 0, 3.0, 5.2, "bath"),
           (0, 5.2, 3.6, 5.55, "bed"), (3.6, 5.2, 4.4, 5.55, "hall"), (8.0, 5.2, 2.4, 5.55, "bath"), (10.4, 5.2, 3.2, 5.55, "ward")],
    outline=rect_outline(13.6, 10.75),
    windows=[(0.6, 0, 6.4, 0), (7.4, 0, 10.2, 0), (11.0, 0, 13.2, 0), (0, 6.0, 0, 9.8), (13.6, 6.2, 13.6, 9.6)],
    doors=[(3.0, 0, "h", 1.2, "up"), (7.0, 3.9, "v", 0.9, "right"), (10.6, 1.0, "v", 0.8, "left"), (3.6, 6.2, "v", 0.9, "left"),
           (8.0, 7.6, "v", 0.8, "right"), (10.4, 6.2, "v", 0.9, "right"), (4.5, 5.2, "h", 1.2, "up")],
    entry=(5.4, 10.75, "h"))

PLANS["ph-185"] = dict(
    rooms=[(0, -1.6, 8.0, 1.6, "terrace"), (0, 0, 8.0, 5.8, "kl"), (8.0, 0, 4.0, 5.8, "master"), (12.0, 0, 3.2, 5.8, "bath"),
           (0, 5.8, 3.8, 6.3, "bed"), (3.8, 5.8, 3.6, 6.3, "kid"), (7.4, 5.8, 3.6, 6.3, "hall"), (11.0, 5.8, 2.0, 6.3, "bath"), (13.0, 5.8, 2.2, 6.3, "ward")],
    outline=rect_outline(15.2, 12.1),
    windows=[(0.6, 0, 7.4, 0), (8.4, 0, 11.6, 0), (12.4, 0, 14.8, 0), (0, 6.6, 0, 11.4), (15.2, 6.6, 15.2, 11.2)],
    doors=[(3.4, 0, "h", 1.2, "up"), (8.0, 4.4, "v", 0.9, "right"), (12.0, 1.0, "v", 0.8, "left"), (2.6, 5.8, "h", 0.9, "up"),
           (4.6, 5.8, "h", 0.9, "up"), (8.0, 5.8, "h", 1.2, "up"), (11.0, 8.4, "v", 0.8, "right"), (13.0, 6.6, "v", 0.8, "right")],
    entry=(8.8, 12.1, "h"))


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(root, "assets", "img", "plans")
    os.makedirs(out, exist_ok=True)
    for key, p in PLANS.items():
        svg, total = plan(key, **p)
        with open(os.path.join(out, f"{key}.svg"), "w", encoding="utf-8") as f:
            f.write(svg)
        print(f"{key}: {total:.1f} м²")


if __name__ == "__main__":
    sys.exit(main())
