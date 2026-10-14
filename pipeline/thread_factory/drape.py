"""Sew and drape a GarmentCode garment on a personal body (runs in the garment environment).

Research-licence component: uses the NVIDIA Warp fork shipped with GarmentCode (non-commercial use).

Usage (from pipeline/):
  scripts\\garment-python.cmd -m thread_factory.drape --design design.yaml --body output/body-demo --out output/drapes
Writes <out>/<name>/garment_sim.obj (+ GarmentCode pattern, segmentation, renders) and drape.json.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import time
from pathlib import Path

GARMENTCODE = Path(__file__).resolve().parents[1] / 'third_party' / 'GarmentCode'


def drape(design_file: Path, body_dir: Path, out_dir: Path, name: str, sim_config: Path | None = None, device: str | None = None) -> dict:
    design_file, body_dir, out_dir = design_file.resolve(), body_dir.resolve(), out_dir.resolve()
    sim_config = sim_config.resolve() if sim_config else None
    os.chdir(GARMENTCODE)  # GarmentCode resolves ./system.json and ./assets relative to its root
    sys.path.insert(0, str(GARMENTCODE))
    import yaml
    from assets.bodies.body_params import BodyParameters
    from assets.garment_programs.meta_garment import MetaGarment
    from pygarment.data_config import Properties
    from pygarment.meshgen.boxmeshgen import BoxMesh
    from pygarment.meshgen.sim_config import PathCofig
    from pygarment.meshgen.simulation import run_sim
    import warp as wp
    wp.init()
    # The simulator follows Warp's current device: the GPU when one is usable, else the CPU (LLVM kernels).
    wp.set_device(device or ('cuda:0' if wp.is_cuda_available() else 'cpu'))
    device = wp.get_device().name if wp.get_device().is_cuda else 'cpu'  # e.g. 'NVIDIA GeForce RTX 5050 Laptop GPU'


    out_dir.mkdir(parents=True, exist_ok=True)
    body = BodyParameters(str(body_dir / 'sim_body.yaml'))
    design = yaml.safe_load(design_file.read_text())['design']
    garment = MetaGarment(name, body, design)
    pattern = garment.assembly()
    if garment.is_self_intersecting():
        print(f'{name}: pattern panels self-intersect; simulation may fail')
    pattern_dir = Path(pattern.serialize(out_dir / 'patterns', tag='', to_subfolder=True,
                                         with_3d=False, with_text=False, view_ids=False))
    body.save(pattern_dir)
    shutil.copy(design_file, pattern_dir / 'design_params.yaml')

    # Mobile profile: 1.6 cm cloth vertex spacing (GarmentCode default 1 cm) keeps garments light on phones.
    props = Properties(str(sim_config or Path(__file__).resolve().parents[1] / 'sim' / 'mobile_sim_props.yaml'))
    props.set_section_stats('sim', fails={}, sim_time={}, spf={}, fin_frame={}, body_collisions={}, self_collisions={})
    props.set_section_stats('render', render_time={})
    paths = PathCofig(in_element_path=pattern_dir, out_path=out_dir, in_name=pattern_dir.name.rstrip('_'),
                      out_name=name, body_name='mean_all', smpl_body=False, add_timestamp=False)
    # Point GarmentCode at the personal body instead of its bundled mannequin.
    paths.in_g_spec = next(pattern_dir.glob('*_specification.json'))
    paths.in_body_mes = body_dir / 'sim_body.yaml'
    paths.in_body_obj = body_dir / 'sim_body.obj'
    paths.body_seg = body_dir / 'sim_body_segmentation.json'

    started = time.time()
    box = BoxMesh(paths.in_g_spec, props['sim']['config']['resolution_scale'])
    box.load()
    box.serialize(paths, store_panels=False, uv_config=props['render']['config']['uv_texture'])
    props.serialize(paths.element_sim_props)
    run_sim(box.name, props, paths, save_v_norms=False, store_usd=False, optimize_storage=False, verbose=False)
    props.serialize(paths.element_sim_props)
    stats = props['sim']['stats']
    result = {
        'name': name, 'sim_obj': str(paths.g_sim), 'seconds': round(time.time() - started, 1), 'device': device,
        'profile': (sim_config or Path('mobile_sim_props.yaml')).stem,
        'failed': bool(stats['fails']),
        'body_collisions': stats['body_collisions'].get(box.name),
        'self_collisions': stats['self_collisions'].get(box.name),
    }
    (paths.out_el / 'drape.json').write_text(json.dumps(result, indent=2))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--design', type=Path, required=True, help='GarmentCode design parameter YAML')
    parser.add_argument('--body', type=Path, required=True, help='folder produced by thread_factory.body')
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--name', default=None)
    parser.add_argument('--sim-config', type=Path, default=None)
    parser.add_argument('--device', default=None, help='cuda:0 or cpu (default: the GPU when available)')
    args = parser.parse_args()
    print(json.dumps(drape(args.design, args.body, args.out, args.name or args.design.stem, args.sim_config, args.device), indent=2))


if __name__ == '__main__':
    main()
