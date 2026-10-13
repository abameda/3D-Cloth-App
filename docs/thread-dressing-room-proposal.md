# Thread — personal 3D dressing room

12 October 2026 · Proposed redesign for review · No product implementation changed

## Outcome and constraints

Open Thread → see yourself in 3D → choose an outfit → get dressed.

Exactly three primary destinations: **Home / Dressing Room / Profile**. The character and clothes lead; navigation, forms and settings recede. Native iPhone and Android remain the target. Preserve the existing wardrobe, outfit choices, learning, secure credentials, account, encrypted backup and sync infrastructure.

Confirmed cost rule: Claude is the only paid service. Reconstruction runs on the user's computer with free local tools. No paid reconstruction API, GPU hosting or billing-dependent trial. External AI generation is optional and user-directed; it cannot require a new paid subscription.

This is a proposed design and phased implementation plan, not a claim that realistic likeness or garment fitting already works.

## Review of the existing project

| Area | Evidence and present behavior | Decision |
| --- | --- | --- |
| Navigation | `App.tsx` exposes Today, Wardrobe, Looks and You, with additional root-stack tasks. | Replace the four-tab shell with three tabs. Move saved looks under Home and wear history under Profile. Keep focused task sheets where useful. |
| Home | `StudioScreen.tsx` puts context, shuffle and preview switches before a 430-high viewer; an empty wardrobe replaces the character with a text-heavy empty state. | Make the character the first and largest element, even before clothes have been added. Move advanced outfit controls behind the selected piece. |
| Native 3D | `AvatarView.tsx` uses Expo GL and Three.js, with drag rotation, local assets, resource disposal and visible render errors. It renders on changes, with no animation mixer or continuous idle animation. | Reuse the native renderer. Extend scene ownership for the room, bounded animation and fitted assets. Keep lifecycle and memory protections. |
| Character | `avatarScene.ts` places a reconstructed head on a standard body. Customization currently covers three skin tones, hair color, short/long/no hair and slim/regular/broad build. | Preserve both explicit modes. Add the three-method creator and a richer, consistently rigged asset system. Do not claim the standard body is the user's reconstructed body. |
| Wardrobe | `WardrobeScreen.tsx` is a searchable two-column photo catalogue. `ItemScreen.tsx` edits metadata and opens reconstruction after an item is saved. | Replace the default grid with an interactive closet. Retain search, availability, favorites and editing through a compact accessible inventory view and item sheets. |
| Reconstruction | `CaptureScreen.tsx`, `src/reconstruction.ts`, `server/reconstruction.ts` and `local-engine/reconstruct.py` connect RGB capture, local COLMAP/OpenMVS processing, textured GLB downloads, retry, deletion and comparison with input photos. Inputs require 8–48 overlapping views. | Keep the genuine local pipeline and its failure semantics. Simplify its interface; do not relabel a single photo as a reconstructed garment. |
| Garment fitting | Jobs explicitly report `not_fitted`; reconstructed garments display separately. `dressAvatar()` selects and colors category meshes, rather than dressing the body with reconstructed clothes. | Treat wearable registration, topology, deformation, collision and layering as required engineering work. Keep surface previews distinct until this passes. |
| Face scan | Camera guidance exists, but no live landmark tracking, expression tracking or TrueDepth fusion. Capture deliberately keeps the subject still while a helper moves the camera. | Keep this reliable capture path. Develop the front-camera head-turn method only with a compatible face reconstruction method; head turns are unsuitable for the current still-subject photogrammetry pipeline. |
| Connected AI | Claude performs context interpretation, clothing tags and optional capture-quality inspection. `StudioScreen.shuffle()` uses the local stylist. | Extend the existing Claude integration to select real wardrobe IDs and explain choices. Keep local styling as an explicitly identified offline fallback. |
| Weather | `ContextScreen.tsx` manually selects Warm/Mild/Cold and explicitly says it is not a live forecast. | Add a free forecast using a user-selected city; preserve manual conditions and display freshness. Never describe chosen conditions as live weather. |
| External generation | `docs/character-reference-prompts.md` contains modeling prompts. There is no complete consumer import-to-character flow in the current screen. | Bring a copyable prompt and two distinct import paths into the creator: reference images and compatible 3D assets. |
| Persistence and privacy | Wardrobe state, secure keys, encrypted backups/sync and private reconstruction storage are already implemented. Expo Go models use evictable cache; computer captures expire after 24 hours. | Preserve protections and data. Resolve durable native asset storage before promising a permanently saved digital twin. Keep computer pairing separate from AI settings. |

The inherited mint palette and rounded controls are evidence of the old interface, not the visual direction for this redesign. Existing browser asset captures show the sample character, not the current native app. Current native visual and photographic likeness acceptance remains outstanding.

## Recommended approach

Build the new experience on the existing native and data infrastructure, then complete the specialized reconstruction and fitting work behind explicit quality gates. This gives Thread a coherent experience while preserving the user's wardrobe and keeping unsupported results honest.

Two alternatives were considered: a full engine-and-app rewrite would discard useful privacy, storage and reconstruction work; provider-led reconstruction might accelerate some outputs but conflicts with the confirmed cost rule and still does not solve fit automatically. Neither is recommended.

## The three-tab experience

### Home — you and today's outfit

The first viewport is a full-body character in a softly lit, premium room. A small destination/weather line sits above it. A horizontal clothing rail sits directly beneath it. The bottom navigation is always legible and reachable.

- Drag the character to rotate; accessible Front / Side / Back actions offer the same control.
- Select Tops, Bottoms, Shoes or another category on the rail; tap a garment to replace that slot. The character updates without opening another screen. A one-piece/separates switch respects locks and explains conflicts.
- Tap **Style me** for a personalized recommendation. Show a short reason and keep the previous outfit available through Undo. Do not mark an outfit worn automatically.
- Put Keep this piece, favorite, outfit feedback, save and wear actions in a compact outfit/piece sheet. Saved looks reopen from a single Home action; no fourth tab.
- With no clothes, keep the chosen character visible and offer **Add your first piece**. With no character, show a brief setup choice in the room, rather than silently creating a generic likeness. Manual avatar is an explicit quick start.

The daily suggestion is prepared locally on app open. Claude styling is explicit by default; an optional daily AI setting requires clear opt-in for credit use and wardrobe metadata transmission. Cache by local day and relevant wardrobe/context/preferences changes; do not issue paid calls on every tab visit. Never replace an outfit the user is actively choosing with a late AI response.

### Dressing Room — the same room, opened into your closet

Entering this tab shifts the view from the character toward wardrobe rails, shelves and a mirror in the same visual world. Use actual rendered geometry, depth, materials and light. A warm plaster room, pale oak cabinetry, brushed metal rails and garment color supply the visual richness; decorative dashboard panels do not.

- Tap a rail or shelf to open that clothing category; tap an item to inspect, wear, edit or remove it.
- Keep one clear **Add clothes** action: Camera / Existing photos / Several pieces. Confirm the owned item before associating a reconstruction job with its ID.
- A single clothing photo creates a photo item and optional AI tags. **Make 3D** explains and guides the overlapping views the local engine needs. Existing photos can be used when coverage is sufficient; otherwise request missing views.
- Processing continues on the paired computer. Show actual stages, with retry, cancellation/deletion and reopen. No invented percentage or celebratory success before asset validation.
- Give each item a small truthful state: Photo / Building 3D / 3D surface / Wearable / Needs retake. Wearable requires a validated character-compatible garment, not merely a valid GLB file.
- Provide a fast native inventory list for accessibility, search, larger wardrobes and lower-power devices. It operates on the same data and selection.

### Profile — your character and preferences

Show the character's head/shoulders, name and **Edit character** first. Below, use concise native settings rows for Style preferences, AI stylist, Reconstruction computer, Account, Privacy, Backup and Wear history. Editing should save at clear task boundaries with visible failure/retry, preserving current unsaved-change protection.

Computer pairing and certificate setup remain a one-time native setup task. They belong in Profile, not in the daily outfit flow. Existing private-service support can remain an advanced connection option.

## Character creation — three explicit methods

**A. Scan my face.** Front-camera permission → live tracked framing and head-pose guidance → valid-view capture → local reconstruction → front/side likeness review → use character. Tracking feedback and completed views must come from actual measurements, not a timer. Hold a stable, neutral expression during reconstruction views; expressive animation is a separate rigging feature. On unsupported devices or low-confidence captures, offer the existing helper capture, reference import or manual creator. Permission denial has a gallery alternative. Before shipping head turns, prove that the reconstruction method handles that acquisition geometry. No Face ID/security-grade accuracy claim.

**B. Use AI references.** Copy a prompt asking an external image model to preserve the user's supplied likeness across separate, consistent front and side views, with neutral lighting, no stylization or invented unseen facial details. Explain that images are references, not 3D assets. Import images as reference material into an explicitly identified modeling pipeline, with review of fabricated/inconsistent surfaces; never pass synthetic views off as measured camera observations. Offer compatible self-contained GLB import separately. Validate size, geometry, textures, origin/license and expected character structure before installation. A head-only mesh needs placement; a full-body mesh needs rig/body/garment compatibility. A valid file alone does not establish any of those. The user controls what they upload externally.

**C. Build my avatar.** A full-height live 3D preview with a compact editor tray: face shape, eyes, brows, nose, mouth, hair, skin and body proportions. Use authored morph targets and modular meshes on one compatible rig. Reuse existing appearance storage through a backward-compatible migration. Keep Save / Cancel clear, and retain the last valid avatar if loading or persistence fails. This mode is playful and personal, explicitly stylized rather than a photographic reconstruction.

All methods end in the same character editor and outfit scene, with provenance retained: custom, reference-derived or photo-reconstructed. Expressions and motion require an appropriate rig; an unrigged scanned head is not described as expression-animated.

### Asset compatibility findings

The current sample character is generated from static mesh groups by `scripts/build-avatar.mjs`; it has no skeletal rig, animation clips or facial morph targets. Camera rotation and a whole-model sway would not satisfy recognizable body motion or expressive character animation. Phase 3 must deliver a compatible rigged character, real clips and facial morph targets, with garment deformation tested against that rig.

The existing head-scan validator in `src/domain/faceScan.ts` explicitly rejects `skins` and `animations`. Its safety checks are useful for static reconstructed heads, but it cannot be reused unchanged as a full-character importer. Add a separate bounded character-asset validation path for rigged assets, covering joint references, skin weights, inverse bind matrices, animation accessors, morph target counts, scene bounds and resource budgets before loading. Preserve the static-head path and its protections. Reject incompatible assets with actionable guidance; do not strip the rig and claim successful animated character import.

No live facial-tracking module is configured in the current Expo camera setup. A native tracker must be evaluated against the actual Expo SDK and target phone in an installed development build. Expo Go camera preview alone is not evidence of tracking. Keep tracking progress, captured-view coverage and reconstruction confidence separate: detecting a face does not prove that a recognizable 3D model can be recovered.

## Technical ownership and invariants

- **Navigation and screens:** `App.tsx`, `src/navigation.ts` and the existing screen modules own the three-tab transition. Native sheets own temporary tasks; avoid a parallel navigation system.
- **Room and character rendering:** extend `AvatarView.tsx` / `avatarScene.ts` into a shared scene with explicit Home and Closet viewpoints. Preserve per-view asset ownership, cleanup and render errors. Pause work when inactive/backgrounded. Reduced Motion replaces orbit transitions with an immediate viewpoint change and disables idle motion.
- **Outfits:** the existing wardrobe reducer and stylist remain the source of truth. Selection never uses another dataset, removed/unavailable items or mismatched categories. Valid locks survive. Save and wear remain separate.
- **AI:** extend `src/domain/claude.ts` and `src/ai.ts` with a bounded wardrobe-styling task. Send relevant metadata, preferences, weather and bounded feedback/history, not face photos or arbitrary local paths. Validate returned IDs against the current owned, available wardrobe and enforce outfit/lock compatibility locally. Discard stale results after relevant edits. Identify local fallback visibly.
- **Weather:** add one small owner for city forecast retrieval/cache and provenance. Failed/stale forecasts use manual conditions; do not quietly imply freshness. A free provider's terms must fit the intended use before release.
- **3D assets:** extend the existing reconstruction/asset records with provenance and compatibility state, without copying private models into wardrobe backup/sync. Activate new assets atomically only after validation. Failed conversion retains the photo item and previous character. Deletion and cache eviction invalidate references explicitly.
- **Fit:** body registration, garment topology and garment-to-rig deformation belong to the local processing/asset pipeline; the mobile renderer displays validated results. Uniform scaling and color changes do not establish realistic fit. Layer order and collision handling must pass front, side, back and motion checks.
- **Privacy:** preserve HTTPS pairing, secure credentials, private storage, owner-scoped jobs and honest incomplete-deletion errors. Share neither personal captures nor reconstructed textures with external tooling during validation. Durable storage requires the installed native build; Expo Go remains a limited test environment.

## Implementation sequence and acceptance gates

| Phase | Deliverable | Required proof before claiming it works |
| --- | --- | --- |
| 1. Simplify and establish the room | Three tabs; character-first Home; direct clothing rail; shared real 3D room/viewpoints; Profile settings rows; saved looks relocated; focused add/edit sheets. Reuse existing avatar and label preview garment shapes accurately. | Existing state survives restart. Every old core action remains reachable. Category selection, locks, one-piece transitions and Undo work. Native device captures verify safe areas, large text, gestures, dark mode, Reduced Motion and render failure recovery. No fit claim. |
| 2. Personal styling | Real wardrobe-aware Claude selection, cached daily suggestion, destination selector and free city forecast with manual fallback. | Mock-provider tests reject invented IDs, wrong dataset/category, unavailable pieces and stale replies. Locks remain intact. Offline/timeout/rate-limit paths preserve the outfit. Explicit real-provider validation only with authorized credit use. |
| 3. Character creator | Expanded manual creator; external prompt/reference/asset import; capability-based camera flow with genuine local tracking. | Original avatar data migrates and rolls back safely. Incompatible files fail without replacing the current character. Tracking guides respond to measured pose/quality. Actual iPhone capture proves usable coverage and likeness; helper capture stays available when front-camera reconstruction cannot pass. |
| 4. Real clothes on your character | Calibrated body registration; usable garment topology; garment-to-body/rig mapping; layered deformation and local collision/draping workflow. Begin with one supported top, then bottoms, then an outer layer. | Real owned garment and body samples pass private front/side/back inspection, proportions, texture/seam fidelity, layer clipping and bounded animation. Missing views yield retake guidance. A surface remains non-wearable if any compatibility gate fails. |
| 5. Native acceptance | Installed native build, protected durable assets, camera/privacy verification and performance tuning of the completed flow. | Capture → process → review → wear → restart → restore → delete works on the user's phone. Test low memory, GPU/context loss, cache eviction, offline computer and deletion during work. Verify actual animation/frame time on the target phone; native export alone is insufficient. |

Phases 3 and 4 include research uncertainty: the installed photogrammetry engine does not solve live selfie reconstruction, missing geometry or natural garment fitting. Complete them with free local tools only after feasibility and asset-license checks. Do not represent completion of Phases 1–2 as completion of the full vision. If a proposed local technique fails real-photo acceptance, report the failure and retain the honest fallback rather than substitute generic geometry.

## Baseline verification and review boundary

- Read the existing Graphify graph first, then traced the relevant native screens, renderer, stylist, provider adapter, reconstruction client/server and local worker. The graph was newer than the sampled implementation files. Graphify's CLI trampoline failed; its installed Python module successfully queried the graph. Project integration already exists. This directory has a package root but no Git repository, so there is no Git post-commit hook to install.
- `npm run typecheck` passed. `npm test` ran 87 tests: 80 passed and seven HTTP tests could not connect to loopback because the sandbox returned `EACCES`. Reran the affected three test files with permitted loopback access: all 17 tests passed, including all seven previously blocked cases. No paid AI inference ran.
- Inspected the stored sample-character image and checked it against the current category-mesh implementation. It is a browser asset preview, not native device evidence. No new native visual, facial-likeness, reconstruction or fitting claim is made.
- Only this proposal was added. Product code, dependencies, wardrobe state, credentials and the existing design system were not changed. No personal capture was processed or transmitted.

**Review requested:** confirm or amend the proposed three-tab experience and implementation order before major product changes. The first implementation milestone is the complete simplified room experience; the full goal still requires the later character and garment acceptance gates.
