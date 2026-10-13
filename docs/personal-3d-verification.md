# Personal 3D wardrobe — verification evidence

## Passing source/build checks

- `node node_modules/typescript/bin/tsc --noEmit`: exit 0 on final source.
- `node node_modules/typescript/bin/tsc -p tsconfig.node.json`: exit 0.
- `node --test .node-build/tests/*.test.js tests/avatarAsset.test.mjs`: 75 tests, 75 passed, 0 failed, 0 skipped.
- `node node_modules/expo/bin/cli export --platform ios --platform android --output-dir work/personal-3d-preview`: exit 0 on final source.
- Android Hermes output: `_expo/static/js/android/index-ad48bc95958994b15267aafdf41e16d2.hbc`, about 5.3 MB.
- iOS Hermes output: `_expo/static/js/ios/index-db3b3c13f317495ff1bc41991e3115da.hbc`, about 5.2 MB.
- Original character GLB: 1,118,364 bytes, all eight clothing category groups present; self-contained and under the existing 2 MB asset budget. Geometry has finite vertices, normals, correct torso orientation and fewer than 60,000 triangles.
- Impeccable detector over changed native screens/components returned `[]` (exit 0). This is a mechanical source check, not native visual approval.
- `graphify update .`: AST-only refresh completed with 723 nodes and 1,905 edges. SQL parser remains unavailable, so SQL source must still be read directly.

## Relevant regression evidence

Claude tests verify atomic secure-setting serialization, preservation of old credentials on failed replacement, fixed provider endpoints, selected-photo-only payloads, bounded structured metadata, refusals/truncation, provider errors and account model-list pagination. Provider responses are mocked; no real paid inference runs.

Avatar tests verify all categories, unavailable-item/dataset isolation, one-piece precedence, appearance/mode persistence and uniform face placement. Clothing/body/skin changes do not modify imported facial vertices, color or texture. Shared textures and geometry are released. Scan validation rejects malformed/external/compressed/cyclic geometry and nonfinite facial vertices. Native candidate import decodes embedded textures and checks usable head bounds before replacing the committed scan.

The rest of the existing suite still covers wardrobe locks/shuffles, saves versus wears, state decoding, backup authentication, recovery and cloud conflict protections. It does not constitute a real two-device account test.

## Environment limitations and remaining proof

The sandbox blocked localhost connections in mock-server tests. Running the local suite with allowed loopback access passed. The first sandboxed native export failed because Hermes could not write its temporary bytecode file; the permitted local export outside that sandbox passed. No deployment or paid build was performed.

Metro still warns about the pre-existing `@noble/hashes/crypto.js` export fallback. Both native exports succeeded. No crypto dependency was changed.

No adb or iOS Simulator tooling was available. No native screenshots, actual GL texture-upload evidence, phone import/gesture/performance tests, real user-key inference, reconstructed personal likeness, signed APK/IPA, store upload or public deployment are claimed. Face-scan files are local-only and are not included in wardrobe backup/cloud sync.
