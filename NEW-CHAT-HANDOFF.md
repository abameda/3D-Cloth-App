# Current Thread mission and implementation

Thread automates photos → real reconstruction → avatar/garment assets → virtual outfits. End users do not prepare meshes, textures or import GLB files. The only permitted paid service is Anthropic Claude; all other processing must have $0 service cost and run locally/open-source on existing hardware.

## Implemented in this change

- Free local worker: background isolation (U2Net/rembg), quality checks, COLMAP alignment/triangulation, OpenMVS dense surface reconstruction/cleanup/texturing, mobile optimization and packed textured GLB output.
- Authenticated local job API with owner scoping, bounded JPEG input, durable uploads, idempotent submission, one running reconstruction, bounded queue, progress, stage checkpoints, restart recovery, explicit retries, cancellation and removal. Expiry cleanup runs after 24 hours for inactive jobs while the engine is running.
- Real native RGB capture/gallery flow. Guided capture records 24 actual frames; it does not simulate scanning or report unmeasured TrueDepth capabilities.
- Optional Claude inspection of four reduced representative views, bounded to retake/quality guidance and the free local pipeline. It uses the actual model ID selected from the user's account. Haiku 5.5 is not assumed to exist without account API confirmation. No real Claude request was made by the agent.
- Reconstruction results download automatically while the capture screen is foregrounded. Face artifacts integrate through the native textured face loader. Body and garment surfaces have genuine standalone model previews; clothing output is explicitly not fitted.
- No consumer GLB-import requirement. The custom avatar is an explicit separate option; it is not an automatic replacement for failed face reconstruction.
- Source setup and isolated local runtime installed on the existing Windows computer. CPU path fits the measured hardware: about 16 GB RAM, Core 5 210H/12 threads, RTX 5050/8 GB VRAM.

## What is NOT complete

The full effortless, realistic virtual outfit mission is not complete. No actual user face/body/garment capture has been supplied or quality-tested. The proof dataset is a real architectural photo benchmark, not evidence of face likeness or garment fit.

- Supported-phone TrueDepth acquisition, calibrated depth fusion and native device acceptance are pending. Face ID private biometric data is neither accessed nor needed. Expo Go does not supply the required custom depth-capture module.
- Face geometry/texture quality and identity likeness need actual consented face views. A face capture alone cannot reconstruct body measurements.
- A generated garment surface is not a wearable garment. Sewing topology, full-body correspondence, fitting, collision-safe layers, believable fabric physics and draping are not implemented. Current preview clothing shapes remain labeled as legacy previews and are not presented as reconstructed garments.
- Phone/computer pairing requires a private HTTPS gateway/certificate on the user's own computer/network. No HTTPS gateway has been deployed. Plain LAN HTTP is blocked for facial photos.
- Reconstruction model backup/sync is pending. Generated models/capture caches stay local; existing encrypted wardrobe backup does not include them.
- OpenMVS/third-party and research-model license review is necessary before public/commercial distribution. A $0 subscription cost does not remove license restrictions.
- Dependency audit still contains 27 non-critical findings after the compatible shell-quote critical fix. No blanket dependency upgrade was applied.

## Real evidence

Read docs/automated-reconstruction-verification.md, docs/automated-reconstruction-design.md and local-engine/README.md. Source/domain tests and native Hermes exports are not device rendering proof. Benchmark reconstruction is real local computation, never an AI simulation.

## Existing constraints

Preserve the native Expo app, owned inventory, locks, saved looks versus actual wears, local recovery, encrypted backup, free Supabase project omuxejbtzruopopxadvv and foreground sync conflict safety. Do not upgrade plans, enable legacy FASHN/paid reconstruction APIs, use paid GPU hosting or replace the application. The private .env.local-reconstruction file contains the pairing token and is ignored; never print it.
