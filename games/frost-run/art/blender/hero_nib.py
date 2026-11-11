"""Nib, the baby frost dragon: round and chubby, with a big head, ice-white horns, a cream belly,
lavender wings that beat to hover, and a tail that ends in an ice spade. An original design.
"""
import math

import bpy  # noqa: F401
import bmesh
from mathutils import Vector

import anim
import lib


def wing_membrane(side):
    """A bat-like wing: three finger bones fanning out from the shoulder, with membrane between them."""
    bm = bmesh.new()
    root = Vector((0.12 * side, 0.16, 0.62))
    tips = [Vector((0.5 * side, 0.22, 0.86)), Vector((0.56 * side, 0.32, 0.64)), Vector((0.44 * side, 0.36, 0.46))]
    elbow = Vector((0.32 * side, 0.18, 0.76))
    verts = [bm.verts.new(root), bm.verts.new(elbow)] + [bm.verts.new(t) for t in tips]
    for a, b in ((2, 3), (3, 4)):
        bm.faces.new((verts[1], verts[a], verts[b]))
    bm.faces.new((verts[0], verts[1], verts[4]))
    geom = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
    moved = [e for e in geom["geom"] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=Vector((0, 0.02, 0)), verts=moved)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def build():
    scene = lib.use_scene("Nib")
    with lib.in_scene(scene):
        coll = lib.collection("Hero · Nib")
        scale_m = lib.material("nib_scale", "#FFFFFF", rough=0.6, vcol=True)
        belly_m = lib.material("nib_belly", "#F2E4C6", rough=0.8)
        wing_m = lib.material("nib_wing", "#B9A8F4", rough=0.55, emit="#9C86F0", strength=0.25)
        horn_m = lib.material("nib_horn", "#EAF7FF", rough=0.3, emit="#BFEAFF", strength=0.3)
        eye_m = lib.material("nib_eye", "#151A26", rough=0.2)
        glint_m = lib.material("nib_glint", "#FFFFFF", rough=0.2, emit="#FFFFFF", strength=2.0)
        claw_m = lib.material("nib_claw", "#DDEAF2", rough=0.4)
        mouth_m = lib.material("nib_mouth", "#2A2238", rough=0.6)

        parts = []
        body = lib.lumpy(lib.ico(1.0, 2), 0.015, seed=5)
        lib.transform(body, loc=(0, 0.02, 0.4), scale=(0.27, 0.25, 0.29))
        body_obj = lib.mesh_object("nib_body", body, scale_m)
        head = lib.lumpy(lib.ico(1.0, 2), 0.012, seed=6)
        lib.transform(head, loc=(0, -0.04, 0.8), scale=(0.25, 0.24, 0.22))
        head_obj = lib.mesh_object("nib_head", head, scale_m)
        snout = lib.ico(1.0, 2)
        lib.transform(snout, loc=(0, -0.23, 0.74), scale=(0.15, 0.13, 0.1))
        snout_obj = lib.mesh_object("nib_snout", snout, scale_m)

        def frost(center, normal, index):
            back = min(max((center.y + 0.1) / 0.4, 0.0), 1.0)
            jitter = ((index * 2654435761) % 89) / 89.0 * 0.06
            top = 0.1 if normal.z > 0.5 else 0.0
            return (0.42 - 0.1 * back + jitter + top, 0.76 - 0.12 * back + jitter + top, 0.84 - 0.1 * back + jitter + top * 0.5)
        for obj, bone in ((body_obj, "body"), (head_obj, "head"), (snout_obj, "head")):
            lib.paint(obj, frost)
            g = obj.vertex_groups.new(name=bone)
            g.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
            parts.append(obj)

        belly = lib.ico(1.0, 2)
        lib.transform(belly, loc=(0, -0.13, 0.38), scale=(0.19, 0.14, 0.23))
        parts.append(lib.part("nib_belly", belly, belly_m, "body"))
        for side, eye_bone in ((1, "eye.L"), (-1, "eye.R")):
            e = lib.transform(lib.uv_sphere(0.068, 10, 8), loc=(0.11 * side, -0.2, 0.86), scale=(0.9, 0.6, 1.2))
            parts.append(lib.part(f"nib_eye_{side}", e, eye_m, eye_bone))
            g = lib.transform(lib.uv_sphere(0.02, 6, 4), loc=(0.11 * side + 0.022, -0.245, 0.9))
            parts.append(lib.part(f"nib_glint_{side}", g, glint_m, eye_bone))
            nostril = lib.transform(lib.uv_sphere(0.012, 6, 4), loc=(0.045 * side, -0.37, 0.77))
            parts.append(lib.part("nib_nostril", nostril, mouth_m, "head"))
            horn = lib.cone(0.045, 0.0, 0.2, segments=5)
            lib.transform(horn, loc=(0, 0, 0.1))
            lib.transform(horn, rot=(-35, 18 * side, 0))
            lib.transform(horn, loc=(0.1 * side, 0.04, 0.96))
            parts.append(lib.part("nib_horn", horn, horn_m, "head"))
            fin = lib.cone(0.06, 0.0, 0.14, segments=3)
            lib.transform(fin, loc=(0, 0, 0.07))
            lib.transform(fin, rot=(0, 75 * side, 0), scale=(1, 0.3, 1))
            lib.transform(fin, loc=(0.23 * side, 0.02, 0.82))
            parts.append(lib.part("nib_fin", fin, wing_m, "head"))
            wing_bone, tip_bone = ("wing.L", "wingtip.L") if side > 0 else ("wing.R", "wingtip.R")
            wing = lib.part(f"nib_wing_{side}", wing_membrane(side), wing_m, wing_bone)
            tip_group = wing.vertex_groups.new(name=tip_bone)
            for v in wing.data.vertices:
                if abs(v.co.x) > 0.34:
                    wing.vertex_groups[wing_bone].remove([v.index])
                    tip_group.add([v.index], 1.0, "REPLACE")
            parts.append(wing)
            # Short legs and feet with three claws each.
            leg = "leg.L" if side > 0 else "leg.R"
            foot = "foot.L" if side > 0 else "foot.R"
            thigh = lib.lumpy(lib.ico(1.0, 1), 0.01, seed=side)
            lib.transform(thigh, loc=(0.14 * side, 0.0, 0.2), scale=(0.1, 0.11, 0.12))
            parts.append(lib.paint(lib.part(f"nib_thigh_{side}", thigh, scale_m, leg), frost))
            f = lib.ico(1.0, 1)
            lib.transform(f, loc=(0.14 * side, -0.06, 0.04), scale=(0.08, 0.12, 0.05))
            parts.append(lib.paint(lib.part(f"nib_foot_{side}", f, scale_m, foot), frost))
            for k in (-1, 0, 1):
                claw = lib.cone(0.016, 0.0, 0.05, segments=4)
                lib.transform(claw, rot=(-90, 0, 0))
                lib.transform(claw, loc=(0.14 * side + 0.04 * k, -0.18, 0.03))
                parts.append(lib.part("nib_claw", claw, claw_m, foot))
            arm = "arm.L" if side > 0 else "arm.R"
            parts.append(lib.paint(lib.part(f"nib_arm_{side}", lib.tube([(0.2 * side, -0.1, 0.52), (0.25 * side, -0.16, 0.42)], [0.045, 0.04], sides=6), scale_m, arm), frost))
            hand = lib.ico(0.045, 1)
            lib.transform(hand, loc=(0.255 * side, -0.17, 0.4))
            parts.append(lib.paint(lib.part(f"nib_hand_{side}", hand, scale_m, arm), frost))
        pts = [(-0.06 + 0.03 * i, -0.355 + 0.004 * abs(i - 2), 0.715 - 0.012 * (1 - ((i - 2) / 2) ** 2)) for i in range(5)]
        parts.append(lib.part("nib_mouth", lib.tube(pts, [0.01] * 5, sides=5), mouth_m, "mouth"))
        # Back spikes and the tail with its ice spade.
        for i, (y, z, r) in enumerate(((0.16, 0.66, 0.035), (0.22, 0.54, 0.035), (0.26, 0.42, 0.03))):
            spike = lib.cone(r, 0.0, 0.09, segments=4)
            lib.transform(spike, loc=(0, 0, 0.045))
            lib.transform(spike, rot=(-50, 0, 0))
            lib.transform(spike, loc=(0, y, z))
            parts.append(lib.part(f"nib_spike_{i}", spike, horn_m, "body"))
        tail_pts = [(0, 0.22, 0.28), (0, 0.38, 0.2), (0, 0.52, 0.15), (0, 0.65, 0.14)]
        tail = lib.tube(tail_pts, [0.09, 0.065, 0.045, 0.03], sides=7)
        tail_obj = lib.mesh_object("nib_tail", tail, scale_m)
        lib.paint(tail_obj, frost)
        groups = [tail_obj.vertex_groups.new(name=f"tail.{i}") for i in (1, 2, 3)]
        for v in tail_obj.data.vertices:
            i = 0 if v.co.y < 0.36 else 1 if v.co.y < 0.52 else 2
            groups[i].add([v.index], 1.0, "REPLACE")
        parts.append(tail_obj)
        spade = lib.cone(0.07, 0.0, 0.14, segments=4)
        lib.transform(spade, rot=(-90, 0, 0), scale=(1, 1, 0.35))
        lib.transform(spade, loc=(0, 0.72, 0.14))
        parts.append(lib.part("nib_spade", spade, horn_m, "tail.3"))

        mesh = lib.join(parts, "Nib")
        lib.link(mesh, coll)
        bones = [
            ("root", (0, 0, 0), (0, 0, 0.12), None),
            ("body", (0, 0.02, 0.14), (0, 0.02, 0.6), "root"),
            ("head", (0, -0.02, 0.6), (0, -0.02, 1.0), "body"),
            ("eye.L", (0.11, -0.2, 0.82), (0.11, -0.2, 0.9), "head"),
            ("eye.R", (-0.11, -0.2, 0.82), (-0.11, -0.2, 0.9), "head"),
            ("mouth", (0, -0.36, 0.69), (0, -0.36, 0.73), "head"),
            ("wing.L", (0.12, 0.16, 0.62), (0.32, 0.18, 0.76), "body"),
            ("wingtip.L", (0.32, 0.18, 0.76), (0.52, 0.28, 0.7), "wing.L"),
            ("wing.R", (-0.12, 0.16, 0.62), (-0.32, 0.18, 0.76), "body"),
            ("wingtip.R", (-0.32, 0.18, 0.76), (-0.52, 0.28, 0.7), "wing.R"),
            ("arm.L", (0.2, -0.1, 0.52), (0.25, -0.16, 0.41), "body"),
            ("arm.R", (-0.2, -0.1, 0.52), (-0.25, -0.16, 0.41), "body"),
            ("leg.L", (0.14, 0.0, 0.3), (0.14, -0.02, 0.08), "root"),
            ("foot.L", (0.14, 0.02, 0.06), (0.14, -0.16, 0.04), "leg.L"),
            ("leg.R", (-0.14, 0.0, 0.3), (-0.14, -0.02, 0.08), "root"),
            ("foot.R", (-0.14, 0.02, 0.06), (-0.14, -0.16, 0.04), "leg.R"),
            ("tail.1", (0, 0.22, 0.28), (0, 0.38, 0.2), "body"),
            ("tail.2", (0, 0.38, 0.2), (0, 0.52, 0.15), "tail.1"),
            ("tail.3", (0, 0.52, 0.15), (0, 0.72, 0.14), "tail.2"),
        ]
        rig = lib.armature("Rig_Nib", bones)
        lib.link(rig, coll)
        lib.skin(mesh, rig)
        roles = anim.Rig({
            "root": "root", "body": "body", "head": "head", "eyes": ["eye.L", "eye.R"], "mouth": "mouth",
            "legs": [("leg.L", None, "foot.L", 1), ("leg.R", None, "foot.R", -1)],
            "arms": [("arm.L", None, 1), ("arm.R", None, -1)],
            "wings": [("wing.L", "wingtip.L", 1), ("wing.R", "wingtip.R", -1)],
            "tails": [["tail.1", "tail.2", "tail.3"]], "run_lean": 8, "stride": 34, "arm_swing": 20,
        })
        anim.make_clips(rig, roles)
    return rig, mesh, scene


if __name__ == "__main__":
    rig, mesh, scene = build()
    with lib.in_scene(scene):
        lib.export_glb([rig], "hero-nib.glb", animations=True)
