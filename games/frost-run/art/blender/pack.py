"""Packs the exported models into src/screen/models/packed.ts, the module the game bundles them from.

The game's frame may load no files, so the models travel inside main.js as base64 text. Before they are packed each one is made smaller,
with nothing a player can see lost:

- Normals are dropped. Every model is flat-shaded, so three.js works each face's normal out on the screen (a primitive with no normals
  is drawn flat by its glTF loader), and with them gone the corners of neighbouring faces that share a place and a colour become one.
- Corners that are the same in every way are joined (welded), and the indices point at the joined ones.
- Vertex colours and skin weights are stored as bytes (unsigned and normalised, as glTF allows for both).
- An animation channel that holds a bone at its rest pose all clip long is dropped: three.js eases a bone that no clip moves back to its rest
  anyway. In the rest, a key that a straight line between its neighbours already gives is dropped, and turns are stored as 16-bit numbers.

Run by build_all.py after it exports, or alone: python art/blender/pack.py (any Python 3 with numpy, such as Blender's own).
"""
import base64
import json
import os
import struct
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
EXPORTS = os.path.join(ROOT, "art", "out")
TARGET = os.path.join(ROOT, "src", "screen", "models", "packed.ts")

FLOAT, UBYTE, USHORT, SHORT, UINT = 5126, 5121, 5123, 5122, 5125
DTYPES = {FLOAT: np.float32, UBYTE: np.uint8, USHORT: np.uint16, SHORT: np.int16, UINT: np.uint32, 5120: np.int8}
WIDTH = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
REST = {"translation": [0, 0, 0], "rotation": [0, 0, 0, 1], "scale": [1, 1, 1]}


def read_glb(path):
    data = open(path, "rb").read()
    magic, version, _length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67 or version != 2:
        raise ValueError(f"{path} is not a glTF 2 binary")
    json_length = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20 + json_length])
    at = 20 + json_length
    blob = b""
    if at < len(data):
        bin_length = struct.unpack_from("<I", data, at)[0]
        blob = data[at + 8:at + 8 + bin_length]
    return gltf, blob


def read_accessor(gltf, blob, index):
    """An accessor's values as a numpy array of shape (count, width), as floats when it is normalised."""
    accessor = gltf["accessors"][index]
    view = gltf["bufferViews"][accessor["bufferView"]]
    dtype = np.dtype(DTYPES[accessor["componentType"]])
    width = WIDTH[accessor["type"]]
    count = accessor["count"]
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    stride = view.get("byteStride", dtype.itemsize * width)
    rows = np.ndarray((count, width), dtype=dtype, buffer=blob, offset=start, strides=(stride, dtype.itemsize)).copy()
    if accessor.get("normalized"):
        top = float(np.iinfo(dtype).max)
        rows = np.maximum(rows.astype(np.float64) / top, -1.0)
    return rows


def stored_bounds(rows):
    """The least and greatest of each column, as glTF wants an accessor's bounds: of the numbers as they are stored (whole numbers stay
    whole), whether or not the accessor is normalised. A loader scales them itself, and culls a mesh by them, so bounds already scaled
    would shrink every 16-bit mesh to a point and it would vanish whenever that point left the picture."""
    cast = float if rows.dtype.kind == "f" else int
    return [cast(v) for v in rows.min(axis=0)], [cast(v) for v in rows.max(axis=0)]


class Writer:
    """Builds the new binary chunk. Accessors of a kind share one buffer view (vertices, indices, the rest), each four-byte aligned
    inside it, so the JSON stays short; positions stored as 16-bit numbers need a stride of their own and get a view each."""

    def __init__(self):
        self.accessors = []
        self.pools = {}

    def add(self, values, component, kind, normalized=False, target=None, bounds=False, stride=None):
        values = np.ascontiguousarray(values)
        accessor = {"componentType": component, "count": int(values.shape[0]), "type": kind}
        if normalized:
            accessor["normalized"] = True
        if bounds:
            accessor["min"], accessor["max"] = stored_bounds(values.reshape(values.shape[0], -1))
        self.accessors.append(accessor)
        pool = ("own", len(self.accessors)) if stride is not None else ("pool", target)
        self.pools.setdefault(pool, []).append((len(self.accessors) - 1, values.tobytes(), target, stride))
        return len(self.accessors) - 1

    def finish(self):
        blob = bytearray()
        views = []
        for entries in self.pools.values():
            while len(blob) % 4:
                blob.append(0)
            start = len(blob)
            for index, data, _target, _stride in entries:
                while (len(blob) - start) % 4:
                    blob.append(0)
                self.accessors[index]["bufferView"] = len(views)
                self.accessors[index]["byteOffset"] = len(blob) - start
                blob.extend(data)
            view = {"buffer": 0, "byteLength": len(blob) - start, "byteOffset": start}
            _index, _data, target, stride = entries[0]
            if target is not None:
                view["target"] = target
            if stride is not None:
                view["byteStride"] = stride
            views.append(view)
        while len(blob) % 4:
            blob.append(0)
        for accessor in self.accessors:
            if accessor.get("byteOffset") == 0:
                del accessor["byteOffset"]
        return blob, views


def to_bytes(values):
    """Values from 0 to 1 as normalised bytes."""
    return np.clip(np.rint(values * 255.0), 0, 255).astype(np.uint8)


def weights_to_bytes(weights):
    """Skin weights as bytes that still add up to exactly one (255), the largest taking up the rounding."""
    total = weights.sum(axis=1, keepdims=True)
    total[total == 0] = 1
    scaled = to_bytes(weights / total).astype(np.int32)
    biggest = scaled.argmax(axis=1)
    scaled[np.arange(len(scaled)), biggest] += 255 - scaled.sum(axis=1)
    return np.clip(scaled, 0, 255).astype(np.uint8)


def pack_primitive(gltf, blob, primitive, out, frame=None):
    attributes = primitive["attributes"]
    position = read_accessor(gltf, blob, attributes["POSITION"]).astype(np.float32)
    count = position.shape[0]
    if frame is None:
        parts = [("POSITION", position, FLOAT, "VEC3", False)]
    else:
        # A mesh that is not skinned keeps its points as 16-bit numbers inside its own box; its node carries the box back (see pack()).
        centre, half = frame
        scaled = np.clip(np.rint((position - centre) / half * 32767.0), -32767, 32767).astype(np.int16)
        parts = [("POSITION", np.hstack([scaled, np.zeros((count, 1), dtype=np.int16)]), SHORT, "VEC3", True)]
    if "COLOR_0" in attributes:
        colour = read_accessor(gltf, blob, attributes["COLOR_0"])
        if colour.shape[1] == 3:
            colour = np.hstack([colour, np.ones((count, 1))])
        parts.append(("COLOR_0", to_bytes(colour), UBYTE, "VEC4", True))
    if "JOINTS_0" in attributes:
        parts.append(("JOINTS_0", read_accessor(gltf, blob, attributes["JOINTS_0"]).astype(np.uint8), UBYTE, "VEC4", False))
        parts.append(("WEIGHTS_0", weights_to_bytes(read_accessor(gltf, blob, attributes["WEIGHTS_0"])), UBYTE, "VEC4", True))
    indices = (
        read_accessor(gltf, blob, primitive["indices"]).reshape(-1).astype(np.int64)
        if "indices" in primitive
        else np.arange(count, dtype=np.int64)
    )
    # Weld: every corner is a row of its bytes; equal rows become one vertex.
    rows = np.hstack([np.ascontiguousarray(values).view(np.uint8).reshape(count, -1) for _, values, *_ in parts])
    keys = np.ascontiguousarray(rows).view(np.dtype((np.void, rows.shape[1]))).reshape(-1)
    _, first, inverse = np.unique(keys, return_index=True, return_inverse=True)
    order = np.argsort(first)
    rank = np.empty_like(order)
    rank[order] = np.arange(len(order))
    kept = first[order]
    remapped = rank[inverse.reshape(-1)][indices]
    packed = {}
    for name, values, component, kind, normalized in parts:
        padded = component == SHORT and name == "POSITION"
        rows_kept = values[kept]
        if padded:
            accessor = out.add(rows_kept, component, kind, normalized, 34962, stride=8)
            out.accessors[accessor]["min"], out.accessors[accessor]["max"] = stored_bounds(rows_kept[:, :3])
            # Three numbers to a point in a stride of four: the count stays the number of points.
            out.accessors[accessor]["count"] = int(rows_kept.shape[0])
            packed[name] = accessor
        else:
            packed[name] = out.add(rows_kept, component, kind, normalized, 34962, bounds=name == "POSITION")
    small = len(kept) < 65536
    index_values = remapped.astype(np.uint16 if small else np.uint32)
    result = {"attributes": packed, "indices": out.add(index_values.reshape(-1, 1), USHORT if small else UINT, "SCALAR", target=34963)}
    for key in ("material", "mode"):
        if key in primitive:
            result[key] = primitive[key]
    return result, count, len(kept)


def still(values, rest):
    rest = np.array(rest, dtype=np.float64)
    if np.all(np.abs(values - rest) < 1e-5):
        return True
    return len(rest) == 4 and np.all(np.abs(values + rest) < 1e-5)


def thin(times, values, tolerance=1e-4):
    """Drops each key that a straight line between the keys kept either side of it already gives."""
    keep = [0]
    for at in range(1, len(times) - 1):
        last = keep[-1]
        share = (times[at] - times[last]) / max(times[at + 1] - times[last], 1e-9)
        guess = values[last] + (values[at + 1] - values[last]) * share
        if np.max(np.abs(guess - values[at])) > tolerance:
            keep.append(at)
    if len(times) > 1:
        keep.append(len(times) - 1)
    return times[keep], values[keep]


def pack_animation(gltf, blob, animation, out, inputs):
    samplers, channels = [], []
    for channel in animation["channels"]:
        target = channel["target"]
        path = target["path"]
        sampler = animation["samplers"][channel["sampler"]]
        times = read_accessor(gltf, blob, sampler["input"]).reshape(-1)
        values = read_accessor(gltf, blob, sampler["output"]).astype(np.float64)
        node = gltf["nodes"][target["node"]]
        if path in REST and still(values, node.get(path, REST[path])):
            continue
        interpolation = sampler.get("interpolation", "LINEAR")
        if interpolation == "LINEAR":
            times, values = thin(times, values)
        key = times.astype(np.float32).tobytes()
        if key not in inputs:
            inputs[key] = out.add(times.astype(np.float32).reshape(-1, 1), FLOAT, "SCALAR", bounds=True)
        if path == "rotation":
            output = out.add(np.clip(np.rint(values * 32767.0), -32767, 32767).astype(np.int16), SHORT, "VEC4", normalized=True)
        else:
            output = out.add(values.astype(np.float32), FLOAT, "VEC3" if values.shape[1] == 3 else "SCALAR")
        samplers.append({"input": inputs[key], "interpolation": interpolation, "output": output})
        channels.append({"sampler": len(samplers) - 1, "target": target})
    return {"channels": channels, "name": animation.get("name", ""), "samplers": samplers}


def frames_for(gltf, blob):
    """For each mesh that may be quantized (not skinned, used by one node with no children, no turn and no scale), the box its points
    are stored in: a centre and one half-size for every axis."""
    users = {}
    for index, node in enumerate(gltf.get("nodes", [])):
        if "mesh" in node:
            users.setdefault(node["mesh"], []).append(index)
    frames = {}
    for mesh_index, nodes in users.items():
        node = gltf["nodes"][nodes[0]]
        if len(nodes) != 1 or "skin" in node or node.get("children") or "rotation" in node or "scale" in node or "matrix" in node:
            continue
        points = np.vstack(
            [read_accessor(gltf, blob, p["attributes"]["POSITION"]) for p in gltf["meshes"][mesh_index]["primitives"]]
        )
        low, high = points.min(axis=0), points.max(axis=0)
        centre = (low + high) / 2
        half = max(float((high - low).max()) / 2, 1e-6)
        frames[mesh_index] = (nodes[0], centre.astype(np.float64), half)
    return frames


def pack(path):
    gltf, blob = read_glb(path)
    out = Writer()
    before = after = 0
    frames = frames_for(gltf, blob)
    for mesh_index, mesh in enumerate(gltf.get("meshes", [])):
        frame = frames.get(mesh_index)
        primitives = []
        for primitive in mesh["primitives"]:
            packed, corners, vertices = pack_primitive(gltf, blob, primitive, out, None if frame is None else frame[1:])
            primitives.append(packed)
            before += corners
            after += vertices
        mesh["primitives"] = primitives
        if frame is not None:
            node_index, centre, half = frame
            node = gltf["nodes"][node_index]
            place = np.array(node.get("translation", [0, 0, 0]), dtype=np.float64) + centre
            node["translation"] = [float(v) for v in place]
            node["scale"] = [half, half, half]
    if frames:
        for key in ("extensionsUsed", "extensionsRequired"):
            gltf[key] = sorted(set(gltf.get(key, [])) | {"KHR_mesh_quantization"})
    for skin in gltf.get("skins", []):
        if "inverseBindMatrices" in skin:
            matrices = read_accessor(gltf, blob, skin["inverseBindMatrices"]).astype(np.float32)
            skin["inverseBindMatrices"] = out.add(matrices, FLOAT, "MAT4")
    inputs = {}
    gltf["animations"] = [pack_animation(gltf, blob, a, out, inputs) for a in gltf.get("animations", [])]
    if not gltf["animations"]:
        del gltf["animations"]
    data, views = out.finish()
    gltf["accessors"] = out.accessors
    gltf["bufferViews"] = views
    gltf["buffers"] = [{"byteLength": len(data)}]
    text = json.dumps(gltf, separators=(",", ":")).encode()
    text += b" " * (-len(text) % 4)
    total = 12 + 8 + len(text) + 8 + len(data)
    glb = struct.pack("<III", 0x46546C67, 2, total)
    glb += struct.pack("<II", len(text), 0x4E4F534A) + text
    glb += struct.pack("<II", len(data), 0x004E4942) + bytes(data)
    return glb, before, after


def entry(name, text):
    """One model's line of the table, laid out as prettier lays it out, so the file this writes needs no formatting afterwards."""
    key = name if name.isidentifier() else f'"{name}"'
    gap = " " if len(key) <= 4 else "\n    "
    return f'  {key}:{gap}"{text}",'


def main(exports=EXPORTS, target=TARGET):
    names = sorted(name for name in os.listdir(exports) if name.endswith(".glb"))
    if not names:
        raise SystemExit(f"No models in {exports}: run build_all.py first.")
    models = []
    for name in names:
        source = os.path.join(exports, name)
        glb, before, after = pack(source)
        models.append((name[:-4], base64.b64encode(glb).decode()))
        print(f"{name:18} {os.path.getsize(source):8} -> {len(glb):8} bytes, {before} corners -> {after} vertices")
    # The names are a list of their own and the table is typed by them: left to work the type out from text this long, the compiler gives up.
    lines = [
        "// Made by art/blender/pack.py from the models art/blender/build_all.py builds in Blender. Do not edit: build the art again.",
        "export const modelNames = [",
        *[f'  "{name}",' for name, _ in models],
        "] as const;",
        "",
        "export type ModelName = (typeof modelNames)[number];",
        "",
        "export const packed: Readonly<Record<ModelName, string>> = {",
        *[entry(name, text) for name, text in models],
        "};",
        "",
    ]
    os.makedirs(os.path.dirname(target), exist_ok=True)
    with open(target, "w") as file:
        file.write("\n".join(lines))
    print("wrote", target, os.path.getsize(target), "bytes")


if __name__ == "__main__":
    main(*sys.argv[1:3])
