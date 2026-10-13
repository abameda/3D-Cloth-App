# Personal 3D wardrobe — current status

Historical snapshot, superseded by the automated zero-additional-service-cost reconstruction work. Read `automated-reconstruction-design.md`, `automated-reconstruction-verification.md` and the current `NEW-CHAT-HANDOFF.md`. End users now supply photos, not external GLB models.

The goal is personal use: add owned clothes, choose an outfit, see it in 3D, then save or record wearing it. Public-store launch infrastructure is outside this change.

## Implemented

- Today opens on a 3D outfit preview, with the primary outfit action above it. Clothing photos remain available as a reference view.
- All eight categories have original local 3D shapes: tops, bottoms, shoes, layers, one-piece, accessories, bags and eyewear. Selected colors and approximate fit categories apply to the shapes. These are not reconstructed copies of clothing photos or cloth simulation.
- Your character offers Real likeness and Custom avatar. The real option imports a head-only GLB, retaining its facial geometry and embedded face texture. Uniform scale and placement attach it to the existing standard body; clothing and skin-tone changes never recolor or reshape that face.
- Custom avatar choices include skin tone, hair color, short/long/no hair and body shape. Choices persist in the profile and its existing encrypted backup/sync flows.
- Imported facial scans are local-only, excluded from backup/sync, and can be replaced or removed. Local wardrobe erasure also removes face scans and AI credentials.
- You → AI settings accepts an Anthropic API key in secure storage. Load my available models requests account metadata, allowing selection of actual Opus/Haiku API IDs without inventing a version. It makes no inference call.
- Optional photo tagging and request interpretation run only on an explicit user action with a saved connection. Results are validated before use; photo edits made during inference are preserved. Paid credits belong to the user's provider account. Offline outfit selection remains available.
- Existing private-service connections remain supported under optional advanced settings. Realistic photo try-on remains disabled.
- Duplicate avatar actions were removed. Piece locks, style preferences and backup/learning tools use progressive disclosure. Core inventory, saves, wear history and cloud safety behavior remain intact.

## Still remaining

1. **Create the user's real scan.** No likeness reference photos or head scan have been provided. Photo-to-3D reconstruction is not implemented. Use multi-angle photogrammetry/face scanning for faithful geometry and texture, then export a mobile head-only GLB. Three still photos can guide reconstruction but do not guarantee an accurate full head. Claude is not a 3D reconstruction engine.
2. **Exact clothing replicas.** The current models show categories and colors, not each garment's silhouette, print, fabric or measured fit. Faithful garment reconstruction requires garment assets/scans and a separate fitting method.
3. **Native acceptance.** Exercise GL rendering, embedded face textures, file import, switching real/custom modes, large text, light/dark, gestures, camera and private storage on iPhone/Android. This workstation has no available adb or iOS Simulator tooling. Source/bundle checks do not verify native rendering.
4. **User-key acceptance.** Enter the API key in the app, load available models and deliberately try one clothing photo/request. No real provider inference was run by the agent.
5. **Device/build work from the previous phase.** Real account/two-device restore and conflicts, native filesystem interruption tests, and a signed installable build remain pending. No paid build or backend upgrade was enabled.

## Scan format

Head only; front facing +Z, upright +Y. GLB 2.0 with embedded geometry and PNG/JPEG textures, under 16 MB, fewer than 80,000 rendered triangles, textures under 4 MB each and up to 2048 × 2048 pixels. Compressed, animated, externally linked or malformed files fail closed. Use the original scan to retain fidelity; this viewer does not invent missing facial features.

## Verification

Results are recorded in docs/personal-3d-verification.md. Native visual approval and real facial reconstruction are outstanding.
