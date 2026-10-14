# Free local reconstruction engine

One-time computer setup (Windows, Python 3.11):

1. Run `powershell -File local-engine/setup.ps1` from the project. It installs checksum-verified COLMAP/OpenMVS binaries and isolated Python dependencies, then caches U2Net weights. No billing account or paid reconstruction API is used.
2. Run `npm run server:reconstruction`. By default, plain HTTP listens only on `127.0.0.1:8790`. Phone setup below configures a private LAN HTTPS address. The private pairing token is stored in `.env.local-reconstruction`; never commit or post it.
3. For a phone, run `pwsh -File local-engine/setup-phone-tls.ps1 -ComputerIp <private Wi-Fi IPv4 address>` once. It creates a private CA/leaf certificate without installing trust anywhere. Follow its output to configure the engine's direct HTTPS listener and trust only that specific root on your own phone. Never transfer the server key or use a cloud tunnel for photos. Pair under You → AI settings → Free local 3D reconstruction. Plain HTTP is restricted to loopback.
4. Capture photos in the app. Your character has face and body capture/review; a saved wardrobe piece has capture/review. The camera pauses for each guided photo, with a helper moving around a still subject. Results and their original reference photos download automatically when the screen is foregrounded and reopen for native side-by-side review.

Privacy: inputs, diagnostic files and results live in `.data/reconstruction/<generated job id>`. No public image URLs are needed. Only an optional, explicitly enabled Claude check sends four reduced representative images to Anthropic. Paid reconstruction service adapters are absent. Delete capture removes computer files and downloaded phone assets; completed/failed/cancelled computer jobs expire after 24 hours while the worker runs. Expo Go stores downloaded face models and model/photo comparisons in private cache excluded from OS backup; iOS can evict that cache. Installed Thread builds use native protected Documents storage. Privacy → Delete all reconstruction captures and models covers both locations; an offline computer produces an incomplete-deletion error and needs retry. Local-only wardrobe erase remains separate. Source Photos-library images and exported copies are under the user's control.

For the iPhone pairing steps, native privacy-build requirements, real-photo acceptance procedure and remaining fitting gaps, see `docs/thread-real-capture-acceptance.md`.

Real reconstruction uses local foreground isolation → COLMAP matching/triangulation → OpenMVS dense surface/cleanup/texturing → packed mobile GLB. Restart recovery and stage checkpoints reuse completed work; failures do not insert generic geometry. More images are required when capture/coverage tests fail.

GPU: with an NVIDIA GPU, setup also installs the official COLMAP 4.2.1 CUDA build (checksum-pinned), and feature extraction and matching run on the GPU (THREAD_DEVICE=cpu forces the CPU build). On the 11-photo Sceaux Castle benchmark (14 Oct 2026, RTX 5050): features 14.7 s → 1.9 s, matching 27.2 s → 0.7 s, total 126 s → 89 s, both producing a 60k-triangle textured model. OpenMVS densification (about 50 s) stays on the CPU: the official Windows build has no CUDA, and 12 threads measured slower than 6 on this laptop. Current limits: CPU path is tested. This host has 8 GB GPU VRAM and about 16 GB RAM. The pipeline needs overlapping views, steady light and a still subject; it cannot faithfully invent invisible details. Guided capture is RGB, not TrueDepth. Native depth capture/fusion, identity-quality validation with actual user photos, calibrated full-body registration, garment sewing topology/fitting/layering/draping, model-aware backup/sync and real phone acceptance are still pending. Garment output is a measured surface, explicitly `not_fitted`, and is not presented as a wearable outfit.

## Licenses

COLMAP is BSD licensed. OpenMVS is AGPL with included third-party licenses, including a research-only graph-cut component noted by its upstream copyright file. Preserve upstream source/notices and review deployment/distribution compatibility before public/commercial use. U2Net/rembg and the Python library licenses remain their respective upstream licenses. A zero monetary cost is not a claim of unrestricted redistribution rights.

## Verification

`local-engine/reconstruct.py --job <directory> --photos <photo folder> --kind face|body|garment` is the same worker used by the HTTP engine. Runtime paths are controlled locally, never accepted as shell commands from images or Claude.

A diagnostic `--kind benchmark --no-isolation` path is used only for the public OpenMVG Sceaux Castle photos. It is not exposed by the app/API and is not facial/garment quality evidence. See `docs/automated-reconstruction-verification.md`.
