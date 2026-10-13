# Native 3D Avatar Implementation Plan

**Goal:** Add a free local 3D test character dressed from the selected wardrobe outfit.

**Architecture:** A pure domain mapper resolves valid active-dataset garments to supported sample meshes. A native Three.js viewer owns graphics lifecycle; a dedicated screen owns navigation and accessible camera controls. Bundled assets require no private-data or backup migration.

**Tech stack:** Existing React Native/Expo; Three.js, React Three Fiber native and Expo GL after compatibility verification.

**Spec:** `docs/3d-avatar-design.md`, approved by the user's “go ahead”. Execution is in this session.

## Constraints

Native iOS and Android, no WebView, no paid inference. Preserve wardrobe state, one-piece rules, example isolation and existing backup formats. Describe sample clothing as an approximation. No claims of body fit or automatic image reconstruction.

## Implementation and proof

- [ ] Verify dependency peer versions and install matching native packages. Configure Metro to bundle GLB resources.
- [ ] Add `src/domain/avatar.ts` with `resolveAvatarOutfit(outfit, garments, dataset)`; return selected supported pieces and notices for invalid/unavailable/unsupported slots. Test empty test-outfit behavior, dataset isolation, one-piece precedence and unavailable pieces in `tests/avatar.test.ts`.
- [ ] Author a reusable original character with distinct body, hair and clothing meshes; bundle it with its reproducible generation source and provenance. Validate geometry bounds, finite vertices, material and object names.
- [ ] Add `src/ui/AvatarView.tsx`: native canvas, local loading, independent materials, demand-driven rendering, error recovery, focus/background teardown and explicit camera orientation/zoom.
- [ ] Add `src/screens/AvatarScreen.tsx` and register it in `src/navigation.ts` and `App.tsx`. Link from Studio (including empty state) and You. Expose rotate gestures and front/side/back/zoom/reset buttons; name approximate pieces and show fallback notices.
- [ ] Run focused domain/asset tests, full tests, TypeScript and native bundle exports. Inspect asset views where tooling permits. Report native device gaps explicitly, update implementation status, then refresh Graphify.

## Review focus

An outfit with only unsupported items must not masquerade as an empty test outfit. Stale IDs and other-dataset items must never dress the character. One-piece must hide separates. Late asset completion after navigation must not leak resources. Graphics failure must preserve access to the ordinary wardrobe.
