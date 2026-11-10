"""Pip, the snow sprite: a small round snow creature about one unit tall, with two stubby feet,
a striped knitted scarf and a crest of three ice shards. An original design.
"""
import math

import bpy  # noqa: F401
import bmesh
from mathutils import Vector

import anim
import lib

H = 0.92  # top of the body


def band(radius, height, thickness, z, segments=28, wobble=0.012):
    """A closed knitted band (the scarf's wrap) as a ring of quads with a little thickness."""
    bm = bmesh.new()
    rings = []
    for k in range(segments):
        a = math.tau * k / segments
        w = wobble * math.sin(a * 5)
        ring = []
        for dr, dz in ((0, -height / 2), (0, height / 2), (thickness, height / 2), (thickness, -height / 2)):
            r = radius + dr + w
            ring.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, z + dz + w * 0.5)))
        rings.append(ring)
    for k in range(segments):
        a, b = rings[k], rings[(k + 1) % segments]
        for i in range(4):
            bm.faces.new((a[i], a[(i + 1) % 4], b[(i + 1) % 4], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def build():
    scene = lib.use_scene("Pip")
    with lib.in_scene(scene):
        coll = lib.collection("Hero · Pip")
        snow = lib.material("pip_snow", "#FFFFFF", rough=0.92, vcol=True)
        ice = lib.material("pip_ice", "#BFE9FA", rough=0.3, emit="#9ADCF5", strength=0.35)
        eye = lib.material("pip_eye", "#141822", rough=0.25)
        glint = lib.material("pip_glint", "#FFFFFF", rough=0.2, emit="#FFFFFF", strength=2.0)
        blush = lib.material("pip_blush", "#F3A9B8", rough=0.8)
        boot = lib.material("pip_boot", "#4E6C8E", rough=0.7)
        scarf = lib.material("pip_scarf", "#C62F3B", rough=0.95)
        stripe = lib.material("pip_stripe", "#E8E0CC", rough=0.95)
        dark = lib.material("pip_mouth", "#2B1F2B", rough=0.6)

        parts = []
        # The body: a chunky faceted egg of packed snow, a little narrower at the top.
        bm = lib.ico(1.0, 2)
        for v in bm.verts:
            taper = 1.0 - 0.1 * max(v.co.z, 0.0)
            v.co.x *= 0.45 * taper
            v.co.y *= 0.43 * taper
            v.co.z *= 0.40
        lib.lumpy(bm, 0.018, scale=3.0, seed=4.0)
        lib.transform(bm, loc=(0, 0, 0.52))
        body = lib.mesh_object("pip_body", bm, snow)

        def snow_shade(center, normal, index):
            up = min(max((center.z - 0.12) / 0.8, 0.0), 1.0)
            base = 0.8 + 0.2 * up
            jitter = ((index * 2654435761) % 97) / 97.0 * 0.05
            return (base * 0.86 + jitter, base * 0.92 + jitter, base + jitter * 0.6)
        lib.paint(body, snow_shade)
        lower = body.vertex_groups.new(name="body")
        upper = body.vertex_groups.new(name="head")
        for v in body.data.vertices:
            w = min(max((v.co.z - 0.36) / 0.3, 0.0), 1.0)
            w = w * w * (3 - 2 * w)
            lower.add([v.index], 1.0 - w, "REPLACE")
            upper.add([v.index], w, "REPLACE")
        parts.append(body)

        # Eyes, each with a glint, riding their own bones so they can blink and look.
        for side, name in ((1, "eye.L"), (-1, "eye.R")):
            e = lib.transform(lib.uv_sphere(0.075, 10, 8), loc=(0.15 * side, -0.375, 0.63), scale=(1.0, 0.55, 1.45))
            parts.append(lib.part(f"pip_{name}", e, eye, name))
            g = lib.transform(lib.uv_sphere(0.022, 6, 4), loc=(0.15 * side + 0.025, -0.418, 0.67))
            parts.append(lib.part(f"pip_{name}_glint", g, glint, name))
            cheek = lib.transform(lib.uv_sphere(0.052, 8, 6), loc=(0.27 * side, -0.325, 0.53), rot=(0, 0, -side * 35), scale=(1.0, 0.32, 0.62))
            parts.append(lib.part(f"pip_cheek_{side}", cheek, blush, "head"))

        # A small smile, on its own bone so it can open.
        pts = [(-0.05 + 0.025 * i, -0.418 + 0.006 * abs(i - 2), 0.535 - 0.016 * (1 - ((i - 2) / 2) ** 2)) for i in range(5)]
        parts.append(lib.part("pip_mouth", lib.tube(pts, [0.011] * 5, sides=5), dark, "mouth"))

        # The crest: three shards of ice, swept back.
        for dx, tilt_y, tilt_x, size in ((0.0, 0, -22, 1.0), (0.07, 24, -14, 0.72), (-0.07, -24, -14, 0.72)):
            shard = lib.cone(0.052 * size, 0.0, 0.26 * size, segments=5)
            lib.transform(shard, loc=(0, 0, 0.13 * size))
            lib.transform(shard, rot=(tilt_x, tilt_y, 0))
            lib.transform(shard, loc=(dx, 0.05, 0.86))
            parts.append(lib.part("pip_crest", shard, ice, "crest"))

        # Feet: stubby steel-blue boots.
        for side, name in ((1, "foot.L"), (-1, "foot.R")):
            f = lib.lumpy(lib.ico(0.16, 1), 0.01, seed=side)
            lib.transform(f, loc=(0.2 * side, -0.11, 0.075), scale=(1.05, 1.4, 0.6))
            parts.append(lib.part(f"pip_{name}", f, boot, name))

        # The scarf: a striped wrap, a knot at the front left and two tails, one long enough to stream behind.
        wrap = band(0.425, 0.13, 0.05, 0.4)
        wrap_obj = lib.mesh_object("pip_scarf_wrap", wrap, scarf)
        wrap_obj.data.materials.append(stripe)
        for poly in wrap_obj.data.polygons:
            ang = math.atan2(poly.center.y, poly.center.x)
            poly.material_index = 1 if int((ang + math.pi) / (math.tau / 14)) % 2 else 0
        g = wrap_obj.vertex_groups.new(name="scarf")
        g.add(list(range(len(wrap_obj.data.vertices))), 1.0, "REPLACE")
        parts.append(wrap_obj)
        knot = lib.lumpy(lib.ico(0.075, 1), 0.012, seed=2)
        lib.transform(knot, loc=(0.27, -0.36, 0.4), scale=(1.0, 0.8, 1.1))
        parts.append(lib.part("pip_knot", knot, scarf, "scarf"))

        def tail(name, points, width, bones):
            bm = lib.ribbon(points, [width] * len(points), thickness=0.025, side=(0.8, 0.6, 0))
            obj = lib.mesh_object(name, bm, scarf)
            obj.data.materials.append(stripe)
            groups = [obj.vertex_groups.new(name=b) for b in bones]
            zs = [p[2] for p in points]
            top, low = max(zs), min(zs)
            for v in obj.data.vertices:
                u = (top - v.co.z) / max(top - low, 1e-4)
                i = min(int(u * len(bones)), len(bones) - 1)
                groups[i].add([v.index], 1.0, "REPLACE")
            for poly in obj.data.polygons:
                u = (top - poly.center.z) / max(top - low, 1e-4)
                poly.material_index = 1 if int(u * 6) % 2 else 0
            return obj

        parts.append(tail("pip_tail_front", [(0.29, -0.38, 0.37), (0.31, -0.39, 0.29), (0.32, -0.385, 0.21), (0.33, -0.37, 0.14)], 0.09,
                          ["scarf.A.1", "scarf.A.2", "scarf.A.3"]))
        parts.append(tail("pip_tail_back", [(0.33, -0.32, 0.38), (0.41, -0.2, 0.33), (0.46, -0.04, 0.27), (0.47, 0.12, 0.21), (0.45, 0.27, 0.16)], 0.085,
                          ["scarf.B.1", "scarf.B.2", "scarf.B.3"]))

        mesh = lib.join(parts, "Pip")
        for o in [mesh]:
            lib.link(o, coll)

        rig = lib.armature("Rig_Pip", [
            ("root", (0, 0, 0), (0, 0, 0.12), None),
            ("body", (0, 0, 0.12), (0, 0, 0.5), "root"),
            ("head", (0, 0, 0.5), (0, 0, H), "body"),
            ("eye.L", (0.15, -0.37, 0.63), (0.15, -0.37, 0.72), "head"),
            ("eye.R", (-0.15, -0.37, 0.63), (-0.15, -0.37, 0.72), "head"),
            ("mouth", (0, -0.41, 0.52), (0, -0.41, 0.56), "head"),
            ("crest", (0, 0.05, 0.86), (0, 0.08, 1.02), "head"),
            ("scarf", (0, 0, 0.36), (0, 0, 0.44), "body"),
            ("scarf.A.1", (0.29, -0.38, 0.37), (0.31, -0.39, 0.29), "scarf"),
            ("scarf.A.2", (0.31, -0.39, 0.29), (0.32, -0.385, 0.21), "scarf.A.1"),
            ("scarf.A.3", (0.32, -0.385, 0.21), (0.33, -0.37, 0.12), "scarf.A.2"),
            ("scarf.B.1", (0.33, -0.32, 0.38), (0.43, -0.12, 0.3), "scarf"),
            ("scarf.B.2", (0.43, -0.12, 0.3), (0.47, 0.06, 0.24), "scarf.B.1"),
            ("scarf.B.3", (0.47, 0.06, 0.24), (0.45, 0.28, 0.15), "scarf.B.2"),
            ("foot.L", (0.2, 0.0, 0.075), (0.2, -0.22, 0.075), "root"),
            ("foot.R", (-0.2, 0.0, 0.075), (-0.2, -0.22, 0.075), "root"),
        ])
        lib.link(rig, coll)
        lib.skin(mesh, rig)
        roles = anim.Rig({
            "root": "root", "body": "body", "head": "head", "eyes": ["eye.L", "eye.R"], "mouth": "mouth", "crest": "crest",
            "feet": [("foot.L", 1), ("foot.R", -1)], "tails": [["scarf.A.1", "scarf.A.2", "scarf.A.3"], ["scarf.B.1", "scarf.B.2", "scarf.B.3"]],
            "spinner": "scarf", "spinner_tails": True, "run_lean": 10,
        })
        anim.make_clips(rig, roles)
    return rig, mesh, scene


if __name__ == "__main__":
    rig, mesh, scene = build()
    with lib.in_scene(scene):
        lib.export_glb([rig], "hero-pip.glb", animations=True)
