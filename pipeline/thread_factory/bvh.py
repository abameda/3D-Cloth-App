"""Nearest-surface and ray queries for rigging, on Warp's BVH (Apache-2.0, already used by Anny).

Runs on the CPU on purpose: measured on a 1 cm tee against the 27k-triangle body, both rigging queries take
0.03 s here versus 1.6 s in trimesh, so there is nothing left for a GPU to win (and the CPU path keeps
working when the GPU is unavailable).
"""
from __future__ import annotations

import numpy as np
import warp as wp

wp.config.quiet = True
DEVICE = 'cpu'


@wp.kernel
def _closest(mesh: wp.uint64, points: wp.array(dtype=wp.vec3), face: wp.array(dtype=int), uv: wp.array(dtype=wp.vec2)):
    i = wp.tid()
    q = wp.mesh_query_point_no_sign(mesh, points[i], 1.0e6)
    if q.result:
        face[i] = q.face
        uv[i] = wp.vec2(q.u, q.v)
    else:
        face[i] = -1


@wp.kernel
def _ray(mesh: wp.uint64, origins: wp.array(dtype=wp.vec3), directions: wp.array(dtype=wp.vec3),
         face: wp.array(dtype=int), distance: wp.array(dtype=float)):
    i = wp.tid()
    q = wp.mesh_query_ray(mesh, origins[i], directions[i], 1.0e6)
    if q.result:
        face[i] = q.face
        distance[i] = q.t
    else:
        face[i] = -1


def _mesh(vertices: np.ndarray, faces: np.ndarray) -> wp.Mesh:
    return wp.Mesh(points=wp.array(np.asarray(vertices, np.float32), dtype=wp.vec3, device=DEVICE),
                   indices=wp.array(np.asarray(faces, np.int32).reshape(-1), dtype=int, device=DEVICE))


def closest_points(vertices: np.ndarray, faces: np.ndarray, points: np.ndarray):
    """For each point: (closest surface point, distance, triangle index, barycentric weights (n, 3))."""
    wp.init()
    mesh = _mesh(vertices, faces)
    face = wp.zeros(len(points), dtype=int, device=DEVICE)
    uv = wp.zeros(len(points), dtype=wp.vec2, device=DEVICE)
    wp.launch(_closest, len(points), inputs=[mesh.id, wp.array(np.asarray(points, np.float32), dtype=wp.vec3, device=DEVICE), face, uv], device=DEVICE)
    triangle, uv = face.numpy(), uv.numpy().astype(np.float64)
    bary = np.column_stack([uv[:, 0], uv[:, 1], 1 - uv[:, 0] - uv[:, 1]])  # Warp: p = u*p0 + v*p1 + (1-u-v)*p2
    closest = np.einsum('nk,nkd->nd', bary, np.asarray(vertices, np.float64)[faces[triangle]])
    return closest, np.linalg.norm(closest - points, axis=1), triangle, bary


def first_hits(vertices: np.ndarray, faces: np.ndarray, origins: np.ndarray, directions: np.ndarray):
    """For each ray: (hit triangle or -1, distance along the ray)."""
    wp.init()
    mesh = _mesh(vertices, faces)
    face = wp.zeros(len(origins), dtype=int, device=DEVICE)
    distance = wp.zeros(len(origins), dtype=float, device=DEVICE)
    unit = directions / np.maximum(np.linalg.norm(directions, axis=1, keepdims=True), 1e-12)
    wp.launch(_ray, len(origins), inputs=[mesh.id, wp.array(np.asarray(origins, np.float32), dtype=wp.vec3, device=DEVICE),
                                          wp.array(unit.astype(np.float32), dtype=wp.vec3, device=DEVICE), face, distance], device=DEVICE)
    return face.numpy(), distance.numpy().astype(np.float64)
