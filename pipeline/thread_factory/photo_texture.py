"""Texture a draped garment from flat-lay photos of the real piece (front, optional back).

Each cloth face is textured from the photo of the side it faces. The draped garment's front/back
silhouette is matched to the photographed silhouette with a thin-plate-spline warp fitted on
corresponding outline points, so photo sleeves, hem and neckline land on the draped ones.
Seams fall at the garment's sides. Without a back photo the back reuses the front's fabric, mirrored.
"""
from __future__ import annotations

import io
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy.interpolate import RBFInterpolator

U2NET_HOME = Path(__file__).resolve().parents[2] / '.runtime' / 'reconstruction-models'
SIDE = 1024  # each photo occupies one 1024 x 1024 half of a 2048 x 1024 atlas


def cutout(photo: Path) -> tuple[np.ndarray, np.ndarray]:
    """RGB image and garment mask, cropped to the garment and padded square."""
    import os
    os.environ.setdefault('U2NET_HOME', str(U2NET_HOME))
    from rembg import new_session, remove
    with Image.open(photo) as image:
        rgb = image.convert('RGB')
    rgb.thumbnail((1600, 1600))
    pixels = np.array(rgb)
    alpha = np.array(remove(rgb, session=new_session('u2net'), only_mask=True))
    # Flat-lays sit on a plain surface: anything far from the border colour is garment. Saliency models
    # (U2Net) can drop large uniform or striped areas, so the two masks are combined.
    lab = cv2.cvtColor(pixels, cv2.COLOR_RGB2LAB).astype(np.float32)
    border = np.concatenate([lab[:8].reshape(-1, 3), lab[-8:].reshape(-1, 3), lab[:, :8].reshape(-1, 3), lab[:, -8:].reshape(-1, 3)])
    distance = np.linalg.norm(lab - np.median(border, axis=0), axis=2)
    mask = ((alpha > 128) | (distance > 18)).astype(np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    filled = mask.copy()  # fill holes fully enclosed by the garment (e.g. a light print on dark fabric)
    flood = np.zeros((mask.shape[0] + 2, mask.shape[1] + 2), np.uint8)
    cv2.floodFill(filled, flood, (0, 0), 1)
    mask = mask | (1 - filled)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
    if count < 2:
        raise ValueError(f'No garment found in {photo.name}. Photograph it flat on a plain, contrasting surface.')
    mask = (labels == 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
    x, y, w, h = cv2.boundingRect(mask)
    size = int(max(w, h) * 1.04)
    cx, cy = x + w // 2, y + h // 2
    box = (cx - size // 2, cy - size // 2, cx - size // 2 + size, cy - size // 2 + size)
    def crop(array, fill):
        canvas = np.full((size, size) + array.shape[2:], fill, array.dtype)
        sx0, sy0 = max(box[0], 0), max(box[1], 0)
        sx1, sy1 = min(box[2], array.shape[1]), min(box[3], array.shape[0])
        canvas[sy0 - box[1]:sy1 - box[1], sx0 - box[0]:sx1 - box[0]] = array[sy0:sy1, sx0:sx1]
        return cv2.resize(canvas, (SIDE, SIDE), interpolation=cv2.INTER_AREA if size > SIDE else cv2.INTER_LINEAR)
    return crop(np.array(rgb), 0), crop(mask, 0)


def outline(mask: np.ndarray, count: int = 160) -> np.ndarray:
    """Outer contour resampled to `count` points by arc length (consistent orientation; start is arbitrary)."""
    contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    points = max(contours, key=cv2.contourArea)[:, 0, :].astype(np.float64)
    if cv2.contourArea(points.astype(np.float32), oriented=True) < 0:
        points = points[::-1]
    closed = np.vstack([points, points[:1]])
    arc = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(closed, axis=0), axis=1))])
    samples = np.linspace(0, arc[-1], count, endpoint=False)
    return np.stack([np.interp(samples, arc, closed[:, k]) for k in (0, 1)], axis=1)


def correspond(source: np.ndarray, target: np.ndarray) -> np.ndarray:
    """Target outline re-indexed so point i matches source point i: best cyclic shift after normalising
    both outlines to their bounding boxes (shape agreement, independent of scale and position)."""
    def unit(points):
        lo, hi = points.min(0), points.max(0)
        return (points - lo) / np.maximum(hi - lo, 1e-9)
    s, t = unit(source), unit(target)
    costs = [np.linalg.norm(s - np.roll(t, -k, axis=0), axis=1).mean() for k in range(len(t))]
    return np.roll(target, -int(np.argmin(costs)), axis=0)


def _silhouette(points_2d: np.ndarray, faces: np.ndarray, frame: tuple[np.ndarray, float]) -> np.ndarray:
    origin, scale = frame
    pixels = ((points_2d - origin) * scale).astype(np.int32)
    mask = np.zeros((SIDE, SIDE), np.uint8)
    cv2.fillPoly(mask, [pixels[f] for f in faces], 1)
    return mask


def bake(positions: np.ndarray, faces: np.ndarray, front_photo: Path, back_photo: Path | None, out_png: Path):
    """Returns per-face-corner UVs (uv, face_uv) into the baked atlas written to out_png."""
    tri = positions[faces]
    normal = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    facing_front = normal[:, 2] >= 0
    atlas = np.zeros((SIDE, 2 * SIDE, 3), np.uint8)
    uv = np.zeros((len(faces), 3, 2))
    photos = {True: cutout(front_photo)}
    photos[False] = cutout(back_photo) if back_photo else (photos[True][0][:, ::-1].copy(), photos[True][1][:, ::-1].copy())
    for half, front in enumerate((True, False)):
        rgb, photo_mask = photos[front]
        # View coordinates: image x right, y down. The back is seen from behind, so x is mirrored.
        view = np.stack([positions[:, 0] * (1 if front else -1), -positions[:, 1]], axis=1)
        chosen = faces[facing_front == front]
        lo, hi = view[np.unique(chosen)].min(0), view[np.unique(chosen)].max(0)
        scale = SIDE * 0.96 / (hi - lo).max()
        origin = (lo + hi) / 2 - (SIDE / 2) / scale
        garment_mask = _silhouette(view, chosen, (origin, scale))
        source = outline(garment_mask)
        target = correspond(source, outline(photo_mask))
        warp = RBFInterpolator(source, target, kernel='thin_plate_spline', smoothing=50.0)
        pixels = warp((view[chosen.reshape(-1)] - origin) * scale).reshape(-1, 3, 2)
        pixels = np.clip(pixels, 0, SIDE - 1)
        uv[facing_front == front] = np.stack([(pixels[..., 0] + half * SIDE) / (2 * SIDE), 1 - pixels[..., 1] / SIDE], axis=-1)
        # Bleed garment colour past the mask edge so seams never sample the background.
        fill = cv2.inpaint(rgb, (1 - photo_mask).astype(np.uint8) * 255, 3, cv2.INPAINT_TELEA)
        atlas[:, half * SIDE:(half + 1) * SIDE] = np.where(photo_mask[..., None] > 0, rgb, fill)
    Image.fromarray(atlas).save(out_png, optimize=True)
    flat = uv.reshape(-1, 2)
    return flat, np.arange(len(flat)).reshape(-1, 3)


def atlas_bytes(path: Path) -> bytes:
    buffer = io.BytesIO()
    with Image.open(path) as image:
        image.convert('RGB').save(buffer, 'JPEG', quality=88)
    return buffer.getvalue()
