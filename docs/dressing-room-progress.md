# Execution ledger — docs/superpowers/plans/2026-10-12-dressing-room.md

Approved: 12 October 2026, user: “Approve and implement”. Full original goal remains binding.

Ruling: implement the approved plan directly, without another design/execution approval — explicit user authorization outranks skill handoff defaults.

Ruling: use the authorized package checkout — no Git repository exists; no commits or worktree operations apply.

Ruling: the approved warm plaster/oak/brushed-metal dressing room wins over Impeccable's degraded direction roll — the user already pinned the visual world. No challenger/quality-board result was available. Native code-led implementation; no raster comp or fake 3D.

Task 1: source complete — three-tab ownership, secondary saved/history routes, direct selection and lock/shape invariants.
Task 2: source implemented — real native room meshes, category raycasting, Home rail, closet/list, concise Profile, separate computer pairing, warm light/dark tokens. Native appearance and gestures remain unverified.
Task 3: source implemented — wardrobe-aware Claude, bounded metadata/schema and local constraints, city weather with freshness/provenance, opt-in cached daily suggestions. Mock-provider proof only; no paid inference.
Task 4: partial — manual face/eye/nose/brow/mouth/height presets and seven skin tones, authored morph targets, articulated Idle/Wave and Blink clips, external copyable prompt/reference portrait/head GLB import with provenance. Native ARKit live tracking and bounded face-surface capture source is now implemented for an installed iOS build on supported TrueDepth hardware. It is NOT compiled or device-validated on this Windows host. Full-head reconstruction, full-body import and reference-to-model conversion remain unfinished.
Task 5: pending — wearable fitting and native acceptance.

Baseline: native TypeScript passed; 80/87 tests passed in sandbox and affected 17/17 passed with loopback access. No paid inference. Native/device and real personal-photo evidence remains absent.

Verification 12 October: native TypeScript passed; full test suite 114/114 passed with local loopback. iOS/Android Hermes exported to `work/dressing-room-preview` before the final review fixes; rerun after subsequent product edits. Sandbox initially blocked Hermes temp writes; normal temp access exported successfully. No paid calls or personal capture processing.

Independent source review: six findings corrected (daily preparation/response identity, shape constraints, erase/write race, dirty preference merge/save, list category access and wrong-city forecast). Focused fix review resolved five and found a trim/save follow-up; that is corrected and verified by the reviewer. Full-state replacements now reset dirty Profile drafts through the store's replacement generation.

Ruling: static parser/reconstruction tests use the preserved synthetic `tests/fixtures/static-scan.glb`, so adding real animations to the bundled character does not invalidate their unanimated-input assumption. Static head import still rejects animated/rigged assets; rejection guards were not weakened.

Dependency: added only SDK-compatible `expo-clipboard ~57.0.2` for actual prompt copying. npm installation reported 27 audit findings (9 moderate, 18 high); no broad dependency upgrades or audit-force changes were made.

Additional proof: full suite 119/119 passed after live-scan and capture-ownership work. Expo autolinking found and resolved the local ThreadFaceScanner pod/class among 22 modules with normal filesystem access; sandboxed discovery misleadingly returned zero modules. Numerical tests validate supplied geometry/JPEG-to-GLB packing, pose/expression gating and anchor continuity. None compiles Swift or establishes actual scan accuracy.

Final JavaScript exports for this milestone passed after those fixes: Android `index-16aa5875ce155f61b0ba61926fed1ad5.hbc` (5.5 MB), iOS `index-ea4098622e148e3d0589218262a2cd32.hbc` (5.4 MB), metadata in `work/dressing-room-preview`. Export reported a forced process exit after writing successfully; no iOS native binary or Swift build was produced. Metro retains an existing @noble/hashes subpath-resolution warning.

Live-scan source: native ARSCNView shows the actual tracked face mesh; measured head-pose/expression fields gate captures; native code rechecks pose at capture. Eight pose samples average the SDK's face-surface positions, with one neutral-front photograph as texture. This is an estimated tracked face surface, not a reconstructed complete head or facial-expression rig. Candidate is privately previewed and explicitly accepted before replacing the character. Expo Go/Android/unsupported hardware retain genuine guided RGB capture. Camera restarts remount the view; anchor loss/change clears the sequence; old events/generations cannot add poses. Preview cache is erased on normal cleanup, scan-screen startup and global local erasure.

Capture ownership: downloaded photo-face archives now retain their own model instead of pointing at the selected character. Opening/downloading a past capture never activates it; Use this face is explicit and integrity-checked. FaceRecord.captureId binds photo activation to its capture. Deleting a capture uses metadata-only ownership checks, so evicted unrelated tracked/imported faces neither block deletion nor get removed.

GarmentSurface displays one actual captured owned garment beneath Home's rail when available, retaining the original geometry/texture and focus/foreground lifecycle. It is clearly separate and not fitted. Room hangers and character clothing remain category previews.

Native finish review: disposition **recapture**. Required actual iOS/Android Home, Dressing Room and Profile screenshots are missing. Default/max accessibility text and light/dark captures, gestures and hardware performance remain unverified. Existing browser asset screenshots are not evidence of native appearance. DESIGN.md and .impeccable/design.json were updated from implemented source with those limits.

Remaining original-goal work: complete actual 3D garment collection/character integration and natural wearable fitting; Swift/native compilation, live-tracker projection/pose direction/likeness/device validation; full-head/body realism; image-reference conversion and validated full rig import; calibrated body registration, layering/draping and actual phone acceptance. Do not mark the goal achieved or describe this source milestone as the full vision.

Mac handoff: user confirmed iPhone testing and access to a Mac on 12 October. Added docs/mac-iphone-setup.md and scripts/run-ios-local.sh for a local Xcode build without paid cloud services. Build-script Bash syntax passed; the Mac/iPhone commands themselves have not run here. scripts/package-mac.ps1 produced work/mac-handoff/thread-mac-test-2026-10-12.zip: 142 allowlisted source/test/doc files, 2,332,472 bytes, SHA256 1d965e95155256f131fc8ae35ecb214a62a258fe5c086d17e4244e94a947dc74. ZIP entries were checked for portable separators, required source/module/plugin/fixture files, and exclusion of .env/private capture/runtime/cache/generated-build paths. Installed native app data is separate from Expo Go; the guide covers encrypted wardrobe backup transfer and separate credentials/capture recovery.
