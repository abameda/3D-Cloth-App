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

### Simulation profiles and the GPU

Cloth simulation runs on the NVIDIA GPU whenever Warp sees one (`--device cpu` forces the CPU). The first GPU run after installing compiles Warp's simulation kernels for the card (about 60 s, cached afterwards).

| Profile (`sim/`) | Studio quality | Cloth | Self-collision | Use |
|---|---|---|---|---|
| `quality_sim_props.yaml` | High | 1 cm (GarmentCode native) | on | Default with an NVIDIA GPU |
| `mobile_sim_props.yaml` | Standard | 1.6 cm | on | Default without a GPU |
| `mobile_fast_sim_props.yaml` | Draft | 1.6 cm | off | Quick previews only |

Measured on an RTX 5050 Laptop GPU (8 GB) against this PC's Intel CPU, same garment pattern, same body, warm kernel caches (14 Oct 2026). Seconds are cloth simulation; each run adds about 5 s of sewing, meshing and preview rendering.

| Garment | Profile | CPU | GPU | Speed-up | Peak VRAM | Collisions (body / self) |
|---|---|---|---|---|---|---|
| T-shirt | Standard | 184.0 s | 8.3 s | 22× | 230 MB | 0 / 0 |
| T-shirt | High | not run | 17.8 s | | 342 MB | 0 / 3 |
| Trousers | Draft (old CPU default) | 61.2 s | 8.4 s | 7× | 253 MB | 0 / 0 |
| Trousers | Standard | 283.9 s | 9.3 s | 31× | 254 MB | 0 / 0 |
| Trousers | High | not run | 23.7 s | | 482 MB | 0 / 0 |

What the extra resolution buys, seen in Thread Studio: at 1.6 cm the tee's neckline and sleeve hems look ragged in a relaxed pose; at 1 cm the edges are clean and the sleeves fold naturally. The phone cost: a tee goes from 7.7k to 19.6k triangles (0.5 → 1.1 MB) and trousers from 10.7k to 27.4k (0.7 → 1.4 MB). A full outfit on the body is about 75k triangles.

Every garment also carries a small tiling normal map (`thread_factory/fabric.py`): jersey knit for tops, twill for trousers and outerwear, repeated at real size through `KHR_texture_transform`. It gives cloth the light response of yarn instead of smooth plastic.

Rigging a garment for the phone (skin weights, skin hiding, tuck morph, photo texture) stays on the CPU and is now quick: a cold run for a 1 cm photo-textured tee went from 32 s to 7 s. Most of the gain came from two changes. U2-Net now runs directly through ONNX Runtime, with rembg's exact pre- and post-processing and an identical mask, so the 8–10 s rembg import is gone. Nearest-surface and ray queries now use Warp's BVH on the CPU: 0.03 s versus 1.6 s in trimesh, results within 1 µm. A GPU has nothing left to win in this stage.

Photo textures now switch between the front and back photo along the garment's real sewing seams, using GarmentCode's per-vertex panel labels. Previously each triangle chose its photo from its normal, which left a zigzag of white shards along side seams and sleeves. Sideways cloth (sleeve undersides, side seams) samples only the clean interior of the photo, a few pixels inside the outline, where colour isn't mixed with the background. That removes the pale patches. Vertices also share UVs, so a 1 cm photo tee is 1.3 MB instead of 4.8 MB.
The body build stays on the CPU: its fits are hundreds of sequential steps on one small mesh, where GPU launch overhead dominates (selfie body: 90 s on the CPU, 231 s on the GPU). Computing all 52 expressions in one batched pass cut that stage from 14 s to 3 s; a selfie body now takes about 65 s. `THREAD_DEVICE=cuda` opts the body into the GPU.
### Thread Studio (inspect and operate everything on Windows)

Double-click `Thread-Studio.cmd` in the project root. It creates a private engine token on first run, starts the local engine (the same process the phone talks to) and opens the studio at `http://127.0.0.1:8790/studio/`. Keep its window open; close it to stop.

- **Kit**: your studio kit (exactly what the phone downloads) or any command-line output folder in `pipeline/output`.
- **Outfit**: pick a top, bottom, outerwear, one-piece and shoes; empty slots show the neutral base layer. Dressing, layering, tucking and skin hiding run the phone's own rules (`src/domain/kitDressing.ts`).
- **Scene**: camera presets (front, ¾, side, back, face, torso, feet), turntable, poses (bind, relaxed breathing, walk, arms out, knee bend), all 52 facial expressions, four lighting setups, wireframe, skeleton, and a switch to show the skin hidden under cloth.
- **Factory**: enter measurements (and optionally a selfie) to build your body; add garments with flat-lay photos. Jobs and their stages appear live; finished pieces load automatically.
- **Screenshot** saves a PNG of the current view.

### Body outputs (since 13 Oct 2026)

Besides `body.glb`, `hair.glb` and the shoe stand-ins, every body build writes:

- `base_bottom.glb` (trunks or briefs) and, for women, `base_top.glb` (bralette): skin-tight underwear cut from the body surface along smooth outlines, skinned with the body's own weights. The phone and studio show them only for empty slots.
- `skin_atlas.jpg`: CC0 MakeHuman skin photography for the right sex and age, tone-matched to the person (or to the selfie), with the head given half of the texture. A selfie is projected onto the face and colour-matched at its edges; the scalp under the hair takes the hair colour.

Eye textures are recoloured to natural iris tones (MakeHuman's own "brown" reads orange-red).
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
