# Thread consumer-product program

Phase closed at 0.3 on 20 September 2026. The latest user decision is strictly no-cost with paid AI/try-on disabled. The original stages below are planning history; consumer-release-status.md and NEW-CHAT-HANDOFF.md govern the next phase.

Status: executing. The user authorized architecture choices and staged implementation. A feature is not complete merely because its screen exists. External integrations require deployed, authenticated services and device evidence before release.

## Audit and priority

| Priority | Evidence in current build | Consequence | Dependency / outcome |
|---|---|---|---|
| P0 | `store.tsx` has one AsyncStorage document and destructive reset as its only recovery | A damaged write or lost phone can lose the entire wardrobe | Recovery journal, validated restore, encrypted portable backups first |
| P0 | No account or remote data layer; photos are device-local URIs | No device migration or recovery | Authenticated, private, encrypted snapshot sync with explicit conflict handling |
| P0 | No device captures, signing or native permission QA | Consumer readiness is unproven | iOS/Android acceptance matrix remains a release gate |
| P1 | Studio mixes management, locks, feedback and explanation; first use starts with an empty inventory | Daily decision takes too much setup | Guided first outfit, clear main action, progress and reversible changes |
| P1 | All outfit shapes assume top+bottom; one generic accessory slot | Excludes common wardrobes | Add one-piece outfits and dedicated bag/eyewear slots with compatibility rules and data migration |
| P1 | Recommendation score gives tiny random noise and penalizes exact repeats only | Shuffle can bounce between two looks; repeated pieces and wear behavior weakly inform recommendations | Diversity among suitable options, piece-level recent-wear penalties, honest reasons and inspectable preference signals |
| P1 | Photo entry asks many fields; no duplicate or pending workflow | Cataloguing is a chore | Fast default entry, optional details and explicit AI suggestions; batch capture follows stable media lifecycle |
| P1 | AI requires a private service token; no product account bridge | Developer setup leaks into normal experience | Consumer account-backed service requests with configuration owned by deployment |
| P1 | Outfit board is not try-on | Main long-term promise is absent | Real asynchronous try-on provider, consent, owned garment validation, durable jobs, quota, retry/error/result deletion |
| P2 | No live forecast, calendar planning, reminders, wardrobe utilization or packing lists | Less habit-forming day-to-day support | Add after recovery, personalized recommendations and core capture are dependable |
| P2 | No store metadata/privacy deletion flow/operational observability | Cannot responsibly launch a public consumer service | Release pipeline and privacy/ops gates |

## Stages, dependencies and completion gates

### Stage 1 — Protect the wardrobe
Implement a last-known-good recovery journal, serialized durable operations, encrypted self-contained backup including managed photos, validated preview before restore, rollback on restore failure, and visible saving/recovery errors. Recovery must never prune the only copy of a photo. Tests cover interrupted writes, corrupt data, wrong backup password and tampering. No API credentials are needed.

### Stage 2 — Make the daily loop work
Migrate existing wardrobe documents without data loss. Support separates or a one-piece outfit, plus independent accessories. Improve recommendation diversity, recent-item wear and preference signals. Simplify first-use and everyday actions; retain locks and owned-item constraints. Tests cover migration, mutually exclusive outfits and deterministic recommendation invariants.

### Stage 3 — Recover across devices
Use Supabase Auth, private Storage and Postgres row-level authorization. Client encrypts the portable snapshot before upload. Revision compare-and-swap prevents overwriting unseen changes. A conflict offers explicit keep-device or restore-cloud choices; no blind last-write-wins. Account switching cannot silently associate a local wardrobe with a different user. Provide migration SQL and deploy/runbook, account screen, sync status, recovery-key handling and deletion. Live multi-device validation requires a configured Supabase project.

### Stage 4 — Realistic virtual try-on
Use a dedicated garment try-on provider rather than generic prompt-based image generation. User selects a separate full-body try-on photo and an owned garment with a photo, explicitly consents to upload, sees a durable queued/running/completed/failed job, and may save or delete the generated result. Account-authenticated jobs enforce ownership and per-user daily quota. Never infer measurements or promise fit accuracy. Existing outfit board remains an instant offline option. Provider API key and live output-quality evaluation are required before the feature can be marked production-ready.

### Stage 5 — Consumer release
Complete real iOS/Android visual and interaction QA (small phone, large text, dark mode, offline, denied permissions, force close during saves, account switching, restore and conflicts). Run provider acceptance and retention/cost review. Establish signed builds, crash reporting with PII redaction, restore drills and rollback. Public deployment, account creation in external services, paid inference and app-store submission are separate concrete actions; they are not assumed to have happened from code alone.

## Architecture decision
Keep React Native/Expo and native navigation. Keep pure validated domain functions, introduce storage/media boundaries instead of rewriting every screen. Supabase supplies managed authentication and per-user authorization rather than building password storage. Encrypted portable snapshots serve both user-controlled backups and initial sync: simple, inspectable recovery at the cost of full-snapshot transfer. Large wardrobes need per-asset incremental sync before public scale; enforce explicit bounds and fail without data loss rather than silently dropping photos. Try-on uses a server-side adapter with durable owner-scoped jobs, not provider keys in the app.

## Deferred by dependency, not omitted
Automatic batch garment segmentation, multiple arbitrary accessory instances, per-asset incremental sync, weather/location integration, notification scheduling, 3D body/garment simulation and shopping assistance follow the above foundations. Keep them visible in the release ledger; do not label them shipped.

## Execution ledger
- Audit complete from source and existing verification evidence. Native visual audit remains unperformed without device access.
- Architecture chosen under user's delegation; service choices can be adapted if an existing deployment is supplied.
- Stages 1–4 implementation in progress; Stage 5 remains gated by native devices, credentials, deployed services and explicit release actions.
