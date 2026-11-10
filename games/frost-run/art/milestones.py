"""Draws the 23 milestone pictures for the staff page, as plain SVG in the platform's strict subset.

Run it from the game's folder: `python3 art/milestones.py`. It writes `milestones/<id>.svg`, one for each milestone in
`src/rules/milestones.ts`. Every picture is shapes and gradients only: no text, no `use`, no styles, hex colours, one root with
`xmlns` and a `viewBox` (docs/product/milestone-drawings.md). `test/milestone-art.unit.test.ts` checks each one with the platform's own
sanitizer. Orange is the crystal's moment in the game, so no picture uses it.
"""

import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "milestones")

MINT = "#3fe0a0"
MINT_DEEP = "#1f9e74"
MINT_PALE = "#b8f5dc"
ICE = "#eaf6ff"
FROST = "#9fd8f2"
FROST_DEEP = "#4f86a3"
EGG = "#c9bdea"
EGG_DEEP = "#8a78c4"
KEY = "#bfeaff"
KEY_DEEP = "#6fa9c7"
NIGHT = "#0b0a08"
DEEP = "#12202b"
STEEL = "#5c6f7d"
PINK = "#ff8fd8"
CYAN = "#7cf9ff"
LAMP = "#ffe9a8"
RED = "#e8475f"


def f(value):
    text = f"{value:.1f}"
    return text[:-2] if text.endswith(".0") else text


def pts(points):
    return " ".join(f"{f(x)},{f(y)}" for x, y in points)


def poly(points, fill, extra=""):
    return f'<polygon points="{pts(points)}" fill="{fill}"{extra}/>'


def circle(cx, cy, r, fill, extra=""):
    return f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{fill}"{extra}/>'


def ellipse(cx, cy, rx, ry, fill, extra=""):
    return f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" fill="{fill}"{extra}/>'


def path(d, fill="none", extra=""):
    return f'<path d="{d}" fill="{fill}"{extra}/>'


def line(x1, y1, x2, y2, stroke, width, extra=""):
    return (
        f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}" stroke="{stroke}" '
        f'stroke-width="{f(width)}" stroke-linecap="round"{extra}/>'
    )


def stroke(colour, width, cap="round"):
    return f' stroke="{colour}" stroke-width="{f(width)}" stroke-linecap="{cap}" stroke-linejoin="round"'


def sparkle(x, y, r, fill=ICE):
    d = (
        f"M{f(x)} {f(y - r)}L{f(x + r * 0.22)} {f(y - r * 0.22)}L{f(x + r)} {f(y)}L{f(x + r * 0.22)} {f(y + r * 0.22)}"
        f"L{f(x)} {f(y + r)}L{f(x - r * 0.22)} {f(y + r * 0.22)}L{f(x - r)} {f(y)}L{f(x - r * 0.22)} {f(y - r * 0.22)}Z"
    )
    return path(d, fill)


def crystal(cx, cy, s, light=MINT_PALE, mid=MINT, dark=MINT_DEEP):
    """A cut crystal standing up, `s` about half its height."""
    top = (cx, cy - s)
    ul, ur = (cx - s * 0.55, cy - s * 0.35), (cx + s * 0.55, cy - s * 0.35)
    ll, lr = (cx - s * 0.42, cy + s * 0.55), (cx + s * 0.42, cy + s * 0.55)
    bottom = (cx, cy + s)
    return "".join(
        [
            poly([top, ur, (cx, cy - s * 0.1), ul], light),
            poly([ul, (cx, cy - s * 0.1), bottom, ll], mid),
            poly([ur, lr, bottom, (cx, cy - s * 0.1)], dark),
        ]
    )


def egg(cx, cy, s, fill="url(#egg)"):
    d = (
        f"M{f(cx)} {f(cy - s)}C{f(cx + s * 0.62)} {f(cy - s)} {f(cx + s * 0.78)} {f(cy + s * 0.2)} {f(cx + s * 0.72)} {f(cy + s * 0.42)}"
        f"C{f(cx + s * 0.62)} {f(cy + s * 0.86)} {f(cx + s * 0.3)} {f(cy + s * 0.98)} {f(cx)} {f(cy + s * 0.98)}"
        f"C{f(cx - s * 0.3)} {f(cy + s * 0.98)} {f(cx - s * 0.62)} {f(cy + s * 0.86)} {f(cx - s * 0.72)} {f(cy + s * 0.42)}"
        f"C{f(cx - s * 0.78)} {f(cy + s * 0.2)} {f(cx - s * 0.62)} {f(cy - s)} {f(cx)} {f(cy - s)}Z"
    )
    spots = "".join(
        circle(cx + dx * s, cy + dy * s, r * s, EGG_DEEP, ' opacity="0.55"')
        for dx, dy, r in [(-0.3, 0.1, 0.09), (0.22, 0.38, 0.07), (0.05, -0.35, 0.06), (0.35, -0.05, 0.05)]
    )
    shine = ellipse(cx - s * 0.28, cy - s * 0.42, s * 0.12, s * 0.22, ICE, ' opacity="0.7"')
    return path(d, fill) + spots + shine


def key(cx, cy, s, fill=KEY, deep=KEY_DEEP, dash=""):
    """A key standing up, its ring at the top; `s` about half its height."""
    ring = circle(cx, cy - s * 0.55, s * 0.36, "none", stroke(fill, s * 0.16) + dash)
    shaft = line(cx, cy - s * 0.2, cx, cy + s, fill, s * 0.16, dash)
    teeth = line(cx, cy + s * 0.62, cx + s * 0.3, cy + s * 0.62, fill, s * 0.14, dash) + line(
        cx, cy + s * 0.9, cx + s * 0.24, cy + s * 0.9, fill, s * 0.14, dash
    )
    gem = "" if dash else circle(cx, cy - s * 0.55, s * 0.11, deep)
    return ring + shaft + teeth + gem


def snowball(cx, cy, r):
    return circle(cx, cy, r, "url(#snow)") + ellipse(cx - r * 0.3, cy - r * 0.35, r * 0.28, r * 0.18, ICE, ' opacity="0.8"')


def blob(cx, cy, r, scarf=True):
    """A small round hero, from above the knees."""
    body = circle(cx, cy, r, ICE) + circle(cx - r * 0.32, cy - r * 0.15, r * 0.11, NIGHT) + circle(cx + r * 0.32, cy - r * 0.15, r * 0.11, NIGHT)
    feet = ellipse(cx - r * 0.42, cy + r * 0.95, r * 0.3, r * 0.16, FROST) + ellipse(cx + r * 0.42, cy + r * 0.95, r * 0.3, r * 0.16, FROST)
    band = path(f"M{f(cx - r * 0.9)} {f(cy + r * 0.25)}Q{f(cx)} {f(cy + r * 0.62)} {f(cx + r * 0.9)} {f(cy + r * 0.25)}", "none", stroke(RED, r * 0.28)) if scarf else ""
    return feet + body + band


def floe(cx, cy, rx, ry):
    cracks = path(
        f"M{f(cx - rx * 0.5)} {f(cy - ry * 0.1)}l{f(rx * 0.25)} {f(ry * 0.2)}l{f(rx * 0.18)} {f(-ry * 0.25)}"
        f"M{f(cx + rx * 0.15)} {f(cy + ry * 0.35)}l{f(rx * 0.2)} {f(-ry * 0.3)}l{f(rx * 0.2)} {f(ry * 0.1)}",
        "none",
        stroke(FROST_DEEP, 1.6),
    )
    return ellipse(cx, cy + ry * 0.18, rx, ry, FROST_DEEP) + ellipse(cx, cy, rx, ry, "url(#ice)") + cracks


def spike_ring(cx, cy, r, count, size, fill, broken=()):
    out = []
    for at in range(count):
        if at in broken:
            continue
        a = at / count * math.tau - math.pi / 2
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
        out.append(poly([(x, y - size), (x + size * 0.45, y + size * 0.4), (x - size * 0.45, y + size * 0.4)], fill))
    return "".join(out)


def badge(emblem, aurora=MINT):
    defs = (
        "<defs>"
        '<radialGradient id="sky" cx="50%" cy="36%" r="64%"><stop offset="0" stop-color="#1d3a4a"/><stop offset="1" stop-color="#0b0a08"/></radialGradient>'
        '<linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eaf6ff"/><stop offset="1" stop-color="#4f86a3"/></linearGradient>'
        f'<linearGradient id="aur" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{aurora}" stop-opacity="0"/>'
        f'<stop offset="0.5" stop-color="{aurora}" stop-opacity="0.55"/><stop offset="1" stop-color="#9fd8f2" stop-opacity="0"/></linearGradient>'
        '<linearGradient id="ice" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4fbff"/><stop offset="1" stop-color="#a9d3e8"/></linearGradient>'
        '<radialGradient id="snow" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#a9c8da"/></radialGradient>'
        '<linearGradient id="egg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ece6ff"/><stop offset="1" stop-color="#9d8bd6"/></linearGradient>'
        '<clipPath id="disc"><circle cx="64" cy="64" r="55"/></clipPath>'
        "</defs>"
    )
    stars = "".join(circle(x, y, r, ICE, ' opacity="0.7"') for x, y, r in [(30, 34, 1.2), (96, 28, 1), (104, 52, 1.3), (22, 60, 0.9), (84, 18, 0.8)])
    sky = (
        circle(64, 64, 60, "url(#rim)")
        + circle(64, 64, 55, "url(#sky)")
        + f'<g clip-path="url(#disc)">'
        + path("M4 58C30 30 62 44 84 30S118 18 128 26L128 44C112 38 96 50 80 52S34 50 4 76Z", "url(#aur)")
        + stars
        + emblem
        + "</g>"
    )
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">{defs}{sky}</svg>'


def ground(y=96):
    return ellipse(64, y + 22, 70, 28, "#1b2f3c") + ellipse(64, y + 20, 64, 24, "url(#ice)", ' opacity="0.25"')


def drawings():
    d = {}
    d["first-crystal"] = badge(ground() + crystal(64, 66, 30) + sparkle(90, 38, 7) + sparkle(40, 44, 4))
    d["first-egg"] = badge(ground() + egg(64, 66, 30) + sparkle(92, 42, 6), EGG)
    d["first-key"] = badge(ground() + key(60, 62, 32) + sparkle(88, 40, 6), KEY)
    d["floe-clear"] = badge(
        floe(64, 78, 42, 16)
        + circle(36, 76, 5, STEEL)
        + circle(92, 80, 6, STEEL)
        + sparkle(64, 46, 10, MINT_PALE)
        + sparkle(42, 54, 5)
        + sparkle(86, 54, 5)
    )
    islets = "".join(ellipse(64 + math.cos(a) * 34, 74 + math.sin(a) * 18, 9, 4.5, "url(#ice)") for a in [i / 5 * math.tau - math.pi / 2 for i in range(5)])
    d["sound-clear"] = badge(
        ellipse(64, 76, 58, 30, "#163447")
        + path("M10 70Q36 64 64 70T118 70", "none", stroke(FROST_DEEP, 1.4))
        + ellipse(64, 76, 14, 7, "url(#ice)")
        + islets
        + sparkle(64, 40, 9, MINT_PALE)
    )
    spires = "".join(
        poly([(x - w, 86), (x, 86 - h), (x + w, 86)], c)
        for x, w, h, c in [(36, 7, 26, FROST), (50, 8, 38, ICE), (64, 9, 50, ICE), (78, 8, 38, ICE), (92, 7, 26, FROST)]
    )
    d["crown-clear"] = badge(ground(88) + spires + path("M30 86H98V94H30Z", FROST_DEEP) + sparkle(64, 26, 7, MINT_PALE), "#b39cff")
    branches = ""
    for i in range(6):
        a = i / 6 * math.tau - math.pi / 2
        ex, ey = 64 + math.cos(a) * 42, 64 + math.sin(a) * 42
        branches += line(64, 64, ex, ey, ICE, 4.2)
        for t, length in [(0.45, 13), (0.72, 9)]:
            bx, by = 64 + math.cos(a) * 42 * t, 64 + math.sin(a) * 42 * t
            for side in (-1, 1):
                b = a + side * 0.75
                branches += line(bx, by, bx + math.cos(b) * length, by + math.sin(b) * length, ICE, 3)
        branches += circle(ex, ey, 3.4, MINT)
    d["perfect-haul"] = badge(branches + circle(64, 64, 7, MINT) + circle(64, 64, 3, ICE))
    shield = path("M64 34L90 44V64C90 80 78 92 64 98C50 92 38 80 38 64V44Z", "url(#ice)", stroke(FROST_DEEP, 2.4))
    d["untouched-floe"] = badge(floe(64, 96, 50, 12) + shield + path("M52 64L61 74L78 54", "none", stroke(MINT_DEEP, 5)))
    watch = circle(66, 68, 28, "url(#ice)", stroke(FROST_DEEP, 3)) + path("M60 34H72V40H60Z", FROST_DEEP)
    marks = "".join(line(66 + math.cos(a) * 21, 68 + math.sin(a) * 21, 66 + math.cos(a) * 25, 68 + math.sin(a) * 25, FROST_DEEP, 2) for a in [i / 12 * math.tau for i in range(12)])
    d["swift-floe"] = badge(
        line(14, 56, 32, 56, FROST, 3) + line(10, 68, 30, 68, FROST, 3) + line(16, 80, 32, 80, FROST, 3) + watch + marks + line(66, 68, 66, 50, NIGHT, 3.2) + line(66, 68, 80, 74, MINT_DEEP, 3.2) + circle(66, 68, 3, NIGHT)
    )
    d["hop-scotch"] = badge(
        ground(92)
        + path("M26 92Q64 6 102 92", "none", stroke(FROST, 2.4) + ' stroke-dasharray="5 6"')
        + snowball(64, 88, 16)
        + blob(64, 36, 11)
    )
    d["heads-down"] = badge(
        ground(92)
        + poly([(22, 50), (78, 44), (78, 56)], ICE)
        + poly([(78, 44), (96, 50), (78, 56)], FROST)
        + line(8, 46, 30, 46, FROST, 2, ' opacity="0.6"')
        + line(12, 56, 34, 56, FROST, 2, ' opacity="0.6"')
        + ellipse(64, 92, 20, 11, ICE)
        + circle(56, 89, 2.4, NIGHT)
        + circle(70, 89, 2.4, NIGHT)
    )
    d["close-shave"] = badge(
        ground(92)
        + line(8, 70, 40, 70, FROST, 3, ' opacity="0.6"')
        + line(12, 82, 44, 82, FROST, 3, ' opacity="0.6"')
        + snowball(60, 76, 17)
        + blob(94, 74, 12)
        + sparkle(78, 64, 6, MINT_PALE)
    )
    d["double-spark"] = badge(ground() + crystal(46, 70, 24) + crystal(82, 62, 24) + sparkle(64, 34, 8) + sparkle(100, 92, 5))
    stops = [(64 + math.cos(a) * 36, 66 + math.sin(a) * 26) for a in [i / 5 * math.tau - math.pi / 2 for i in range(5)]]
    trail = "M" + "L".join(f"{f(x)} {f(y)}" for x, y in stops + [stops[0]])
    d["island-hopper"] = badge(
        ellipse(64, 70, 58, 38, "#163447")
        + path(trail, "none", stroke(MINT, 2.4) + ' stroke-dasharray="4 5"')
        + "".join(ellipse(x, y, 10, 6, "url(#ice)") for x, y in stops)
        + blob(64, 44, 8)
    )
    d["crate-cracker"] = badge(
        ground(92)
        + poly([(64, 40), (92, 52), (64, 64), (36, 52)], ICE)
        + poly([(36, 52), (64, 64), (64, 96), (36, 84)], FROST)
        + poly([(64, 64), (92, 52), (92, 84), (64, 96)], FROST_DEEP)
        + path("M50 60L56 72L50 80L56 90M76 62L72 74L80 82", "none", stroke(NIGHT, 2))
        + poly([(98, 36), (106, 40), (100, 46)], ICE)
        + poly([(24, 38), (30, 34), (32, 42)], ICE)
    )
    shards = "".join(
        poly([(64 + math.cos(a) * 14, 68 + math.sin(a) * 14), (64 + math.cos(a + 0.35) * 30, 68 + math.sin(a + 0.35) * 30), (64 + math.cos(a - 0.3) * 26, 68 + math.sin(a - 0.3) * 26)], ICE if i % 2 else FROST)
        for i, a in enumerate(i / 7 * math.tau for i in range(7))
    )
    d["snow-crusher"] = badge(ground(92) + shards + circle(64, 68, 12, "url(#snow)") + sparkle(64, 68, 9, MINT_PALE))
    d["wall-breaker"] = badge(ground(92) + spike_ring(64, 70, 30, 8, 12, FROST, broken=(1, 2)) + egg(64, 70, 15) + poly([(90, 42), (98, 38), (96, 48)], ICE) + poly([(100, 58), (110, 60), (102, 66)], ICE))
    eye = path("M16 66Q64 22 112 66Q64 110 16 66Z", "url(#ice)", stroke(FROST_DEEP, 2.4))
    d["frost-sight"] = badge(eye + circle(64, 66, 20, "#163447") + key(64, 62, 14, CYAN, CYAN, ' stroke-dasharray="3 3"') + sparkle(98, 36, 6, CYAN), "#7cc8ff")
    horn = lambda side: path(
        f"M{f(64 + side * 12)} 50C{f(64 + side * 34)} 30 {f(64 + side * 44)} 58 {f(64 + side * 30)} 66C{f(64 + side * 20)} 72 {f(64 + side * 18)} 60 {f(64 + side * 26)} 58",
        "none",
        stroke(PINK, 7),
    )
    d["win-as-volt"] = badge(
        ground(96)
        + path("M48 50Q64 36 80 50L76 86Q64 98 52 86Z", "#2a3f9e", stroke(CYAN, 2.4))
        + horn(-1)
        + horn(1)
        + circle(57, 64, 3.4, CYAN)
        + circle(71, 64, 3.4, CYAN)
        + line(52, 76, 76, 76, CYAN, 1.6, ' opacity="0.7"')
        + line(54, 82, 74, 82, CYAN, 1.6, ' opacity="0.7"'),
        CYAN,
    )
    wing = lambda side: path(f"M{f(64 + side * 16)} 66L{f(64 + side * 46)} 44L{f(64 + side * 38)} 62L{f(64 + side * 46)} 72Z", MINT_DEEP)
    d["win-as-nib"] = badge(
        ground(96)
        + wing(-1)
        + wing(1)
        + ellipse(64, 72, 20, 22, MINT)
        + poly([(52, 52), (56, 40), (60, 52)], MINT_PALE)
        + poly([(68, 52), (72, 40), (76, 52)], MINT_PALE)
        + ellipse(64, 82, 11, 8, MINT_PALE)
        + circle(56, 66, 3.6, NIGHT)
        + circle(72, 66, 3.6, NIGHT)
        + circle(57, 65, 1.2, ICE)
        + circle(73, 65, 1.2, ICE)
    )
    d["win-as-lumen"] = badge(
        ground(96)
        + line(30, 96, 92, 34, STEEL, 5)
        + path("M80 26Q96 30 104 46", "none", stroke(FROST, 6))
        + circle(64, 66, 22, LAMP, ' opacity="0.25"')
        + path("M54 54H74L72 82H56Z", "#2a3440", stroke(FROST, 2))
        + ellipse(64, 68, 6, 9, LAMP)
        + path("M58 54Q64 42 70 54", "none", stroke(FROST, 2)),
        LAMP,
    )
    d["win-as-hrimm"] = badge(
        ground(98)
        + path("M22 108Q24 86 40 82H88Q104 86 106 108Z", "#4f7f9b")
        + path("M38 90V70Q38 50 64 50Q90 50 90 70V90Q64 100 38 90Z", "#6f9bb6")
        + "".join(poly([(x - 6, 54), (x, 54 - h), (x + 6, 54)], ICE) for x, h in [(44, 14), (54, 22), (64, 28), (74, 22), (84, 14)])
        + path("M46 72H82", "none", stroke(NIGHT, 3))
        + circle(54, 68, 3.4, CYAN)
        + circle(74, 68, 3.4, CYAN)
        + path("M54 84Q64 90 74 84", "none", stroke(NIGHT, 2.4)),
        "#7cc8ff",
    )
    d["win-as-pip"] = badge(ground(96) + blob(64, 68, 26) + sparkle(98, 38, 6) + sparkle(30, 46, 4))
    return d


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, svg in drawings().items():
        with open(os.path.join(OUT, f"{name}.svg"), "w", encoding="ascii") as out:
            out.write(svg + "\n")


if __name__ == "__main__":
    main()
