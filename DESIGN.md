---
name: Thread
description: Native personal wardrobe companion in a warm dressing room
colors:
  background: "#F5F1EA"
  surface: "#FFFCF6"
  inset: "#EAE3D7"
  board: "#E9E1D4"
  text: "#292C25"
  muted: "#615F56"
  line: "#D6CEBF"
  primary: "#3E5243"
  on-primary: "#FFFFFF"
  selected: "#DBE1D4"
  danger: "#A7352B"
  dark-background: "#201F1B"
  dark-surface: "#2B2923"
  dark-inset: "#38352D"
  dark-board: "#34312D"
  dark-text: "#F3EEE4"
  dark-muted: "#C4BEAF"
  dark-line: "#514B40"
  dark-primary: "#C3D3B7"
  dark-on-primary: "#253224"
  dark-selected: "#3C4836"
  dark-danger: "#FFABA6"
typography:
  headline:
    fontSize: "23px"
    fontWeight: 600
    lineHeight: 1.4
  title:
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.4
  control:
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
  supporting:
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  caption:
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  small:
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  field: "12px"
  control: "14px"
  board: "16px"
  chip: "24px"
spacing:
  compact: "8px"
  row: "10px"
  group: "12px"
  field: "14px"
  board: "16px"
  action: "18px"
  screen: "20px"
  section: "22px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "13px 18px"
  button-secondary:
    backgroundColor: "{colors.inset}"
    textColor: "{colors.primary}"
    rounded: "{rounded.control}"
    padding: "13px 18px"
  button-danger:
    backgroundColor: "{colors.inset}"
    textColor: "{colors.danger}"
    rounded: "{rounded.control}"
    padding: "13px 18px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "14px"
  chip:
    backgroundColor: "{colors.inset}"
    textColor: "{colors.text}"
    rounded: "{rounded.chip}"
    padding: "10px 16px"
  chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.chip}"
    padding: "10px 16px"
  room-view:
    backgroundColor: "{colors.board}"
    rounded: "{rounded.board}"
  rail-tile:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.control}"
    width: "126px"
    height: "134px"
---

# Design System: Thread

## Overview

**Creative North Star: "Your own dressing room"**

Thread places a chosen character and owned clothing within an authored native 3D room. Warm plaster and oak provide the setting; restrained moss tint identifies actions and selection. Photographs and garment colors supply personal variation. Thread remains a working name.

This is a source milestone for React Native / Expo iOS and Android phones, with native stacks, three bottom tabs and focused tasks. It records implemented rules rather than visual approval. Tablet layouts are outside the product target; existing wardrobe storage, backup/sync and reconstruction privacy remain infrastructure.

**Key Characteristics:**
- Warm light and dark UI roles, separate from lit 3D materials.
- Character and room views paired with real wardrobe data and photo rails.
- Concise Profile settings and disclosed secondary outfit tools.
- Explicit distinction between custom avatars, reconstructed heads and clothing previews.

Evidence: `App.tsx`; `src/ui/theme.ts`, `primitives.tsx`, `SettingsRow.tsx`, `DressingRail.tsx`, `OutfitPreview.tsx`, `AvatarView.tsx`, `roomScene.ts`, `avatarScene.ts`, `Icon.tsx`, `GarmentSurface.tsx`, `NativeFaceScanner.tsx`; Studio, Wardrobe, Profile, Context, Avatar, Computer and LiveFace screens; `modules/thread-face-scanner/ios/ThreadFaceScannerModule.swift`, capture activation and face-record ownership paths. Product boundaries come from `PRODUCT.md`; direction comes from `docs/thread-dressing-room-proposal.md`. The shared control shapes and infrastructure remain; mint palette, packing-mat composition and four-tab notes are superseded.

Verification boundary: no current iOS Simulator/device or Android emulator/device screenshots exist. The finish review disposition is **recapture**. Old asset images are browser inspection only. Native light/dark rendering, large text, clipping, safe areas, keyboard behavior, gestures, touch spacing, accessibility and performance remain unverified. No web detector ran; native code is outside its scope. Source checks cannot confer native acceptance, photographic likeness or production completion.

## Colors

Warm ground and cream surfaces support moss actions and charcoal reading. Frontmatter records reused interface roles from `theme.ts`; `dark-` tokens replace matching roles through `useColorScheme`.

### Primary
- **Moss action tint:** primary buttons, selected chips, selected tab and active icon controls, paired with on-primary foreground.
- **Held sage:** selected garment fields and icon fills, with primary outlines where implemented.

### Neutral
- **Warm plaster ground:** screens.
- **Cream surface:** fields, rail tiles and navigation.
- **Inset plaster:** secondary controls, search and notices.
- **Room surround:** board remains the GL container/background role; it no longer means an outfit packing mat.
- **Charcoal / muted ink:** reading and secondary explanation.
- **Warm divider:** input outlines, settings/inventory separators and tab boundary.

Danger marks destructive button text and errors. The unused warning pair is omitted. `colorHex`, skin and hair palettes describe content, not UI accents.

**The Semantic Pair Rule.** Resolve foreground and background together from the active theme; primary and on-primary change together in dark mode.

**The Material Boundary Rule.** UI colors identify controls; room material colors describe lit geometry. A shared hex does not make these roles interchangeable.

3D material colors are separate: plaster (light #E9E1D4 / dark #34312D, roughness 1), oak (#BA9B76 / #72604C, .86), floor (#D7C7AF / #262420, .85), shelves (#CFB490 / #4C4337, .8), metal (#A7A49B, metalness .8, roughness .28), mirror (#C9D4CF / #788583, metalness .92, roughness .15) and standing mat (#C2B49D / #645B4D, roughness 1). Mirror is a reflective surface without a live character reflection. Static category fabric tones #C6C0B4, #5C6661, #E2D6C4 and #89745F are illustrative room meshes, not photographed possessions.

## Typography

**Body and control font:** platform default native UI family; no custom face is loaded. Native navigation owns header typography. System UI type is appropriate here, not a branded display face.

Frontmatter px values serialize numeric React Native sizes, not instructions to disable scaling. Label uses a 1.4 line-height multiplier. Reused roles include headline (23/600), title (19/600), body (16/400), control (16/600), chip label (15/400, selected 600), supporting (14), caption (13) and small (12). Fields use 17; tab labels 12/500. Profile/Computer use 25/600, Context 26/600 and creator 24/600 as local treatments, not a separate display scale.

Manual size assignments are observed source behavior, not semantic iOS Dynamic Type or Material text-style conformance; that gap remains review debt.

## Layout

Standard screens scroll with 20 edge padding, 22 section gap and bottom padding max(28, safe-area bottom + 16). Fields use 8 gap, groups 12, rows 10 and wrapping choices 8. No tablet breakpoints are implemented.

Home has a greeting/day line above the room, height min(430, max(290, window-height Ã— .46)); the data rail follows, then styling and disclosed outfit tools. Dressing Room uses min(370, max(270, window-height Ã— .4)), an inventory alternative for search/access and one Add clothes action. Profile uses a 230-high portrait and concise settings rows. Viewport fit remains unverified.

Categories scroll with 8 gap. Data rail tiles have width 126, artwork height 134, 12 gap, names and availability/reference labels. Settings rows have minimum height 60, vertical padding 12, icon/content gap 14 and a bottom divider. Secondary forms reuse fields, chips, switches and notices with save/discard boundaries.

The room has a 6-wide floor and three walls; 3.8-wide cabinet back, two hanging rails, trouser/shoe/accessory shelves, mirror and circular standing mat. Home camera targets the character; closet camera targets cabinetry. Raycast taps resolve meshes tagged top, outerwear, bottom, shoes or accessories. One-piece is available through the data category rail rather than a dedicated room mesh. Targets are categories, not item IDs or garment assets. Inventory and photo rails operate on current wardrobe data and selection.

## Elevation & Depth

Shared 2D controls use flat tonal layers and lines, with no custom shadow/elevation vocabulary. Native stack/modal depth remains platform-managed. The room supplies actual perspective geometry and lit materials.

Native GL uses ACES filmic mapping/exposure 1.15, hemisphere light, warm key and cool fill. Closet camera interpolation lasts 520ms with cubic-out progress. Reduce Motion makes it immediate and disables clip motion. Focused foreground views own rendering; mixer, renderer, geometry, materials and textures dispose on release. These source safeguards still require hardware proof.

## Shapes

Fields/notices use 12 rounding; buttons/icon controls/rail fields 14; clipped GL views 16; chips 24. Selected rail fields add a 2-width primary border. Field outlines and row separators use 1-width lines. Clothing artwork uses contain. Cabinetry uses boxes, rails cylinders and mat a shallow cylinder; this is room geometry rather than 2D control styling.

## Components

### Buttons
Primary, secondary and danger share minimum height 52, padding 13 vertical / 18 horizontal, centered semibold text, optional 20-size icon and 9 gap. Press opacity .72; disabled .45. Loading uses an indicator and disables interaction. Icon controls are 48 square with selected fill/primary tint; press/disabled opacity .6/.4. Icons are SF Symbols on iOS and Ionicons on Android, not invented glyphs.

### Chips
Minimum height 48; padding 10 vertical / 16 horizontal. Selected uses primary/on-primary and weight 600; default inset/text and weight 400. Press opacity .7. Category chips scroll; form choices wrap.

### Cards / Containers
Rail fields use surface fill and real garment art. Selection uses selected fill and primary outline. Unavailable pieces are disabled for direct wear and fade to .55; inspection remains possible in the closet. Notices use inset fill, field rounding, 14 padding and polite live-region semantics, with muted or danger text.

### Inputs / Fields
Semibold labels precede native TextInput with 8 gap, surface fill, line border, 14 padding and minimum height 52. Selection uses primary. Multiline aligns top. No custom focus border exists in source. Context/computer forms use iOS keyboard avoidance; native keyboard and focus acceptance remain open.

### Navigation
Three bottom destinations: **Home / Dressing Room / Profile**. Native-stack section headers use inline titles (`headerLargeTitle: false`); this is source behavior, not HIG large-title approval. Tabs pair platform icons/labels with primary active and muted inactive tint, surface fill and line boundary. Saved looks open from Home; history from Profile. Add/edit, Context and SaveLook use iOS modal / Android card presentation; other tasks use the root stack. Computer pairing is a Profile task separate from AI settings.

### Character and room preview
Native Expo GL / Three.js loads the bundled character and authored room. Drag rotates the Home character; Front / Side / Back native actions provide alternatives. Loading, timeout, errors and Retry keep wardrobe access available. Missing character offers creation rather than asserting likeness. Imported/reconstructed heads preserve geometry/textures on a standard body. Clothing meshes show category colors/cuts rather than reconstructed garments or fit.

Manual presets drive authored Round/Square head, Small/Strong nose, Smile mouth, Wide eyes and Bold brows morph targets, hair/skin, build width and height. The bundled character has real Idle/Wave clips with mixer playback; custom mode exposes Wave hello. Source clips/morphs do not establish realistic expression, likeness or garment deformation. Native live face source now exists for installed iOS builds on supported TrueDepth hardware; it is uncompiled and device-unverified on this Windows host. Full-head/body reconstruction, full-body import, automatic AI-image conversion, verified photographic likeness and wearable reconstructed fitting remain incomplete.

**The Preview Truth Rule.** Keep category shapes, saved photo references, reconstructed surfaces and wearable garments distinct. Room decoration is not the owned inventory.

### Captured garment surface
`GarmentSurface` displays one actual captured owned garment below Home’s rail when an installed reconstruction is available. Its 230-high native GL view preserves original geometry/texture, supports drag inspection and offers comparison/recovery. Rendering is limited to focused foreground use. The surface remains separate from the character and explicitly not fitted; room hangers and character outfit meshes remain category previews. Native texture appearance and hardware resource use remain unverified.

### Live face source and candidate review
The local `modules/thread-face-scanner` Expo module and `LiveFaceScreen` use ARKit face mesh, head pose and expression measurements with capture gates and anchor-continuity checks. The capability-gated button requires an installed iOS build and supported TrueDepth hardware; Expo Go, Android and unsupported hardware retain guided RGB capture. Eight checked poses produce averaged SDK face-surface positions with one neutral-front photograph projected as texture. This is an estimated static face surface, not a complete head, measured back/ears/hair, personal body or facial rig.

Private photograph/3D candidate review precedes explicit activation; failure preserves the previous character. Candidate files use private cache and are pruned on cleanup, startup and local erasure. Photo-face archives retain their own models independently of the selected face: download/open does not activate them; Use this face performs explicit integrity-checked activation, and capture ownership is retained for deletion.

This source has not been Swift-compiled on Windows. Native module registration, physical pose directions, projection/UV orientation, side texture, facial likeness, permissions, lifecycle, storage/privacy, gestures and performance require an installed build and phone proof. No live scan has been established to work on a phone. See `docs/live-face-native-acceptance.md` and `docs/dressing-room-progress.md`; the original scope remains unfinished.

### Profile and secondary tasks
Profile starts with portrait/name/Edit character and settings rows. Preferences and insights disclose in place. Daily Claude is explicit opt-in with metadata/credit use named. Context distinguishes forecast freshness from manual weather. Character creation names Scan my face / AI references / Build my avatar; images remain references and static-head GLB import remains bounded. Computer pairing uses a concise HTTPS/certificate/token task. Existing privacy/storage/backup constraints remain intact.

## Do's and Don'ts

### Do:
- **Do** resolve interface colors through useTheme in both appearances.
- **Do** retain native navigation, accessible control names and system text scaling.
- **Do** preserve clothing photo aspect ratios and provenance labels.
- **Do** distinguish saved looks from wear history.
- **Do** retain category buttons and the inventory alternative alongside 3D targeting.

### Don't:
- **Don't** portray category meshes or a standard preview body as measured fit.
- **Don't** treat an image reference or a valid head GLB as a complete character.
- **Don't** use browser asset previews or source checks as native visual-review evidence.

Not canonized or repaired: manually chosen type sizes, custom native control/platform-conformance gaps, inline top-level titles and incomplete touch-spacing/accessibility evidence remain source/review debt. Native recapture and hardware checks are required. No decorative kickers, hard offset shadows or invented glyph icons were found in sampled components; system UI type is not a branded display rule. Verification gaps and unfinished capabilities are not rules for future screens to inherit.
