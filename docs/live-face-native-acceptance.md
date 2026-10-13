# Native live face acceptance — 12 October 2026

This is an unverified native-source implementation. The Windows host has no Xcode, iOS simulator or connected phone tooling. Passing TypeScript, numerical unit tests, autolinking or Hermes export does not prove Swift compilation or live scan quality.

## What exists

- Local Expo module: `modules/thread-face-scanner`. Uses installed Apple ARKit/SceneKit/AVFoundation/CoreImage frameworks; no paid service or external facial model.
- Capability check requires native module presence, ARFaceTrackingConfiguration support and TrueDepth hardware. Expo Go and unsupported platforms use guided RGB capture; the live button is hidden rather than showing a pretend scan.
- Native camera previews actual tracked face geometry. Bridge reports head pose, framing, jaw openness, blinking and anchor UUID. UUID checks establish capture continuity, not biometric identity.
- Captures recheck current native pose and expression. The bounded GLB preserves averaged SDK face-surface positions, canonical triangle topology and a neutral-front photograph projected into UVs. It invents no hair, ears, back/head or body geometry. Side texture coverage is unverified.
- Explicit private review precedes activation. Failed packing, texture/bounds validation or saving preserves the previous character. Files/models are excluded from wardrobe backup/sync; preview candidates use OS-evictable private cache.

## Required build and device proof

1. Generate/install an iOS development build on a Mac with Xcode using the local module. Verify podspec acceptance, Swift compilation, native view registration and reference-method calls. Local Apple personal-team signing may be used; do not buy signing/build services without separate user authorization. An iOS JavaScript export is not an installed native build.
2. On the actual TrueDepth phone, test denied/granted camera permission, first neutral calibration, all eight head-pose directions, steady tracking, mouth/blink feedback, restart after moving the phone, interruption/background and anchor loss/change. Confirm instructions correspond to physical left/right/up/down; coordinate sign and neutral pose cannot be certified here.
3. Compare original photo and native 3D front/side/back. Verify UV orientation, mirroring, normal direction, recognizable facial features, skin tone, crops, seams, holes and texture stretch. Reject surfaces that are not useful. This test cannot establish a complete head or expression animation because neither is implemented.
4. Confirm accepting the candidate activates exactly that face; failed/aborted acceptance retains the previous face. Open old computer-photo captures and confirm they remain separate until explicitly selected. Delete an old capture with an evicted unrelated face and verify deletion completes.
5. Close/reopen the installed app and verify durable protected storage. Test Expo Go cache eviction on its RGB path separately. Kill the app with a candidate staged; reopen the scanner and verify pruning. Run global local erasure and confirm preview/model files and face metadata are gone. Report failures and retry; do not announce completed erasure on an error.
6. Capture actual native Home, Dressing Room, Profile and Live Face screens on each applicable device, in light/dark and default/max accessibility text. Test scroll/rotation/category gestures and GPU/memory performance. Native screenshots are required; browser asset inspection is insufficient.

No required phone step above has passed. Real full-head reconstruction, personal body registration, image-reference conversion and naturally fitted real garments remain additional unfinished goal requirements.
