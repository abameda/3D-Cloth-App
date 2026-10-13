"""Minimal, dependency-light GLB writer for skinned meshes with sparse morph targets."""
from __future__ import annotations

import json
import struct
from pathlib import Path

import numpy as np
from scipy.spatial.transform import Rotation

FLOAT, UBYTE, USHORT, UINT = 5126, 5121, 5123, 5125
ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER = 34962, 34963


class _Builder:
    def __init__(self):
        self.blob = bytearray()
        self.views, self.accessors = [], []

    def view(self, data: bytes, target: int | None = None) -> int:
        while len(self.blob) % 4:
            self.blob.append(0)
        self.views.append({'buffer': 0, 'byteOffset': len(self.blob), 'byteLength': len(data),
                           **({'target': target} if target else {})})
        self.blob.extend(data)
        return len(self.views) - 1

    def accessor(self, array: np.ndarray, kind: str, component: int, target: int | None = None,
                 minmax: bool = False, normalized: bool = False) -> int:
        dtype = {FLOAT: np.float32, UBYTE: np.uint8, USHORT: np.uint16, UINT: np.uint32}[component]
        array = np.ascontiguousarray(array, dtype=dtype)
        acc = {'bufferView': self.view(array.tobytes(), target), 'componentType': component,
               'count': int(array.shape[0]), 'type': kind}
        if normalized:
            acc['normalized'] = True
        if minmax:
            acc['min'] = array.reshape(array.shape[0], -1).min(0).tolist()
            acc['max'] = array.reshape(array.shape[0], -1).max(0).tolist()
        self.accessors.append(acc)
        return len(self.accessors) - 1

    def sparse_vec3(self, count: int, indices: np.ndarray, values: np.ndarray) -> int:
        values = np.ascontiguousarray(values, dtype=np.float32)
        # Bounds cover the implicit zeros of every element not listed in the sparse set.
        lo = np.minimum(values.min(0), 0) if len(values) else np.zeros(3)
        hi = np.maximum(values.max(0), 0) if len(values) else np.zeros(3)
        acc = {'componentType': FLOAT, 'count': count, 'type': 'VEC3',
               'min': lo.astype(float).tolist(), 'max': hi.astype(float).tolist()}
        if len(indices):
            acc['sparse'] = {'count': int(len(indices)),
                             'indices': {'bufferView': self.view(np.asarray(indices, np.uint32).tobytes()), 'componentType': UINT},
                             'values': {'bufferView': self.view(values.tobytes())}}
        self.accessors.append(acc)
        return len(self.accessors) - 1


def _split_by_uv(faces: np.ndarray, face_uv: np.ndarray):
    """glTF needs one UV per vertex: duplicate vertices along UV seams."""
    pairs = np.stack([faces.reshape(-1), face_uv.reshape(-1)], axis=1)
    unique, inverse = np.unique(pairs, axis=0, return_inverse=True)
    return unique[:, 0], unique[:, 1], inverse.reshape(faces.shape)


def _top4(indices: np.ndarray, weights: np.ndarray):
    order = np.argsort(-weights, axis=1)[:, :4]
    j = np.take_along_axis(indices, order, 1)
    w = np.take_along_axis(weights, order, 1).astype(np.float64)
    w /= np.maximum(w.sum(1, keepdims=True), 1e-9)
    j[w == 0] = 0
    return j, w


def _linear(srgb) -> list[float]:
    """glTF colour factors are linear; profile colours are sRGB."""
    c = np.asarray(srgb, np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4).round(5).tolist()


def _normals(positions: np.ndarray, faces: np.ndarray) -> np.ndarray:
    n = np.zeros_like(positions)
    tri = positions[faces]
    fn = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    for k in range(3):
        np.add.at(n, faces[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


def portable_name(bone: str) -> str:
    """Engines sanitise node names differently (three.js drops '.'); use only [A-Za-z0-9_-]."""
    return bone.replace('.', '_')


def write_skinned_glb(path: Path, *, positions, faces, uv, face_uv, joint_indices, joint_weights,
                      bone_names, bone_parents, bone_world, morphs: dict | None = None,
                      skin_rgb=(0.78, 0.57, 0.44), name='ThreadAvatar', material_name='skin',
                      texture: bytes | None = None, texture_mime='image/png', double_sided=False,
                      roughness=0.55, extras: dict | None = None) -> None:
    """bone_world: (B, 4, 4) rigid bind-pose transforms in the same space as positions."""
    src, uv_src, tri = _split_by_uv(np.asarray(faces), np.asarray(face_uv))
    normals = _normals(np.asarray(positions, np.float64), np.asarray(faces))[src]
    pos = np.asarray(positions)[src]
    tex = np.asarray(uv)[uv_src].astype(np.float64)
    tex[:, 1] = 1.0 - tex[:, 1]  # MakeHuman UVs are bottom-left origin; glTF is top-left
    joints, weights = _top4(np.asarray(joint_indices)[src], np.asarray(joint_weights)[src])

    b = _Builder()
    attributes = {
        'POSITION': b.accessor(pos, 'VEC3', FLOAT, ARRAY_BUFFER, minmax=True),
        'NORMAL': b.accessor(normals, 'VEC3', FLOAT, ARRAY_BUFFER),
        'TEXCOORD_0': b.accessor(tex, 'VEC2', FLOAT, ARRAY_BUFFER),
        'JOINTS_0': b.accessor(joints, 'VEC4', USHORT, ARRAY_BUFFER),
        'WEIGHTS_0': b.accessor(weights, 'VEC4', FLOAT, ARRAY_BUFFER),
    }
    primitive = {'attributes': attributes, 'indices': b.accessor(tri.reshape(-1), 'SCALAR', UINT, ELEMENT_ARRAY_BUFFER),
                 'material': 0}
    mesh = {'name': name, 'primitives': [primitive]}
    if morphs:
        targets, names = [], []
        for morph_name, delta in morphs.items():
            d = np.asarray(delta)[src]
            moving = np.nonzero(np.linalg.norm(d, axis=1) > 1e-6)[0]
            targets.append({'POSITION': b.sparse_vec3(len(pos), moving, d[moving])})
            names.append(morph_name)
        primitive['targets'] = targets
        mesh['weights'] = [0.0] * len(targets)
        mesh['extras'] = {'targetNames': names}

    world = np.asarray(bone_world, np.float64)
    nodes, roots = [], []
    for i, (bone, parent) in enumerate(zip(bone_names, bone_parents)):
        local = world[i] if parent < 0 else np.linalg.inv(world[parent]) @ world[i]
        rotation = Rotation.from_matrix(local[:3, :3]).as_quat()  # x, y, z, w as glTF expects
        nodes.append({'name': portable_name(bone), 'translation': local[:3, 3].tolist(), 'rotation': rotation.tolist()})
        if parent < 0:
            roots.append(i)
        else:
            nodes[parent].setdefault('children', []).append(i)
    inverse_bind = np.linalg.inv(world).transpose(0, 2, 1).reshape(-1, 16)  # column-major per glTF
    skin = {'joints': list(range(len(bone_names))), 'inverseBindMatrices': b.accessor(inverse_bind, 'MAT4', FLOAT),
            'skeleton': roots[0]}
    mesh_node = len(nodes)
    nodes.append({'name': name, 'mesh': 0, 'skin': 0, **({'extras': extras} if extras else {})})
    material = {'name': material_name, 'doubleSided': double_sided, 'pbrMetallicRoughness': {
        'baseColorFactor': [*_linear(skin_rgb), 1.0], 'metallicFactor': 0.0, 'roughnessFactor': roughness}}
    images = textures = None
    if texture is not None:
        images = [{'bufferView': b.view(texture), 'mimeType': texture_mime}]
        textures = [{'source': 0}]
        material['pbrMetallicRoughness']['baseColorTexture'] = {'index': 0}
        material['pbrMetallicRoughness']['baseColorFactor'] = [1.0, 1.0, 1.0, 1.0]
    gltf = {
        'asset': {'version': '2.0', 'generator': 'Thread asset factory'},
        'scene': 0, 'scenes': [{'nodes': roots + [mesh_node]}], 'nodes': nodes,
        'meshes': [mesh], 'skins': [skin],
        'materials': [material],
        'accessors': b.accessors, 'bufferViews': b.views, 'buffers': [{'byteLength': len(b.blob)}],
    }
    if images:
        gltf['images'], gltf['textures'] = images, textures
    while len(b.blob) % 4:
        b.blob.append(0)
    header = json.dumps(gltf, separators=(',', ':')).encode()
    header += b' ' * (-len(header) % 4)
    gltf['buffers'][0]['byteLength'] = len(b.blob)
    header = json.dumps(gltf, separators=(',', ':')).encode()
    header += b' ' * (-len(header) % 4)
    body = struct.pack('<I4s', len(header), b'JSON') + header + struct.pack('<I4s', len(b.blob), b'BIN\x00') + bytes(b.blob)
    Path(path).write_bytes(struct.pack('<4sII', b'glTF', 2, 12 + len(body)) + body)
