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
import json
from pathlib import Path

import numpy as np
import torch
import trimesh
import yaml
from scipy.spatial import ConvexHull

from .gltf import write_skinned_glb
from .measure import hull_perimeter, measure, torso_levels

ANNY_ROOT = Path(__file__).resolve().parents[1] / 'third_party' / 'anny' / 'src' / 'anny'
# Anny is z-up with the front facing -y. glTF and GarmentCode are y-up with the front facing +z.
TO_YUP = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], dtype=np.float64)
ARM_BONES = ('upperarm', 'lowerarm', 'wrist', 'hand', 'finger', 'thumb', 'index', 'middle', 'ring', 'pinky', 'metacarpal')
LEG_BONES = ('upperleg', 'lowerleg', 'foot', 'toe')


def age_parameter(years: float) -> float:
    """MakeHuman age slider: 0 -> 1 y, 0.1875 -> 11 y, 0.5 -> 25 y, 1 -> 90 y."""
    points = [(1, 0.0), (11, 0.1875), (25, 0.5), (90, 1.0)]
    years = min(max(years, 1), 90)
    for (y0, p0), (y1, p1) in zip(points, points[1:]):
        if years <= y1:
            return p0 + (p1 - p0) * (years - y0) / (y1 - y0)
    return 1.0


def load_model():
    import anny
    return anny.Anny(local_changes='default', facial_actions='all').to(dtype=torch.float32)


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
        v = vertices[0].detach().numpy() @ TO_YUP.T
        mesh = trimesh.Trimesh(v, self.model.faces.numpy(), process=False)
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
    heads = out['rest_bone_heads'][0].detach().numpy()
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


def build(profile: dict, out_dir: Path) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    model = load_model()
    phenotypes, local_changes = BodyFitter(model).fit(profile)
    with torch.no_grad():
        out = model(phenotype_kwargs=phenotypes, local_changes_kwargs=local_changes)
        vertices = out['rest_vertices'][0].numpy().astype(np.float64)
        heads = out['rest_bone_heads'][0].numpy()
    pelvis = heads[model.bone_labels.index('root')]
    up = vertices @ TO_YUP.T
    offset = np.array([-(pelvis @ TO_YUP.T)[0], -up[:, 1].min(), -(pelvis @ TO_YUP.T)[2]])
    def to_world(p): return np.asarray(p, dtype=np.float64) @ TO_YUP.T + offset
    up = up + offset
    faces = model.faces.numpy()
    mesh = trimesh.Trimesh(up, faces, process=False)

    marks = landmarks(model, out, to_world, mesh)
    measurements = measure(mesh, marks)

    # --- GarmentCode draping inputs ---
    mesh.export(out_dir / 'sim_body.obj')
    with open(out_dir / 'sim_body.yaml', 'w') as f:
        yaml.safe_dump({'body': {**measurements, 'body_sample': 'sim_body'}}, f, sort_keys=True)
    labels = model.bone_labels
    dominant = model.vertex_bone_indices[torch.arange(len(up)), model.vertex_bone_weights.argmax(dim=1)].numpy()
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
    with torch.no_grad():
        morphs = {}
        for action in model.facial_action_labels:
            shaped = model(phenotype_kwargs=phenotypes, local_changes_kwargs=local_changes,
                           facial_actions={action: 1.0})['rest_vertices'][0].numpy()
            morphs[action] = (shaped - out['rest_vertices'][0].numpy()) @ TO_YUP.T
        bone_world = out['rest_bone_poses'][0].numpy().astype(np.float64)
    rot = np.eye(4); rot[:3, :3] = TO_YUP
    shift = np.eye(4); shift[:3, 3] = offset
    bone_world = np.einsum('ij,njk->nik', shift @ rot, bone_world)
    uv = model.texture_coordinates.numpy()
    # Skeleton + skin weights for binding garments to the same rig without reloading Anny.
    np.savez_compressed(out_dir / 'skeleton.npz', bone_names=np.array(labels), bone_parents=np.array(model.bone_parents),
                        bone_world=bone_world, vertex_joints=model.vertex_bone_indices.numpy(),
                        vertex_weights=model.vertex_bone_weights.numpy(), positions=up, faces=faces)
    write_skinned_glb(
        out_dir / 'body.glb', positions=up, faces=faces, uv=uv,
        face_uv=model.face_texture_coordinate_indices.numpy(),
        joint_indices=model.vertex_bone_indices.numpy(), joint_weights=model.vertex_bone_weights.numpy(),
        bone_names=list(labels), bone_parents=list(model.bone_parents), bone_world=bone_world,
        morphs=morphs, skin_rgb=profile.get('skin_rgb', (0.78, 0.57, 0.44)),
    )
    report = {'profile': profile, 'phenotypes': phenotypes, 'local_changes': local_changes,
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
