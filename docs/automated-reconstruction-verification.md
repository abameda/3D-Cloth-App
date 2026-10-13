# Real local reconstruction verification — 11 October 2026

## Actual photo reconstruction

This was local computation from real photographs, not a mock provider or sample mesh substitution.

- Hardware: Windows, Core 5 210H (8 cores/12 threads), about 16 GB RAM, RTX 5050 laptop GPU with 8 GB VRAM. The verified path uses CPU and needs no paid GPU hosting.
- Input: 11 public Sceaux Castle photographs from OpenMVG's ImageDataset_SceauxCastle. Photographer: copyright 2012 Pierre Moulon. This is an architectural benchmark, not a face/body/garment quality dataset.
- Pipeline: decode/quality checks → COLMAP 4.2.1 CPU SIFT/matching/triangulation → undistortion → OpenMVS 2.4.0 dense geometry/cleanup → mobile decimation → photographed texture atlas → Trimesh embedded GLB packing and camera-based orientation.
- Final command: `.runtime/reconstruction-python/Scripts/python.exe local-engine/reconstruct.py --job work/reconstruction-benchmark/verified-final --photos work/reconstruction-benchmark/images --kind benchmark --no-isolation` exited 0.
- Final real output: `work/reconstruction-benchmark/verified-final/result.glb`, 4,727,876 bytes, 60,000 triangles, one measured mesh and one embedded photographed texture.
- SHA256: `794e1bd2be7caeebec75660d8c84df7fd9d972434ca462e3d763a2d341d1d7f8`.
- The same native GLB validator passed its geometry bounds, finite vertices, triangle indices, embedded texture/resource and mobile memory gates.
- Re-running the same command resumed every expensive stage from versioned checkpoints and reproduced the identical hash. Stale input/version checkpoints fail instead of mixing processing results.
- Background removal was separately run on a real benchmark photo using locally downloaded U2Net/rembg weights; output is `work/reconstruction-benchmark/background-removed.png`. No photo was uploaded to a reconstruction provider.

The benchmark uses a diagnostic no-isolation path because it reconstructs architecture. Production face/garment captures use local subject isolation and face captures additionally require one detectable frontal face in their first view. Those production paths need actual consented subject captures for end-to-end quality acceptance.

## Source and integration checks

- Strict native TypeScript and Node TypeScript compilation passed.
- Complete Node suite: 81 passed, 0 failed, 0 skipped. It covers the existing wardrobe/sync safety invariants plus job ownership, input limits/consent, durable upload scheduling, idempotency, restart recovery, deletion, artifact transport and bounded Claude capture planning.
- HTTP tests use the measured textured benchmark artifact and an explicitly mocked runner to isolate transport/job controls. They are not live face or garment reconstruction tests.
- Claude tests use fake responses. The new capture plan can request retakes but cannot choose a paid reconstruction service or execute arbitrary code. No real Claude call or model-availability assertion was made by the agent.
- The mechanical UI detector returned `[]`; native visual/device approval remains unverified.
- Local setup PowerShell source parses. Installed official binaries were SHA256-checked against their release assets. Isolated Python dependencies are pinned in local-engine/requirements.lock.txt.

## Native bundle checks

Both iOS and Android Hermes exports pass for the native capture and reconstruction source. Final bundle identifiers are appended after the last source export. A Hermes export is not an APK/IPA or proof of camera, texture upload, filesystem behavior or gestures on hardware.

## Cost, security and licensing

No paid reconstruction API, subscription, trial, GPU host, cloud plan upgrade, paid build or real paid inference was used. Only the optional Anthropic API is permitted as paid inference. The previous private metadata server now uses Anthropic rather than OpenAI.

The dependency install surfaced a critical shell-quote advisory in the existing toolchain; a compatible update to 1.12.0 removed that critical finding. The remaining audit reports 27 non-critical findings (18 high, 9 moderate), so this is not a production-security signoff. The pre-existing Metro @noble/hashes/crypto.js export-fallback warning remains; exports succeed.

OpenMVS is AGPL and its upstream copyright lists third-party restrictions, including a research-only graph-cut component. Public/commercial redistribution or deployment needs a license review; zero subscription cost does not mean unrestricted licensing. Benchmark image attribution is retained. No paid alternative was activated.

## Unmet mission acceptance

No user face/body/garment photos were available. Realistic facial likeness, full-body correspondence, wearable garment topology/fitting/layers/draping, TrueDepth capture/fusion, phone/computer trusted HTTPS pairing, model-aware backup/sync and actual phone behavior are not verified or complete. Garment quality explicitly reports `not_fitted`. The system does not replace a failed capture with generic geometry or claim that a measured surface proves natural virtual try-on.

## Final native export identifiers

Final source exported successfully (exit 0):

- iOS: `_expo/static/js/ios/index-0c27a2efcd418037f6d29ebadd90e79e.hbc`, about 5.3 MB.
- Android: `_expo/static/js/android/index-c90343564b9b7aee1b0be6cb92d95e9c.hbc`, about 5.4 MB.

Final regression count is 81/81, including explicit rejection of an untextured generic avatar as a reconstructed photo output. The graph was refreshed after final source changes. No native device screenshots or true garment fitting/depth results are claimed.
