# Automated reconstruction at $0 additional service cost

Thread owns photos → reconstruction → validation → app integration. Users never need to create meshes, prepare textures or import GLB files. The customizable avatar remains an explicit alternate mode, never a reconstruction fallback.

## Hardware and evidence

Existing host: Windows, Intel Core 5 210H (8 cores/12 threads), about 16 GB RAM, RTX 5050 laptop GPU with 8 GB VRAM. COLMAP 4.2.1 and OpenMVS 2.4.0 official Windows releases can run locally without a paid service. The CPU path avoids CUDA compatibility surprises on this newer GPU. Real benchmark photos have already aligned successfully and produced dense measured geometry.

## Chosen initial pipeline

Native capture/upload → authenticated local job → image decode and quality checks → local foreground segmentation → masked COLMAP SfM → undistortion → OpenMVS dense reconstruction → mesh cleanup and photographed texture atlas → mobile GLB → output validation → automatic device download.

Claude optionally checks capture coverage and proposes bounded capture guidance. It never supplies geometry, marks an untested reconstruction realistic, executes shell commands or substitutes a generic model. The actual geometry is triangulated from the supplied views. Missing information triggers more capture or a failure.

Only Anthropic may be a paid service. Reconstruction tools and model weights run on the user's existing computer. No fal, Replicate, GPU hosting, commercial avatar API, free trial or mandatory subscription.

## Privacy and reliability

Use a private authenticated connection to the local worker, HTTPS for device transfers, bounded JPEG inputs, generated job paths, idempotent submission, one active reconstruction per host, cancellation, restart recovery and stage checkpoints. Store images/work products locally, delete them explicitly and expire abandoned jobs. Never publish face images to public storage or write API keys into job manifests/logs. Photos reach Anthropic only when the user enables that step and starts processing.

Quality checks must distinguish a reconstructed asset from a wearable outfit. Textured geometry does not prove identity, measurement accuracy, successful garment fitting or draping.

## Capture requirements and limits

Multi-view photogrammetry needs overlapping photographs, stable lighting, a neutral expression and a still subject. A moving head against a static background requires subject masks and careful registration; the body and facial expressions cannot change between views. Smooth skin, dark fabric, shiny material and thin cloth are difficult. A few front/side photos cannot faithfully reveal the back, ears, garment interior or measured material properties. More views are required where the evidence is insufficient.

Guided native scanning should collect overlapping RGB frames with calibrated pose/depth on supported iPhones. Accessible ARKit/AVFoundation APIs can provide face geometry and TrueDepth data; private Face ID biometric data is never accessible or needed. This needs a native development build, not Expo Go. It must be tested on actual hardware.

Body reconstruction requires body captures or measurements. Face photos alone cannot reconstruct a digital twin's body. Garment meshes require garment isolation, open boundaries, body registration and collision-aware fitting. Plausible unseen geometry and physical drape need further dedicated modeling and validation; the implementation must not disguise simple affine placement as draping.

## Alternatives evaluated

- TripoSR: MIT code/weights, about 6 GB VRAM. Useful inferred single-object geometry, but single-view hallucination cannot prove facial identity or create a wearable garment topology. Do not use it as a silent replacement for faithful reconstruction.
- TRELLIS: documented Linux and at least 16 GB VRAM; exceeds this host's VRAM in its supported configuration.
- DECA: non-commercial scientific-research licensing and FLAME dependencies. Do not treat it as an unrestricted production dependency.
- OpenMVS: AGPL and included third-party licenses require review before public distribution; personal local verification has no subscription cost. Native executables remain separate from app source. Source notices are retained.

## Required acceptance

Real photos must produce a real geometry/texture artifact, with recorded stage results. Real user face/body/garment photos and device tests are required before claiming a recognizable digital twin or natural outfit draping. Benchmark architecture reconstruction is pipeline proof, not face or clothing quality proof.
