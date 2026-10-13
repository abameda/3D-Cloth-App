"""Personal face shape from a selfie: MediaPipe Face Landmarker (Apache-2.0) + Anny face controls.

The head stays an Anny head (same rig, same 52 ARKit expressions); only its face shape controls move to
match the 478 landmarks MediaPipe reads from the photo. Landmarks are tied to the skin surface once, by
rendering the template face with a known camera and ray-casting each detected landmark.

Correspondence:  python -m thread_factory.face correspond --body <body dir>
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

import numpy as np
import torch
import trimesh

MODEL = Path(__file__).resolve().parents[1] / 'tools' / 'models' / 'face_landmarker.task'
DATA = Path(__file__).resolve().parent / 'data' / 'mediapipe_anny.npz'
CAMERA = dict(yfov=np.radians(20), size=800, eye=np.array([0.0, 1.62, 0.75]))
# Face controls fitted to landmarks (ears are not observed; '-trans-out' shifts break symmetry).
FACE_CONTROL = re.compile(r'^(l-|r-)?(head|chin|cheek|eye|eyes|eyebrows|nose|mouth|forehead)-(?!.*trans-out)')


def detect(rgb: np.ndarray) -> tuple[np.ndarray, dict]:
    """(478, 3) landmarks in pixels (x right, y down, z toward the camera), and ARKit-named blendshape scores."""
    import mediapipe as mp
    from mediapipe.tasks import python as mpt
    from mediapipe.tasks.python import vision
    options = vision.FaceLandmarkerOptions(base_options=mpt.BaseOptions(model_asset_path=str(MODEL)),
                                           num_faces=1, output_face_blendshapes=True)
    with vision.FaceLandmarker.create_from_options(options) as detector:
        result = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb[:, :, :3])))
    if not result.face_landmarks:
        raise ValueError('No face found. Use a sharp, front-facing photo in even light.')
    h, w = rgb.shape[:2]
    points = np.array([[p.x * w, p.y * h, -p.z * w] for p in result.face_landmarks[0]])
    scores = {b.category_name: b.score for b in result.face_blendshapes[0]} if result.face_blendshapes else {}
    return points, scores


def render_front(glb: Path) -> np.ndarray:
    import pyrender
    scene = pyrender.Scene.from_trimesh_scene(trimesh.load(glb), bg_color=[0.85, 0.85, 0.85, 1.0], ambient_light=[0.35] * 3)
    pose = np.eye(4); pose[:3, 3] = CAMERA['eye']
    scene.add(pyrender.PerspectiveCamera(yfov=CAMERA['yfov']), pose=pose)
    scene.add(pyrender.DirectionalLight(intensity=3.0), pose=pose)
    return pyrender.OffscreenRenderer(CAMERA['size'], CAMERA['size']).render(scene)[0]


def build_correspondence(body_dir: Path) -> dict:
    """Ties each landmark to a skin triangle (vertex ids + barycentric weights) of the template topology."""
    rig = np.load(body_dir / 'skeleton.npz')
    skin = trimesh.Trimesh(rig['positions'], rig['faces'], process=False)
    points, _ = detect(render_front(body_dir / 'body.glb'))
    size, focal = CAMERA['size'], (CAMERA['size'] / 2) / np.tan(CAMERA['yfov'] / 2)
    directions = np.stack([(points[:, 0] - size / 2) / focal, -(points[:, 1] - size / 2) / focal, -np.ones(len(points))], axis=1)
    directions /= np.linalg.norm(directions, axis=1, keepdims=True)
    origins = np.tile(CAMERA['eye'], (len(points), 1))
    hits, rays, _ = skin.ray.intersects_location(origins, directions, multiple_hits=False)
    landmark, vertices, weights = [], [], []
    triangles = skin.ray.intersects_first(origins, directions)
    for ray in range(len(points)):
        if ray >= 468 or triangles[ray] < 0:  # iris landmarks lie on the eyes, not the skin
            continue
        corners = skin.faces[triangles[ray]]
        location = hits[np.nonzero(rays == ray)[0][0]]
        bary = trimesh.triangles.points_to_barycentric(skin.vertices[corners][None], location[None])[0]
        landmark.append(ray); vertices.append(corners); weights.append(bary)
    # The template's own detections are kept: fitting uses photo-minus-template displacements, which cancels
    # MediaPipe's systematic bias and correspondence error. metres_per_px converts them at the face's depth.
    depth = float(np.mean(CAMERA['eye'][2] - skin.vertices[np.array(vertices)].mean(1)[:, 2]))
    data = dict(landmark=np.array(landmark), vertices=np.array(vertices), weights=np.array(weights),
                template_points=points[np.array(landmark)], metres_per_px=depth / focal)
    DATA.parent.mkdir(exist_ok=True)
    np.savez_compressed(DATA, **data)
    return data


def _rotation(axis_angle: torch.Tensor) -> torch.Tensor:
    angle = torch.linalg.norm(axis_angle) + 1e-9
    k = axis_angle / angle
    K = torch.stack([torch.stack([torch.zeros(()), -k[2], k[1]]), torch.stack([k[2], torch.zeros(()), -k[0]]),
                     torch.stack([-k[1], k[0], torch.zeros(())])])
    return torch.eye(3) + torch.sin(angle) * K + (1 - torch.cos(angle)) * K @ K


def _similarity(source: np.ndarray, target: np.ndarray, weight: np.ndarray) -> np.ndarray:
    """source aligned onto target (rotation, uniform scale, translation; Umeyama on axis-weighted points)."""
    src, tgt = source * weight, target * weight
    mu_s, mu_t = src.mean(0), tgt.mean(0)
    u, sigma, vt = np.linalg.svd((src - mu_s).T @ (tgt - mu_t))
    d = np.eye(3); d[2, 2] = np.sign(np.linalg.det(u @ vt))
    rotation = (u @ d @ vt).T
    scale = (sigma * np.diag(d)).sum() / ((src - mu_s) ** 2).sum()
    return (scale * (src - mu_s) @ rotation.T + mu_t) / weight


def fit_face(model, phenotypes: dict, local_changes: dict, photo_points: np.ndarray, steps: int = 300,
             shape_weight: float = 2e-6, depth_weight: float = 0.5) -> tuple[dict, float]:
    """Face controls whose landmark displacements match the photo's displacements from the template face.
    Returns (local_changes incl. face controls, final RMS of displacement residual in mm)."""
    from .body import TO_YUP
    corr = np.load(DATA)
    axis = np.array([1.0, 1.0, depth_weight])  # MediaPipe depth is the least reliable axis
    photo = _similarity(photo_points[corr['landmark']], corr['template_points'], axis)
    delta = (photo - corr['template_points']) * corr['metres_per_px']
    delta[:, 1] *= -1; delta[:, 2] *= 1  # image y down -> up; z already toward the camera (+z front)
    target = torch.as_tensor(delta, dtype=torch.float32)
    labels = [label for label in model.local_change_labels if FACE_CONTROL.match(label)]
    raw = torch.zeros(len(labels), requires_grad=True)
    to_yup = torch.as_tensor(TO_YUP, dtype=torch.float32)
    vertices = torch.as_tensor(corr['vertices']); bary = torch.as_tensor(corr['weights'], dtype=torch.float32)
    fixed = {k: torch.tensor([float(v)]) for k, v in local_changes.items()}
    weight = torch.as_tensor(axis, dtype=torch.float32)

    def landmarks(values):
        local = {**fixed, **{label: values[i][None] for i, label in enumerate(labels)}}
        rest = model(phenotype_kwargs=phenotypes, local_changes_kwargs=local)['rest_vertices'][0] @ to_yup.T
        return (rest[vertices] * bary[..., None]).sum(1)

    with torch.no_grad():
        base = landmarks(torch.zeros(len(labels)))
    optimiser = torch.optim.Adam([raw], lr=0.05)
    for _ in range(steps):
        moved = landmarks(torch.tanh(raw)) - base
        moved = moved - moved.mean(0) + target.mean(0)  # translation is not shape
        loss = (((moved - target) * weight) ** 2).sum(1).mean() + shape_weight * (raw ** 2).sum()
        optimiser.zero_grad(); loss.backward(); optimiser.step()
    with torch.no_grad():
        values = torch.tanh(raw)
        moved = landmarks(values) - base
        moved = moved - moved.mean(0) + target.mean(0)
        rms = float(torch.sqrt((((moved - target) * weight) ** 2).sum(1).mean())) * 1000
    result = dict(local_changes)
    result.update({label: float(values[i]) for i, label in enumerate(labels)})
    return result, rms


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    correspond = sub.add_parser('correspond'); correspond.add_argument('--body', type=Path, required=True)
    args = parser.parse_args()
    data = build_correspondence(args.body)
    print(f'{len(data["landmark"])} landmarks tied to the skin -> {DATA}')


if __name__ == '__main__':
    main()


# MakeHuman eye materials and their typical iris colours (sRGB), for matching the photographed iris.
EYE_COLOURS = {'brown': (92, 56, 38), 'brownlight': (140, 96, 60), 'blue': (88, 120, 170), 'lightblue': (130, 165, 200),
               'deepblue': (50, 80, 140), 'green': (90, 120, 80), 'bluegreen': (80, 130, 130), 'grey': (125, 130, 135),
               'ice': (170, 190, 205)}


def bake_face_texture(positions: np.ndarray, faces: np.ndarray, uv: np.ndarray, face_uv: np.ndarray,
                      rgb: np.ndarray, photo_points: np.ndarray, size: int = 2048):
    """Skin texture: the selfie projected onto the face, feathered into a body tone sampled from the cheeks.
    The MakeHuman head UV island is tiny, so UVs are re-laid out: the head island fills the whole texture and
    every other (plain-tone) triangle maps to a tone-only corner.
    Returns (texture RGB, new uv, new face_uv, skin sRGB 0-1, eye material name)."""
    import cv2
    uv, face_uv = relayout_head_uv(positions, faces, uv, face_uv)
    corr = np.load(DATA)
    model = (positions[corr['vertices']] * corr['weights'][..., None]).sum(1)
    photo = photo_points[corr['landmark']].copy()
    # Weak-perspective camera from the model landmarks to the photo (pixels, y down).
    target = photo * np.array([1, -1, 1])
    mu_m, mu_t = model.mean(0), target.mean(0)
    u, sigma, vt = np.linalg.svd((model - mu_m).T @ (target - mu_t))
    d = np.eye(3); d[2, 2] = np.sign(np.linalg.det(u @ vt))
    rotation = (u @ d @ vt).T
    scale = (sigma * np.diag(d)).sum() / ((model - mu_m) ** 2).sum()
    projected = scale * (positions - mu_m) @ rotation.T + mu_t
    pixel = np.stack([projected[:, 0], -projected[:, 1]], axis=1)
    view = rotation.T @ np.array([0, 0, 1.0])  # camera direction in model space

    # Skin tone from both cheeks (MediaPipe 205 / 425), robust median.
    h, w = rgb.shape[:2]
    samples = []
    for index in (205, 425, 50, 280):
        x, y = photo_points[index, :2].astype(int)
        samples.append(rgb[max(0, y - 6):y + 6, max(0, x - 6):x + 6].reshape(-1, 3))
    tone = np.median(np.concatenate(samples), axis=0)
    atlas = np.tile(tone.astype(np.uint8), (size, size, 1))
    weight_map = np.zeros((size, size), np.float32)
    colour_map = np.zeros((size, size, 3), np.float32)

    # Face region: inside the landmark hull, facing the camera; weight fades towards the hull edge.
    hull = cv2.convexHull(photo_points[:468, :2].astype(np.float32))
    tri = positions[faces]
    normals = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    normals /= np.linalg.norm(normals, axis=1, keepdims=True) + 1e-12
    facing = normals @ view
    inradius = np.sqrt(cv2.contourArea(hull) / np.pi)
    for f in np.nonzero(facing > 0.25)[0]:
        src = pixel[faces[f]].astype(np.float32)
        centre = src.mean(0)
        inside = cv2.pointPolygonTest(hull, (float(centre[0]), float(centre[1])), True)
        if inside <= 0:
            continue
        dst = np.stack([uv[face_uv[f], 0] * size, (1 - uv[face_uv[f], 1]) * size], axis=1).astype(np.float32)
        x0, y0 = np.floor(dst.min(0)).astype(int); x1, y1 = np.ceil(dst.max(0)).astype(int) + 1
        if x1 - x0 < 1 or y1 - y0 < 1 or x0 < 0 or y0 < 0 or x1 > size or y1 > size:
            continue
        local = dst - np.array([x0, y0], np.float32)
        warp = cv2.getAffineTransform(src, local)
        patch = cv2.warpAffine(rgb, warp, (x1 - x0, y1 - y0), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        mask = np.zeros((y1 - y0, x1 - x0), np.float32)
        cv2.fillConvexPoly(mask, np.round(local).astype(np.int32), 1.0)
        alpha = min(1.0, inside / (0.25 * inradius)) * min(1.0, (facing[f] - 0.25) / 0.35)
        region = mask * alpha
        weight_map[y0:y1, x0:x1] = np.maximum(weight_map[y0:y1, x0:x1], region)
        colour_map[y0:y1, x0:x1] = np.where(region[..., None] > 0, patch, colour_map[y0:y1, x0:x1])
    weight_map = cv2.GaussianBlur(weight_map, (0, 0), 6)
    atlas = (colour_map * weight_map[..., None] + atlas * (1 - weight_map[..., None])).astype(np.uint8)

    # Eye colour: mean iris colour around MediaPipe iris centres (468, 473), nearest MakeHuman material.
    # Iris colour: the ring between pupil and iris edge (MediaPipe 468-472 left, 473-477 right), median.
    iris = []
    yy, xx = np.mgrid[0:rgb.shape[0], 0:rgb.shape[1]]
    for centre_index in (468, 473):
        centre = photo_points[centre_index, :2]
        radius = np.linalg.norm(photo_points[centre_index + 1:centre_index + 5, :2] - centre, axis=1).mean()
        distance = np.hypot(xx - centre[0], yy - centre[1])
        iris.append(rgb[(distance > 0.45 * radius) & (distance < 0.9 * radius)])
    iris_colour = np.median(np.concatenate(iris), axis=0)
    eye = min(EYE_COLOURS, key=lambda name: np.linalg.norm(np.array(EYE_COLOURS[name]) - iris_colour))
    if np.linalg.norm(iris_colour - tone) < 45:  # eyes closed/squinting or too dark to read: keep the default
        eye = 'brown'
    return atlas, uv, face_uv, tuple((tone / 255).round(4).tolist()), eye


def relayout_head_uv(positions: np.ndarray, faces: np.ndarray, uv: np.ndarray, face_uv: np.ndarray):
    """Per-corner UVs: the face's own UV island (the one holding the nose tip) scaled to fill [0.02, 0.98]^2;
    every other triangle collapses to the tone-only corner (0.005, 0.005)."""
    import scipy.sparse as sp
    from scipy.sparse.csgraph import connected_components
    # Triangles sharing a UV corner belong to the same island.
    rows = np.repeat(np.arange(len(faces)), 3)
    incidence = sp.coo_matrix((np.ones(len(rows)), (rows, face_uv.reshape(-1))), shape=(len(faces), len(uv))).tocsr()
    _, island = connected_components(incidence @ incidence.T, directed=False)
    nose = np.argmax(positions[:, 2] - 10 * (positions[:, 1] < positions[:, 1].max() - 0.25))  # most forward head point
    face = island == island[np.nonzero((faces == nose).any(axis=1))[0][0]]
    in_face = np.zeros(len(uv), bool); in_face[face_uv[face].reshape(-1)] = True  # a UV index lives in one island
    lo, hi = uv[in_face].min(0), uv[in_face].max(0)
    table = np.full_like(uv, 0.005)
    table[in_face] = 0.02 + 0.96 * (uv[in_face] - lo) / (hi - lo).max()
    return table, face_uv  # same indices: vertices stay shared, only the UV table changes
