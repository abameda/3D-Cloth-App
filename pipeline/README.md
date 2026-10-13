# Thread asset factory (Windows)

Heavy processing runs here, on the Windows PC, and never on the phone. That covers body fitting, garment sewing and draping, skinning and asset export. The phone only downloads the finished, optimised GLB files and renders them interactively.

```
profile.json ──▶ thread_factory.body ──▶ body.glb                     (phone: skinned avatar, 52 ARKit expressions)
(height, sex,                         └▶ sim_body.obj/.yaml/.json     (draping body + GarmentCode measurements)
 tape measures)                       └▶ skeleton.npz                 (rig + weights for binding garments)

design.yaml ──▶ thread_factory.drape ──▶ garment_sim.obj ──▶ thread_factory.garment_glb ──▶ garment.glb
(GarmentCode     (sew + cloth simulation      (draped, UV'd        (skin-weight transfer,      (phone: skinned to the
 parameters)      on the personal body)        panels)              body-coverage mask)          avatar skeleton)
```

## Setup

Run once in PowerShell. No admin rights are needed. You need git, [uv](https://docs.astral.sh/uv/) and Visual Studio 2022 with the C++ workload.

```powershell
pipeline\setup.ps1
```

The script creates two **isolated** environments, so that the licences stay separable:

| Environment | Contents | Python |
|---|---|---|
| `envs/body` | Anny, PyTorch (CUDA 12.8), trimesh | 3.11 (uv) |
| `envs/garment` | GarmentCode, the NVIDIA Warp fork, and a user-level CUDA 12.8 toolkit from conda-forge/nvidia | 3.10 (micromamba) |

The Warp fork is built from source and given a small Windows patch (`patches/`). When no CUDA GPU is available, the simulator runs on the CPU using Warp's LLVM DLL. That DLL comes from the official `warp-lang` 1.0.0 wheel.

## Run

```powershell
# 1. Personal body from measurements
$env:ANNY_CACHE_DIR = "pipeline\tools\anny-cache"
pipeline\envs\body\Scripts\python.exe -m thread_factory.body --profile me.json --out pipeline\output\me

# 2. Sew and drape a garment on that body
pipeline\scripts\garment-python.cmd -m thread_factory.drape --design shirt.yaml --body pipeline\output\me --out pipeline\output\drapes --name shirt

# 3. Skinned garment for the phone
pipeline\envs\body\Scripts\python.exe -m thread_factory.garment_glb --sim pipeline\output\drapes\shirt\shirt_sim.obj --body pipeline\output\me --out pipeline\output\me\shirt.glb
```

Run the commands from the `pipeline` folder, or set `PYTHONPATH` to it. `profile.json` fields:

- `sex`: `male` or `female`
- `age`: years
- `height_cm`
- optional: `weight_kg`, `chest_cm`, `waist_cm`, `hips_cm`, `skin_rgb` (sRGB values from 0 to 1)

### From the phone (studio API)

`npm run server:reconstruction` serves `/v1/studio/*` next to the reconstruction API. It uses the same pairing token and the same HTTPS.

- **`PUT /v1/studio/body`** with measurements → fits the body, then re-drapes every fitted garment on the new shape.
- **`PUT /v1/studio/garments/:id`** with `{category, spec?, colorHex?}` → sews and drapes one piece. The `spec` comes from Claude's photo reading (`shape` → `specFromShape`). Without a spec, the category preset is used.
- **`GET /v1/studio/kit`** returns a manifest of SHA-256-addressed GLBs plus job progress. The phone downloads only what changed.

State lives in `.data/studio/<owner>/`, which is git-ignored and erasable with `DELETE /v1/studio`.

### Simulation profiles

| Profile | Use | Notes |
|---|---|---|
| `sim/mobile_sim_props.yaml` (default) | All garments | 1.6 cm cloth vertex spacing (GarmentCode default: 1 cm): ~2.5× fewer vertices, faster drape |
| `sim/mobile_fast_sim_props.yaml` | Bottoms on CPU | Cloth self-collision off. On CPU, self-collision between two close trouser legs costs about 9 s per frame; with a working CUDA GPU, use the default profile |

### Viewer

Start the `asset-viewer` launch configuration (`python -m http.server 8765 --directory pipeline`), then open `http://localhost:8765/viewer/index.html?files=me/body.glb,me/shirt.glb`.

## Measured results (13 Oct 2026)

**Measurement code vs GarmentCode's published reference bodies** (mean_all, mean_female, mean_male):
- Height, bust, waist, hips, underbust and thigh agree within about 1 cm.
- Back widths and line lengths agree within about 2–3 cm.

**Body fit, male demo profile** (178 cm, 100/84/98 cm): achieved 178.6 / 99.1 / 84.4 / 97.9 cm, all within 1 cm. CPU time is about 80 s.

**Drape:** the GarmentCode T-shirt on the default mannequin ran on CPU in 7.5 min and finished with 0 body–cloth intersections.

## Licences

Everything below runs locally and costs nothing. **Personal use only** while research-licensed parts are present.

| Component | Use | Licence | Commercial? | Isolation |
|---|---|---|---|---|
| [Anny](https://github.com/naver/anny) | Body model, rig, expressions | Code Apache-2.0; MakeHuman assets CC0 | Yes (do not use the `smplx` topology) | `envs/body` |
| [GarmentCode / pygarment](https://github.com/maria-korosteleva/GarmentCode) | Sewing patterns | MIT | Yes | `envs/garment` |
| [NvidiaWarp-GarmentCode](https://github.com/maria-korosteleva/NvidiaWarp-GarmentCode) | Cloth simulation | NVIDIA Source Code License: **research/evaluation only** | **No**, must be replaced (mainline Warp is Apache-2.0) | `envs/garment` only; nothing it produces ships with any code |
| warp-lang 1.0.0 `warp-clang.dll` | CPU kernel compiler | Apache-2.0 | Yes | `envs/garment` |
| CUDA toolkit (conda) | GPU build/runtime | NVIDIA EULA (redistribution restricted) | Local use | `envs/garment` |
| PyTorch, trimesh, scipy, shapely | Maths | BSD/MIT | Yes | both |

For commercial use, replace the Warp fork with an XPBD/VBD drape on mainline Warp or Newton (Apache-2.0). The draped meshes it produces are the user's own assets; the restriction applies to the simulator code.

## Privacy

`pipeline/output`, `pipeline/envs`, `pipeline/third_party`, `pipeline/tools` and all model weights are git-ignored. Personal measurements, scans and generated avatars never leave this computer, except as optimised GLBs sent to the paired phone.
