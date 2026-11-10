"""Lumen, the spirit miner: a small glowing miner's spirit with a steel helmet and a cold white
headlamp, a canvas satchel and a pickaxe. Its body materials are named spirit_* so the game can add
a soft ghostly rim glow on top of the colours set here. An original design.
"""
import bpy  # noqa: F401

import anim
import lib


def build():
    scene = lib.use_scene("Lumen")
    with lib.in_scene(scene):
        coll = lib.collection("Hero · Lumen")
        spirit_m = lib.material("spirit_body", "#6CC2EC", rough=0.4, emit="#7AD6FF", strength=1.1)
        face_m = lib.material("spirit_face", "#B5ECFF", rough=0.35, emit="#A6E6FF", strength=0.8)
        eye_m = lib.material("spirit_eye", "#FFFFFF", rough=0.1, emit="#FFFFFF", strength=5.0)
        helmet_m = lib.material("miner_helmet", "#4A4742", rough=0.45, metal=0.4)
        brim_m = lib.material("miner_brim", "#35322E", rough=0.5, metal=0.3)
        lamp_m = lib.material("miner_lamp", "#E8FFFF", rough=0.1, emit="#E8FFFF", strength=8.0)
        canvas_m = lib.material("miner_canvas", "#E8E0CC", rough=0.95)
        boot_m = lib.material("miner_boot", "#2E2A27", rough=0.7)
        wood_m = lib.material("miner_wood", "#6D5C4C", rough=0.85)
        steel_m = lib.material("miner_steel", "#A7B2BC", rough=0.3, metal=0.8)

        parts = []
        torso = lib.lumpy(lib.ico(1.0, 2), 0.012, seed=11)
        lib.transform(torso, loc=(0, 0, 0.42), scale=(0.2, 0.17, 0.2))
        parts.append(lib.part("lumen_torso", torso, spirit_m, "body"))
        hips = lib.ico(1.0, 2)
        lib.transform(hips, loc=(0, 0.01, 0.28), scale=(0.17, 0.15, 0.1))
        parts.append(lib.part("lumen_hips", hips, spirit_m, "body"))
        head = lib.lumpy(lib.ico(1.0, 2), 0.01, seed=12)
        lib.transform(head, loc=(0, -0.01, 0.76), scale=(0.24, 0.23, 0.23))
        parts.append(lib.part("lumen_head", head, face_m, "head"))
        # The helmet: a dome, a brim, a band and a cold white lamp.
        dome = lib.uv_sphere(1.0, 14, 8)
        for v in dome.verts:
            if v.co.z < 0:
                v.co.z = 0
        lib.transform(dome, loc=(0, 0.0, 0.83), scale=(0.255, 0.255, 0.2))
        parts.append(lib.part("lumen_helmet", dome, helmet_m, "head"))
        brim = lib.cone(0.33, 0.33, 0.025, segments=14)
        lib.transform(brim, loc=(0, -0.03, 0.83), scale=(1, 1.05, 1))
        parts.append(lib.part("lumen_brim", brim, brim_m, "head"))
        lamp_base = lib.cone(0.07, 0.06, 0.06, segments=10)
        lib.transform(lamp_base, rot=(90, 0, 0))
        lib.transform(lamp_base, loc=(0, -0.24, 0.95))
        parts.append(lib.part("lumen_lamp_base", lamp_base, helmet_m, "head"))
        lens = lib.cone(0.05, 0.05, 0.02, segments=10)
        lib.transform(lens, rot=(90, 0, 0))
        lib.transform(lens, loc=(0, -0.275, 0.95))
        parts.append(lib.part("lumen_lamp", lens, lamp_m, "head"))
        for side, eye_bone in ((1, "eye.L"), (-1, "eye.R")):
            e = lib.transform(lib.uv_sphere(0.045, 8, 6), loc=(0.09 * side, -0.215, 0.74), scale=(0.75, 0.5, 1.35))
            parts.append(lib.part(f"lumen_eye_{side}", e, eye_m, eye_bone))
            # Arms: upper arm and forearm, with mitten hands.
            arm, fore = ("arm.L", "fore.L") if side > 0 else ("arm.R", "fore.R")
            parts.append(lib.part(f"lumen_arm_{side}", lib.tube([(0.2 * side, 0, 0.52), (0.25 * side, 0, 0.38)], [0.05, 0.045], sides=6), spirit_m, arm))
            parts.append(lib.part(f"lumen_fore_{side}", lib.tube([(0.25 * side, 0, 0.38), (0.27 * side, -0.02, 0.26)], [0.045, 0.04], sides=6), spirit_m, fore))
            hand = lib.lumpy(lib.ico(0.06, 1), 0.008, seed=side)
            lib.transform(hand, loc=(0.275 * side, -0.025, 0.23))
            parts.append(lib.part(f"lumen_hand_{side}", hand, face_m, fore))
            # Legs and heavy boots.
            leg, shin = ("leg.L", "shin.L") if side > 0 else ("leg.R", "shin.R")
            parts.append(lib.part(f"lumen_leg_{side}", lib.tube([(0.08 * side, 0, 0.26), (0.085 * side, 0, 0.15)], [0.055, 0.05], sides=6), spirit_m, leg))
            parts.append(lib.part(f"lumen_shin_{side}", lib.tube([(0.085 * side, 0, 0.15), (0.085 * side, 0, 0.07)], [0.05, 0.048], sides=6), spirit_m, shin))
            boot = lib.box((0.11, 0.17, 0.08), bevel=0.02)
            lib.transform(boot, loc=(0.085 * side, -0.03, 0.04))
            parts.append(lib.part(f"lumen_boot_{side}", boot, boot_m, shin))
        # A small smile, the satchel and its strap.
        pts = [(-0.035 + 0.0175 * i, -0.226 + 0.003 * abs(i - 2), 0.665 - 0.01 * (1 - ((i - 2) / 2) ** 2)) for i in range(5)]
        parts.append(lib.part("lumen_mouth", lib.tube(pts, [0.008] * 5, sides=5), boot_m, "mouth"))
        bag = lib.box((0.13, 0.07, 0.11), bevel=0.02)
        lib.transform(bag, loc=(-0.17, -0.06, 0.33))
        parts.append(lib.part("lumen_bag", bag, canvas_m, "body"))
        strap = lib.tube([(0.15, -0.12, 0.55), (0.0, -0.18, 0.46), (-0.15, -0.12, 0.38)], [0.015] * 3, sides=4)
        parts.append(lib.part("lumen_strap", strap, canvas_m, "body"))
        # The pickaxe, held in the right hand.
        handle = lib.tube([(-0.28, -0.04, 0.12), (-0.28, -0.04, 0.62)], [0.018, 0.018], sides=6)
        parts.append(lib.part("lumen_pick_handle", handle, wood_m, "fore.R"))
        pick = lib.tube([(-0.28, -0.22, 0.56), (-0.28, -0.12, 0.6), (-0.28, -0.04, 0.62), (-0.28, 0.06, 0.6), (-0.28, 0.16, 0.55)],
                        [0.012, 0.025, 0.035, 0.025, 0.012], sides=5)
        parts.append(lib.part("lumen_pick_head", pick, steel_m, "fore.R"))
        # Wisps: two little lights that orbit when the spirit is happy.
        for i, (x, z) in enumerate(((0.32, 0.86), (-0.34, 0.72))):
            w = lib.ico(0.03, 1)
            lib.transform(w, loc=(x, 0.1, z))
            parts.append(lib.part(f"lumen_wisp_{i}", w, eye_m, "wisps"))

        mesh = lib.join(parts, "Lumen")
        lib.link(mesh, coll)
        bones = [
            ("root", (0, 0, 0), (0, 0, 0.12), None),
            ("body", (0, 0, 0.24), (0, 0, 0.58), "root"),
            ("head", (0, 0, 0.58), (0, 0, 1.0), "body"),
            ("eye.L", (0.09, -0.21, 0.71), (0.09, -0.21, 0.78), "head"),
            ("eye.R", (-0.09, -0.21, 0.71), (-0.09, -0.21, 0.78), "head"),
            ("mouth", (0, -0.22, 0.65), (0, -0.22, 0.68), "head"),
            ("wisps", (0, 0.1, 0.6), (0, 0.1, 0.9), "body"),
            ("arm.L", (0.2, 0, 0.52), (0.25, 0, 0.38), "body"),
            ("fore.L", (0.25, 0, 0.38), (0.27, -0.02, 0.24), "arm.L"),
            ("arm.R", (-0.2, 0, 0.52), (-0.25, 0, 0.38), "body"),
            ("fore.R", (-0.25, 0, 0.38), (-0.27, -0.02, 0.24), "arm.R"),
            ("leg.L", (0.08, 0, 0.27), (0.085, 0, 0.15), "root"),
            ("shin.L", (0.085, 0, 0.15), (0.085, 0, 0.03), "leg.L"),
            ("leg.R", (-0.08, 0, 0.27), (-0.085, 0, 0.15), "root"),
            ("shin.R", (-0.085, 0, 0.15), (-0.085, 0, 0.03), "leg.R"),
        ]
        rig = lib.armature("Rig_Lumen", bones)
        lib.link(rig, coll)
        lib.skin(mesh, rig)
        roles = anim.Rig({
            "root": "root", "body": "body", "head": "head", "eyes": ["eye.L", "eye.R"], "mouth": "mouth",
            "legs": [("leg.L", "shin.L", None, 1), ("leg.R", "shin.R", None, -1)],
            "arms": [("arm.L", "fore.L", 1), ("arm.R", "fore.R", -1)], "throw_side": -1, "wave_side": 1,
            "tails": [["wisps"]], "spinner": "wisps", "run_lean": 9, "stride": 36,
        })
        anim.make_clips(rig, roles)
    return rig, mesh, scene


if __name__ == "__main__":
    rig, mesh, scene = build()
    with lib.in_scene(scene):
        lib.export_glb([rig], "hero-lumen.glb", animations=True)
