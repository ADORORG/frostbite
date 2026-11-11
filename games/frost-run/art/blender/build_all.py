"""Builds every Frost Run model, each in a scene of its own, exports each to art/out/ as a .glb, saves everything there as
frost-run.blend, then packs the models into src/screen/models/packed.ts (pack.py), the module the game bundles them from.

In Blender:   blender --background --python art/blender/build_all.py   (or open it in the Scripting tab and run it)
With bpy:     python art/blender/build_all.py   (Blender as a Python module, 5.2)
art/out/ is not committed: it is made again from these scripts.
"""
import importlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import bpy  # noqa: E402

import anim  # noqa: E402
import arenas  # noqa: E402
import hero_hrimm  # noqa: E402
import hero_lumen  # noqa: E402
import hero_nib  # noqa: E402
import hero_pip  # noqa: E402
import hero_volt  # noqa: E402
import lib  # noqa: E402
import pack  # noqa: E402
import props  # noqa: E402

HEROES = (hero_volt, hero_nib, hero_lumen, hero_hrimm, hero_pip)


def main():
    for module in (lib, anim, *HEROES, props, arenas, pack):
        importlib.reload(module)
    for name in ("Cube", "Camera", "Light"):
        obj = bpy.data.objects.get(name)
        if obj is not None:
            bpy.data.objects.remove(obj, do_unlink=True)
    written = []
    for hero in HEROES:
        rig, _mesh, scene = hero.build()
        with lib.in_scene(scene):
            written.append(lib.export_glb([rig], f"hero-{scene.name.lower()}.glb", animations=True))
    written += props.build_all()
    written += arenas.build_all()
    first = bpy.data.scenes.get("Pip")
    if first is not None and bpy.context.window is not None:
        bpy.context.window.scene = first
    stale = bpy.data.scenes.get("Scene")
    if stale is not None and len(stale.objects) == 0 and len(bpy.data.scenes) > 1:
        bpy.data.scenes.remove(stale)
    blend = os.path.join(lib.MODELS, "frost-run.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
    for path in written:
        print(os.path.basename(path), os.path.getsize(path))
    print("saved", blend)
    pack.main()


if __name__ == "__main__":
    main()
