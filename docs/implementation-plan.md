# Thread Native Implementation Plan

> Execute inline using executing-plans; independent final review and design documentation use the Impeccable handoffs.

**Goal:** Deliver a runnable native wardrobe companion with durable personal inventory and constrained styling.
**Architecture:** Pure typed recommendation and state modules, native React Native presentation, optional authenticated AI bridge.
**Tech Stack:** Expo 57, React Native, TypeScript, React Navigation, AsyncStorage, Expo image picker/file system/haptics, Node test runner, Zod.
**Spec:** docs/spec.md

## Global constraints
- Native iOS/Android phone components, no embedded website.
- Suggestions reference owned available garment IDs; locked slots never change.
- Save and wear actions remain separate; local data and photos survive restart.
- Example wardrobe is opt-in and separate. No fake try-on, live weather or AI claims.

## Task 1: Domain and persistence
Files: src/domain/types.ts, stylist.ts, state.ts; tests/domain.test.ts.
Interfaces: suggestOutfit(items, current, locks, context, feedback, history, random), shuffleSlot(...), appReducer(state, action), decodeState(raw).
- [x] Add tests demonstrating lock preservation, ownership/availability, sparse wardrobe recovery, single-slot behavior, feedback and saved/worn separation.
- [x] Run `npm test` and observe failing assertions or missing exports.
- [x] Implement pure functions and versioned state validation.
- [x] Run domain tests and TypeScript.

## Task 2: Native companion
Files: App.tsx, src/ui/*, src/screens/*, src/store.tsx, src/data/demo.ts, src/media.ts.
- [x] Add native navigation, theme, large text-safe primitives and durable store.
- [x] Implement Studio with board, context, locks, selection and shuffle.
- [x] Implement photo capture/import, item editing, search, availability, deletion and favorites.
- [x] Implement saved looks, wear history and profile/preferences.
- [x] Implement opt-in example wardrobe and helpful empty/error states.
- [x] Typecheck and export iOS/Android bundles.

## Task 3: Optional AI
Files: server/index.ts, server/ai.ts, src/ai.ts, tests/ai.test.ts, .env.example.
- [x] Test schema validation, auth, invalid payload rejection and constrained metadata output.
- [x] Implement structured context/photo endpoints and server-only secrets.
- [x] Add client connection settings, timeout and honest offline fallback.
- [x] Verify endpoints without a live API key through injected model responses; document live inference unverified.

## Task 4: Delivery
- [x] Run tests, typecheck, dependency checks, native bundle exports.
- [x] Review actual source and available runtime evidence; fix material findings.
- [ ] Complete native visual/gesture/camera review on iOS and Android devices.
- [x] Record design tokens from shipped implementation.
- [x] Write README, setup/run/build instructions and verification limitations.

## Progress
Implementation tasks 1–3 complete. Domain, native UI, optional AI service, regression fixes and documentation are present. 28 tests and strict TypeScript pass. Android/iOS Hermes exports pass. Source review's three findings are resolved. Design tokens documented from source. Task 4 native visual/interaction acceptance remains pending on actual devices; no simulator is available and no browser capture was substituted. See docs/verification.md.
