"""Base layer: neutral underwear shown whenever an outfit leaves a slot empty.

Underwear is skin-tight, so it is cut straight from the personal body surface instead of simulated: a smooth
scalar field over the skin decides what each piece covers, triangles are split exactly along the field's zero
level (clean, straight-looking edges at any mesh density), and the piece sits a few millimetres off the skin.
It reuses the body's own skin weights, so it follows every pose without clipping, and it hides exactly the
skin triangles it fully covers.

  base_bottom.glb   briefs (female) or trunks (male)
  base_top.glb      bralette (female only)

Usage: python -m thread_factory.base_layer --body <body dir> --sex female
"""
from __future__ import annotations

import argparse
import base64
import io
import json
from pathlib import Path

import numpy as np
import trimesh

from .gltf import Material, Part, write_skinned_glb
from .measure import torso_levels

ARM_BONES = ('upperarm', 'lowerarm', 'wrist', 'hand', 'finger', 'thumb', 'index', 'middle', 'ring', 'pinky', 'metacarpal')
FABRIC = (0.17, 0.17, 0.19)  # sRGB charcoal jersey


def cut(f: np.ndarray, faces: np.ndarray):
    """Split a triangle mesh along f = 0 and keep f >= 0.
    Returns (faces over [old vertices + new vertices], new-vertex parents (M, 2), weights t (M,), fully-inside mask)."""
    inside = f >= 0
    count = inside[faces].sum(1)
    full = count == 3
    edges: dict[tuple[int, int], int] = {}
    parents, ts = [], []

    def crossing(a: int, b: int) -> int:
        key = (a, b) if a < b else (b, a)
        if key not in edges:
            edges[key] = len(f) + len(parents)
            parents.append(key); ts.append(f[key[0]] / (f[key[0]] - f[key[1]]))
        return edges[key]

    out = [faces[full]]
    for tri, n in zip(faces[(count == 1) | (count == 2)], count[(count == 1) | (count == 2)]):
        flags = inside[tri]
        odd = int(np.nonzero(flags if n == 1 else ~flags)[0][0])  # the vertex alone on its side
        a, b, c = tri[odd], tri[(odd + 1) % 3], tri[(odd + 2) % 3]  # rotation keeps the winding
        ab, ac = crossing(a, b), crossing(a, c)
        out.append(np.array([[a, ab, ac]]) if n == 1 else np.array([[ab, b, c], [ab, c, ac]]))
    return np.concatenate(out), np.array(parents, int).reshape(-1, 2), np.array(ts), full


def subdivide(attributes: np.ndarray, faces: np.ndarray, selected: np.ndarray):
    """Midpoint (1 -> 4) subdivision of the selected faces. attributes: per-vertex rows (position, normal, then
    anything else), averaged on new vertices; new positions are Phong-tessellated so the surface stays curved.
    Returns (attributes, faces, parent face of each face). Unselected neighbours keep T-junctions; they lie
    outside every piece and are dropped by the cut."""
    chosen = faces[selected]
    edges = np.sort(np.concatenate([chosen[:, [0, 1]], chosen[:, [1, 2]], chosen[:, [2, 0]]]), axis=1)
    unique, inverse = np.unique(edges, axis=0, return_inverse=True)
    mid = len(attributes) + inverse.reshape(3, -1).T  # (F, 3): midpoints of edges 01, 12, 20
    ends = attributes[unique[:, 0]], attributes[unique[:, 1]]
    middle = 0.5 * (ends[0] + ends[1])
    # Phong tessellation: average the midpoint's projections onto both end vertices' tangent planes.
    project = lambda end: middle[:, :3] - (np.einsum('ij,ij->i', middle[:, :3] - end[:, :3], end[:, 3:6]) /
                                           np.maximum(np.einsum('ij,ij->i', end[:, 3:6], end[:, 3:6]), 1e-12))[:, None] * end[:, 3:6]
    middle[:, :3] = 0.25 * middle[:, :3] + 0.375 * (project(ends[0]) + project(ends[1]))  # shape factor 3/4
    attributes = np.concatenate([attributes, middle])
    a, b, c = chosen.T
    m01, m12, m20 = mid.T
    children = np.concatenate([np.stack(t, 1) for t in ((a, m01, m20), (m01, b, m12), (m20, m12, c), (m01, m12, m20))])
    parent = np.concatenate([np.nonzero(~selected)[0], np.tile(np.nonzero(selected)[0], 4)])
    return attributes, np.concatenate([faces[~selected], children]), parent


def fields(v: np.ndarray, levels: dict, arm: np.ndarray, sex: str) -> dict[str, np.ndarray]:
    """Signed coverage fields in metres (positive = covered), one per piece."""
    h = levels['height'] / 1.75
    cx, cz = levels['centre']
    x, y, z = v[:, 0] - cx, v[:, 1], v[:, 2] - cz
    hips, waist, crotch, bust = levels['hips'], levels['waist'], levels['crotch'], levels['bust']
    out = {}
    if sex == 'female':
        top = hips + 0.42 * (waist - hips)
        leg = crotch - 0.012 * h + 0.85 * np.maximum(0, np.abs(x) - 0.045 * h)  # high-cut leg line rising to the hip
    else:
        top = hips + 0.55 * (waist - hips)
        leg = np.full_like(y, crotch - 0.07 * h)  # short trunks
    out['base_bottom'] = np.minimum(top - y, y - leg)
    if sex == 'female':
        under = bust - 0.085 * h
        bottom = under - 0.028 * h
        front = np.clip(z / 0.09 + 0.5, 0, 1)  # 0 at the back, 1 at the front, blended across the sides
        neckline = bust + 0.05 * h - 0.05 * h * np.exp(-(x / (0.035 * h)) ** 2)
        upper = (under + 0.03 * h) * (1 - front) + neckline * front
        body = np.minimum(upper - y, y - bottom)
        strap = np.minimum(0.0085 - np.abs(np.abs(x) - 0.082 * h), levels['armpit'] + 0.22 * h - y)
        out['base_top'] = np.maximum(body, np.minimum(strap, y - bottom))
    for f in out.values():
        f[arm] = -1.0  # arms hang beside the hips in the bind pose
    return out


def stripe_texture(size: int = 256, band: float = 0.12, colour=FABRIC) -> bytes:
    """Fine jersey rib (u repeats around the body) with a slightly darker elastic band at v < band."""
    from PIL import Image
    u = np.linspace(0, 1, size, endpoint=False)
    rib = 1 + 0.05 * np.sin(2 * np.pi * 24 * u)[None, :]
    v = np.linspace(0, 1, size, endpoint=False)[:, None]
    shade = np.where(v < band, 0.78 + 0.08 * np.sin(2 * np.pi * 40 * u)[None, :], rib)
    noise = 1 + 0.025 * np.random.default_rng(7).standard_normal((size, size))
    rgb = np.clip(np.asarray(colour)[None, None, :] * (shade * noise)[..., None], 0, 1)
    buffer = io.BytesIO()
    Image.fromarray((rgb * 255).astype(np.uint8)).save(buffer, 'PNG', optimize=True)
    return buffer.getvalue()


def build(body_dir: Path, sex: str, colour=FABRIC) -> dict:
    rig = np.load(body_dir / 'skeleton.npz')
    positions, faces = rig['positions'], rig['faces']
    bone_names = [str(b) for b in rig['bone_names']]
    skin = trimesh.Trimesh(positions, faces, process=False)
    normals = skin.vertex_normals
    dominant = rig['vertex_joints'][np.arange(len(positions)), rig['vertex_weights'].argmax(1)]
    arm = np.array([any(k in bone_names[int(b)] for k in ARM_BONES) for b in dominant])
    levels = torso_levels(trimesh.Trimesh(positions, faces, process=False))
    dense = np.zeros((len(positions), len(bone_names)))
    np.add.at(dense, (np.repeat(np.arange(len(positions)), rig['vertex_joints'].shape[1]), rig['vertex_joints'].reshape(-1)),
              rig['vertex_weights'].reshape(-1))
    report = {}
    for name in fields(positions, levels, arm, sex):
        # Refine the skin around the piece (straps: 16x, briefs: 4x) so narrow parts span many triangles.
        attrs, tris, parent = np.hstack([positions, normals, dense, arm[:, None]]), faces, np.arange(len(faces))
        for _ in range(2 if name == 'base_top' else 1):
            f = fields(attrs[:, :3], levels, attrs[:, -1] > 0.5, sex)[name]
            attrs, tris, step = subdivide(attrs, tris, (f[tris] > -0.02).any(axis=1))
            parent = parent[step]
        f = fields(attrs[:, :3], levels, attrs[:, -1] > 0.5, sex)[name]
        tri, parents, t, inside = cut(f, tris)
        full = np.ones(len(faces), bool); np.logical_and.at(full, parent, inside)  # every child fully covered
        lift = 0.0025 if name == 'base_bottom' else 0.003
        n = attrs[:, 3:6] / np.maximum(np.linalg.norm(attrs[:, 3:6], axis=1, keepdims=True), 1e-9)
        mix = lambda a: np.concatenate([a, a[parents[:, 0]] * (1 - t[:, None]) + a[parents[:, 1]] * t[:, None]])
        p_all, w_all = mix(attrs[:, :3] + n * lift), mix(attrs[:, 6:-1])
        used = np.unique(tri)
        remap = np.full(len(p_all), -1); remap[used] = np.arange(len(used))
        p, w, tri = p_all[used], w_all[used], remap[tri]
        joints = np.argsort(-w, axis=1)[:, :8]
        # u: around the body (rib repeats every ~4 cm); v: distance from the elastic edge (waistband / underband).
        edge = levels['hips'] + (0.42 if sex == 'female' else 0.55) * (levels['waist'] - levels['hips'])
        if name == 'base_top':
            edge = levels['bust'] - 0.085 * levels['height'] / 1.75 - 0.028 * levels['height'] / 1.75
        ribs = 40
        uv = np.stack([np.arctan2(p[:, 0] - levels['centre'][0], p[:, 2] - levels['centre'][1]) / (2 * np.pi) * ribs,
                       1 - np.clip(np.abs(p[:, 1] - edge) / 0.2, 0, 0.999)], axis=1)  # writer flips v (OBJ convention)
        corners = uv[tri]  # per-corner UVs: triangles across the angle wrap at the back get a continuous u
        wraps = np.ptp(corners[:, :, 0], axis=1) > ribs / 2
        corners[wraps, :, 0] += np.where(corners[wraps, :, 0] < 0, ribs, 0)
        uv, face_uv = corners.reshape(-1, 2), np.arange(3 * len(tri)).reshape(-1, 3)
        bits = base64.b64encode(np.packbits(full.astype(np.uint8))).decode()
        write_skinned_glb(body_dir / f'{name}.glb', parts=[Part(
            positions=p, faces=tri, uv=uv, face_uv=face_uv, joint_indices=joints, joint_weights=np.take_along_axis(w, joints, 1),
            material=Material(name=f'fabric_{name}', roughness=0.9, double_sided=True, texture=stripe_texture(colour=colour)))],
            bone_names=bone_names, bone_parents=[int(b) for b in rig['bone_parents']], bone_world=rig['bone_world'], name=name,
            extras={'thread': {'category': name, 'bodyTriangles': int(len(faces)), 'coversBodyTriangles': bits}})
        report[name] = {'triangles': int(len(tri)), 'covers': int(full.sum())}
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--body', type=Path, required=True)
    parser.add_argument('--sex', choices=['male', 'female'], required=True)
    args = parser.parse_args()
    print(json.dumps(build(args.body, args.sex), indent=2))


if __name__ == '__main__':
    main()
