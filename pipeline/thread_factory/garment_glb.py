"""Turn a draped garment into a skinned GLB bound to the personal avatar's skeleton.

Skin weights come from the closest body surface point (barycentric blend of the body's weights),
then are smoothed across the cloth so folds move coherently. The GLB records which body triangles
the garment covers (extras.thread.coversBodyTriangles, base64 bitset) so the phone can hide skin
under opaque cloth instead of letting it poke through.

Usage: python -m thread_factory.garment_glb --sim <garment_sim.obj> --body <body dir> --out garment.glb
"""
from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path

import numpy as np
import trimesh

from .fabric import surface
from .gltf import Material, Part, texture_bytes, write_skinned_glb


def read_obj(path: Path):
    positions, uvs, faces, face_uv = [], [], [], []
    for line in path.read_text().splitlines():
        if line.startswith('v '):
            positions.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('vt '):
            uvs.append([float(x) for x in line.split()[1:3]])
        elif line.startswith('f '):
            corners = [c.split('/') for c in line.split()[1:]]
            for k in range(1, len(corners) - 1):  # fan-triangulate
                tri = [corners[0], corners[k], corners[k + 1]]
                faces.append([int(c[0]) - 1 for c in tri])
                face_uv.append([int(c[1]) - 1 if len(c) > 1 and c[1] else 0 for c in tri])
    return np.array(positions), np.array(uvs or [[0, 0]]), np.array(faces), np.array(face_uv)


def transfer_weights(garment: np.ndarray, garment_faces: np.ndarray, body: trimesh.Trimesh,
                     joints: np.ndarray, weights: np.ndarray, bone_count: int, smooth_iters: int = 12) -> np.ndarray:
    dense = np.zeros((len(body.vertices), bone_count))
    np.add.at(dense, (np.repeat(np.arange(len(joints)), joints.shape[1]), joints.reshape(-1)), weights.reshape(-1))
    closest, _, tri = trimesh.proximity.closest_point(body, garment)
    bary = trimesh.triangles.points_to_barycentric(body.triangles[tri], closest)
    corners = body.faces[tri]
    result = np.einsum('nk,nkb->nb', bary, dense[corners])
    # Laplacian smoothing on the cloth graph: neighbouring cloth moves together.
    edges = np.concatenate([garment_faces[:, [0, 1]], garment_faces[:, [1, 2]], garment_faces[:, [2, 0]]])
    edges = np.concatenate([edges, edges[:, ::-1]])
    degree = np.bincount(edges[:, 0], minlength=len(garment)).astype(float)[:, None]
    for _ in range(smooth_iters):
        summed = np.zeros_like(result)
        np.add.at(summed, edges[:, 0], result[edges[:, 1]])
        result = 0.5 * result + 0.5 * summed / np.maximum(degree, 1)
    result = np.clip(result, 0, None)
    return result / np.maximum(result.sum(1, keepdims=True), 1e-9)


def covered_triangles(body: trimesh.Trimesh, garment: trimesh.Trimesh, reach: float = 0.05) -> np.ndarray:
    """Body triangles whose three vertices sit under the garment (outward ray hits cloth within reach)."""
    origins = body.vertices + body.vertex_normals * 1e-4
    hits = garment.ray.intersects_first(origins, body.vertex_normals)
    covered = np.zeros(len(body.vertices), bool)
    found = hits >= 0
    if found.any():
        points = trimesh.triangles.closest_point(garment.triangles[hits[found]], origins[found])
        covered[np.nonzero(found)[0]] = np.linalg.norm(points - origins[found], axis=1) < reach
    return covered[body.faces].all(axis=1)


def tuck_morph(garment: np.ndarray, body: trimesh.Trimesh, category: str, gap: float = 0.0015) -> np.ndarray:
    """Displacements that pull an inner layer snug to the body (gap metres off the skin) where an outer
    layer overlaps it: a bottom's upper part under a top, a whole top under outerwear. The phone enables
    this morph only while an outer layer is worn, so no outfit combination needs re-simulation."""
    closest, distance, triangle = trimesh.proximity.closest_point(body, garment)
    target = closest + body.face_normals[triangle] * gap
    amount = np.clip((distance - gap) / 0.002, 0, 1)  # cloth already at the gap stays put
    if category in ('bottom', 'onepiece'):
        floor = body.bounds[0, 1]
        hip = floor + 0.50 * (body.bounds[1, 1] - floor)  # tops end around the hip; fade in over 8 cm below
        amount = amount * np.clip((garment[:, 1] - (hip - 0.08)) / 0.08, 0, 1)
    return (target - garment) * amount[:, None]


def build(sim_obj: Path, body_dir: Path, out: Path, *, category: str, colour=(0.85, 0.85, 0.85),
          texture: Path | None = None, front_photo: Path | None = None, back_photo: Path | None = None,
          scale: float = 0.01) -> dict:
    rig = np.load(body_dir / 'skeleton.npz')
    body = trimesh.Trimesh(rig['positions'], rig['faces'], process=False)
    positions, uvs, faces, face_uv = read_obj(sim_obj)
    positions = positions * scale  # GarmentCode simulates in centimetres
    cloth = trimesh.Trimesh(positions, faces, process=False)
    bone_names = [str(b) for b in rig['bone_names']]
    weights = transfer_weights(positions, faces, body, rig['vertex_joints'], rig['vertex_weights'], len(bone_names))
    joints = np.argsort(-weights, axis=1)[:, :8]
    covers = covered_triangles(body, cloth)
    texture_data, mime = (texture_bytes(texture), 'image/png') if texture else (None, 'image/png')
    if front_photo:  # the real garment's look, projected from its flat-lay photos
        from .photo_texture import atlas_bytes, bake
        atlas = out.with_suffix('.atlas.png')
        uvs, face_uv = bake(positions, faces, front_photo, back_photo, atlas)
        texture_data, mime = atlas_bytes(atlas), 'image/jpeg'
    bits = base64.b64encode(np.packbits(covers.astype(np.uint8))).decode()
    part = Part(positions=positions, faces=faces, uv=uvs, face_uv=face_uv,
                joint_indices=joints, joint_weights=np.take_along_axis(weights, joints, 1),
                morphs={'tuck': tuck_morph(positions, body, category)} if category in ('bottom', 'onepiece', 'top') else None,
                material=Material(name=f'fabric_{category}', rgb=colour, roughness=0.85, double_sided=True,
                                  texture=texture_data, mime=mime, **(surface(category, positions, faces, uvs, face_uv) or {})))
    write_skinned_glb(
        out, parts=[part], bone_names=bone_names, bone_parents=[int(p) for p in rig['bone_parents']],
        bone_world=rig['bone_world'], name=f'garment_{category}',
        extras={'thread': {'category': category, 'bodyTriangles': int(len(body.faces)), 'coversBodyTriangles': bits}},
    )
    return {'triangles': int(len(faces)), 'covered_body_triangles': int(covers.sum()), 'bytes': out.stat().st_size}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--sim', type=Path, required=True)
    parser.add_argument('--body', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--category', default='top')
    parser.add_argument('--texture', type=Path, default=None)
    parser.add_argument('--colour', default=None, help='sRGB hex, e.g. #2f3e5a, used when there is no texture')
    parser.add_argument('--front-photo', type=Path, default=None, help='flat-lay photo of the garment front')
    parser.add_argument('--back-photo', type=Path, default=None, help='flat-lay photo of the garment back (optional)')
    args = parser.parse_args()
    colour = tuple(int(args.colour[i:i + 2], 16) / 255 for i in (1, 3, 5)) if args.colour else (0.85, 0.85, 0.85)
    print(json.dumps(build(args.sim, args.body, args.out, category=args.category, texture=args.texture, colour=colour,
                           front_photo=args.front_photo, back_photo=args.back_photo), indent=2))


if __name__ == '__main__':
    main()
