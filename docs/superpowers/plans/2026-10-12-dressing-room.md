# Thread Dressing Room Implementation Plan

> Execute natively in this session using superpowers:executing-plans. The user approved the proposal and explicitly requested implementation on 12 October 2026; no further approval round is required for this scope.

**Goal:** Implement the complete approved Home / Dressing Room / Profile experience and advance the full personal-character and real-garment goal through verified capability gates.

**Architecture:** Keep the existing native navigation, wardrobe reducer, local reconstruction pipeline and secure provider connection. Extend their responsible layers with a shared room scene, direct wardrobe selection and bounded wardrobe-aware Claude styling. Asset quality, provenance and wearable compatibility remain distinct.

**Tech Stack:** Expo SDK 57, React Native, Three.js, React Navigation, TypeScript, Zod, local COLMAP/OpenMVS, Anthropic BYOK.

**Spec:** `docs/thread-dressing-room-proposal.md` (approved).

## Global constraints

- Native iOS/Android phones; no WebView or static image substitute for 3D.
- Exactly Home / Dressing Room / Profile as primary destinations.
- Claude is the only paid service; reconstruction runs locally without extra service cost.
- Preserve owned/example separation, locks, one-piece compatibility, encrypted storage/sync and privacy.
- No claim of likeness, measured fit, live tracking or wearable reconstruction without corresponding evidence.
- Reduced Motion, native accessibility, truthful error/retry and inactive rendering lifecycle are required.
- Directory is a package project without Git; work in the authorized checkout and do not fabricate commits/worktrees.

## Review focus

- A selected garment conflicts with a locked one-piece/separates slot: keep the outfit and explain how to unlock.
- A delayed AI reply arrives after wardrobe/context/selection edits: discard it.
- A personal model is missing, invalid or cache-evicted: preserve the wardrobe and show explicit recovery.
- Changing tabs/backgrounding releases expensive GL resources; Reduced Motion skips camera travel.
- No wardrobe or character yet: keep room-first composition with explicit character choice and add-piece action.

## Task 1 — direct selection and three-tab ownership

Files: `src/domain/dressing.ts`, `tests/dressing.test.ts`, `src/navigation.ts`, `App.tsx`, existing route consumers.

- [ ] Write and run regression tests for direct selection, dataset/unavailable rejection, lock conflict, one-piece/separates and removal.
- [ ] Implement `selectDressingPiece(input: { garments: Garment[]; dataset: Dataset; outfit: Outfit; locks: Locks }, id: string): { outfit: Outfit; notice?: string }` with existing category and state semantics.
- [ ] Register only Home / DressingRoom / Profile tabs. Register Looks as a secondary route, with saved/history entry parameters; migrate all internal destinations.
- [ ] Typecheck and run direct-selection tests.

## Task 2 — room renderer and native room-first surfaces

Files: `src/ui/roomScene.ts`, `tests/roomScene.test.ts`, `src/ui/AvatarView.tsx`, `src/ui/OutfitPreview.tsx`, `src/ui/DressingRail.tsx`, `src/ui/theme.ts`, Home/Wardrobe/Profile screens.

- [ ] Test real closet geometry, category hit targets, non-personal room-only state and shared-resource disposal.
- [ ] Build floor/walls, cabinetry, rails, shelves, mirror and category preview pieces as native Three meshes. Category targets carry category IDs; raycast taps open the matching rail.
- [ ] Extend the current renderer for room viewpoints, bounded camera transitions, room-only rendering and accessible alternative view/category controls. Keep personal scan placement separate from room geometry and no animation while backgrounded.
- [ ] Put character/room first, category rail beneath, Style me below, advanced outfit actions behind disclosure. Add garment actions and one Add clothes menu in Dressing Room; Profile uses concise settings rows and existing edit flows.
- [ ] Typecheck and run scene tests. Device screenshots and gestures are explicitly pending until a native surface is available.

## Task 3 — real wardrobe-aware styling and forecast

Files: `src/domain/claude.ts`, `src/domain/aiStyling.ts`, `src/ai.ts`, `tests/aiStyling.test.ts`, Home/context screens and forecast owner.

- [ ] Test schema, current dataset, availability, category and lock constraints, one-piece coherence, bounded metadata, response staleness and cache invalidation.
- [ ] Extend Claude's existing fixed provider request with a `style` task returning validated wardrobe IDs and a brief reason. Send metadata/preferences/bounded history only.
- [ ] Wire Style me to the saved provider; explicitly identify local fallback and avoid repeated paid calls by caching unchanged requests. Preserve user edits after pending replies.
- [ ] Add a free city forecast and manual fallback with freshness/source shown. No automatic location permission or inferred location.
- [ ] Run provider-contract tests without paid inference and source/build checks.

## Task 4 — character methods and actual animation assets

Files: existing Avatar screen, appearance schema/state migration, asset builder/validator/loader, import/reference storage, camera native integration and local face processing.

- [ ] Preserve existing appearance defaults while adding facial-feature/body choices that actually deform authored geometry.
- [ ] Add external copyable prompt, reference-image handling and separately validated compatible asset import; retain provenance and prior valid character on failure.
- [ ] Deliver a rig, animation clips and facial morph targets rather than whole-model sway; validate native rendering compatibility.
- [ ] Evaluate and implement live native face tracking and a compatible local head-turn reconstruction method; keep helper RGB capture as honest fallback when acquisition cannot pass.
- [ ] Verify real personal capture quality privately and mark unsupported/failed states explicitly.

## Task 5 — wearable garment pipeline and native acceptance

Files: local engine, reconstruction contracts/asset installation, character/garment registration, renderer and acceptance documentation.

- [ ] Implement calibrated body coordinates, usable garment topology, deformation, collision/layering and draping using free local tools.
- [ ] Verify one actual owned top, bottoms and outer layer on the user's character from front/side/back and motion, retaining retake states for incomplete surfaces.
- [ ] Exercise installed native build protection, face capture, restoration, low memory, GL errors, offline computer and deletion during processing on actual hardware.
- [ ] Keep goal incomplete until all original requirements, including likeness and naturally fitted real garments, have matching evidence.

## Proof commands

`npm run typecheck`; `npm test` (local HTTP tests require loopback access); `npm run export:native`; `graphify update .` via the installed Python module if the CLI trampoline fails. Source checks and exports never substitute for native device or personal-photo acceptance.
