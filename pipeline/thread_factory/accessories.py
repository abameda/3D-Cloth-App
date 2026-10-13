"""MakeHuman proxy assets (CC0 system assets: eyes, eyebrows, eyelashes, hair, shoes) fitted to a body.

A .mhclo proxy places each of its vertices at a weighted blend of three base-mesh vertices plus an offset
scaled by the current body's proportions. The same blend carries the body's skin weights and facial
expression deltas, so eyelashes blink and eyebrows follow brow expressions.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

ASSETS = Path(__file__).resolve().parents[1] / 'tools' / 'mh-assets' / 'pack'


@dataclass
class Proxy:
    name: str
    folder: Path
    obj_file: str
    scales: dict  # axis -> (vertex a, vertex b, reference length)
    refs: np.ndarray       # (n, 3) base-mesh vertex indices
    weights: np.ndarray    # (n, 3)
    offsets: np.ndarray    # (n, 3) MakeHuman axes: x right, y up, z front
    material: str | None
    delete_verts: np.ndarray = field(default_factory=lambda: np.zeros(0, int))


def read_mhclo(path: Path) -> Proxy:
    scales, refs, weights, offsets, deleted = {}, [], [], [], []
    obj_file = material = None
    mode = None
    for raw in path.read_text(encoding='utf-8', errors='replace').splitlines():
        line = raw.split('#', 1)[0].strip()
        if not line:
            continue
        parts = line.split()
        if parts[0] in ('x_scale', 'y_scale', 'z_scale'):
            scales[parts[0][0]] = (int(parts[1]), int(parts[2]), float(parts[3]))
        elif parts[0] == 'obj_file':
            obj_file = parts[1]
        elif parts[0] == 'material':
            material = parts[1]
        elif parts[0] == 'verts':
            mode = 'verts'
        elif parts[0] == 'delete_verts':
            mode = 'delete'
        elif mode == 'verts' and parts[0].lstrip('-').isdigit():
            if len(parts) == 1:  # rigidly attached to one vertex
                refs.append([int(parts[0])] * 3); weights.append([1, 0, 0]); offsets.append([0, 0, 0])
            else:
                refs.append([int(p) for p in parts[:3]])
                weights.append([float(p) for p in parts[3:6]])
                offsets.append([float(p) for p in parts[6:9]])
        elif mode == 'delete':
            tokens = line.replace('-', ' - ').split()
            i = 0
            while i < len(tokens):
                if i + 2 < len(tokens) and tokens[i + 1] == '-':
                    deleted.extend(range(int(tokens[i]), int(tokens[i + 2]) + 1)); i += 3
                else:
                    deleted.append(int(tokens[i])); i += 1
        else:
            mode = None  # any other keyword ends a numeric section
    return Proxy(path.stem, path.parent, obj_file, scales, np.array(refs), np.array(weights), np.array(offsets),
                 material, np.array(sorted(set(deleted)), int))


def read_obj(path: Path):
    v, vt, faces, face_uv = [], [], [], []
    for line in path.read_text(encoding='utf-8', errors='replace').splitlines():
        if line.startswith('v '):
            v.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('vt '):
            vt.append([float(x) for x in line.split()[1:3]])
        elif line.startswith('f '):
            corners = [c.split('/') for c in line.split()[1:]]
            for k in range(1, len(corners) - 1):
                tri = (corners[0], corners[k], corners[k + 1])
                faces.append([int(c[0]) - 1 for c in tri])
                face_uv.append([int(c[1]) - 1 if len(c) > 1 and c[1] else 0 for c in tri])
    return np.array(v), np.array(vt or [[0, 0]]), np.array(faces), np.array(face_uv)


def read_mhmat(path: Path) -> dict:
    values = {}
    for line in path.read_text(encoding='utf-8', errors='replace').splitlines():
        parts = line.split(None, 1)
        if len(parts) == 2 and not parts[0].startswith('#'):
            values[parts[0]] = parts[1].strip()
    return values


def fit(proxy: Proxy, base: np.ndarray) -> np.ndarray:
    """Proxy vertex positions for a body. `base` is the full MakeHuman-topology mesh in Anny space (z-up, -y front)."""
    # MakeHuman axes -> Anny axes: x -> x, y (up) -> z, z (front) -> -y.
    axis = {'x': (0, 1.0), 'y': (2, 1.0), 'z': (1, -1.0)}
    position = np.einsum('nk,nkd->nd', proxy.weights, base[proxy.refs])
    for name, (a, b, reference) in proxy.scales.items():
        index, sign = axis[name]
        scale = abs(base[a, index] - base[b, index]) / reference
        position[:, index] += sign * proxy.offsets[:, 'xyz'.index(name)] * scale
    return position


def blend(proxy: Proxy, values: np.ndarray) -> np.ndarray:
    """Per-vertex body quantities (weights, morph deltas) carried onto the proxy by its blend weights."""
    return np.einsum('nk,nk...->n...', proxy.weights, values[proxy.refs])


def load(kind: str, name: str) -> tuple[Proxy, dict]:
    folder = ASSETS / kind / name
    proxy = read_mhclo(next(folder.glob('*.mhclo')))
    material_path = (folder / proxy.material) if proxy.material else next(folder.glob('*.mhmat'), None)
    material = read_mhmat(material_path) if material_path and material_path.exists() else {}
    material['_folder'] = str(material_path.parent if material_path else folder)
    return proxy, material
