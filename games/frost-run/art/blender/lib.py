"""Shared helpers for every Frost Run model: scene reset, flat-shaded materials, bmesh builders,
rigid rigging, keyframed actions, glTF export and viewport-style preview renders.

Every model is built from code so it can be rebuilt in any Blender (headless here, or the
artist's own Blender through the Blender MCP) and come out the same.
"""
import math
import os
import struct
import zlib

import bpy  # noqa: I001  (bpy first: it makes bmesh and mathutils importable outside Blender)
import bmesh
from mathutils import Euler, Matrix, Quaternion, Vector, noise

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODELS = os.path.join(ROOT, "art", "out")
PREVIEWS = os.path.join(ROOT, "art", "previews")
FPS = 24


# ---------------------------------------------------------------------------- scene


def reset_scene():
    """Start from nothing: the default cube, camera and light go first."""
    for name in ("Cube", "Camera", "Light"):
        obj = bpy.data.objects.get(name)
        if obj is not None:
            bpy.data.objects.remove(obj, do_unlink=True)
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures, bpy.data.actions,
                  bpy.data.cameras, bpy.data.lights, bpy.data.images):
        for item in list(block):
            if item.users == 0 or block is bpy.data.actions:
                block.remove(item)
    for coll in list(bpy.data.collections):
        bpy.data.collections.remove(coll)
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.unit_settings.system = "METRIC"
    return scene


def purge():
    """Drops data no object uses any more (a rebuilt model leaves its old meshes and materials behind)."""
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures, bpy.data.cameras, bpy.data.lights):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def use_scene(name):
    """Each model is built in a scene of its own, so one .blend holds them all, each at the origin for export.
    Rebuilding a model first empties its scene."""
    window = bpy.context.window
    if window is None:
        scene = bpy.context.scene
        scene.name = name
    else:
        scene = bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
        window.scene = scene
    for obj in list(scene.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    purge()
    scene.render.fps = FPS
    return scene


def in_scene(scene):
    """Makes `scene` the current one (operators act on the current scene) and returns a no-op context."""
    import contextlib
    window = bpy.context.window
    if window is not None and window.scene != scene:
        window.scene = scene
    return contextlib.nullcontext()


def collection(name):
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(coll)
    return coll


def link(obj, coll):
    for other in list(obj.users_collection):
        other.objects.unlink(obj)
    coll.objects.link(obj)
    return obj


# ---------------------------------------------------------------------------- materials


def hex_rgb(value):
    value = value.lstrip("#")
    srgb = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]


def material(name, color, rough=0.85, metal=0.0, emit=None, strength=0.0, alpha=1.0, vcol=False):
    """A flat Principled material. `vcol` multiplies the colour by the mesh's colour attribute,
    which the glTF exporter then writes as vertex colours."""
    mat = bpy.data.materials.get(name)
    if mat is not None:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    rgb = hex_rgb(color)
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit is not None:
        bsdf.inputs["Emission Color"].default_value = (*hex_rgb(emit), 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.surface_render_method = "BLENDED"
    if vcol:
        attr = nodes.new("ShaderNodeVertexColor")
        attr.layer_name = "Col"
        mix = nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        mix.inputs["A"].default_value = (*rgb, 1.0)
        mat.node_tree.links.new(attr.outputs["Color"], mix.inputs["B"])
        mat.node_tree.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    mat.diffuse_color = (*rgb, alpha)
    mat["vcol"] = bool(vcol)
    return mat


# ---------------------------------------------------------------------------- meshes


def mesh_object(name, bm, mat=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    if mat is not None:
        me.materials.append(mat)
    for poly in me.polygons:
        poly.use_smooth = False
    return obj


def ico(radius=1.0, subdiv=2):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    return bm


def uv_sphere(radius=1.0, segments=12, rings=8):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    return bm


def cone(r1, r2, depth, segments=8, cap=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=segments,
                          radius1=r1, radius2=r2, depth=depth)
    return bm


def box(size=(1, 1, 1), bevel=0.0, segments=1):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=segments,
                        affect="EDGES", profile=0.5)
    return bm


def transform(bm, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    mat = (Matrix.Translation(Vector(loc)) @ Euler([math.radians(a) for a in rot]).to_matrix().to_4x4()
           @ Matrix.Diagonal((*scale, 1.0)))
    bmesh.ops.transform(bm, matrix=mat, verts=bm.verts)
    return bm


def lumpy(bm, amount, scale=1.6, seed=0.0, along="normal"):
    """Pushes vertices in or out by smooth noise: snow, rock and ice are never perfectly round."""
    bm.verts.ensure_lookup_table()
    bm.normal_update()
    for v in bm.verts:
        n = noise.noise(v.co * scale + Vector((seed, seed * 1.7, seed * 2.3)))
        if along == "normal":
            v.co += v.normal * (n * amount)
        else:
            v.co.z += n * amount
    return bm


def tube(points, radii, sides=6, cap=True):
    """A tube along a polyline, ring by ring; the radius can change along it (horns, tails)."""
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(points):
        p = Vector(p)
        a = Vector(points[max(i - 1, 0)])
        b = Vector(points[min(i + 1, len(points) - 1)])
        t = (b - a).normalized()
        up = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
        x = t.cross(up).normalized()
        y = t.cross(x).normalized()
        ring = []
        for k in range(sides):
            ang = 2 * math.pi * k / sides
            ring.append(bm.verts.new(p + (x * math.cos(ang) + y * math.sin(ang)) * radii[i]))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(sides):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % sides], rings[i + 1][(k + 1) % sides], rings[i + 1][k]))
    if cap:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def ribbon(points, widths, thickness=0.02, side=(1, 0, 0)):
    """A flat strip along a polyline (scarf tails, wing membranes, banners)."""
    bm = bmesh.new()
    side = Vector(side).normalized()
    top, bottom = [], []
    for p, w in zip(points, widths):
        p = Vector(p)
        top.append((bm.verts.new(p + side * w / 2), bm.verts.new(p - side * w / 2)))
    for i in range(len(top) - 1):
        bm.faces.new((top[i][0], top[i][1], top[i + 1][1], top[i + 1][0]))
    geom = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
    moved = [e for e in geom["geom"] if isinstance(e, bmesh.types.BMVert)]
    bm.normal_update()
    normal = Vector((0, 0, 0))
    for f in bm.faces:
        normal += f.normal
    normal = normal.normalized() if normal.length > 0 else Vector((0, 1, 0))
    bmesh.ops.translate(bm, vec=normal * thickness, verts=moved)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def merge(*bms):
    out = bmesh.new()
    for bm in bms:
        me = bpy.data.meshes.new("_tmp")
        bm.to_mesh(me)
        out.from_mesh(me)
        bpy.data.meshes.remove(me)
        bm.free()
    return out


def paint(obj, colour_of):
    """Colours each face (corner domain) by `colour_of(face_center, face_normal, index) -> '#rrggbb'`."""
    me = obj.data
    attr = me.color_attributes.get("Col") or me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    me.color_attributes.active_color = attr
    for poly in me.polygons:
        c = colour_of(poly.center, poly.normal, poly.index)
        rgb = hex_rgb(c) if isinstance(c, str) else c
        for li in poly.loop_indices:
            attr.data[li].color = (*rgb, 1.0)
    return obj


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    out = bpy.context.view_layer.objects.active
    out.name = name
    out.data.name = name
    whiten_plain_faces(out)
    return out


def whiten_plain_faces(obj):
    """After a join, faces whose material does not use vertex colour get white, so the colour attribute
    (which the whole mesh shares once exported) leaves their material's colour as it is."""
    me = obj.data
    attr = me.color_attributes.get("Col")
    if attr is None:
        return
    for poly in me.polygons:
        mat = me.materials[poly.material_index] if poly.material_index < len(me.materials) else None
        painted = any(sum(attr.data[li].color[:3]) > 0 for li in poly.loop_indices)
        if mat is not None and mat.get("vcol") and painted:
            continue
        for li in poly.loop_indices:
            attr.data[li].color = (1.0, 1.0, 1.0, 1.0)


def part(name, bm, mat, bone=None):
    """A mesh piece; `bone` names the vertex group it will ride on when the pieces are joined and skinned."""
    obj = mesh_object(name, bm, mat)
    if bone is not None:
        group = obj.vertex_groups.new(name=bone)
        group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    return obj


def ground_object(obj):
    """Drops the object so its lowest point sits on z = 0."""
    low = min((obj.matrix_world @ v.co).z for v in obj.data.vertices)
    obj.location.z -= low


# ---------------------------------------------------------------------------- rigs and actions


def armature(name, bones):
    """`bones`: list of (name, head, tail, parent or None). Returns the armature object."""
    data = bpy.data.armatures.new(name)
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    for bname, head, tail, parent in bones:
        eb = data.edit_bones.new(bname)
        eb.head = Vector(head)
        eb.tail = Vector(tail)
        eb.roll = 0.0
        if parent is not None:
            eb.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    return obj


def skin(mesh_obj, arm_obj):
    mesh_obj.parent = arm_obj
    mod = mesh_obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm_obj
    return mesh_obj


def _quat(deg):
    return Euler([math.radians(a) for a in deg], "XYZ").to_quaternion()


def action(arm_obj, name, frames, pose, step=2):
    """Keys `pose(t)` (t from 0 to 1 over `frames` frames) on every bone it names.
    `pose` returns {bone: {"rot": (x, y, z) degrees, "loc": (x, y, z), "scale": (x, y, z)}}."""
    full = f"{arm_obj.name}|{name}"
    stale = bpy.data.actions.get(full)
    if stale is not None:
        bpy.data.actions.remove(stale)
    act = bpy.data.actions.new(full)
    act.use_fake_user = True
    arm_obj.animation_data_create()
    arm_obj.animation_data.action = act
    pbones = arm_obj.pose.bones
    for pb in pbones:
        pb.rotation_mode = "QUATERNION"
    keyed = set()
    frame_list = list(range(0, frames + 1, step))
    if frame_list[-1] != frames:
        frame_list.append(frames)
    for f in frame_list:
        t = f / frames
        posed = pose(t)
        for pb in pbones:
            spec = posed.get(pb.name, {})
            pb.rotation_quaternion = _quat(spec.get("rot", (0, 0, 0)))
            pb.location = Vector(spec.get("loc", (0, 0, 0)))
            pb.scale = Vector(spec.get("scale", (1, 1, 1)))
            if spec or pb.name in keyed:
                pb.keyframe_insert("rotation_quaternion", frame=f)
                pb.keyframe_insert("location", frame=f)
                pb.keyframe_insert("scale", frame=f)
                keyed.add(pb.name)
    for pb in pbones:
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()
        pb.scale = Vector((1, 1, 1))
    return act


def push_actions_to_nla(arm_obj, actions):
    """Each action on a muted NLA track of its own, so the file shows them all and the exporter sends each as a clip."""
    ad = arm_obj.animation_data
    for act in actions:
        clip = act.name.split("|")[-1]
        track = ad.nla_tracks.new()
        track.name = clip
        strip = track.strips.new(clip, 0, act)
        strip.name = clip
        track.mute = True
    ad.action = None
    # Playing a clip leaves its last pose on the bones; the file and the export keep the rest pose.
    for pb in arm_obj.pose.bones:
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()
        pb.scale = Vector((1, 1, 1))


# ---------------------------------------------------------------------------- export


def export_glb(objs, filename, animations=False):
    os.makedirs(MODELS, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
        for child in o.children_recursive:
            child.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = os.path.join(MODELS, filename)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        use_active_scene=True,
        export_yup=True,
        export_apply=False,
        export_extras=True,
        export_vertex_color="ACTIVE",
        export_animations=animations,
        export_animation_mode="NLA_TRACKS" if animations else "ACTIONS",
        export_optimize_animation_size=True,
        export_skins=animations,
        export_morph=False,
        export_lights=False,
        export_cameras=False,
    )
    # Sampling the clips leaves the bones posed; put every rig back at rest for the file.
    for o in objs:
        if o.type == "ARMATURE":
            for pb in o.pose.bones:
                pb.rotation_quaternion = Quaternion()
                pb.location = Vector()
                pb.scale = Vector((1, 1, 1))
    return path


# ---------------------------------------------------------------------------- previews


def _write_png(path, width, height, rgba_rows):
    raw = b"".join(b"\x00" + bytes(row) for row in rgba_rows)
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b"")
    with open(path, "wb") as fh:
        fh.write(png)


def preview(objs, filename, views=((35, -25), (35, 65), (15, 160), (70, -25)), size=360, engine="WORKBENCH",
            distance=None, target=None, frame=None, colors="MATERIAL"):
    """Renders the objects from several angles (like orbiting the viewport) and writes one contact sheet."""
    import numpy as np
    os.makedirs(PREVIEWS, exist_ok=True)
    scene = bpy.context.scene
    if frame is not None:
        scene.frame_set(frame)
    hidden = []
    for o in scene.objects:
        if o not in objs and o.type in {"MESH", "CURVE"} and not any(o in p.children_recursive for p in objs):
            if not o.hide_render:
                o.hide_render = True
                hidden.append(o)
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        for each in [o, *o.children_recursive]:
            if each.type != "MESH":
                continue
            ev = each.evaluated_get(depsgraph)
            for v in ev.data.vertices:
                w = ev.matrix_world @ v.co
                lo = Vector((min(lo.x, w.x), min(lo.y, w.y), min(lo.z, w.z)))
                hi = Vector((max(hi.x, w.x), max(hi.y, w.y), max(hi.z, w.z)))
    center = Vector(target) if target is not None else (lo + hi) / 2
    radius = distance or max((hi - lo).length * 1.25, 0.5)
    cam_data = bpy.data.cameras.new("PreviewCam")
    cam_data.lens = 50
    cam = bpy.data.objects.new("PreviewCam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.engine = "BLENDER_WORKBENCH" if engine == "WORKBENCH" else "CYCLES"
    if engine == "WORKBENCH":
        shading = scene.display.shading
        shading.light = "STUDIO"
        shading.color_type = colors
        shading.show_cavity = True
        shading.cavity_type = "BOTH"
        shading.show_object_outline = True
        shading.show_shadows = True
        scene.display.shadow_focus = 0.4
        scene.render.film_transparent = False
        world = scene.world or bpy.data.worlds.new("World")
        scene.world = world
        world.color = (0.035, 0.034, 0.03)
    else:
        scene.cycles.samples = 24
        scene.cycles.device = "CPU"
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    tiles = []
    for elev, azim in views:
        e, a = math.radians(elev), math.radians(azim)
        offset = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * radius * 1.6
        cam.location = center + offset
        cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
        path = os.path.join(PREVIEWS, "_tile.png")
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(path)
        px = np.array(img.pixels[:]).reshape(size, size, 4)
        tiles.append(np.flipud((np.clip(px, 0, 1) * 255).astype(np.uint8)))
        bpy.data.images.remove(img)
    cols = 2 if len(tiles) > 1 else 1
    rows = (len(tiles) + cols - 1) // cols
    sheet = np.zeros((rows * size, cols * size, 4), dtype=np.uint8)
    for i, t in enumerate(tiles):
        r, c = divmod(i, cols)
        sheet[r * size:(r + 1) * size, c * size:(c + 1) * size] = t
    out = os.path.join(PREVIEWS, filename)
    _write_png(out, cols * size, rows * size, [sheet[y].tobytes() for y in range(rows * size)])
    bpy.data.objects.remove(cam, do_unlink=True)
    bpy.data.cameras.remove(cam_data)
    for o in hidden:
        o.hide_render = False
    return out
