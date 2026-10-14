"""Personal body: fit the Anny parametric human (Apache-2.0 / CC0) to a person's measurements.

Outputs, all in one folder:
  body.glb                 skinned avatar for the phone (y-up, metres, A-pose bind pose, 52 ARKit facial morphs)
  sim_body.obj/.yaml       the same surface plus GarmentCode measurements, for garment draping
  sim_body_segmentation.json  GarmentCode body-part labels
  fit_report.json          requested vs achieved measurements

Usage: python -m thread_factory.body --profile profile.json --out <dir>
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import time
from pathlib import Path

import numpy as np
import torch
import trimesh
import yaml

import anny
from scipy.spatial import ConvexHull

from . import accessories
from .gltf import Material, Part, texture_bytes, tintable_texture, write_skinned_glb
from .measure import hull_perimeter, measure, torso_levels

ANNY_ROOT = Path(__file__).resolve().parents[1] / 'third_party' / 'anny' / 'src' / 'anny'
# Anny is z-up with the front facing -y. glTF and GarmentCode are y-up with the front facing +z.
TO_YUP = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], dtype=np.float64)
ARM_BONES = ('upperarm', 'lowerarm', 'wrist', 'hand', 'finger', 'thumb', 'index', 'middle', 'ring', 'pinky', 'metacarpal')
LEG_BONES = ('upperleg', 'lowerleg', 'foot', 'toe')
# Eyes: the cornea shell is fully transparent (cut-out). Brows/lashes are soft strokes (blended, small, few sort issues).
# Hair is cut-out: blended hair cannot be depth-sorted reliably on phones.
ALPHA = {'eyes': 'MASK', 'eyebrows': 'BLEND', 'eyelashes': 'BLEND', 'hair': 'MASK'}
# CC0 shoe stand-ins and the wardrobe colours each one represents.
SHOES = {'shoes05': ['White', 'Beige', 'Unknown'], 'shoes06': ['Navy', 'Blue', 'Purple'], 'shoes04': ['Black'],
         'shoes01': ['Brown', 'Red', 'Yellow'], 'shoes02': ['Grey', 'Green', 'Pink'], 'shoes03': []}


def age_parameter(years: float) -> float:
    """MakeHuman age slider: 0 -> 1 y, 0.1875 -> 11 y, 0.5 -> 25 y, 1 -> 90 y."""
    points = [(1, 0.0), (11, 0.1875), (25, 0.5), (90, 1.0)]
    years = min(max(years, 1), 90)
    for (y0, p0), (y1, p1) in zip(points, points[1:]):
        if years <= y1:
            return p0 + (p1 - p0) * (years - y0) / (y1 - y0)
    return 1.0


def compute_device() -> str:
    """CPU by default: body and face fitting are hundreds of sequential steps on one small mesh, where GPU
    launch overhead dominates (measured on an RTX 5050: 231 s on the GPU vs 90 s on the CPU for a selfie
    body). THREAD_DEVICE=cuda opts in, e.g. for a future batched fit."""
    return os.environ.get('THREAD_DEVICE') or 'cpu'


def load_model():
    import anny
    # Anny's buffers come from files, so they move explicitly; torch's default device covers new tensors.
    return anny.Anny(local_changes='default', facial_actions='all').to(dtype=torch.float32, device=torch.get_default_device())


class BodyFitter:
    """Gradient-based fit of phenotype and tape-measure targets."""

    FREE = ('height', 'weight', 'muscle', 'proportions')
    LOCAL = {'chest_cm': 'measure-bust-circ-incr', 'waist_cm': 'measure-waist-circ-incr', 'hips_cm': 'measure-hips-circ-incr'}
    LEVEL = {'chest_cm': 'bust', 'waist_cm': 'waist', 'hips_cm': 'hips'}

    def __init__(self, model):
        self.model = model
        from anny.anthropometry import Anthropometry
        self.anthro = Anthropometry(model)
        dominant = model.vertex_bone_indices[torch.arange(model.vertex_bone_indices.shape[0]),
                                             model.vertex_bone_weights.argmax(dim=1)]
        labels = model.bone_labels
        # Only arms are excluded: buttock vertices are weighted to the thigh bones but belong on the hip tape.
        self.arm = np.array([any(k in labels[int(b)] for k in ARM_BONES) for b in dominant])

    def forward(self, phenotypes: dict, locals_: dict):
        out = self.model(phenotype_kwargs=phenotypes, local_changes_kwargs=locals_)
        return out['rest_vertices']

    def _rings(self, vertices: torch.Tensor, wanted: list[str]) -> dict:
        """Hull-ordered torso vertex rings at the tape levels of the current shape."""
        v = vertices[0].detach().cpu().numpy() @ TO_YUP.T
        mesh = trimesh.Trimesh(v, self.model.faces.cpu().numpy(), process=False)
        levels = torso_levels(mesh)
        rings = {}
        for key in wanted:
            y = levels[self.LEVEL[key]]
            band = np.nonzero((np.abs(v[:, 1] - y) < 0.012) & ~self.arm)[0]
            hull = ConvexHull(v[band][:, [0, 2]])
            rings[key] = torch.as_tensor(band[hull.vertices])
        return rings

    @staticmethod
    def _perimeter(vertices: torch.Tensor, ring: torch.Tensor) -> torch.Tensor:
        p = vertices[0, ring][:, :2]  # Anny x/y are the horizontal plane
        return torch.linalg.norm(p - torch.roll(p, 1, 0), dim=1).sum()

    def fit(self, profile: dict, steps: int = 160) -> tuple[dict, dict]:
        fixed = {'age': age_parameter(profile.get('age', 30))}
        if profile.get('sex') in ('male', 'female'):
            fixed['gender'] = 0.0 if profile['sex'] == 'male' else 1.0  # Anny: 0 = male, 1 = female (see shape_distribution)
        free = [k for k in self.FREE if k in self.model.phenotype_labels]
        if 'gender' not in fixed:
            free.append('gender')
        raw = torch.zeros(len(free), requires_grad=True)
        targets = {k: profile[k] / 100 for k in self.LOCAL if profile.get(k)}
        local_raw = torch.zeros(len(targets), requires_grad=True)
        optimiser = torch.optim.Adam([raw, local_raw], lr=0.08)
        neutral = {k: 0.5 for k in self.model.phenotype_labels}

        def params():
            phen = {**neutral, **{k: torch.tensor([v]) for k, v in fixed.items()}}
            phen.update({k: torch.sigmoid(raw[i])[None] for i, k in enumerate(free)})
            loc = {self.LOCAL[k]: torch.tanh(local_raw[i])[None] for i, k in enumerate(targets)}
            return phen, loc

        rings = {}
        for step in range(steps):
            phen, loc = params()
            vertices = self.forward(phen, loc)
            if step % 40 == 0 and targets:
                rings = self._rings(vertices, list(targets))
            loss = ((self.anthro.height(vertices)[0] - profile['height_cm'] / 100) / 0.01) ** 2
            for key, target in targets.items():
                loss = loss + ((self._perimeter(vertices, rings[key]) - target) / 0.01) ** 2
            if profile.get('weight_kg'):
                loss = loss + ((self.anthro.mass(vertices)[0] - profile['weight_kg']) / 1.0) ** 2
            loss = loss + 0.5 * (local_raw ** 2).sum()  # prefer global phenotype over local edits
            optimiser.zero_grad()
            loss.backward()
            optimiser.step()
        phen, loc = params()
        return ({k: float(v.detach()) for k, v in phen.items()}, {k: float(v.detach()) for k, v in loc.items()})


def landmarks(model, out, to_world, mesh: trimesh.Trimesh) -> dict:
    """Skin-surface landmarks: joints locate them, the mesh surface gives tailor positions."""
    heads = out['rest_bone_heads'][0].detach().cpu().numpy()
    labels = model.bone_labels
    def head(name): return to_world(heads[labels.index(name)])
    v = mesh.vertices

    def top(x, z, radius=0.015, below=np.inf):
        """Highest skin point near (x, z): the shoulder line as a tape would follow it."""
        near = np.nonzero((np.hypot(v[:, 0] - x, v[:, 2] - z) < radius) & (v[:, 1] < below))[0]
        return v[near[np.argmax(v[near, 1])]]

    joint_l, joint_r, neck = head('upperarm01.L'), head('upperarm01.R'), head('neck01')
    acromion_l, acromion_r = top(joint_l[0], joint_l[2]), top(joint_r[0], joint_r[2])
    neck_band = v[(np.abs(v[:, 1] - neck[1] - 0.03) < 0.01)]  # mid-neck, above the trapezius slope
    neck_half = float(np.percentile(np.abs(neck_band[:, 0] - neck[0]), 90))
    neck_side = top(neck[0] + neck_half + 0.01, neck[2], below=neck[1] + 0.02)  # the head overhangs above
    wrist = head('wrist.L') if 'wrist.L' in labels else head('hand.L')
    # Wrist girth: tape perpendicular to the forearm, 1.5 cm above the wrist joint.
    axis = wrist - head('lowerarm01.L')
    axis /= np.linalg.norm(axis)
    centre = wrist - 0.015 * axis
    along = (v - centre) @ axis
    ring = v[(np.abs(along) < 0.006) & (np.linalg.norm(v - centre, axis=1) < 0.06)]
    basis = np.linalg.svd(np.eye(3) - np.outer(axis, axis))[0][:, :2]
    wrist_circ = hull_perimeter(ring @ basis)
    return dict(wrist_circ=wrist_circ, shoulder_l=joint_l, shoulder_r=joint_r, acromion_l=acromion_l, acromion_r=acromion_r,
                neck_base=neck_side, nape=neck_side, neck_half_width=neck_half, wrist_l=wrist)


def open_eye_openings(positions: np.ndarray, faces: np.ndarray, eye_positions: np.ndarray) -> np.ndarray:
    """Mask of skin faces to keep. The MakeHuman base mesh carries low-poly helper eyeballs that would hide
    the textured eye proxies. Those helpers are separate closed pieces (not connected to the skin), so every
    small connected component centred inside an eye proxy is dropped; eyelids stay intact."""
    keep = np.ones(len(faces), bool)
    skin = trimesh.Trimesh(positions, faces, process=False)
    labels = trimesh.graph.connected_component_labels(skin.face_adjacency, node_count=len(faces))
    centres = [eye_positions[side].mean(axis=0) for side in (eye_positions[:, 0] < 0, eye_positions[:, 0] >= 0)]
    radius = np.linalg.norm(eye_positions[eye_positions[:, 0] < 0] - centres[0], axis=1).max()
    for label in np.unique(labels):
        component = labels == label
        if component.sum() > len(faces) // 4:
            continue  # the body itself
        centre = positions[faces[component]].reshape(-1, 3).mean(axis=0)
        if min(np.linalg.norm(centre - c) for c in centres) < radius:
            keep &= ~component
    return keep


def build(profile: dict, out_dir: Path) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    device = compute_device()
    torch.set_default_device(device)  # every tensor below (ours and Anny's) is created on this device
    timings, clock = {}, time.time()

    def lap(stage: str):
        nonlocal clock
        if device == 'cuda':
            torch.cuda.synchronize()
        timings[stage] = round(time.time() - clock, 1); clock = time.time()

    model = load_model()
    lap('load_model')
    phenotypes, local_changes = BodyFitter(model).fit(profile)
    lap('fit_body')
    face_photo = None
    if profile.get('face_photo'):  # face shape from a selfie (MediaPipe landmarks -> Anny face controls)
        from PIL import Image, ImageOps
        from .face import detect, fit_face
        with Image.open(profile['face_photo']) as photo:
            face_rgb = np.array(ImageOps.exif_transpose(photo).convert('RGB'))
        points, _ = detect(face_rgb)
        face_photo = (face_rgb, points)
        local_changes, face_rms = fit_face(model, phenotypes, local_changes, points)
        profile = {**profile, 'face_fit_rms_px': round(face_rms, 2)}
        lap('fit_face')
    # Manual face/body sliders (values in [-1, 1]) apply last and win over fitted values.
    allowed = set(model.local_change_labels)
    local_changes.update({k: float(np.clip(v, -1, 1)) for k, v in profile.get('face_controls', {}).items() if k in allowed})
    with torch.no_grad():
        out = model(phenotype_kwargs=phenotypes, local_changes_kwargs=local_changes)
        vertices = out['rest_vertices'][0].cpu().numpy().astype(np.float64)
        heads = out['rest_bone_heads'][0].cpu().numpy()
    pelvis = heads[model.bone_labels.index('root')]
    up = vertices @ TO_YUP.T
    offset = np.array([-(pelvis @ TO_YUP.T)[0], -up[:, 1].min(), -(pelvis @ TO_YUP.T)[2]])
    def to_world(p): return np.asarray(p, dtype=np.float64) @ TO_YUP.T + offset
    up = up + offset
    faces = model.faces.cpu().numpy()
    mesh = trimesh.Trimesh(up, faces, process=False)

    marks = landmarks(model, out, to_world, mesh)
    measurements = measure(mesh, marks)

    # --- GarmentCode draping inputs ---
    mesh.export(out_dir / 'sim_body.obj')
    with open(out_dir / 'sim_body.yaml', 'w') as f:
        yaml.safe_dump({'body': {**measurements, 'body_sample': 'sim_body'}}, f, sort_keys=True)
    labels = model.bone_labels
    dominant = model.vertex_bone_indices[torch.arange(len(up)), model.vertex_bone_weights.argmax(dim=1)].cpu().numpy()
    part = {'body': [], 'left_arm': [], 'right_arm': [], 'left_leg': [], 'right_leg': [], 'face_internal': []}
    for i, b in enumerate(dominant):
        name = labels[int(b)]
        side = 'left' if name.endswith('.L') else 'right'
        if any(k in name for k in ARM_BONES):
            part[f'{side}_arm'].append(i)
        elif any(k in name for k in LEG_BONES):
            part[f'{side}_leg'].append(i)
        else:
            part['body'].append(i)
    cavities = torch.load(ANNY_ROOT / 'data' / 'template_mesh_internal_cavities.pth')['vertex_indices']
    base = {int(b): i for i, b in enumerate(model.base_mesh_vertex_indices.tolist())}
    internal = sorted({base[int(c)] for c in cavities if int(c) in base})
    internal_set = set(internal)
    part = {k: [i for i in v if i not in internal_set] for k, v in part.items()}
    part['face_internal'] = internal
    (out_dir / 'sim_body_segmentation.json').write_text(json.dumps(part))

    # --- Phone avatar ---
    # The full MakeHuman topology (same shape parameters) anchors CC0 proxies: eyes, brows, lashes, hair.
    full = anny.Anny(topology='anny-full', local_changes='default', facial_actions='all').to(dtype=torch.float32, device=device)
    with torch.no_grad():
        morphs, full_morphs = {}, {}
        full_rest = full(phenotype_kwargs=phenotypes, local_changes_kwargs=local_changes)['rest_vertices'][0].cpu().numpy().astype(np.float64)
        # All 52 expressions in one batched pass (row i = expression i at full strength): ~14x faster than a loop.
        actions = list(model.facial_action_labels)
        batch = lambda values: {k: torch.full((len(actions),), float(v)) for k, v in values.items()}
        one_hot = {action: row for action, row in zip(actions, torch.eye(len(actions)))}
        shaped = model(phenotype_kwargs=batch(phenotypes), local_changes_kwargs=batch(local_changes),
                       facial_actions=one_hot)['rest_vertices'].cpu().numpy()
        shaped_full = full(phenotype_kwargs=batch(phenotypes), local_changes_kwargs=batch(local_changes),
                           facial_actions=one_hot)['rest_vertices'].cpu().numpy()
        rest = out['rest_vertices'][0].cpu().numpy()
        for i, action in enumerate(actions):
            morphs[action] = (shaped[i] - rest) @ TO_YUP.T
            full_morphs[action] = (shaped_full[i] - full_rest) @ TO_YUP.T
        bone_world = out['rest_bone_poses'][0].cpu().numpy().astype(np.float64)
    lap('expressions')
    rot = np.eye(4); rot[:3, :3] = TO_YUP
    shift = np.eye(4); shift[:3, 3] = offset
    bone_world = np.einsum('ij,njk->nik', shift @ rot, bone_world)
    full_weights = np.zeros((len(full_rest), len(labels)))
    np.add.at(full_weights, (np.repeat(np.arange(len(full_rest)), full.vertex_bone_indices.shape[1]),
                             full.vertex_bone_indices.cpu().numpy().reshape(-1)), full.vertex_bone_weights.cpu().numpy().reshape(-1))
    rig = dict(bone_names=list(labels), bone_parents=list(model.bone_parents), bone_world=bone_world)

    def proxy(kind: str, name: str, material: str | None = None, with_morphs=True, roughness=0.5, tint=None) -> Part:
        item, mat = accessories.load(kind, name)
        if material:
            mat = accessories.read_mhmat(accessories.ASSETS / kind / 'materials' / f'{material}.mhmat')
            mat['_folder'] = str(accessories.ASSETS / kind / 'materials')
        v, vt, f, fu = accessories.read_obj(item.folder / item.obj_file)
        weights = accessories.blend(item, full_weights)
        joints = np.argsort(-weights, axis=1)[:, :8]
        texture = Path(mat['_folder']) / mat['diffuseTexture'] if mat.get('diffuseTexture') else None
        if kind == 'eyes' and texture:
            from .face import EYE_COLOURS
            from .skin import recolour_iris
            image = recolour_iris(texture, EYE_COLOURS.get(material or 'brown', EYE_COLOURS['brown']))
        else:
            image = (tintable_texture(texture) if tint else texture_bytes(texture)) if texture else None
        return Part(positions=to_world(accessories.fit(item, full_rest)), faces=f, uv=vt, face_uv=fu,
                    joint_indices=joints, joint_weights=np.take_along_axis(weights, joints, 1),
                    morphs={k: accessories.blend(item, d) for k, d in full_morphs.items()} if with_morphs else None,
                    material=Material(name=f'{kind}_{name}', roughness=roughness, double_sided=kind != 'eyes',
                                      texture=image,
                                      tint=tint, alpha=ALPHA.get(kind, 'MASK' if mat.get('transparent') == 'True' else 'OPAQUE')))

    style = profile.get('style', {})
    hair_colour = tuple(style.get('hair_rgb', (0.23, 0.16, 0.11)))  # sRGB; default dark brown
    eyes = proxy('eyes', 'high-poly', material=style.get('eyes', 'brown'), roughness=0.15)
    open_faces = open_eye_openings(up, faces, eyes.positions)
    skin_rgb = tuple(profile.get('skin_rgb', (0.78, 0.57, 0.44)))
    if face_photo:  # body tone and eye colour follow the selfie
        from .face import face_colours
        skin_rgb, eye_colour = face_colours(*face_photo)
        if 'eyes' not in style:
            eyes = proxy('eyes', 'high-poly', material=eye_colour, roughness=0.15)
    # Skin: CC0 skin photography tone-matched to the person; the selfie, when given, becomes the face.
    import io
    from PIL import Image
    from . import skin
    atlas, skin_uv, skin_face_uv, skin_source = skin.bake(
        up, faces[open_faces], model.texture_coordinates.cpu().numpy(), model.face_texture_coordinate_indices.cpu().numpy()[open_faces],
        sex=profile.get('sex'), age=profile.get('age', 30), tone=skin_rgb)
    if face_photo:
        from .face import project_face
        atlas = project_face(atlas, up, faces[open_faces], skin_uv, skin_face_uv, *face_photo)
    hair = style.get('hair', 'short02' if profile.get('sex') == 'male' else 'bob02')
    hair_part = None if hair == 'none' else proxy('hair', hair, with_morphs=False, roughness=0.65, tint=hair_colour)
    if hair_part:
        atlas = skin.paint_scalp(atlas, up, faces[open_faces], skin_uv, skin_face_uv, hair_part.positions, hair_part.faces,
                                 hair_colour, brow_y=float(eyes.positions[:, 1].max()) + 0.015)
    lap('skin_textures')
    buffer = io.BytesIO(); Image.fromarray(atlas).save(buffer, 'JPEG', quality=88); skin_texture = buffer.getvalue()
    Image.fromarray(atlas).save(out_dir / 'skin_atlas.jpg', quality=88)
    # Skeleton, skin weights and the exact skin triangle list the phone renders: garments bind to this
    # rig and index their body-coverage masks into these triangles.
    np.savez_compressed(out_dir / 'skeleton.npz', bone_names=np.array(labels), bone_parents=np.array(model.bone_parents),
                        bone_world=bone_world, vertex_joints=model.vertex_bone_indices.cpu().numpy(),
                        vertex_weights=model.vertex_bone_weights.cpu().numpy(), positions=up, faces=faces[open_faces])
    body_part = Part(positions=up, faces=faces[open_faces], uv=skin_uv, face_uv=skin_face_uv,
                     joint_indices=model.vertex_bone_indices.cpu().numpy(), joint_weights=model.vertex_bone_weights.cpu().numpy(),
                     morphs=morphs, material=Material(name='skin', rgb=skin_rgb, roughness=0.55, texture=skin_texture, mime='image/jpeg'))
    write_skinned_glb(out_dir / 'body.glb', parts=[
        body_part,
        eyes,
        *([] if face_photo and 'eyebrows' not in style else [proxy('eyebrows', style.get('eyebrows', 'eyebrow001'), tint=hair_colour)]),
        proxy('eyelashes', style.get('eyelashes', 'eyelashes01'), tint=(0.07, 0.05, 0.04)),
    ], **rig)
    # Shoe stand-ins (CC0, textured). Their delete_verts mark the foot skin hidden inside the shoe.
    skin_faces = faces[open_faces]
    base_index = model.base_mesh_vertex_indices.cpu().numpy()
    for name, colours in SHOES.items():
        item, _ = accessories.load('clothes', name)
        hidden = np.isin(base_index[skin_faces], item.delete_verts).all(axis=1)
        bits = base64.b64encode(np.packbits(hidden.astype(np.uint8))).decode()
        write_skinned_glb(out_dir / f'shoes_{name}.glb', parts=[proxy('clothes', name, with_morphs=False, roughness=0.5)],
                          name=f'shoes_{name}', extras={'thread': {'category': 'shoes', 'colors': colours,
                          'bodyTriangles': int(len(skin_faces)), 'coversBodyTriangles': bits}}, **rig)
    if hair_part:
        write_skinned_glb(out_dir / 'hair.glb', parts=[hair_part],
                          name='hair', extras={'thread': {'category': 'hair', 'style': hair}}, **rig)
    from . import base_layer  # neutral underwear for empty outfit slots
    lap('assets')
    base_layer.build(out_dir, profile.get('sex', 'female'))
    lap('base_layer')
    report = {'profile': profile, 'phenotypes': phenotypes, 'local_changes': local_changes, 'skin_source': skin_source,
              'device': torch.cuda.get_device_name(0) if device == 'cuda' else 'cpu', 'timings_s': timings,
              'achieved': {'height_cm': measurements['height'], 'chest_cm': measurements['bust'],
                           'waist_cm': measurements['waist'], 'hips_cm': measurements['hips']},
              'garmentcode_measurements': measurements}
    (out_dir / 'fit_report.json').write_text(json.dumps(report, indent=2))
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--profile', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    report = build(json.loads(args.profile.read_text()), args.out)
    print(json.dumps(report['achieved'], indent=2))


if __name__ == '__main__':
    main()
