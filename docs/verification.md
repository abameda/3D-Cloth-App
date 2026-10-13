# Verification — 20 September 2026, version 0.3.0

## iPhone preview setup — 4 October 2026

- User's iPhone reported that Expo Go and Expo CLI must be signed in; the CLI was logged out and the previous preview was anonymous/offline.
- Completed Expo CLI browser authentication with the user's explicit approval. Linked the existing app to `@elshorbagys-team/ai-wearable-cloth`, project `2177adde-8ee3-401f-aa14-d3068980e2e7`. Updated only the Expo slug, owner and EAS project metadata; display name and native identifiers remain Thread's.
- Restarted Metro online. Requested the iOS multipart manifest with Expo's signing header: HTTP 200, certificate chain present, RSA-SHA256 manifest signature verified against the returned development certificate, and scope `@elshorbagys-team/ai-wearable-cloth`.
- iOS SDK 57 Hermes development bundle returned HTTP 200 (7,541,408 bytes). This proves signed preview delivery, not actual iPhone rendering or device acceptance.
- No cloud build, store submission, paid inference or plan upgrade was started. Real iPhone retest is pending.
- The subsequent iPhone screen identified Thread but could not fetch its bundle from the laptop's LAN address. Metro was running and listening on `0.0.0.0:8081`; the precise phone/router/firewall cause was not established.
- After explicit user approval for third-party exposure of the development code/assets, restarted Expo with its temporary ngrok tunnel. Through the public tunnel, the iOS manifest signature verified and the HTTPS bundle returned HTTP 200 (7,541,450 bytes). A new tunnel QR was provided. These transport checks still do not prove the app has opened on the iPhone; device acceptance remains pending.
- The user subsequently reported that the iPhone preview worked. This confirms successful opening by user report; camera/import, persistence, backup and account/sync acceptance have not yet been reported.
- Confirmed the Supabase organization remains Free and requested restoration of the inactive existing Thread project. The API accepted the request and subsequently reported `COMING_UP`. Follow-up management requests failed at the connector transport, direct endpoint checks failed to connect, and browser navigation timed out. Final backend availability remains unverified; do not report cloud sync as tested or restored to active yet.

## Final local gates

- `npm test`: **55 passed, 0 failed**. Covers constraints, migration, retained wear history, recovery, chunked storage, encrypted archives/assets, truncated streams, conflicts, auth-link parsing and mocked provider boundaries.
- `npm run typecheck`: passed.
- Native export: **iOS and Android passed**, producing Hermes bundles under `../../work/release-native-bundle`. These are not signed APK/IPA files.
- Metro reported a package-export fallback for `@noble/hashes/crypto.js`; exports completed. Check actual native crypto behavior before changing dependencies.

## Live backend

Free project `omuxejbtzruopopxadvv` has migration `20260919101506` applied. Tests in `supabase/tests/isolation.sql` passed with temporary fixtures rolled back: separate-user visibility, commits, stale/null revisions, cross-owner paths and revoked sessions.

Security/performance advisors returned no findings. HTTPS smoke checks: Auth settings 200; anonymous metadata access 401; unauthenticated deletion 401. The deployed delete-account function (version 2) verifies tokens through Supabase Auth and requires password reconfirmation. Legacy gateway JWT verification is intentionally disabled for signing-key compatibility.

No real end-user account was deleted, no real email was sent by the agent, and no paid inference ran. These checks do not prove email delivery or two-phone operation.

## Next phase: device acceptance

1. Test iOS/Android native rendering, light/dark, large text, keyboards, Back/dismiss and safe areas.
2. Test camera/library permissions, individual/batch import and real files/share sheets.
3. Test locked slots, one-piece/separates, shuffle/undo, saved looks versus wears.
4. Test restart, force-close during writes, recovery, wrong passwords, corrupted archives and large wardrobes.
5. Test two-device incremental sync, foreground behavior, drafts, conflicts and account switching.
6. Test real confirmation/recovery emails and account deletion using an explicitly disposable account.
7. Test local erasure separately from cloud deletion.
8. Confirm paid AI/try-on stay inaccessible.

No native screenshots or independent visual signoff exist. No browser preview was substituted. EAS account inspection stopped at a config-directory permission error before login status could be determined. The phase closes with code, tests and backend evidence; installable native builds and device evidence are next.
