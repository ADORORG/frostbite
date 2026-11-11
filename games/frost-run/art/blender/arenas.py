"""The three rounds' scenery. The numbers that matter to play (where the land, rocks, islets and
pillars are) mirror src/rules/levels.ts: rules millimetres (x east, y south) become Blender metres
(x, -y). Everything else is dressing: water, floating chunks, distant bergs and peaks, an aurora.
"""
import math

import bpy  # noqa: F401
import bmesh
from mathutils import Vector, noise

import lib

# ---- mirror of src/rules/levels.ts (millimetres) ----
FLOE_ROCKS = [(2936, -9035, 1050), (8643, -4404, 800), (8940, 2905, 1200), (4530, 8520, 900),
              (-2763, 9037, 1100), (-8643, 4404, 850), (-8888, -3060, 1150), (-4358, -8554, 950)]
SOUND_LAND = [(0, 0, 5600), (7053, -9708, 2300), (11413, 3708, 2000), (0, 12000, 2400), (-11413, 3708, 2100), (-7053, -9708, 2200)]
CROWN_PILLARS = [(3253, -3253, 700), (3253, 3253, 700), (-3253, 3253, 700), (-3253, -3253, 700)]


def at(x_mm, y_mm):
    return x_mm / 1000.0, -y_mm / 1000.0


def h(i, mod=97):
    return ((i * 2654435761) % mod) / mod


def mix(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


SNOW = (0.95, 0.97, 0.99)
ICE = (0.66, 0.84, 0.92)
CRACK = (0.36, 0.58, 0.74)
CLIFF = (0.55, 0.78, 0.9)
DEEP = (0.1, 0.27, 0.4)


def zip_rings(bm, inner, inner_angles, outer, outer_angles):
    """Joins two closed rings of different sizes with triangles, walking both by angle."""
    def unwrap(values, start):
        return [((v - start) % math.tau) for v in values]
    start = inner_angles[0]
    ia = unwrap(inner_angles, start) + [math.tau]
    oa = unwrap(outer_angles, start)
    first = min(range(len(oa)), key=lambda k: oa[k])
    outer = outer[first:] + outer[:first]
    oa = oa[first:] + oa[:first]
    oa = oa + [oa[0] + math.tau]
    inner = inner + [inner[0]]
    outer = outer + [outer[0]]
    a = b = 0
    while a < len(inner) - 1 or b < len(outer) - 1:
        if b >= len(outer) - 1 or (a < len(inner) - 1 and ia[a + 1] < oa[b + 1]):
            tri = (inner[a], outer[b], inner[a + 1])
            a += 1
        else:
            tri = (inner[a], outer[b], outer[b + 1])
            b += 1
        if len(set(tri)) == 3:
            try:
                bm.faces.new(tri)
            except ValueError:
                pass


def cracks(name, cx, cy, radius, seed, count, mat):
    """Thin dark cracks lying on the ice: jagged lines with a branch or two."""
    bm = bmesh.new()
    for c in range(count):
        a = math.tau * h(c * 53 + int(seed * 7), 1013)
        d = radius * (0.2 + 0.65 * h(c * 29 + 3, 1019))
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
        heading = math.tau * h(c * 71 + 5, 1021)
        pts = [(x, y)]
        for k in range(5 + int(4 * h(c + 9, 97))):
            heading += (h(c * 13 + k * 7, 103) - 0.5) * 1.4
            step = 0.35 + 0.35 * h(k * 11 + c, 107)
            x, y = x + math.cos(heading) * step, y + math.sin(heading) * step
            pts.append((x, y))
        for k in range(len(pts) - 1):
            (x0, y0), (x1, y1) = pts[k], pts[k + 1]
            dx, dy = x1 - x0, y1 - y0
            ln = math.hypot(dx, dy) or 1.0
            px, py = -dy / ln, dx / ln
            w0 = 0.045 * (1 - k / len(pts)) + 0.012
            w1 = 0.045 * (1 - (k + 1) / len(pts)) + 0.012
            z = 0.045
            v = [bm.verts.new((x0 + px * w0, y0 + py * w0, z)), bm.verts.new((x1 + px * w1, y1 + py * w1, z)),
                 bm.verts.new((x1 - px * w1, y1 - py * w1, z)), bm.verts.new((x0 - px * w0, y0 - py * w0, z))]
            bm.faces.new(v)
    return lib.mesh_object(name, bm, mat)


def floe(name, cx, cy, radius, seed, depth=2.2, wobble=0.45, rings=9, segs=56, lip=True, mat=None):
    """An ice floe: an uneven top inside a wobbly outline, a rounded lip and jagged sides going down."""
    bm = bmesh.new()

    def rim(a):
        return radius + wobble * noise.noise(Vector((math.cos(a) * 1.4 + seed, math.sin(a) * 1.4 - seed, seed * 0.7))) + 0.1 * math.sin(5 * a + seed)

    def top_z(x, y, f):
        z = 0.03 * noise.noise(Vector((x * 0.35 + seed, y * 0.35, 0.5)))
        if lip and f > 0.86:
            z += 0.09 * (f - 0.86) / 0.14 * (0.6 + 0.4 * noise.noise(Vector((x * 0.9, y * 0.9, seed))))
        return z

    # Rings of even triangles: each ring has as many points as its length needs, and neighbouring rings are zipped together.
    centre = bm.verts.new((cx, cy, top_z(cx, cy, 0)))
    grid = [[centre]]
    angles = [[0.0]]
    for i in range(1, rings + 1):
        f = i / rings
        count = segs if i == rings else max(6, round(segs * f))
        offset = 0.0 if i == rings else math.tau * h(i * 977 + int(seed * 13), 1009) / count
        ring, ring_angles = [], []
        for k in range(count):
            a = offset + math.tau * k / count
            jitter = 0.0 if i == rings else 0.08 * (h(i * 131 + k) - 0.5) * radius / rings
            r = rim(a) * f + jitter
            x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
            ring.append(bm.verts.new((x, y, top_z(x, y, f))))
            ring_angles.append(a)
        grid.append(ring)
        angles.append(ring_angles)
    for k in range(len(grid[1])):
        bm.faces.new((centre, grid[1][k], grid[1][(k + 1) % len(grid[1])]))
    for i in range(1, rings):
        zip_rings(bm, grid[i], angles[i], grid[i + 1], angles[i + 1])
    grid = grid[1:]
    # The sides: a rounded lip, the waterline, then down and in.
    edge = grid[-1]
    steps = ((0.08, -0.14), (0.14, -0.34), (0.05, -depth * 0.55), (-0.25 * radius, -depth))
    prev = edge
    for out, z in steps:
        ring = []
        for k, v in enumerate(prev):
            d = Vector((v.co.x - cx, v.co.y - cy, 0))
            d = d.normalized() if d.length > 0 else Vector((1, 0, 0))
            wob = 0.12 * (h(k * 7 + int(z * 10) + seed) - 0.5)
            p = Vector((edge[k].co.x, edge[k].co.y, 0)) + d * (out + wob)
            ring.append(bm.verts.new((p.x, p.y, z)))
        for k in range(segs):
            bm.faces.new((prev[k], prev[(k + 1) % segs], ring[(k + 1) % segs], ring[k]))
        prev = ring
    bottom = bm.verts.new((cx, cy, -depth - 0.2))
    for k in range(segs):
        bm.faces.new((prev[(k + 1) % segs], prev[k], bottom))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = lib.mesh_object(name, bm, mat)

    def colour(c, n, i):
        if c.z < -0.3:
            return mix(CLIFF, DEEP, min(1.0, (-c.z - 0.3) / max(depth * 0.7, 0.1)))
        if n.z < 0.6:
            return mix(CLIFF, SNOW, 0.35 + 0.2 * h(i))
        patch = noise.noise(Vector((c.x * 0.13 + seed, c.y * 0.13, 1.7)))
        base = SNOW if patch > 0.05 else mix(SNOW, ICE, 0.5) if patch > -0.12 else ICE
        return tuple(v - 0.035 * h(i, 89) for v in base)
    lib.paint(obj, colour)
    return obj


def rock(x, y, r, seed, mat):
    bm = lib.lumpy(lib.ico(1.0, 1), 0.18, scale=1.3, seed=seed)
    lib.transform(bm, loc=(x, y, r * 0.18), rot=(0, 0, seed * 37), scale=(r, r * 0.88, r * 0.72))
    obj = lib.mesh_object(f"rock_{seed}", bm, mat)

    def colour(c, n, i):
        if n.z > 0.55:
            return tuple(v - 0.03 * h(i) for v in SNOW)
        g = 0.25 + 0.08 * h(i, 89)
        return (g * 1.05, g * 1.0, g * 0.92)
    lib.paint(obj, colour)
    return obj


def berg(x, y, s, seed, mat):
    bm = lib.lumpy(lib.ico(1.0, 1), 0.25, scale=0.9, seed=seed)
    lib.transform(bm, loc=(x, y, s * 0.6), rot=(0, 0, seed * 53), scale=(s * 1.1, s, s * 1.6))
    obj = lib.mesh_object(f"berg_{seed}", bm, mat)
    lib.paint(obj, lambda c, n, i: mix(CLIFF, SNOW, max(0.0, min(1.0, 0.4 + 0.5 * n.z)) - 0.05 * h(i)))
    return obj


def water(size=140.0, cells=24, z=-0.32, mat=None):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=cells, y_segments=cells, size=size / 2)
    lib.transform(bm, loc=(0, 0, z))
    return lib.mesh_object("Water", bm, mat)


def chunks(count, near, far, seed, mat, avoid=()):
    out = []
    k = 0
    tries = 0
    while len(out) < count and tries < 200:
        tries += 1
        a = math.tau * h(seed * 31 + tries, 1009)
        d = near + (far - near) * h(seed * 17 + tries * 3, 1013)
        x, y = math.cos(a) * d, math.sin(a) * d
        if any((x - ax) ** 2 + (y - ay) ** 2 < (ar + 2.0) ** 2 for ax, ay, ar in avoid):
            continue
        r = 0.45 + 0.6 * h(tries * 7 + seed, 101)
        c = floe(f"Chunk.{k}", 0, 0, r, seed + tries, depth=0.7, wobble=0.12 * r, rings=2, segs=9, lip=False, mat=mat)
        c.location = (x, y, 0.02)
        out.append(c)
        k += 1
    return out


def floe_round():
    scene = lib.use_scene("Floe")
    ice = lib.material("arena_ice", "#FFFFFF", rough=0.4, vcol=True)
    stone = lib.material("arena_rock", "#FFFFFF", rough=0.85, vcol=True)
    sea = lib.material("arena_water", "#0B1C25", rough=0.08)
    dark = lib.material("arena_crack", "#5B8FB0", rough=0.6)
    main = lib.join([floe("Floe", 0, 0, 9.65, seed=1.0, mat=ice), cracks("floe_cracks", 0, 0, 8.6, 1.0, 9, dark)], "Floe")
    rocks = [rock(*at(x, y), r / 1000.0, i + 1, stone) for i, (x, y, r) in enumerate(FLOE_ROCKS)]
    rock_obj = lib.join(rocks, "Rocks")
    avoid = [(0, 0, 10.2)]
    floating = chunks(9, 12.5, 19.0, 4, ice, avoid)
    bergs = lib.join([berg(math.cos(a) * d, math.sin(a) * d, s, i + 20, ice) for i, (a, d, s) in
                      enumerate(((1.9, 34, 3.4), (2.6, 40, 4.5), (0.9, 38, 3.8), (3.8, 33, 3.0), (5.2, 41, 4.2), (4.4, 36, 2.6)))], "Bergs")
    sea_obj = water(mat=sea)
    return scene, [main, rock_obj, bergs, sea_obj, *floating]


def sound_round():
    scene = lib.use_scene("Sound")
    ice = lib.material("arena_ice", "#FFFFFF", rough=0.4, vcol=True)
    sea = lib.material("arena_water", "#0B1C25", rough=0.08)
    objs = []
    for i, (x, y, r) in enumerate(SOUND_LAND):
        bx, by = at(x, y)
        name = "Floe" if i == 0 else f"Islet.{i}"
        objs.append(floe(name, bx, by, r / 1000.0 + (0.6 if i == 0 else 0.55), seed=10.0 + i, wobble=0.45 if i == 0 else 0.3,
                         rings=7 if i == 0 else 4, segs=48 if i == 0 else 28, mat=ice))
    avoid = [(at(x, y)[0], at(x, y)[1], r / 1000.0 + 1.0) for x, y, r in SOUND_LAND]
    objs += chunks(10, 16.0, 22.0, 9, ice, avoid)
    objs.append(lib.join([berg(math.cos(a) * d, math.sin(a) * d, s, i + 40, ice) for i, (a, d, s) in
                          enumerate(((1.6, 36, 4.0), (2.4, 42, 5.0), (0.7, 40, 3.6), (3.6, 37, 3.2), (5.0, 44, 4.6)))], "Bergs"))
    objs.append(water(size=160, mat=sea))
    return scene, objs


# Each curtain of the aurora: the way it lies from the middle (radians, from east through north), how far off, how wide an arc,
# the height of its foot and how tall it is, and a number that folds it differently from the others.
AURORA = (
    (math.pi / 2, 58.0, 2.1, 2.5, 24.0, 0.0),
    (math.pi / 2 + 0.25, 72.0, 1.7, 9.0, 26.0, 1.3),
    (math.pi + 0.35, 62.0, 1.2, 3.0, 20.0, 2.1),
    (-0.35, 62.0, 1.2, 3.5, 21.0, 3.4),
)


def curtain(name, mat, bearing, far, span, foot, tall, phase):
    """One curtain of the aurora: a tall thin sheet along an arc, folded like hanging cloth. Its colour is painted corner by corner,
    green at the foot and violet above, and goes to black at its foot, its top and both ends. The game adds its light to the sky
    (and draws no other light on it), so black is clear and the curtain has no edge."""
    cols, rows = 40, (0.0, 0.08, 0.28, 0.6, 1.0)
    bm = bmesh.new()
    where = []
    for k in range(cols):
        u = k / (cols - 1)
        a = bearing - span / 2 + span * u
        d = far + 2.2 * math.sin(u * 13 + phase) + 0.9 * math.sin(u * 29 + phase * 2)
        low = foot + 1.5 * math.sin(u * 5 + phase)
        height = tall * (0.72 + 0.28 * math.sin(u * 8 + phase * 3))
        for v in rows:
            bm.verts.new((math.cos(a) * d, math.sin(a) * d, low + height * v))
            where.append((u, v))
    bm.verts.ensure_lookup_table()
    for k in range(cols - 1):
        for r in range(len(rows) - 1):
            i = k * len(rows) + r
            bm.faces.new((bm.verts[i], bm.verts[i + len(rows)], bm.verts[i + len(rows) + 1], bm.verts[i + 1]))
    obj = lib.mesh_object(name, bm, mat)
    me = obj.data
    attr = me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    me.color_attributes.active_color = attr
    for loop in me.loops:
        u, v = where[loop.vertex_index]
        glow = min(1.0, v / rows[1]) * (1.0 - v) ** 1.6 * math.sin(math.pi * u) ** 0.6
        tint = mix((0.12, 1.0, 0.55), (0.62, 0.3, 1.0), v ** 0.75)
        attr.data[loop.index].color = (*(c * glow for c in tint), 1.0)
    return obj


def crown_round():
    scene = lib.use_scene("Crown")
    ice = lib.material("arena_ice", "#FFFFFF", rough=0.4, vcol=True)
    stone = lib.material("arena_rock", "#FFFFFF", rough=0.85, vcol=True)
    sky = lib.material("arena_aurora", "#FFFFFF", rough=0.5, emit="#7FFFE0", strength=1.5, alpha=0.6, vcol=True)
    cloud = lib.material("arena_cloud", "#FFFFFF", rough=0.9, vcol=True)
    dark = lib.material("arena_crack", "#5B8FB0", rough=0.6)
    plateau = lib.join([floe("Plateau", 0, 0, 10.25, seed=30.0, depth=9.0, wobble=0.5, rings=9, segs=60, mat=ice),
                        cracks("crown_cracks", 0, 0, 9.0, 30.0, 12, dark)], "Plateau")
    pillars = []
    for i, (x, y, r) in enumerate(CROWN_PILLARS):
        bx, by = at(x, y)
        height = 3.2 + 1.2 * h(i + 5, 7)
        bm = lib.tube([(bx, by, -0.1), (bx, by, height * 0.55), (bx, by, height)], [r / 1000.0 * 1.05, r / 1000.0 * 0.8, r / 1000.0 * 0.45], sides=6)
        tip = lib.cone(r / 1000.0 * 0.45, 0.0, 0.9, segments=6)
        lib.transform(tip, loc=(bx, by, height + 0.45))
        p = lib.mesh_object(f"pillar_{i}", lib.merge(bm, tip), ice)
        lib.paint(p, lambda c, n, k: mix(CLIFF, SNOW, min(1.0, max(0.0, c.z / 4.5 + 0.2 * n.z))))
        base = rock(bx, by, r / 1000.0 * 1.35, i + 60, stone)
        # Each pillar is its own object, so the game can fade the one that stands between the camera and the hero.
        pillars.append(lib.join([p, base], f"Pillar.{i + 1}"))
    peaks = []
    for i in range(10):
        a = math.tau * i / 10 + 0.3 * h(i)
        d = 36 + 10 * h(i + 3)
        s = 9 + 7 * h(i + 7)
        cx, cy = math.cos(a) * d, math.sin(a) * d
        crags = []
        for j, (dx, dy, f) in enumerate(((0, 0, 1.0), (s * 0.45, s * 0.1, 0.62), (-s * 0.4, -s * 0.15, 0.55), (s * 0.1, s * 0.4, 0.48))):
            crag = lib.lumpy(lib.cone(s * 0.6 * f, 0.0, s * f, segments=6), 0.8 * f, scale=0.35, seed=i * 5 + j)
            lib.transform(crag, rot=(0, 0, 37 * j + 11 * i), loc=(cx + dx, cy + dy, s * f / 2 - 7))
            crags.append(crag)
        pk = lib.mesh_object(f"peak_{i}", lib.merge(*crags), ice)
        lib.paint(pk, lambda c, n, k: SNOW if c.z > 1.0 + 2 * h(k) else mix(DEEP, CLIFF, 0.5 + 0.3 * h(k)))
        peaks.append(pk)
    # The aurora hangs far off behind the peaks, round all of the horizon but the south, where the camera stands in a run.
    aurora = [curtain(f"aurora_{i}", sky, *shape) for i, shape in enumerate(AURORA)]
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=30, y_segments=30, size=90)
    lib.lumpy(bm, 1.6, scale=0.08, seed=5, along="z")
    lib.transform(bm, loc=(0, 0, -6.5))
    clouds = lib.mesh_object("Clouds", bm, cloud)
    lib.paint(clouds, lambda c, n, k: mix((0.42, 0.4, 0.55), (0.85, 0.86, 0.95), min(1.0, max(0.0, (c.z + 7.5) / 2.5))))
    return scene, [plateau, *pillars, lib.join(peaks, "Peaks"), lib.join(aurora, "Aurora"), clouds]


BUILDERS = ((floe_round, "arena-floe.glb"), (sound_round, "arena-sound.glb"), (crown_round, "arena-crown.glb"))


def build_all(export=True):
    out = []
    for builder, filename in BUILDERS:
        scene, objs = builder()
        if export:
            with lib.in_scene(scene):
                out.append(lib.export_glb(objs, filename))
    return out


if __name__ == "__main__":
    build_all()
