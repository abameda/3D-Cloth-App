"""Skin texture: CC0 MakeHuman skin photography, tone-matched to the person.

The MakeHuman UV layout gives the head a small island, so the atlas is re-packed: the head island fills the
right half of the texture and every other island the left half. Both maps are uniform scale + offset, so the
source photography is resampled without seams. A selfie, when given, is projected onto the face afterwards
(face.project_face).
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

from .accessories import ASSETS

SKINS = ASSETS / 'skins'
PAD = 0.01


def _srgb_to_linear(c):
    c = np.asarray(c, np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _linear_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def head_island(positions: np.ndarray, faces: np.ndarray, face_uv: np.ndarray, uv_count: int) -> np.ndarray:
    """Per-face mask of the UV island that holds the nose tip (the whole head/face island)."""
    import scipy.sparse as sp
    from scipy.sparse.csgraph import connected_components
    rows = np.repeat(np.arange(len(faces)), 3)  # triangles sharing a UV corner belong to the same island
    incidence = sp.coo_matrix((np.ones(len(rows)), (rows, face_uv.reshape(-1))), shape=(len(faces), uv_count)).tocsr()
    _, island = connected_components(incidence @ incidence.T, directed=False)
    nose = np.argmax(positions[:, 2] - 10 * (positions[:, 1] < positions[:, 1].max() - 0.25))  # most forward head point
    return island == island[np.nonzero((faces == nose).any(axis=1))[0][0]]


def repack(positions, faces, uv, face_uv):
    """Head-priority layout. Returns (new uv table, face_uv, [(lo, scale, origin) for body, head])."""
    head = head_island(positions, faces, face_uv, len(uv))
    in_head = np.zeros(len(uv), bool); in_head[face_uv[head].reshape(-1)] = True  # a UV index lives in one island
    used = np.zeros(len(uv), bool); used[face_uv.reshape(-1)] = True
    table, maps = uv.astype(np.float64).copy(), []
    for k, members in enumerate((used & ~in_head, in_head)):
        lo, hi = uv[members].min(0), uv[members].max(0)
        scale = min((0.5 - 2 * PAD) / (hi - lo)[0], (1 - 2 * PAD) / (hi - lo)[1])
        origin = np.array([0.5 * k + PAD, PAD])
        table[members] = origin + (uv[members] - lo) * scale
        maps.append((lo, scale, origin))
    return table, face_uv, maps


def _resample(source: np.ndarray, maps, size: int) -> np.ndarray:
    """Each half of the atlas is the source photography under one uv map (scale + offset; image y is flipped)."""
    import cv2
    src_size = source.shape[0]
    out = np.zeros((size, size, 3), np.uint8)
    for k, (lo, scale, origin) in enumerate(maps):
        a = scale * size / src_size
        bx = size * (origin[0] - lo[0] * scale)
        by = size * (1 - origin[1] + lo[1] * scale - scale)
        warped = cv2.warpAffine(source, np.array([[a, 0, bx], [0, a, by]], np.float32), (size, size),
                                flags=cv2.INTER_AREA if a < 1 else cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        half = slice(k * size // 2, (k + 1) * size // 2)
        out[:, half] = warped[:, half]
    return out


def _texture_median(path: Path, positions, faces, uv, face_uv) -> np.ndarray:
    """Median sRGB skin colour of a MakeHuman texture over the torso (chest to hips, front and back)."""
    from PIL import Image
    with Image.open(path) as image:
        rgb = np.asarray(image.convert('RGB'))
    torso = (positions[faces].mean(1)[:, 1] - positions[:, 1].min()) / np.ptp(positions[:, 1])
    pick = (torso > 0.5) & (torso < 0.7) & (np.abs(positions[faces].mean(1)[:, 0]) < 0.08)
    centres = uv[face_uv[pick]].mean(1)
    px = np.clip((centres[:, 0] * rgb.shape[1]).astype(int), 0, rgb.shape[1] - 1)
    py = np.clip(((1 - centres[:, 1]) * rgb.shape[0]).astype(int), 0, rgb.shape[0] - 1)
    return np.median(rgb[py, px], axis=0) / 255


def choose(sex: str | None, age: float, tone, positions, faces, uv, face_uv) -> Path:
    """The MakeHuman skin of the right sex and age group whose colour is nearest the person's tone."""
    group = 'young' if age < 38 else 'middleage' if age < 60 else 'old'
    sexes = [sex] if sex in ('male', 'female') else ['female', 'male']
    candidates = []
    for folder in sorted(SKINS.iterdir()):
        parts = folder.name.split('_')
        if len(parts) != 3 or parts[0] != group or parts[2] not in sexes:
            continue
        mhmat = (folder / f'{folder.name}.mhmat').read_text(errors='ignore')
        texture = next(line.split()[1] for line in mhmat.splitlines() if line.startswith('diffuseTexture'))
        candidates.append(folder / texture)
    target = _srgb_to_linear(tone)
    return min(candidates, key=lambda p: float(np.linalg.norm(_srgb_to_linear(_texture_median(p, positions, faces, uv, face_uv)) - target)))


def bake(positions, faces, uv, face_uv, *, sex: str | None, age: float, tone, size: int = 2048):
    """(atlas RGB uint8, new uv, face_uv, texture name): tone-matched MakeHuman skin in the head-priority layout."""
    from PIL import Image
    texture = choose(sex, age, tone, positions, faces, uv, face_uv)
    median = _texture_median(texture, positions, faces, uv, face_uv)
    with Image.open(texture) as image:
        source = np.asarray(image.convert('RGB'))
    # Per-channel gain in linear light moves the photography's median onto the person's tone.
    gain = _srgb_to_linear(tone) / np.maximum(_srgb_to_linear(median), 1e-4)
    toned = (_linear_to_srgb(_srgb_to_linear(source / 255) * gain) * 255).round().astype(np.uint8)
    table, face_uv, maps = repack(positions, faces, uv, face_uv)
    return _resample(toned, maps, size), table, face_uv, texture.stem


def recolour_iris(path: Path, rgb, max_size: int = 1024) -> bytes:
    """Eye texture with the iris recoloured to a natural tone (sRGB 0-255). MakeHuman's iris photography is
    strongly saturated (its 'brown' reads orange-red on screen); luminance detail is kept, hue comes from rgb."""
    import io
    from PIL import Image
    with Image.open(path) as image:
        image = image.convert('RGBA'); image.thumbnail((max_size, max_size))
        rgba = np.asarray(image).astype(np.float32) / 255
    colour = rgba[..., :3]
    saturation = (colour.max(-1) - colour.min(-1)) / np.maximum(colour.max(-1), 1e-4)
    iris = np.clip((saturation - 0.25) / 0.2, 0, 1)[..., None]  # sclera and pupil are nearly grey
    luminance = colour @ np.array([0.2126, 0.7152, 0.0722])
    reference = np.median(luminance[iris[..., 0] > 0.9]) if (iris > 0.9).any() else 0.3
    target = np.asarray(rgb, np.float32) / 255
    # Softer contrast and a darker base: photographed irises read darker than their nominal colour.
    recoloured = np.clip(0.75 * target * ((luminance / max(reference, 1e-3)) ** 0.7)[..., None], 0, 1)
    rgba[..., :3] = colour * (1 - iris) + recoloured * iris
    buffer = io.BytesIO()
    Image.fromarray((rgba * 255).round().astype(np.uint8), 'RGBA').save(buffer, 'PNG', optimize=True)
    return buffer.getvalue()


def paint_scalp(atlas: np.ndarray, positions, faces, uv, face_uv, hair_positions, hair_faces, rgb, brow_y: float) -> np.ndarray:
    """Scalp skin under the hair takes the hair colour (feathered), as real hair grows from it: no bald
    gaps between hair cards and no hard 'helmet' line at the hairline. Only the head above the brows and
    the nape are painted, never shoulders under long hair."""
    import cv2
    import trimesh
    from .garment_glb import covered_triangles
    hair = trimesh.Trimesh(hair_positions, hair_faces, process=False)
    covered = covered_triangles(trimesh.Trimesh(positions, faces, process=False), hair, reach=0.04)
    centres = positions[faces].mean(1)
    head_z = positions[positions[:, 1] > brow_y, 2].mean()
    region = (centres[:, 1] > brow_y + 0.02) | ((centres[:, 2] < head_z - 0.02) & (centres[:, 1] > brow_y - 0.08))
    size = atlas.shape[0]
    weight = np.zeros(atlas.shape[:2], np.float32)
    for f in np.nonzero(covered & region)[0]:
        corners = np.stack([uv[face_uv[f], 0] * size, (1 - uv[face_uv[f], 1]) * size], axis=1)
        cv2.fillConvexPoly(weight, np.round(corners).astype(np.int32), 1.0)
    weight = cv2.GaussianBlur(weight, (0, 0), size / 400)[..., None] * 0.9
    shade = np.asarray(rgb, np.float32) * 255 * 0.85
    return np.clip(atlas * (1 - weight) + shade * weight, 0, 255).astype(np.uint8)
