# Thread — automatic local photo reconstruction

Native React Native / Expo SDK 57 wardrobe companion. The target experience is take photos → Thread reconstructs your real avatar and clothes → try outfits. End users do not prepare or import 3D models.

The only permitted paid service is Anthropic Claude. Reconstruction runs on your own computer using free tools/models, with no paid reconstruction API or GPU host.

## Start the native app

Use Node 24, install dependencies with npm ci, sign into Expo and run npm start. The existing Expo project remains @elshorbagys-team/ai-wearable-cloth. Guided RGB capture uses expo-camera. Real TrueDepth support requires a custom native build and is not implemented yet.

## Start local reconstruction

Follow local-engine/README.md. Run local-engine/setup.ps1 on the Windows computer, then npm run server:reconstruction. This installs isolated, checksum-verified COLMAP/OpenMVS binaries and Python/U2Net dependencies, with no billing account. The engine listens only on loopback. A private trusted HTTPS gateway is required to pair a phone and has not been deployed yet.

In the app, Your character → Create my face from photos accepts gallery views or a real 24-frame guided RGB capture. A saved clothing piece exposes Reconstruct this piece from photos. Jobs report actual progress and errors, allow retries/removal and download completed models automatically. Optional Claude capture inspection sends only four representative reduced photos with explicit consent; available model IDs come from the account API.

## Current limits

The full realistic virtual outfit mission is not complete. Actual user face/body/clothing samples have not been provided. TrueDepth fusion, verified identity likeness, body/garment registration, sewing topology, layering and physical draping are pending. A garment surface is explicitly not fitted and is not substituted with a generic model. Face artifacts attach to the standard preview body; face photos alone do not measure a body. Legacy category shapes are still labeled as previews.

Generated models stay local and are excluded from current encrypted wardrobe backup/sync. Computer captures are removed explicitly or expire while the engine runs. Review OpenMVS/third-party licenses before public/commercial deployment. No real paid inference, paid GPU host, signed installable build or public deployment was performed.

## Existing wardrobe and cloud behavior

Owned/example inventory remains isolated. Locks, shuffle, saved looks, actual wears, local recovery, encrypted backup and foreground-only conflict-safe cloud sync remain available. The existing Supabase Free project omuxejbtzruopopxadvv is unchanged. Do not reapply migrations or enable paid plans. Legacy paid FASHN try-on remains disabled.

## Evidence

See docs/automated-reconstruction-verification.md for real-photo geometry/texture output, regression tests and native exports. See docs/automated-reconstruction-design.md for hardware findings and evaluated free alternatives. Benchmark reconstruction is not face/garment quality evidence. Continue from NEW-CHAT-HANDOFF.md.
