# Realistic try-on integration

INACTIVE: the latest user decision is strictly no-cost with try-on disabled. Client flags and server guards enforce that. This document is retained for potential future work, not permission to deploy or incur charges.

Thread uses FASHN's dedicated `tryon-v1.6` garment model. This is a real provider adapter, not a generated mock or a claim that the outfit board is try-on. No live inference has been performed because no provider account/key or body photos were supplied.

## Deploy

Use Node.js 24+ (built-in SQLite), persistent disk and one service instance for this implementation.

1. Set server-only `FASHN_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `THREAD_TRYON_DB`, `TRYON_DAILY_LIMIT` and `TRYON_PORT` from `.env.example`.
2. Run `npm run server:tryon`. Default bind address is loopback. Put it behind authenticated-user-compatible HTTPS ingress. Do not expose a provider key in the mobile app.
3. Supply durable disk for the SQLite database. Losing it loses job ownership/idempotency/quota records. Multiple instances need a shared transactional database before scale-out.
4. Set the mobile `EXPO_PUBLIC_TRYON_URL` to the HTTPS service origin and configure Supabase accounts. Rebuild the app.
5. In Studio, open Preview a piece on me. Add a separate full-body photo and select a photographed owned garment. Tops/layers, bottoms and one-piece garments are supported; shoes, bags, eyewear and other accessories are not synthesized.

## Contract

Every request verifies the Supabase bearer token through the Auth service. Jobs are owned by the returned account ID, not a client-provided user ID. The native selection enforces owned garments; because cloud wardrobes are encrypted, the server does not inspect or prove inventory ownership. The server validates input images, allowed garment categories and explicit consent.

- `POST /jobs`: consented person/garment JPEG data, category and request UUID. Creates an owner-scoped persistent job, reserves a daily quota slot, and submits once.
- `GET /jobs`: that user's recent job records.
- `GET /jobs/:id`: refreshes only that user's provider job and returns a completed base64 JPEG if available.
- `DELETE /jobs/:id`: removes the job from Thread's user-visible list. It does not cancel a running provider task, undo its cost or claim immediate provider deletion.

Maximum three submissions per rolling 24 hours by default. Failed/uncertain submissions count conservatively; client retries of the same UUID do not resubmit. A service crash after submission may leave an uncertain job. The service reports that uncertainty rather than silently charging for another inference. Metadata expires after seven days; results are treated as expired after 24 hours. Original body and garment photos are not written to server disk. The client holds the selected body photo only for that screen; generated results can be saved with the native share sheet.

Official references inspected: [tryon-v1.6](https://docs.fashn.ai/api-reference/tryon-v1-6), [API workflow and polling](https://docs.fashn.ai/api-overview/api-fundamentals). Before launch, verify the current [provider retention policy](https://docs.fashn.ai/api-overview/data-retention-privacy), commercial terms, regional processing, moderation and pricing. Thread's deletion action must not be described as immediate third-party erasure.

## Acceptance before consumer availability

Use consented adult test photos across lighting, poses, sizes, skin tones and garment types. Check preservation of identity, garment color/pattern, body shape and occlusion. Reject or explain misleading outputs; never market this as fit or size measurement. Measure latency and cost, verify timeout/restart/idempotency behavior, cross-account job access, quota, deletion, and force-close/resume on real iOS and Android devices. Provider transport is tested with an injected response; no real output quality claim is established yet.
