# Thread — effortless photo-to-3D wardrobe
<!-- impeccable:product-schema 1 -->

## Platform
Native iOS and Android phones using React Native / Expo SDK 57. No WebView. Tablet-specific layouts are not a target.

## Mission
Users take photos; Thread handles isolation, reconstruction, texturing, optimization, character integration and outfit try-on. The default capture flow requires no manual modeling or texture preparation. The approved three-method character creator also offers optional external AI references and compatible asset import. Actual facial likeness, actual garment appearance and effortless use are the product goal. Custom avatars are an explicit alternative, never a substitute for failed reconstruction.

## Cost constraints
Anthropic Claude is the only allowed paid service. No paid reconstruction APIs, GPU hosting, subscriptions or billing-dependent free trials. Specialized models/tools must run locally at $0 additional service cost. Model IDs come from the user's Anthropic account; Haiku 5.5 availability is not assumed. Existing Free Supabase remains unchanged.

## Implemented now
An authenticated local COLMAP/OpenMVS/U2Net worker reconstructs actual multi-view geometry and photographed texture atlases. Native photo upload and guided RGB capture create jobs; progress, retries, cancellation and automatic artifact download are connected. Optional Claude inspects four representative views for actionable capture quality guidance. Local checks inspect all input views. Outputs are integrity-checked and privately previewed. Photo-face captures join the character only after explicit selection; reviewing an archive preserves the current face. Custom avatar choices persist separately.

## Product truth
This is real local photo reconstruction, but the full realistic outfit mission is unfinished. The proof images are a real architectural benchmark, not the user's face/clothes. Facial identity quality has not been verified. A reconstructed body/garment surface is not proof of measured fit. Garment output remains not fitted; body registration, sewing topology, layering and fabric draping are pending. TrueDepth acquisition/fusion is also pending; guided capture currently uses RGB only. No app or source test is evidence that those unfinished capabilities exist.

## Real capture validation phase

Guided capture now pauses at each face/body/garment view with the subject still. Models and capture reference photos persist together for native side-by-side review and reopen through the character or owned wardrobe item. Direct private-computer HTTPS is available without a cloud tunnel. Single-capture and delete-all controls cover computer work products and downloaded phone assets, with explicit offline failure. iOS native builds exclude app documents from OS backup and apply complete file protection; Expo Go does not apply that config plugin. These source features still need actual iPhone testing with the user's new photographs. The realistic digital twin and naturally fitted real clothing remain incomplete.

The user's next iPhone test uses Expo Go. For that environment, reconstruction files and face models use private cache excluded from OS backup. iOS can evict cached files, and computer captures expire after 24 hours; cache is not durable avatar storage. Existing persistent capture records are moved to cache when reopened. Installed Thread builds remain necessary for durable protected storage and native privacy acceptance.

## Data and control
Captures/work products stay on the user's reconstruction computer. An optional explicit Claude check sends four reduced views to Anthropic. HTTPS is required for phone-to-computer transfers. API keys and computer tokens stay in secure storage. Models are local-only and excluded from current wardrobe backup/sync. Delete capture removes computer files; inactive captures expire after 24 hours while the engine is running. Local phone erasure and computer/cloud deletion remain separate actions.

## Verification boundary
Read docs/automated-reconstruction-verification.md for real output artifacts and checks. Native device acceptance, a private phone HTTPS connection, actual facial/garment samples, depth integration, full body/garment fitting and license/dependency release reviews remain outstanding. Never describe the full mission as complete solely because a benchmark mesh or native bundle passes.

## Approved dressing-room redesign — 12 October 2026

The source now has Home / Dressing Room / Profile, a real native Three.js room, direct outfit selection, an accessible inventory alternative, separate computer pairing, wardrobe-aware Claude styling and user-selected city weather. Daily AI is opt-in and cached; credits and transmitted metadata are named explicitly. The local stylist remains available without AI.

The manual avatar now includes authored facial morph targets, body proportions, articulated arm motion, blink and wave clips. External AI flow copies a real prompt, saves a reference portrait and imports a bounded static head GLB with explicit provenance. A custom local iOS ARKit module implements live face tracking, pose/expression feedback and a privately reviewed face-surface candidate; only supported TrueDepth hardware in an installed build can expose it. Swift compilation and actual device/projection/likeness testing are outstanding; Expo Go and Android retain guided RGB capture. This is a tracked face-surface estimate with a neutral-front photograph, not a complete reconstructed head, measured raw-depth fusion or facial-expression rig.

Home can also display one actual captured garment surface under the rail, independently of the character. Room garments and selected outfit meshes remain category previews. These source capabilities do not establish photographic realism, full-body asset compatibility, image-to-character conversion or wearable garment fitting, layering and draping.

See docs/dressing-room-progress.md for checks and remaining work. Native rendering and actual phone interaction have not been visually verified. Source changes preserve reconstruction privacy, wardrobe storage/sync and the confirmed Claude-only paid-service rule.
