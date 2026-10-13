# Thread native first-release specification

Historical 0.1 baseline. Use README.md, consumer-release-status.md and NEW-CHAT-HANDOFF.md for the current no-cost 0.3 edition.

## Architecture
Expo/React Native phone client with bottom sections Studio, Wardrobe, Looks and You. Each section uses native stack navigation. Item capture and editing use a native modal stack with cancel/save. A typed store serializes a versioned local document to AsyncStorage; image-picker results are copied to app-owned document storage. Domain functions operate independently of React Native and are tested with Node's test runner through tsx.

## Data
Profile: display name, optional photo URI, style choices. Garment: stable ID, title, category (top, bottom, shoes, outerwear, accessories), color, fit, formality 1–3, warmth 1–3, photo URI, availability, favorite, source (owned/example), creation time. Outfit: one optional garment ID per slot. Saved look: ID, title, slots, creation time. Wear: independent ID, timestamp, slot snapshot and item-name snapshot. Feedback: outfit signature, vote, time. Preferences use bounded scores derived from feedback, never silently inferred sensitive traits.

## Recommendation contract
Filter to active wardrobe and available garments. Validate locks; empty locked slots stay empty. Choose top/bottom/shoes when possible, optional outerwear/accessory only when requested or already present. Score context, color harmony, preferences and recent wear. Generate multiple candidates with injected randomness for deterministic tests. Avoid identical current outfit when alternatives exist. Single-slot shuffle cannot change any other slot. Return explanatory reasons and explicit missing-category/no-alternative messages. Feedback distinguishes rejection of a combination from disliking every item. History marks real wear only when user taps Wore this.

## AI boundary
Offline recommendations use local scoring, labeled On-device stylist. Optional server interprets free text into the same bounded context and tags one user-selected clothing photo using structured responses. Server validates every output with Zod; client still enforces ownership and locks. Server uses OPENAI_API_KEY and configured OPENAI_MODEL, shared per-install authentication token, body limit, rate limiting and request timeout. The mobile app asks consent before sending a photo. Unconfigured or unavailable AI falls back to editable metadata and offline styling. No API key is requested in chat or stored in app source.

## Interface
Studio leads with occasion, large outfit board, contextual note, lockable slot rail and Shuffle. Wardrobe is a searchable two-column photo grid with category filters and Add. Looks switches Saved/History. You edits personal identity, portrait and preferred styles, shows learned signals and provides explicit reset. All destructive deletion has confirmation. Sample wardrobe is opt-in and never mixes into owned recommendations; switching datasets preserves both.

## Verification and limits
Test owned/available filtering, locks, single-slot changes, sparse wardrobes, recent wear, feedback bounds, saved/worn separation, persistence decoding and server output validation. Run TypeScript, unit tests, Expo dependency checks and Android/iOS JS export. Native camera, permissions, accessibility and gestures require a connected device/emulator. Windows cannot run iOS Simulator; no device is assumed. Do not claim native runtime QA based on a web renderer.

## Subsequent releases
1. Secure accounts and encrypted cloud sync with per-user authorization.
2. Background removal and batch capture with human confirmation.
3. Photo try-on with explicit consent, cost limits and approximation labels.
4. 3D representation, garment assets and shopping compatibility using candidate items isolated from owned inventory.
