# Thread: project audit and technology reassessment

Date: 13 October 2026. This is an assessment only. No production code was changed.

## How to read the evidence

Each claim is tagged with where it comes from:

- **[Code]** I checked it myself in this repository, either by reading the source or by running it.
- **[Src]** It comes from the research pass, which checked primary sources (licence files, official docs, repositories, papers). The URL is listed in the Sources section. I did not re-check every one of these myself.
- **[Hyp]** It is a technical hypothesis or judgement. A proof-of-concept (Section E) still has to confirm it.

---

## A. Audit of the current project

### What actually exists

| Area | State | Evidence |
|---|---|---|
| Wardrobe data, locks, shuffle, saved looks, wears, feedback | **Works (logic level)** | [Code] `src/domain/*`. `npm test` gives **119/119 passing** (I re-ran it today). |
| Rule-based stylist | **Works.** It is decent and scored (formality, warmth, recency, feedback, colour). | [Code] `src/domain/stylist.ts` |
| Claude styling and tagging | **Built.** Schema-bounded, opt-in and cached. It has only been tested against a mocked provider. | [Code] `src/domain/aiStyling.ts`, `claude.ts`. The docs say no real call was made. |
| Weather | **Works.** Open-Meteo, which is free and needs no key. | [Code] `src/domain/weather.ts` |
| Encrypted backup and Supabase sync | **Built and tested** | [Code] tests |
| Three-tab shell (Home / Dressing Room / Profile) | **Built.** It has never been seen on a real device. | [Code] `App.tsx`, and `docs/dressing-room-progress.md` says "recapture: native screenshots missing" |
| **3D avatar** | **Placeholder only.** See the first finding below. | [Code] `scripts/build-avatar.mjs`, `src/ui/avatarScene.ts` |
| **3D garments** | **Placeholder only.** Each of the 8 categories has one primitive shape. Only the colour changes, plus a horizontal "fit" scale of ×1.06 or ×0.97. | [Code] `dressAvatar()` |
| Dressing room | Built from box and cylinder primitives | [Code] `src/ui/roomScene.ts` |
| ARKit live face scan | **Written but never compiled.** It captures ARKit's face *mask* mesh and textures it with one photo. | [Code] `modules/thread-face-scanner/ios/*.swift`. The docs say Swift was never built. |
| Photogrammetry worker (COLMAP + OpenMVS + U2Net on the PC) | **Works on one architectural benchmark** (Sceaux Castle). It has never been run on a face, body or garment. | [Code] `local-engine/reconstruct.py` and the verification doc |
| Job server, phone↔PC HTTPS pairing, auth, retries | Built and tested at unit level | [Code] `server/*` |
| Legacy FASHN and OpenAI try-on server | Disabled, but the code is still present | [Code] `server/tryon.ts`, `server/service.ts` |

### Key findings

1. **The avatar is a mannequin built from spheres and cylinders.**
   - `build-avatar.mjs` assembles the body from `SphereGeometry`, `CylinderGeometry` and lofted ellipses.
   - The arms are rigid meshes parented to two bones. There is no skinned mesh, so nothing deforms.
   - "Face customisation" consists of 7 hand-written vertex morphs on primitive spheres.
   - **None of this can be iterated toward realism.** It has to be replaced, not improved.

2. **The garments are not garments.** A "shirt" is a loft shell around the torso, and every shirt in the wardrobe renders as the same shape in a different colour enum. The photos of the user's real clothes never reach the 3D view.

3. **The "real likeness" path stacks two weak steps.**
   - The ARKit module produces the face-only mask mesh, with no ears, hair, back of head or neck. [Src] Apple ARFaceGeometry
   - It is textured from a single front photo.
   - `attachFaceScan()` then scales it uniformly onto the primitive head position and hides the primitive head.
   - **[Hyp]** The result will look like a mask floating on a mannequin.

4. **Photogrammetry is the wrong tool for people and soft clothes.**
   - COLMAP/OpenMVS assume a rigid, textured, static subject.
   - A self-captured head moves, and skin is low-texture.
   - A garment's shape in photos is not the shape it takes when worn: it is folded, flat or hanging.
   - So even a perfect reconstruction gives a "statue" that cannot be fitted.
   - The code itself labels garment output `not_fitted`. **It is still the right tool for rigid items: shoes, bags and eyewear.**

5. **Many safeguards, little visual proof.** The project has about 20 docs and 119 tests, mostly covering invariants, privacy and job plumbing. **Not one screenshot from a real phone exists.** The engineering discipline is real, but it has been spent around the hard problem rather than on it.

6. **Housekeeping risks:**
   - **No git repository.** Nothing can be reverted.
   - Stray OpenMVS logs sit at the project root.
   - `.runtime` takes 1.3 GB.
   - The source is written in very dense one-line style, which is hard to review or maintain.
   - The docs record 27 open `npm audit` findings.
   - Legacy paid-provider code is still in `server/`.

### What is worth keeping

- The whole wardrobe domain layer, the stylist, Claude styling, weather, backup and sync, and their tests.
- The navigation shell, theme and privacy screens.
- The **PC worker infrastructure**: job queue, checkpoints, authenticated HTTPS pairing and the progress UI. The pipeline it runs changes, but the plumbing carries over.
- The ARKit Expo module **as a skeleton**: pose gating, consent and review flow. It will be repurposed to capture TrueDepth RGB-D frames and blendshapes.
- COLMAP/OpenMVS, kept only for rigid accessories.

---

## B. Technology research: keep, improve, replace or drop

| Current choice | Verdict | Replacement or why | Evidence |
|---|---|---|---|
| three.js r180 on expo-gl | **Replace** for the dressing room. Keep it for 2D/simple fallbacks. | **react-native-filament** (Google Filament, MIT, v1.11 from May 2026). It renders natively with Metal and Vulkan, and has skinning, morph targets, image-based lighting (IBL) and cascaded shadows. The Filament core also has fabric **sheen**, clearcoat and a subsurface (skin) material model. expo-gl cannot upload compressed textures (KTX2) and has no multisample anti-aliasing (MSAA) render targets. | [Src] expo-gl docs, react-native-filament releases, Filament README |
| Procedural primitive avatar | **Drop** | Use a real parametric human. See below. | [Code] |
| ARKit face mask with one-photo texture | **Repurpose** | Capture the TrueDepth neutral and turn frames, plus ARKit blendshapes, as *input* to a head-fitting step. Do not use the mask as the asset. | [Src] Apple docs |
| COLMAP/OpenMVS for face, body and garments | **Drop for people and clothes. Keep for rigid accessories.** | Not suitable for non-rigid or worn shapes. OpenMVS is AGPL and contains a research-only component, which is acceptable for personal use only. | [Code], [Src] verification doc |
| U2Net / rembg | **Keep or upgrade** | BiRefNet (MIT) gives better garment edges. SAM 2 (Apache-2.0) is useful for sleeve and collar parts. | [Src] |
| Claude for styling and tagging | **Keep and expand** | Also use it to estimate garment *pattern parameters* from photos (see D3). Research suggests a vision model can drive sewing-pattern generation without training. | [Src] ChatGarment, NGL-Prompter |
| FASHN 2D try-on (paid) | **Drop** | Paid. Open alternatives are mostly non-commercial (see below). | [Src] |

### Body model options

| Option | Licence | Verdict |
|---|---|---|
| SMPL / SMPL-X | Non-commercial research only | **Avoid.** Most research code depends on it, and that is the trap. |
| **Anny** (NAVER, v0.6 from Aug 2026) | Code Apache-2.0, assets CC0 (based on MakeHuman) | **Strong candidate.** It has phenotype controls (height, weight, age…) calibrated to population data, and rigs of 104 or 163 bones. |
| **MHR** (Meta Momentum Human Rig) | Apache-2.0 | **Strong candidate.** 45 identity parameters, 72 facial-expression blendshapes, 7 levels of detail (LODs), and it is the output of SAM 3D Body. |
| **MetaHuman** | Since UE 5.6 it may be used in any engine. Royalty-free below $1M revenue. Must not be used to train AI. | **Best realism per hour of work.** Mesh-to-MetaHuman / "From Video Footage" builds a rigged identity from **iPhone TrueDepth** captures on a Windows PC running UE 5.6. The catch is the effort of exporting to glTF and building mobile LODs. |

### Head options

| Option | Licence | Verdict |
|---|---|---|
| FLAME | Classic versions are academic-only. The **2023 Open** version is CC-BY-4.0. | Usable only as the 2023 Open version. Fitters such as DECA, EMOCA and MICA are non-commercial. SMIRK is MIT. |
| **LAM** (one selfie → animatable Gaussian head driven by ARKit blendshapes, claimed 110 FPS on a Xiaomi 14) | Code Apache-2.0, **weights CC BY-NC** | **Best photoreal likeness from one photo, but only as a personal-use experiment.** A Gaussian head on a mesh body with mesh clothes will show a seam and a lighting mismatch, and there is no mature native React Native splat renderer. |
| Ready Player Me | — | **Dead.** Services shut down 31 Jan 2026. |
| Avaturn | — | Paid. |

### Garment reconstruction options

| Approach | Verdict |
|---|---|
| Generic image-to-3D (TRELLIS, Hunyuan3D, SAM 3D Objects) | **Reject for clothing.** These produce closed, rigid "statues" with no panels or rest shape. They also need 16–32 GB of VRAM (your GPU has 8 GB), and TRELLIS depends on nvdiffrast, which is non-commercial. Hunyuan3D's licence excludes the EU, UK and South Korea. |
| Photo → sewing pattern with a research model (SewFormer, AIpparel, ChatGarment) | Research quality. Licences are missing, non-commercial or unverified. The idea is valid; the code cannot be shipped as-is. |
| **Parametric sewing templates (GarmentCode, MIT) + Claude estimating parameters + photo projected onto flat panels + offline drape** | **Recommended.** Each piece is licensable and fits 8 GB. The compromise is that the silhouette is approximate while the look (colour, print, texture) comes from the actual photo. |
| Draping and simulation | Use mainline **NVIDIA Warp (Apache-2.0)**. The GarmentCode fork of Warp is research-only, so its drape step has to be re-implemented. HOOD and ContourCraft have MIT code but depend on SMPL. |
| Skinning garments to the body | **Robust Skin Weights Transfer** (MIT). |
| 2D AI try-on (IDM-VTON, CatVTON, OOTDiffusion, FitDiT) | All CC BY-NC-SA. **Qwen-Image-Edit (Apache-2.0)** is the only licensable base. **[Hyp]** On 8 GB it needs heavy quantisation. It could serve as an optional "photo preview" later. It cannot replace interactive 3D. |

---

## C. Feasibility, stated plainly

| Goal | Status today | Notes |
|---|---|---|
| A 3D self that friends recognise | **Achievable with compromise.** | **[Hyp]** MetaHuman from TrueDepth gives a *recognisable*, well-rigged, game-quality likeness. It is not a photographic replica: skin pores, exact hair and stubble will be approximations. Gaussian methods (LAM) look more photographic but do not combine well with clothes on mobile. |
| An exact digital twin with a scan-accurate face *and* body, photoreal on a phone | **Research-level.** | Nobody ships this on phones today. Apple Personas is visionOS-only with no export. Meta Codec Avatars is research only. |
| Correct body proportions | **Achievable with user input.** | Image-only methods are off by about **5–10 cm** in circumference (SHAPY benchmark). A purpose-trained model using photos plus height and weight reached about 2 cm, but it is proprietary (Amazon Halo). **Ask for height plus 3–5 tape measurements, and refine from photos.** |
| Live camera scan with facial expressions | **Achievable on iPhone.** | ARKit gives 52 blendshape coefficients live. Retarget them to a rig with ARKit-named blendshapes; MetaHuman and MHR are both compatible. |
| Snapchat-simple manual editing, but realistic | **Achievable.** | Expose a small number of parametric sliders (body phenotype, a few face controls, hair and skin presets) as morph targets in the GLB. |
| Photos of your real clothes on your avatar | **Achievable with compromise.** | Category templates are fitted to the photo, the photo supplies the texture, and the drape is baked offline. Expect approximate cut, seams at panel edges, and baked wrinkles. Unusual cuts fall back to the nearest template. |
| Clothes that fit and do not clip | **Achievable for 1–3 layers, if pre-baked.** | Offline Warp drape on the user's body, then skinning, then hiding body triangles under opaque cloth. |
| Real-time cloth physics on the phone | **Do not plan for this.** | Baked drape plus pose-corrective shapes is the industry approach. |
| Exact garment geometry from 1–2 photos | **Research-level.** | Papers from 2026 (NGL-Prompter, PatternGSL) are promising but have no released code. |
| Daily outfit recommendations | **Achievable now.** | The stylist, Claude and weather pieces already exist. They need real-device validation, not new technology. |

---

## D. Recommended architecture

```
 iPhone (dev build)                         Windows PC worker (existing server, new jobs)
 ─────────────────                          ───────────────────────────────────────────
 1 Capture user ─ TrueDepth RGB-D + poses ─▶ 2 Avatar build:
   + height/tape measurements                  Face: MetaHuman identity (UE 5.6)  ◀ PoC-2 decides
   + 2 full-body photos                        Body: parametric fit to measurements, photo refine
                                               Export: GLB, skinned, ARKit-52 blendshapes,
                                                       mobile LOD, KTX2 textures
 3 Capture garment ─ flat-lay front/back ───▶ 4 Garment build:
   (rigid items: orbit photos)                 BiRefNet mask → Claude → GarmentCode params
                                               → pattern → photo warped onto panels
                                               → Warp drape on user body → skin weights
                                               → GLB per garment (+ layer offset)
                                               Rigid items: existing COLMAP/OpenMVS
 5 Dressing room (react-native-filament) ◀─── GLBs downloaded, stored locally
   skinned avatar + skinned garments on the same skeleton,
   IBL + 1 shadow light, orbit, idle/expression clips,
   lock / shuffle / save (existing domain code)
 6 Recommendations: existing stylist + Claude + Open-Meteo,
   plus garment attributes extracted by Claude at capture time
```

### Design rules

- **One skeleton.** The body and every garment share the body's skeleton, which makes layering and animation straightforward.
- **Heavy work on the PC, display on the phone.** All reconstruction, draping and baking runs on the PC worker. The phone only renders and handles UX. This matches your hardware and the free-tools constraint.
- **Re-bake when the body changes.** Garment drapes are baked per body. A changed body triggers a background re-bake. Each outfit *combination* gets a cheap layer-offset pass, and a full re-drape only when clipping is detected.
- **Privacy stays as built.** Raw captures stay on the PC, deletion stays explicit, and Claude receives only reduced images with consent.

---

## E. Proof-of-concept plan

Run these on real hardware with your real face and clothes. Each one has a pass/fail gate.

| # | Experiment | Pass criteria | Effort |
|---|---|---|---|
| **P0** | Dev-build pipeline: get an Expo dev client with react-native-filament onto your iPhone, then hot-reload a JS change over LAN. | Install once, then JS edits appear in under 5 s with no rebuild. | 1–2 days, but blocked on the Apple decision (see F) |
| **P1** | Renderer: a skinned human GLB (MHR or Anny LOD) plus 3 skinned garment GLBs, with IBL, shadow and orbit, in Filament on your iPhone. Compare against the same scene in three.js on expo-gl. | Steady ≥55 fps while orbiting, scene memory under 500 MB, cold load under 3 s. Side-by-side screenshots judged "premium" by you. | 3–4 days |
| **P2** | Head likeness bake-off on *your* face: (a) MetaHuman from TrueDepth, (b) LAM from one selfie (reference ceiling, personal use only), (c) ARKit mask plus projected texture (current approach). | 5 people who know you rank the three blind against a photo. (a) must be rated "clearly you" by at least 4 of 5. It must also export to a mobile GLB under 80k triangles with working ARKit blendshapes. | 4–6 days |
| **P3** | Body fit: fit Anny or MHR to your height plus tape measurements, refined with 2 photos. | Re-measure the mesh: girth error ≤2 cm, height error ≤1 cm. Overlaying the photo silhouette gives intersection-over-union (IoU) ≥0.9. | 2–3 days |
| **P4** | Garment pipeline on 3 of your real items (a tee, jeans and an overshirt or jacket): Claude estimates parameters, GarmentCode builds the pattern, the photo is warped onto it, Warp drapes it on the P3 body, then skin weights are transferred. | You recognise each item at a glance. Sleeve and hem length are within 3 cm of the real garment. Zero visible poke-through in the A-pose and in 3 test poses. Each GLB is under 10k triangles and under 4 MB. | 1.5–2 weeks (the hardest experiment) |
| **P5** | Layering: tee + overshirt + jacket, all combinations. | No clipping after the offset pass. Re-bake time on the PC under 2 minutes per combination. | 3–4 days |

**Kill criteria:**

- If P2(a) fails the likeness test, the fallback is a stylised-realistic head driven by sliders. Do not chase scan fidelity further.
- If P4 fails, ship category templates with photo textures (skip the Claude parameter step) while the 2026 image-to-pattern research matures.

---

## F. Roadmap

### Decisions only you can make, before any work starts

1. **Apple Developer Program ($99/yr) or the MacBook.**
   - Installing any custom native build on an iPhone, which includes ARKit and Filament, requires either the paid programme with EAS cloud builds, or a Mac with Xcode using a free 7-day signing profile.
   - Expo Go cannot load these native modules.
   - This conflicts with "no paid dependencies." The alternative is waiting for the Mac.
   - Either way, after one install, JS changes hot-reload with no rebuild.
   - The EAS free tier gives 15 iOS builds per month. [Src] Expo pricing, Expo docs, Apple membership comparison
2. **Personal-only or distributable.**
   - Personal use opens up non-commercial-weight tools (LAM, CatVTON) and AGPL OpenMVS.
   - Distribution limits the stack to Apache, MIT, CC0 and MetaHuman terms.
   - I recommend building on the licensable stack either way, and treating the non-commercial tools only as experiments.

### Phases

- **Phase 0, hygiene (1–2 days):**
  - `git init` and commit the baseline.
  - Move the stray logs out of the root.
  - Quarantine the legacy try-on server code.
  - Set up the dev-client build profile (the existing `eas.json` already has one).
- **Phase 1, proofs P0–P3 (2–3 weeks).** This settles the renderer, head and body questions with real evidence.
- **Phase 2, avatar productisation:**
  - Change the PC worker's jobs from photogrammetry to avatar build.
  - Repurpose the ARKit module into TrueDepth capture.
  - Build the Home tab on Filament with idle and expression clips.
  - Add slider customisation as morph targets.
  - Retire `build-avatar.mjs` and `avatarScene.ts`.
- **Phase 3, proofs P4–P5, then the garment pipeline:**
  - Capture UX for flat-lay front and back.
  - Claude tagging of attributes and parameters, extending the existing `ai.ts`.
  - Bake jobs on the PC.
  - Garment GLB storage linked to the existing `Garment` records. This needs one new field, an asset reference.
  - Rigid accessories keep using COLMAP.
- **Phase 4, the dressing-room experience:**
  - Put the outfit, lock, shuffle and save domain logic, which already exists and is tested, behind the Filament view.
  - Replace the primitive room with one authored environment or an HDRI backdrop.
  - Run real-device performance and accessibility passes.
- **Phase 5, intelligence:**
  - Daily recommendations using the extracted garment attributes, weather and wear history. The code mostly exists.
  - Validate it with real Claude calls on your account.
- **Later and optional:**
  - A 2D photoreal preview through Qwen-Image-Edit on the PC.
  - Re-evaluate Gaussian heads and the 2026 image-to-pattern models once their code and licences are public.

### Why this beats the current approach, in one line each

- **Filament over expo-gl:** native PBR, skin and fabric materials, and compressed textures, instead of a WebGL subset that cannot load KTX2.
- **Parametric body over primitives:** a rigged, measurable, deformable human, instead of rigid spheres.
- **MetaHuman or fitted head over the ARKit mask:** a complete head with a rig, instead of a floating face mask. P2 measures this directly.
- **Templates plus photo texture plus baked drape over photogrammetry:** a fittable cloth surface, instead of a statue that the code itself labels `not_fitted`.
- **The PC worker is kept:** the same infrastructure runs jobs that can actually succeed.

---

## Sources

From the research pass (primary sources):

- **Rendering and build**
  - https://docs.expo.dev/versions/latest/sdk/gl-view/
  - https://github.com/margelo/react-native-filament
  - https://github.com/google/filament
  - https://github.com/wcandillon/react-native-webgpu
  - https://expo.dev/pricing
  - https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/
  - https://developer.apple.com/support/compare-memberships/
- **Face and body**
  - https://developer.apple.com/documentation/arkit/arfacegeometry
  - https://flame.is.tue.mpg.de/modellicense.html
  - https://github.com/aigc3d/LAM
  - https://github.com/facebookresearch/sam-3d-body
  - https://github.com/facebookresearch/MHR
  - https://github.com/naver/anny
  - https://smpl-x.is.tue.mpg.de/modellicense.html
  - https://arxiv.org/html/2206.07036 (SHAPY measurement errors)
  - https://pmc.ncbi.nlm.nih.gov/articles/PMC10495406/
  - https://dev.epicgames.com/documentation/metahuman/from-video-footage
- **Garments**
  - https://github.com/maria-korosteleva/GarmentCode
  - https://github.com/maria-korosteleva/NvidiaWarp-GarmentCode/blob/main/LICENSE.md
  - https://github.com/biansy000/ChatGarment
  - https://arxiv.org/abs/2602.20700
  - https://github.com/NVIDIA/warp
  - https://github.com/rin-23/RobustSkinWeightsTransferCode
  - https://github.com/NVlabs/nvdiffrast/blob/main/LICENSE.txt
  - https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/main/LICENSE
  - https://github.com/Zheng-Chong/CatVTON
  - https://huggingface.co/Qwen/Qwen-Image-Edit-2509

### Not yet verified

- Licences for the ChatGarment, AIpparel and GarmentCodeData weights.
- Which compressed-texture extensions react-native-filament actually exposes.
- VRAM requirements for SAM 3D Body.
- The detailed MetaHuman glTF export workflow.
- How accurate Claude is at estimating GarmentCode parameters.

P2 and P4 exist to answer the last two.
