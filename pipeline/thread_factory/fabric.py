"""Fabric surface detail: small tileable normal maps (jersey knit, twill weave) repeated at real-world scale.

The cloth simulation gives the drape; these maps give the light response of the yarn structure, which is
what stops close-up cloth from reading as smooth plastic. 256 px each, shared by every garment of a kind.
"""
from __future__ import annotations

import io
from functools import lru_cache

import numpy as np

# Weave kind per wardrobe category and the real size of one texture tile (metres).
KIND = {'top': 'jersey', 'onepiece': 'jersey', 'bottom': 'twill', 'outerwear': 'twill'}
TILE_METRES = {'jersey': 0.024, 'twill': 0.03}
STRENGTH = {'jersey': 0.55, 'twill': 0.6}


def _height(kind: str, size: int) -> np.ndarray:
    u, v = np.meshgrid(np.arange(size) / size, np.arange(size) / size)
    if kind == 'jersey':
        # Wales of interlocking V-shaped loops: 8 columns x 10 courses per tile (about 3 mm x 2.4 mm loops).
        fx, fy = (u * 8) % 1, (v * 10) % 1
        leg = np.abs(fx - 0.5) - 0.22 * (fy - 0.5)  # two legs leaning into a V
        h = np.exp(-((np.abs(leg) - 0.22) / 0.11) ** 2)
        h *= 0.75 + 0.25 * np.cos(2 * np.pi * fy)
    else:
        # 2/1 twill: diagonal ribs at 45 degrees, 14 per tile (about 2 mm), with faint warp/weft structure.
        diagonal = (u + v) * 14
        h = 0.5 + 0.5 * np.cos(2 * np.pi * diagonal)
        h = h ** 1.5 + 0.12 * np.cos(2 * np.pi * u * 42) * np.cos(2 * np.pi * v * 42)
    # Slubs: yarn thickness varies smoothly. Integer frequencies keep the tile seamless.
    rng = np.random.default_rng(3)
    for _ in range(12):
        fu, fv = rng.integers(1, 9, size=2)
        h = h + 0.025 * np.cos(2 * np.pi * (fu * u + fv * v) + rng.uniform(0, 2 * np.pi))
    return h


@lru_cache(maxsize=None)
def normal_map(kind: str, size: int = 256) -> bytes:
    """Tangent-space normal map (PNG, OpenGL/glTF convention: +Y up)."""
    from PIL import Image
    h = _height(kind, size)
    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * 0.5 * size / 64  # periodic differences: seamless tile
    dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * 0.5 * size / 64
    n = np.dstack([-dx, dy, np.ones_like(h)])  # image rows grow downwards, glTF +Y is up
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    buffer = io.BytesIO()
    Image.fromarray(((n * 0.5 + 0.5) * 255).round().astype(np.uint8)).save(buffer, 'PNG', optimize=True)
    return buffer.getvalue()


def uv_metres(positions: np.ndarray, faces: np.ndarray, uv: np.ndarray, face_uv: np.ndarray) -> float:
    """Metres of cloth per unit of UV (median over triangles), so a tile repeats at its real size."""
    p, t = positions[faces], uv[face_uv]
    edge3 = np.linalg.norm(p[:, 1] - p[:, 0], axis=1) + np.linalg.norm(p[:, 2] - p[:, 1], axis=1)
    edge2 = np.linalg.norm(t[:, 1] - t[:, 0], axis=1) + np.linalg.norm(t[:, 2] - t[:, 1], axis=1)
    ok = edge2 > 1e-9
    return float(np.median(edge3[ok] / edge2[ok]))


def surface(category: str, positions, faces, uv, face_uv) -> dict | None:
    """Material fields for a garment: normal map bytes, tile repeat and strength."""
    kind = KIND.get(category)
    if not kind:
        return None
    repeat = uv_metres(positions, faces, uv, face_uv) / TILE_METRES[kind]
    return {'normal': normal_map(kind), 'normal_repeat': round(repeat, 3), 'normal_scale': STRENGTH[kind]}
