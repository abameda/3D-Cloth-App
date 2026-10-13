# Current cloud deployment

Thread is already deployed on Supabase Free:
- Project ref: omuxejbtzruopopxadvv
- Region: eu-west-1
- Migration: 20260919101506_thread_private_wardrobe_vault.sql
- Private bucket: thread-vaults
- Table: public.wardrobe_snapshots
- Edge Function: delete-account, version 2

Do not create another project or reapply the initial migration. Public client identifiers are in src/projectConfig.ts. Never place service-role credentials in the app.

The database enforces ownership and an active auth.sessions record. Commits compare the expected revision before replacing the pointer. The privileged implementation resides in thread_private; the exposed wrapper is security-invoker. Live temporary-fixture checks passed and rolled back. Advisors returned no findings.

Cloud sync encrypts metadata separately from photos, reuses unchanged encrypted assets and supports explicit foreground synchronization. Conflicts do not silently merge or overwrite. The recovery password is distinct from the account password and is retained in SecureStore only for opt-in automatic sync.

Account deletion verifies the bearer token via Supabase Auth, verifies the account password again, revokes sessions, removes objects and deletes the user. Legacy gateway JWT verification is disabled intentionally for current signing keys; body authentication remains mandatory. Unauthenticated live requests return 401. Positive deletion with a real disposable account remains a next-phase test.

Supabase Free's default sender has recipient/rate restrictions. Dashboard template editing required Pro or custom SMTP, so it was left unchanged. The app accepts default signup/reset links or codes. No-cost public email delivery still needs an eligible sender/domain setup and acceptance testing; do not upgrade automatically.

Historical encrypted cloud blobs are not automatically garbage-collected yet. Design race-safe retention before deleting them, since another device may be preparing a commit. Monitor the free storage quota.

Next: real email/account test, two-device incremental upload/restore/conflict, force-close/restart, and disposable account-deletion test. See NEW-CHAT-HANDOFF.md.
