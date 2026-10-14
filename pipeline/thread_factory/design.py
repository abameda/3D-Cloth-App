"""Compact garment specs -> GarmentCode design parameter files.

A spec is {"preset": "<name>", "params": {"section.parameter": value, ...}}. Values override
GarmentCode's defaults (assets/design_params/default.yaml); unknown keys or out-of-range values are
rejected, so specs written by a vision model cannot produce invalid garments.
"""
from __future__ import annotations

import copy
from pathlib import Path

import yaml

DEFAULTS = Path(__file__).resolve().parents[1] / 'third_party' / 'GarmentCode' / 'assets' / 'design_params' / 'default.yaml'

# Starting points per wardrobe category. Garment-specific values come from the photo analysis.
PRESETS: dict[str, dict] = {
    'tshirt': {'meta.upper': 'Shirt', 'meta.bottom': None, 'meta.wb': None,
               'shirt.length': 1.2, 'shirt.width': 1.05, 'sleeve.length': 0.3, 'sleeve.sleeveless': False,
               'collar.f_collar': 'CircleNeckHalf', 'collar.b_collar': 'CircleNeckHalf'},
    'longsleeve': {'meta.upper': 'Shirt', 'meta.bottom': None, 'meta.wb': None,
                   'shirt.length': 1.25, 'shirt.width': 1.05, 'sleeve.length': 0.95, 'sleeve.sleeveless': False},
    'overshirt': {'meta.upper': 'Shirt', 'meta.bottom': None, 'meta.wb': None,
                  'shirt.length': 1.45, 'shirt.width': 1.2, 'sleeve.length': 0.95, 'sleeve.sleeveless': False},
    # GarmentCode's straight leg (flare 1.0) reads as wide-leg; regular trousers taper towards the hem.
    'trousers': {'meta.upper': None, 'meta.bottom': 'Pants', 'meta.wb': 'StraightWB', 'pants.length': 0.88, 'pants.flare': 0.8},
    # Relaxed hoodie: dropped, roomy body to the hip, long sleeves gathered into rib cuffs, two-panel hood.
    'hoodie': {'meta.upper': 'Shirt', 'meta.bottom': None, 'meta.wb': None,
               'shirt.length': 1.4, 'shirt.width': 1.25, 'sleeve.sleeveless': False, 'sleeve.length': 1.0,
               'sleeve.end_width': 0.75, 'sleeve.cuff.type': 'CuffBand', 'sleeve.cuff.cuff_len': 0.12,
               'collar.component.style': 'Hood2Panels', 'collar.f_collar': 'CircleNeckHalf', 'collar.b_collar': 'CircleNeckHalf'},
    # Sweatpants: elastic waistband, roomy straight legs.
    'sweatpants': {'meta.upper': None, 'meta.bottom': 'Pants', 'meta.wb': 'StraightWB', 'waistband.width': 0.35,
                   'pants.length': 0.88, 'pants.width': 1.3, 'pants.flare': 1.0},
    'shorts': {'meta.upper': None, 'meta.bottom': 'Pants', 'meta.wb': 'StraightWB', 'pants.length': 0.35},
    'skirt': {'meta.upper': None, 'meta.bottom': 'PencilSkirt', 'meta.wb': 'StraightWB'},
}


def _slot(design: dict, dotted: str) -> dict:
    node = design
    for key in dotted.split('.'):
        if not isinstance(node, dict) or key not in node:
            raise KeyError(f'Unknown GarmentCode parameter: {dotted}')
        node = node[key]
    if not isinstance(node, dict) or 'v' not in node:
        raise KeyError(f'Not a parameter: {dotted}')
    return node


def _check(slot: dict, dotted: str, value):
    kind, allowed = slot.get('type'), slot.get('range')
    if kind in ('float', 'int'):
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise ValueError(f'{dotted} must be a number')
        lo, hi = allowed
        if not lo <= value <= hi:
            raise ValueError(f'{dotted}={value} outside [{lo}, {hi}]')
    elif kind == 'bool':
        if not isinstance(value, bool):
            raise ValueError(f'{dotted} must be true/false')
    elif kind in ('select', 'select_null'):
        if value not in allowed and not (kind == 'select_null' and value is None):
            raise ValueError(f'{dotted}={value!r} not in {allowed}')


def design_from_spec(spec: dict) -> dict:
    design = copy.deepcopy(yaml.safe_load(DEFAULTS.read_text())['design'])
    values = {**PRESETS[spec['preset']], **spec.get('params', {})}
    for dotted, value in values.items():
        slot = _slot(design, dotted)
        _check(slot, dotted, value)
        slot['v'] = value
    return {'design': design}


def write_design(spec: dict, path: Path) -> Path:
    path.write_text(yaml.safe_dump(design_from_spec(spec), sort_keys=False))
    return path


def main():
    import argparse
    import json
    parser = argparse.ArgumentParser(description='Write a GarmentCode design file from a compact spec.')
    parser.add_argument('--spec', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    write_design(json.loads(args.spec.read_text()), args.out)


if __name__ == '__main__':
    main()
