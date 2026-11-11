"""The things in the rounds: a mint crystal, a frost egg in its snow nest, an ice key, a lumpy
snowball, an icicle dart, an ice crate, an ice cage and a frost bolt. Each is built in a scene of
its own at the origin and exported as its own .glb.
"""
import math

import bpy  # noqa: F401
import bmesh
from mathutils import Vector

import lib


def prism(radius, body, top, bottom, sides=6, twist=0.0):
    """A crystal: a prism of `sides` faces with a pointed top and a shorter pointed bottom."""
    bm = bmesh.new()
    low = [bm.verts.new((radius * math.cos(math.tau * k / sides + twist), radius * math.sin(math.tau * k / sides + twist), 0.0)) for k in range(sides)]
    high = [bm.verts.new((v.co.x * 0.92, v.co.y * 0.92, body)) for v in low]
    tip = bm.verts.new((0, 0, body + top))
    foot = bm.verts.new((0, 0, -bottom))
    for k in range(sides):
        n = (k + 1) % sides
        bm.faces.new((low[k], low[n], high[n], high[k]))
        bm.faces.new((high[k], high[n], tip))
        bm.faces.new((low[n], low[k], foot))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def shade(obj, colour_of):
    return lib.paint(obj, colour_of)


def h(index, mod=97):
    return ((index * 2654435761) % mod) / mod


def crystal():
    scene = lib.use_scene("Crystal")
    core = lib.material("crystal_core", "#3FE0A0", rough=0.15, emit="#3FE0A0", strength=1.8)
    edge = lib.material("crystal_edge", "#B8FFE2", rough=0.1, emit="#8CFFD0", strength=2.6)
    pieces = []
    main = prism(0.13, 0.38, 0.2, 0.12, twist=0.2)
    pieces.append(lib.mesh_object("crystal_main", main, core))
    for k, (ang, tilt, s) in enumerate(((20, 28, 0.62), (150, 32, 0.52), (260, 24, 0.45))):
        side = prism(0.13 * s, 0.38 * s, 0.2 * s, 0.06, twist=0.5 * k)
        lib.transform(side, rot=(tilt, 0, ang), loc=(0.06 * math.cos(math.radians(ang)), 0.06 * math.sin(math.radians(ang)), -0.02))
        pieces.append(lib.mesh_object(f"crystal_side_{k}", side, core))
    obj = lib.join(pieces, "Crystal")
    obj.data.materials.append(edge)
    for poly in obj.data.polygons:
        if poly.normal.z > 0.35:
            poly.material_index = 1
    return scene, [obj]


def egg():
    scene = lib.use_scene("Egg")
    shell = lib.material("egg_shell", "#FFFFFF", rough=0.55, vcol=True)
    snow = lib.material("nest_snow", "#FFFFFF", rough=0.95, vcol=True)
    bm = lib.uv_sphere(1.0, 12, 9)
    for v in bm.verts:
        v.co.z *= 1.28
        if v.co.z > 0:
            f = 1.0 - 0.22 * (v.co.z / 1.28)
            v.co.x *= f
            v.co.y *= f
    lib.transform(bm, loc=(0, 0, 0.27), scale=(0.2, 0.2, 0.2))
    e = lib.mesh_object("Egg", bm, shell)
    shade(e, lambda c, n, i: "#8E7CC4" if h(i) < 0.16 else "#C9BDEA" if h(i, 89) < 0.22 else "#EEE8F8")
    ring = bmesh.new()
    rings = []
    for k in range(18):
        a = math.tau * k / 18
        ring_pts = []
        for j in range(6):
            b = math.tau * j / 6
            r = 0.24 + 0.08 * math.cos(b)
            ring_pts.append(ring.verts.new((r * math.cos(a), r * math.sin(a), 0.07 + 0.07 * math.sin(b))))
        rings.append(ring_pts)
    for k in range(18):
        for j in range(6):
            a, b = rings[k], rings[(k + 1) % 18]
            ring.faces.new((a[j], a[(j + 1) % 6], b[(j + 1) % 6], b[j]))
    bmesh.ops.recalc_face_normals(ring, faces=ring.faces)
    lib.lumpy(ring, 0.03, scale=6.0, seed=3)
    nest = lib.mesh_object("Nest", ring, snow)
    shade(nest, lambda c, n, i: (0.82, 0.88, 0.95) if n.z < 0.2 else (0.97, 0.98, 1.0))
    return scene, [e, nest]


def key():
    scene = lib.use_scene("Key")
    ice = lib.material("key_ice", "#C6ECFF", rough=0.18, metal=0.35, emit="#8FD8FF", strength=0.55)
    gem = lib.material("key_gem", "#F2FDFF", rough=0.05, emit="#DDF8FF", strength=3.0)
    parts = []
    ring = bmesh.new()
    rings = []
    for k in range(16):
        a = math.tau * k / 16
        pts = []
        for j in range(5):
            b = math.tau * j / 5
            r = 0.13 + 0.035 * math.cos(b)
            pts.append(ring.verts.new((r * math.cos(a), 0.035 * math.sin(b), 0.2 + r * math.sin(a))))
        rings.append(pts)
    for k in range(16):
        for j in range(5):
            a, b = rings[k], rings[(k + 1) % 16]
            ring.faces.new((a[j], a[(j + 1) % 5], b[(j + 1) % 5], b[j]))
    bmesh.ops.recalc_face_normals(ring, faces=ring.faces)
    parts.append(lib.mesh_object("key_bow", ring, ice))
    stone = prism(0.06, 0.04, 0.05, 0.05, sides=4)
    lib.transform(stone, rot=(90, 0, 0), loc=(0, 0, 0.2))
    parts.append(lib.mesh_object("key_gem", stone, gem))
    parts.append(lib.mesh_object("key_shaft", lib.tube([(0, 0, 0.06), (0, 0, -0.36)], [0.03, 0.028], sides=6), ice))
    for z, w in ((-0.3, 0.1), (-0.2, 0.075)):
        tooth = lib.box((w, 0.05, 0.06), bevel=0.01)
        lib.transform(tooth, loc=(w / 2 + 0.02, 0, z))
        parts.append(lib.mesh_object("key_tooth", tooth, ice))
    collar = lib.cone(0.05, 0.05, 0.03, segments=8)
    lib.transform(collar, loc=(0, 0, 0.05))
    parts.append(lib.mesh_object("key_collar", collar, ice))
    return scene, [lib.join(parts, "Key")]


def snowball():
    scene = lib.use_scene("Snowball")
    snow = lib.material("snowball_snow", "#FFFFFF", rough=0.95, vcol=True)
    pieces = []
    core = lib.lumpy(lib.ico(0.5, 2), 0.06, scale=2.6, seed=8)
    pieces.append(lib.mesh_object("snowball_core", core, snow))
    for k, (x, y, z, r) in enumerate(((0.3, 0.2, 0.18, 0.2), (-0.26, -0.24, 0.12, 0.18), (0.05, -0.3, -0.26, 0.17), (-0.18, 0.28, -0.2, 0.16))):
        lump = lib.lumpy(lib.ico(r, 1), r * 0.15, seed=k + 1)
        lib.transform(lump, loc=(x, y, z))
        pieces.append(lib.mesh_object(f"snowball_lump_{k}", lump, snow))
    obj = lib.join(pieces, "Snowball")
    shade(obj, lambda c, n, i: tuple(v - 0.12 * h(i) for v in ((0.86, 0.9, 0.97) if c.length < 0.42 else (0.98, 0.99, 1.0))))
    return scene, [obj]


def dart():
    scene = lib.use_scene("Dart")
    ice = lib.material("dart_ice", "#D2F4FF", rough=0.1, emit="#9FE8FF", strength=0.9)
    body = prism(0.07, 0.5, 0.32, 0.06, sides=6)
    lib.transform(body, rot=(90, 0, 0), loc=(0, 0.3, 0))
    parts = [lib.mesh_object("dart_body", body, ice)]
    for k in range(3):
        fin = lib.cone(0.09, 0.0, 0.18, segments=3)
        lib.transform(fin, rot=(90, 0, 0), scale=(1, 0.18, 1))
        lib.transform(fin, rot=(0, 120 * k, 0), loc=(0, 0.34, 0))
        parts.append(lib.mesh_object(f"dart_fin_{k}", fin, ice))
    return scene, [lib.join(parts, "Dart")]


def crate():
    scene = lib.use_scene("Crate")
    shell = lib.material("crate_ice", "#A9DDF4", rough=0.12, emit="#7FCBEF", strength=0.25, alpha=0.55)
    frost = lib.material("crate_frost", "#E9F8FF", rough=0.5)
    snow = lib.material("crate_snow", "#F6FAFC", rough=0.95)
    block = lib.box((0.92, 0.92, 0.86), bevel=0.06, segments=2)
    lib.transform(block, loc=(0, 0, 0.43))
    parts = [lib.mesh_object("crate_block", block, shell)]
    s = 0.46
    for x in (-s, s):
        for y in (-s, s):
            post = lib.box((0.1, 0.1, 0.9), bevel=0.02)
            lib.transform(post, loc=(x, y, 0.45))
            parts.append(lib.mesh_object("crate_post", post, frost))
    for z in (0.04, 0.86):
        for axis in (0, 1):
            for off in (-s, s):
                bar = lib.box((1.0, 0.09, 0.09) if axis == 0 else (0.09, 1.0, 0.09), bevel=0.02)
                lib.transform(bar, loc=(0, off, z) if axis == 0 else (off, 0, z))
                parts.append(lib.mesh_object("crate_bar", bar, frost))
    cap = lib.lumpy(lib.box((0.86, 0.86, 0.14), bevel=0.05, segments=2), 0.03, scale=4.0, seed=4)
    lib.transform(cap, loc=(0, 0, 0.93))
    parts.append(lib.mesh_object("crate_cap", cap, snow))
    return scene, [lib.join(parts, "Crate")]


def cage():
    scene = lib.use_scene("Cage")
    ice = lib.material("cage_ice", "#9FD8F2", rough=0.15, emit="#6CC4EE", strength=0.45)
    tip = lib.material("cage_tip", "#E6F8FF", rough=0.1, emit="#BCEBFF", strength=0.8)
    snow = lib.material("cage_snow", "#FFFFFF", rough=0.95, vcol=True)
    parts = []
    for k in range(8):
        a = math.tau * k / 8
        height = 1.55 + 0.45 * h(k + 3, 11)
        spike = prism(0.3, height, 0.45, 0.05, sides=6, twist=k)
        lib.transform(spike, rot=(-9, 0, 0))
        lib.transform(spike, rot=(0, 0, math.degrees(a) - 90), loc=(1.35 * math.cos(a), 1.35 * math.sin(a), 0.05))
        o = lib.mesh_object(f"cage_spike_{k}", spike, ice)
        o.data.materials.append(tip)
        for poly in o.data.polygons:
            if poly.center.z > height * 0.95:
                poly.material_index = 1
        parts.append(o)
    base = bmesh.new()
    rings = []
    for k in range(24):
        a = math.tau * k / 24
        pts = []
        for j in range(6):
            b = math.tau * j / 6
            r = 1.35 + 0.42 * math.cos(b)
            pts.append(base.verts.new((r * math.cos(a), r * math.sin(a), max(0.0, 0.16 * math.sin(b)))))
        rings.append(pts)
    for k in range(24):
        for j in range(6):
            a, b = rings[k], rings[(k + 1) % 24]
            base.faces.new((a[j], a[(j + 1) % 6], b[(j + 1) % 6], b[j]))
    bmesh.ops.recalc_face_normals(base, faces=base.faces)
    lib.lumpy(base, 0.05, scale=2.0, seed=6)
    snow_obj = lib.mesh_object("cage_base", base, snow)
    shade(snow_obj, lambda c, n, i: (0.8, 0.87, 0.95) if n.z < 0.3 else (0.97, 0.98, 1.0))
    parts.append(snow_obj)
    return scene, [lib.join(parts, "Cage")]


def bolt():
    scene = lib.use_scene("Bolt")
    glow = lib.material("bolt_glow", "#E4F9FF", rough=0.1, emit="#CFF4FF", strength=5.0)
    parts = []
    for k, rot in enumerate(((0, 0, 0), (90, 0, 0), (0, 90, 0))):
        star = prism(0.05, 0.0, 0.17, 0.17, sides=4)
        lib.transform(star, rot=rot)
        parts.append(lib.mesh_object(f"bolt_spike_{k}", star, glow))
    return scene, [lib.join(parts, "Bolt")]


BUILDERS = (
    (crystal, "crystal.glb"),
    (egg, "egg.glb"),
    (key, "key.glb"),
    (snowball, "snowball.glb"),
    (dart, "dart.glb"),
    (crate, "crate.glb"),
    (cage, "cage.glb"),
    (bolt, "bolt.glb"),
)


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
