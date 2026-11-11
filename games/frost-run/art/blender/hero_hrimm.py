"""Hrimm, the ice giant: a small giant built of faceted blue ice, with a snow-capped back, crystal
spires on the shoulders, glowing eyes under a heavy brow and great fists that reach the ground.
An original design.
"""
import bpy  # noqa: F401

import anim
import lib


def build():
    scene = lib.use_scene("Hrimm")
    with lib.in_scene(scene):
        coll = lib.collection("Hero · Hrimm")
        ice_m = lib.material("giant_ice", "#FFFFFF", rough=0.35, vcol=True)
        deep_m = lib.material("giant_deep", "#3E7FAA", rough=0.4)
        snow_m = lib.material("giant_snow", "#F3F8FB", rough=0.95)
        spire_m = lib.material("giant_spire", "#DFF6FF", rough=0.15, emit="#AEE9FF", strength=0.6)
        eye_m = lib.material("giant_eye", "#9BF0FF", rough=0.1, emit="#9BF0FF", strength=6.0)

        def facets(center, normal, index):
            jitter = ((index * 2654435761) % 101) / 101.0
            light = 0.55 + 0.45 * max(normal.z, 0.0)
            return (0.42 * light + 0.08 * jitter, 0.7 * light + 0.08 * jitter, 0.88 * light + 0.06 * jitter)

        def chunk(name, bm, bone):
            obj = lib.mesh_object(name, bm, ice_m)
            lib.paint(obj, facets)
            g = obj.vertex_groups.new(name=bone)
            g.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
            return obj

        parts = []
        torso = lib.lumpy(lib.ico(1.0, 1), 0.06, scale=1.4, seed=21)
        lib.transform(torso, loc=(0, 0.02, 0.66), scale=(0.4, 0.3, 0.36))
        parts.append(chunk("hrimm_torso", torso, "body"))
        belly = lib.lumpy(lib.ico(1.0, 1), 0.03, seed=22)
        lib.transform(belly, loc=(0, -0.08, 0.42), scale=(0.3, 0.24, 0.2))
        parts.append(chunk("hrimm_belly", belly, "body"))
        head = lib.lumpy(lib.ico(1.0, 1), 0.02, seed=23)
        lib.transform(head, loc=(0, -0.16, 0.96), scale=(0.17, 0.16, 0.15))
        parts.append(chunk("hrimm_head", head, "head"))
        brow = lib.box((0.3, 0.08, 0.06), bevel=0.02)
        lib.transform(brow, loc=(0, -0.29, 1.0), rot=(-12, 0, 0))
        parts.append(lib.part("hrimm_brow", brow, deep_m, "head"))
        for side, eye_bone in ((1, "eye.L"), (-1, "eye.R")):
            e = lib.transform(lib.uv_sphere(0.03, 8, 6), loc=(0.065 * side, -0.3, 0.95), scale=(1.4, 0.5, 0.75))
            parts.append(lib.part(f"hrimm_eye_{side}", e, eye_m, eye_bone))
            # Snow on the shoulders and a cluster of crystal spires on each.
            cap = lib.lumpy(lib.ico(1.0, 1), 0.02, seed=side + 30)
            lib.transform(cap, loc=(0.3 * side, 0.04, 0.92), scale=(0.17, 0.17, 0.08))
            parts.append(lib.part(f"hrimm_cap_{side}", cap, snow_m, "body"))
            for k, (dx, dy, h, tilt) in enumerate(((0.0, 0.08, 0.32, 10), (0.08, 0.0, 0.22, 25), (-0.06, 0.14, 0.2, -5))):
                spire = lib.cone(0.06, 0.0, h, segments=5)
                lib.transform(spire, loc=(0, 0, h / 2))
                lib.transform(spire, rot=(-20, tilt * side, 0))
                lib.transform(spire, loc=(0.32 * side + dx * side, dy + 0.06, 0.92))
                parts.append(lib.part(f"hrimm_spire_{side}_{k}", spire, spire_m, "body"))
            # Great arms: shoulder, forearm and a fist that nearly touches the ground.
            arm, fore = ("arm.L", "fore.L") if side > 0 else ("arm.R", "fore.R")
            upper = lib.lumpy(lib.ico(1.0, 1), 0.02, seed=side + 40)
            lib.transform(upper, loc=(0.44 * side, -0.02, 0.74), scale=(0.13, 0.13, 0.17))
            parts.append(chunk(f"hrimm_upper_{side}", upper, arm))
            fore_bm = lib.lumpy(lib.ico(1.0, 1), 0.02, seed=side + 50)
            lib.transform(fore_bm, loc=(0.48 * side, -0.06, 0.45), scale=(0.12, 0.12, 0.17))
            parts.append(chunk(f"hrimm_fore_{side}", fore_bm, fore))
            fist = lib.lumpy(lib.ico(1.0, 1), 0.02, seed=side + 60)
            lib.transform(fist, loc=(0.5 * side, -0.08, 0.2), scale=(0.15, 0.15, 0.13))
            parts.append(chunk(f"hrimm_fist_{side}", fist, fore))
            knuckle_cap = lib.lumpy(lib.ico(1.0, 1), 0.01, seed=side + 70)
            lib.transform(knuckle_cap, loc=(0.5 * side, -0.1, 0.3), scale=(0.1, 0.08, 0.04))
            parts.append(lib.part(f"hrimm_knuckle_{side}", knuckle_cap, snow_m, fore))
            # Short legs and blocky feet.
            leg, shin = ("leg.L", "shin.L") if side > 0 else ("leg.R", "shin.R")
            thigh = lib.lumpy(lib.ico(1.0, 1), 0.015, seed=side + 80)
            lib.transform(thigh, loc=(0.17 * side, 0.02, 0.26), scale=(0.12, 0.12, 0.13))
            parts.append(chunk(f"hrimm_thigh_{side}", thigh, leg))
            foot = lib.box((0.2, 0.26, 0.1), bevel=0.03)
            lib.transform(foot, loc=(0.17 * side, -0.04, 0.05))
            parts.append(chunk(f"hrimm_foot_{side}", foot, shin))
        back = lib.lumpy(lib.ico(1.0, 1), 0.03, seed=31)
        lib.transform(back, loc=(0, 0.16, 0.86), scale=(0.3, 0.16, 0.12))
        parts.append(lib.part("hrimm_back_snow", back, snow_m, "body"))
        jaw = lib.box((0.2, 0.08, 0.05), bevel=0.015)
        lib.transform(jaw, loc=(0, -0.28, 0.86))
        parts.append(lib.part("hrimm_jaw", jaw, deep_m, "mouth"))

        mesh = lib.join(parts, "Hrimm")
        lib.link(mesh, coll)
        bones = [
            ("root", (0, 0, 0), (0, 0, 0.12), None),
            ("body", (0, 0.02, 0.3), (0, 0.02, 0.86), "root"),
            ("head", (0, -0.12, 0.86), (0, -0.14, 1.14), "body"),
            ("eye.L", (0.065, -0.3, 0.92), (0.065, -0.3, 0.98), "head"),
            ("eye.R", (-0.065, -0.3, 0.92), (-0.065, -0.3, 0.98), "head"),
            ("mouth", (0, -0.28, 0.84), (0, -0.28, 0.88), "head"),
            ("arm.L", (0.38, -0.02, 0.86), (0.47, -0.05, 0.56), "body"),
            ("fore.L", (0.47, -0.05, 0.56), (0.5, -0.08, 0.18), "arm.L"),
            ("arm.R", (-0.38, -0.02, 0.86), (-0.47, -0.05, 0.56), "body"),
            ("fore.R", (-0.47, -0.05, 0.56), (-0.5, -0.08, 0.18), "arm.R"),
            ("leg.L", (0.17, 0.02, 0.36), (0.17, 0.0, 0.14), "root"),
            ("shin.L", (0.17, 0.0, 0.14), (0.17, -0.02, 0.02), "leg.L"),
            ("leg.R", (-0.17, 0.02, 0.36), (-0.17, 0.0, 0.14), "root"),
            ("shin.R", (-0.17, 0.0, 0.14), (-0.17, -0.02, 0.02), "leg.R"),
        ]
        rig = lib.armature("Rig_Hrimm", bones)
        lib.link(rig, coll)
        lib.skin(mesh, rig)
        roles = anim.Rig({
            "root": "root", "body": "body", "head": "head", "eyes": ["eye.L", "eye.R"], "mouth": "mouth",
            "legs": [("leg.L", "shin.L", None, 1), ("leg.R", "shin.R", None, -1)],
            "arms": [("arm.L", "fore.L", 1), ("arm.R", "fore.R", -1)], "throw_side": 1, "wave_side": 1,
            "run_lean": 12, "stride": 26, "arm_swing": 40, "duck_scale": 0.7,
        })
        anim.make_clips(rig, roles)
    return rig, mesh, scene


if __name__ == "__main__":
    rig, mesh, scene = build()
    with lib.in_scene(scene):
        lib.export_glb([rig], "hero-hrimm.glb", animations=True)
