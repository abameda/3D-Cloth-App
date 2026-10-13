# Thread: 3D character and wardrobe

Status: proposed design, not implemented. Prepared 2026-10-04.

## Outcome

Add a rotatable, dressed 3D character to the existing native wardrobe app. Start with a generic adult test character because the user has no reference sheet ready. Allow a personal character later without replacing the wardrobe system. Aim for a polished stylized fashion character, with natural proportions, a recognizable face, modeled hair and separate garments.

## Existing behavior and constraints

- `src/screens/StudioScreen.tsx` reads the selected outfit from the shared store and renders `OutfitBoard`. Selection, shuffle, locks, undo, saving and wear history already exist.
- `src/screens/ProfileScreen.tsx` edits a portrait, name and preferences. The portrait is not a body model.
- `src/domain/state.ts` strictly validates stored data and keeps one-piece outfits mutually exclusive with tops and bottoms. Example and owned wardrobes are separate.
- `src/domain/photos.ts`, portable backups, streamed backups and cloud assets currently understand photos. Adding model files requires an explicit asset lifecycle; a model URI alone is not a complete import feature.
- The established product requires no paid inference and no WebView. Existing paid AI and photographic try-on remain disabled. The requested local 3D viewer can be implemented independently of those services.

## Recommended approach

Use Three.js with React Three Fiber's native renderer and Expo GL, subject to confirming compatibility with the installed Expo 57 / React 19.2 / React Native 0.86 versions before installation. Render locally on iOS and Android. Keep the interface in React Native and preserve the mint/forest design system.

Use a bundled, self-authored or appropriately licensed GLB character and a small set of matching clothing meshes. A polished asset is essential: a renderer alone does not provide professional character design. Build the initial asset in a neutral A-pose with clothing fitted to that same body. Rigging and animation are unnecessary for the initial turntable viewer; rotation applies to the whole dressed character.

Alternative: image-to-3D inference may produce an initial mesh, but requires a model/provider, substantial compute, and cleanup of geometry, materials and clothing separation. It cannot be promised as a free, small on-device AI feature. A custom-trained reconstruction model is outside this app's current needs.

## First implementation

1. Add a 3D preview route accessible from Studio and You, including when the owned wardrobe is empty. Opening it without clothes shows the explicitly labeled test outfit.
2. Load the bundled character and clothing locally. Support drag-to-rotate, front/side/back buttons, zoom and reset. Provide labeled buttons so gestures are not the only control method. Avoid automatic motion by default.
3. Read the existing selected outfit directly from the store. Map supported garment categories to separate sample clothing meshes and existing garment colors. Display the selected garment names below the viewer.
4. Explicitly label category-based representations as approximate shapes. A coat photo does not become an exact coat mesh. Unsupported categories remain listed with an explanation rather than being silently omitted.
5. Keep one-piece and separates mutually exclusive, preserve owned/example separation, and update the view when the outfit changes. The viewer must never mutate the outfit merely to make it render.
6. Start with a fixed body and curated appearance presets. Do not add body-shape sliders until clothing has compatible deformation targets; stretching only the body causes clipping.
7. Include loading, load failure, retry and unavailable-graphics states. Keep the flat board usable. Stop rendering on background/navigation and dispose of GPU resources on unmount.

The first version needs no backend or new backup format. Store only optional validated appearance preset IDs if customization is included. Old state without these fields receives defaults. Bundled models are application resources and do not belong in the user's backup.

## Personal character and clothing imports

A character sheet is an art reference, not a 3D file. The prompt in `character-reference-prompts.md` creates the visual brief for modeling. True personal model import should follow the working bundled viewer and define GLB validation, size limits, permitted embedded resources, storage, cleanup, encryption, backup/restore and compatibility with garments before shipping.

For a personal avatar, create or obtain a clean model from the approved reference, then inspect it in 3D. For clothing, model garments to the chosen body or use a garment-generation workflow with subsequent fitting and cleanup. Do not paste an entire multi-view reference sheet over a body as a texture or present a flat image on a plane as reconstructed 3D.

## Proof required before release

- Unit tests for category mapping, unsupported categories, one-piece rules, dataset isolation and persisted preset defaults/validation.
- Existing tests, TypeScript checks and Android/iOS bundle exports.
- Native device check of model loading, gestures/buttons, navigation away/back, background/resume, light/dark UI, screen-reader labels and GPU cleanup.
- Visual inspection of front, side and back views of every supplied outfit for clipping, transparent surfaces and missing materials.
- Performance measurement on an actual target phone; export success alone does not establish frame rate or native graphics compatibility.

## Completion boundary

A bundled test character wearing separate rotatable 3D clothing, connected to the existing outfit selection, with honest approximation labels and successful native evidence. Automatic reconstruction from arbitrary photos, exact fit prediction, cloth physics and paid inference are separate capabilities and must not be advertised by this version.
