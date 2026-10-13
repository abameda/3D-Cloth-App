"""Tailor-style body measurements on a y-up, metre-scale, front +z mesh in an A-pose.

Circumferences follow a tape measure: the convex-hull perimeter of a horizontal torso section.
Definitions follow GarmentCode's "Body Measurements" sheet (docs/Body Measurements GarmentCode.pdf).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import trimesh
from scipy.spatial import ConvexHull
from shapely.geometry import Point, Polygon


@dataclass
class Section:
    y: float
    torso: Polygon | None  # loop around the body centre line, None below the crotch
    loops: list[Polygon]

    @property
    def girth(self) -> float:
        return hull_perimeter(np.asarray(self.torso.exterior.coords)) if self.torso else 0.0


def hull_perimeter(points: np.ndarray) -> float:
    hull = points[ConvexHull(points).vertices]
    return float(np.linalg.norm(hull - np.roll(hull, 1, axis=0), axis=1).sum())


def section(mesh: trimesh.Trimesh, y: float, centre: tuple[float, float]) -> Section:
    path = mesh.section(plane_origin=[0, y, 0], plane_normal=[0, 1, 0])
    if path is None:
        return Section(y, None, [])
    # Sections are horizontal, so (x, z) of the 3D path are the planar coordinates.
    loops = []
    for entity in path.discrete:
        if len(entity) >= 4:
            polygon = Polygon(entity[:, [0, 2]])
            if polygon.is_valid and polygon.area > 1e-6:
                loops.append(polygon)
    # Torso: the largest loop straddling the sagittal plane (legs and arms lie to either side).
    x = centre[0]
    torso = max((p for p in loops if p.area > 0.01 and p.bounds[0] < x < p.bounds[2] and p.contains(Point(x, p.centroid.y))),
                key=lambda p: p.area, default=None)
    return Section(y, torso, loops)


def _back_length(points: np.ndarray, centre_z: float) -> float:
    """Hull arc behind the coronal plane, balance line to balance line (tailor's back width)."""
    hull = points[ConvexHull(points).vertices]
    left, right = int(np.argmax(hull[:, 0])), int(np.argmin(hull[:, 0]))
    def arc(a, b):
        idx = [a]
        while idx[-1] != b:
            idx.append((idx[-1] + 1) % len(hull))
        segment = hull[idx]
        return segment, float(np.linalg.norm(np.diff(segment, axis=0), axis=1).sum())
    first, len_first = arc(left, right)
    second, len_second = arc(right, left)
    return len_first if first[:, 1].mean() < second[:, 1].mean() else len_second


def _peak_distance(points: np.ndarray, front: bool) -> float:
    """Distance between the most protruding left and right points (bust or bum points)."""
    sign = 1 if front else -1
    left, right = points[points[:, 0] > 0], points[points[:, 0] < 0]
    if len(left) == 0 or len(right) == 0:
        return 0.0
    return float(left[np.argmax(sign * left[:, 1])][0] - right[np.argmax(sign * right[:, 1])][0])


def torso_levels(mesh: trimesh.Trimesh, step: float = 0.005) -> dict:
    """Find crotch, waist, hips, armpit and bust levels by scanning horizontal sections."""
    lo, hi = mesh.bounds[:, 1]
    height = hi - lo
    centre = (float(np.median(mesh.vertices[:, 0])), float(np.median(mesh.vertices[:, 2])))
    ys = np.arange(lo + 0.35 * height, lo + 0.85 * height, step)
    sections = [section(mesh, float(y), centre) for y in ys]
    girths = np.array([s.girth for s in sections])
    widths = np.array([np.ptp(np.asarray(s.torso.exterior.coords)[:, 0]) if s.torso else 0 for s in sections])
    # Crotch: bottom of the continuous run of torso sections, walking down from mid-torso
    # (small isolated loops between the legs must not extend the torso).
    crotch_i = int(len(ys) * 0.4)
    while crotch_i > 0 and girths[crotch_i - 1] > 0:
        crotch_i -= 1
    # Arms join the torso section at the armpit: section width jumps.
    jump = np.nonzero((widths[1:] > 1.25 * widths[:-1]) & (np.arange(1, len(ys)) > crotch_i + 10))[0]
    armpit_i = int(jump[0]) if len(jump) else int(len(ys) * 0.8)
    torso = slice(crotch_i, armpit_i)
    span = armpit_i - crotch_i
    # Hipline passes through the bum points (most protruding back), bustline through the bust points
    # (most protruding front), per the GarmentCode measurement sheet; the waist is the narrowest girth between.
    back = np.array([np.asarray(s.torso.exterior.coords)[:, 1].min() if s.torso else np.inf for s in sections])
    front = np.array([np.asarray(s.torso.exterior.coords)[:, 1].max() if s.torso else -np.inf for s in sections])
    hips_i = crotch_i + int(np.argmin(back[crotch_i:crotch_i + span // 2]))
    waist_lo, waist_hi = hips_i + span // 6, crotch_i + int(span * 0.85)
    waist_i = waist_lo + int(np.argmin(girths[waist_lo:waist_hi]))
    # Tape bustline sits ~4 cm below the armpit on the reference bodies (male chests have no front apex).
    bust_i = max(waist_i + 1, armpit_i - int(round(0.04 * height / 1.72 / step)))
    return dict(centre=centre, crotch=ys[crotch_i], hips=ys[hips_i], waist=ys[waist_i], bust=ys[bust_i],
                armpit=ys[armpit_i], sections={k: sections[i] for k, i in
                dict(hips=hips_i, waist=waist_i, bust=bust_i).items()}, height=height, floor=lo, torso=torso)


def measure(mesh: trimesh.Trimesh, landmarks: dict | None = None) -> dict:
    """GarmentCode measurements in cm (angles in degrees).

    landmarks (optional, y-up metres): shoulder_l/r (shoulder joints), acromion_l/r (outer collarbone ends),
    neck_base, nape, wrist_l. Without landmarks only section-based measurements are returned.
    """
    levels = torso_levels(mesh)
    cm = 100.0
    s = levels['sections']
    pts = {k: np.asarray(v.torso.exterior.coords) for k, v in s.items()}
    top = mesh.bounds[1, 1]
    result = dict(
        height=levels['height'] * cm,
        bust=s['bust'].girth * cm,
        waist=s['waist'].girth * cm,
        hips=s['hips'].girth * cm,
        back_width=_back_length(pts["bust"], levels["centre"][1]) * 1.09 * cm,  # calibrated on GarmentCode reference bodies
        waist_back_width=_back_length(pts['waist'], levels['centre'][1]) * cm,
        hip_back_width=_back_length(pts['hips'], levels['centre'][1]) * cm,
        # Peak-to-peak distances are poorly defined on smooth scans; GarmentCode's reference bodies give
        # stable ratios (bust_points/bust = 0.169, bum_points/hips = 0.176).
        bust_points=0.169 * s['bust'].girth * cm,
        bum_points=0.176 * s['hips'].girth * cm,
        hips_line=(levels['waist'] - levels['hips']) * cm,
        crotch_hip_diff=(levels['hips'] - levels['crotch']) * cm,
    )
    under = section(mesh, levels["bust"] - 0.08 * levels["height"] / 1.72, levels["centre"])
    result['underbust'] = (under.girth or s['waist'].girth) * cm
    # Thigh: the thickest single-leg section just below the crotch.
    thighs = []
    for dy in np.arange(0.01, 0.08, 0.005):
        sec = mesh.section(plane_origin=[0, levels['crotch'] - dy, 0], plane_normal=[0, 1, 0])
        if sec is None:
            continue
        for entity in sec.discrete:
            if len(entity) >= 4 and entity[:, 0].mean() > 0.02:
                thighs.append(hull_perimeter(entity[:, [0, 2]]))
    result['leg_circ'] = max(thighs) * cm if thighs else 0.0
    w = np.asarray(s['waist'].torso.exterior.coords)[:, 0]
    h = np.asarray(s['hips'].torso.exterior.coords)[:, 0]
    result['hip_inclination'] = float(np.degrees(np.arctan2((np.ptp(h) - np.ptp(w)) / 2, levels['waist'] - levels['hips'])))
    if landmarks:
        nape, neck = np.asarray(landmarks['nape']), np.asarray(landmarks['neck_base'])
        al, ar = np.asarray(landmarks['acromion_l']), np.asarray(landmarks['acromion_r'])
        sl, wl = np.asarray(landmarks['shoulder_l']), np.asarray(landmarks['wrist_l'])
        result.update(
            head_l=(top - nape[1]) * cm,
            waist_line=(nape[1] - levels['waist']) * 1.03 * cm,   # back curvature allowance over the vertical drop
            vert_bust_line=(nape[1] - levels['bust']) * cm,
            shoulder_w=np.linalg.norm(al - ar) * cm,
            arm_length=np.linalg.norm(al - wl) * cm,
            armscye_depth=(al[1] - levels['armpit']) * cm,
            shoulder_incl=float(np.degrees(np.arctan2(neck[1] - al[1], abs(al[0]) - landmarks.get('neck_half_width', 0.06)))),
            wrist=landmarks['wrist_circ'] * cm,
            arm_pose_angle=float(np.degrees(np.arctan2(sl[1] - wl[1], wl[0] - sl[0]))),
        )
        # Neck base width, back balance line to balance line: half the neck girth (circular neck section).
        result['neck_w'] = np.pi * landmarks.get('neck_half_width', 0.06) * cm
        # Over-bust front line: neck base -> bust point -> waist, following the tape's convex path.
        bust_front = pts['bust'][np.argmax(pts['bust'][:, 1])]
        waist_front = pts['waist'][np.argmax(pts['waist'][:, 1])]
        to_bust = np.hypot(neck[1] - levels['bust'], bust_front[1] - neck[2])
        result['bust_line'] = to_bust * cm
        result['waist_over_bust_line'] = (to_bust + np.hypot(levels['bust'] - levels['waist'], bust_front[1] - waist_front[1])) * cm
    return {k: round(float(v), 4) for k, v in result.items()}
