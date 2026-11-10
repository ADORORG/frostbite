"""Volt, the neon holographic ram: a chunky low-poly ram drawn in light, with a fleece of glowing
tufts, curled neon horns and bright hooves. Its materials are named holo_* so the game can add a
holographic shimmer (scanlines and a rim glow) on top of the colours set here. An original design.
"""
import math

import bpy  # noqa: F401
from mathutils import Vector

import anim
import lib


def spiral(side, turns=1.35, steps=16):
    """A ram's horn: a curl that starts at the crown, sweeps back and down, and comes forward under the ear."""
    pts, radii = [], []
    centre = Vector((0.17 * side, -0.36, 0.8))
    for i in range(steps):
        u = i / (steps - 1)
        ang = math.radians(90) + u * turns * math.tau
        r = 0.13 * (1 - 0.55 * u)
        pts.append(centre + Vector((0.07 * side * u, -math.cos(ang) * r * -1, math.sin(ang) * r)))
        radii.append(0.05 * (1 - 0.7 * u) + 0.012)
    return pts, radii


def build():
    scene = lib.use_scene("Volt")
    with lib.in_scene(scene):
        coll = lib.collection("Hero · Volt")
        body_m = lib.material("holo_body", "#2C2066", rough=0.35, emit="#5B3DFF", strength=0.55)
        wool_m = lib.material("holo_wool", "#46339A", rough=0.4, emit="#8C6BFF", strength=0.8)
        face_m = lib.material("holo_face", "#231A52", rough=0.3, emit="#4AC8FF", strength=0.4)
        horn_m = lib.material("holo_horn", "#FF4FD8", rough=0.2, emit="#FF4FD8", strength=3.0)
        hoof_m = lib.material("holo_hoof", "#43E8FF", rough=0.2, emit="#43E8FF", strength=2.4)
        eye_m = lib.material("holo_eye", "#9FF8FF", rough=0.1, emit="#9FF8FF", strength=6.0)
        dark_m = lib.material("volt_dark", "#120C2A", rough=0.5)

        parts = []
        body = lib.lumpy(lib.ico(1.0, 2), 0.04, scale=2.2, seed=7)
        lib.transform(body, loc=(0, 0.04, 0.56), scale=(0.25, 0.4, 0.22))
        parts.append(lib.part("volt_body", body, body_m, "body"))
        # The fleece: glowing tufts over the back and sides.
        tufts = [(0, 0.04, 0.76, 0.11), (0.13, 0.12, 0.7, 0.1), (-0.13, 0.12, 0.7, 0.1), (0.14, -0.12, 0.69, 0.1),
                 (-0.14, -0.12, 0.69, 0.1), (0, 0.24, 0.72, 0.1), (0, -0.16, 0.75, 0.1), (0.2, 0.02, 0.6, 0.09),
                 (-0.2, 0.02, 0.6, 0.09), (0.17, 0.28, 0.6, 0.085), (-0.17, 0.28, 0.6, 0.085), (0, 0.38, 0.64, 0.09),
                 (0.18, -0.24, 0.6, 0.085), (-0.18, -0.24, 0.6, 0.085), (0.22, 0.16, 0.47, 0.09), (-0.22, 0.16, 0.47, 0.09), (0.21, -0.12, 0.46, 0.085),
                 (-0.21, -0.12, 0.46, 0.085), (0.1, 0.36, 0.48, 0.085), (-0.1, 0.36, 0.48, 0.085), (0.0, -0.3, 0.52, 0.09)]
        for i, (x, y, z, r) in enumerate(tufts):
            t = lib.lumpy(lib.ico(r, 1), r * 0.15, seed=i)
            lib.transform(t, loc=(x, y, z))
            parts.append(lib.part(f"volt_tuft_{i}", t, wool_m, "body"))
        # Neck, head and snout.
        parts.append(lib.part("volt_neck", lib.tube([(0, -0.24, 0.62), (0, -0.33, 0.7), (0, -0.4, 0.76)], [0.1, 0.09, 0.085], sides=7), face_m, "neck"))
        head = lib.lumpy(lib.ico(1.0, 2), 0.02, seed=3)
        lib.transform(head, loc=(0, -0.46, 0.8), rot=(-18, 0, 0), scale=(0.13, 0.17, 0.13))
        parts.append(lib.part("volt_head", head, face_m, "head"))
        snout = lib.ico(1.0, 1)
        lib.transform(snout, loc=(0, -0.6, 0.74), rot=(-25, 0, 0), scale=(0.085, 0.1, 0.075))
        parts.append(lib.part("volt_snout", snout, face_m, "head"))
        for side in (1, -1):
            nose = lib.transform(lib.uv_sphere(0.014, 6, 4), loc=(0.03 * side, -0.69, 0.75))
            parts.append(lib.part("volt_nostril", nose, dark_m, "head"))
            eye = lib.transform(lib.uv_sphere(0.03, 8, 6), loc=(0.1 * side, -0.55, 0.85), scale=(0.7, 1.0, 1.25))
            parts.append(lib.part(f"volt_eye_{side}", eye, eye_m, "eye.L" if side > 0 else "eye.R"))
            ear = lib.cone(0.05, 0.0, 0.16, segments=4)
            lib.transform(ear, loc=(0, 0, 0.08))
            lib.transform(ear, rot=(0, 90 * side, 0), scale=(1, 0.5, 1))
            lib.transform(ear, loc=(0.14 * side, -0.42, 0.82))
            parts.append(lib.part("volt_ear", ear, face_m, "head"))
            pts, radii = spiral(side)
            parts.append(lib.part(f"volt_horn_{side}", lib.tube(pts, radii, sides=7), horn_m, "head"))
        # Four legs with bright hooves, each in two pieces for knees.
        for name, x, y in (("fleg.L", 0.14, -0.2), ("fleg.R", -0.14, -0.2), ("bleg.L", 0.14, 0.27), ("bleg.R", -0.14, 0.27)):
            shin = name.replace("leg", "shin")
            parts.append(lib.part(f"volt_{name}", lib.tube([(x, y, 0.5), (x, y, 0.27)], [0.078, 0.064], sides=6), body_m, name))
            parts.append(lib.part(f"volt_{shin}", lib.tube([(x, y, 0.27), (x, y - 0.01, 0.07)], [0.06, 0.05], sides=6), body_m, shin))
            hoof = lib.cone(0.07, 0.058, 0.08, segments=6)
            lib.transform(hoof, loc=(x, y - 0.012, 0.04))
            parts.append(lib.part(f"volt_hoof_{name}", hoof, hoof_m, shin))
        tail = lib.lumpy(lib.ico(0.07, 1), 0.01, seed=9)
        lib.transform(tail, loc=(0, 0.47, 0.64))
        parts.append(lib.part("volt_tail", tail, wool_m, "tail.1"))

        mesh = lib.join(parts, "Volt")
        lib.link(mesh, coll)
        bones = [
            ("root", (0, 0, 0), (0, 0, 0.15), None),
            ("body", (0, 0.04, 0.45), (0, 0.04, 0.66), "root"),
            ("neck", (0, -0.24, 0.62), (0, -0.38, 0.75), "body"),
            ("head", (0, -0.38, 0.75), (0, -0.4, 0.98), "neck"),
            ("eye.L", (0.1, -0.55, 0.82), (0.1, -0.55, 0.9), "head"),
            ("eye.R", (-0.1, -0.55, 0.82), (-0.1, -0.55, 0.9), "head"),
            ("tail.1", (0, 0.43, 0.64), (0, 0.52, 0.62), "body"),
        ]
        for name, x, y in (("fleg.L", 0.14, -0.2), ("fleg.R", -0.14, -0.2), ("bleg.L", 0.14, 0.27), ("bleg.R", -0.14, 0.27)):
            shin = name.replace("leg", "shin")
            bones.append((name, (x, y, 0.5), (x, y, 0.27), "body"))
            bones.append((shin, (x, y, 0.27), (x, y - 0.01, 0.03), name))
        rig = lib.armature("Rig_Volt", bones)
        lib.link(rig, coll)
        lib.skin(mesh, rig)
        roles = anim.Rig({
            "root": "root", "body": "body", "head": "head", "eyes": ["eye.L", "eye.R"],
            "quad_legs": [("fleg.L", "fshin.L", None, 1), ("bleg.R", "bshin.R", None, 1),
                          ("fleg.R", "fshin.R", None, -1), ("bleg.L", "bshin.L", None, -1)],
            "tails": [["tail.1"]], "run_lean": 4, "stride": 34,
        })
        anim.make_clips(rig, roles)
    return rig, mesh, scene


if __name__ == "__main__":
    rig, mesh, scene = build()
    with lib.in_scene(scene):
        lib.export_glb([rig], "hero-volt.glb", animations=True)
