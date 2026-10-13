# Thread real capture acceptance — 11 October 2026

The experience is not complete. A photo-based surface, a passing source test, and a native JavaScript bundle do not prove a recognizable digital twin or naturally fitted clothing. The user will capture new photographs on an iPhone; none have been provided or tested in this phase.

## Available for the next capture

- Face, body and garment capture each have a preparation guide. The camera pauses at every view. Face capture defaults to a helper using the rear camera around a still head, with a neutral expression; the old timed head-turn sequence is removed. Body capture keeps the pose fixed. Garment capture uses a stable support and all sides.
- Captures carry their guide labels and approximate camera yaw to the engine. Gallery uploads are explicitly unlabeled, rather than guessing their angle. The guide does not supply camera calibration or measured body dimensions.
- Reconstructed models and the input reference photos download into private app storage. Capture displays an original photo beside a rotatable native 3D view, with previous/next and front/left/right/back controls. Camera orbit and model rotation have opposite signs. These are visual comparisons, not pixel-aligned renders or quantitative acceptance results.
- Face output integrates through the existing avatar loader. Body captures reopen from Your character. Garment results reopen from their actual wardrobe item, including when the computer is offline. Garment surfaces are still unfitted; they are not inserted into the outfit as wearable clothing.
- A capture's Delete action removes computer inputs/work products and downloaded phone assets. Privacy has a delete-all action that waits for active processing to stop. Deletion failures remain actionable and do not report success. Local-only wardrobe erase explicitly leaves computer captures untouched. Removing a garment removes its phone reconstruction files; the confirmation explains how to delete its computer capture too.

## Private iPhone pairing

The computer now has direct authenticated HTTPS support, so a cloud tunnel is unnecessary. Its Wi-Fi address changed during the pause; private certificates and the worker were updated for `192.168.50.8`, with engine URL `https://192.168.50.8:8790` and Expo Go URL `exp://192.168.50.8:8081`. Use the current `.data/phone-tls/thread-private-root.cer`, not the archived certificate for the previous network. The private token was preserved and never displayed. A DHCP address change requires updating the certificate and configuration before capturing.

1. The user will use Expo Go for the next capture test. In Expo Go, face models and reconstructed model/photo comparisons use private cache storage excluded from OS backups, instead of Documents. iOS can evict this cache. Re-download only works while the corresponding computer capture remains available; computer captures expire after 24 hours. An installed Thread development build is needed for durable protected storage and final native privacy acceptance. This Windows host has not built or installed an iPhone binary; no paid build service was used.
2. Transfer only `.data/phone-tls/thread-private-root.cer` directly to your iPhone. Install that certificate profile and enable that specific root under Settings → General → About → Certificate Trust Settings. The setup script did not change Windows or iPhone trust. Never share `server-key.pem`, the pairing token, or capture folders.
3. Keep phone and computer on the same private Wi-Fi. Under You → AI settings → Free local 3D reconstruction, enter the computer HTTPS address and existing private token. Save and check the computer. Certificate trust and Windows firewall access from the actual phone remain untested.
4. Keep Claude capture inspection off for a wholly local photo workflow. Enabling it explicitly sends four reduced representative images to Anthropic and uses the user's credits. No other paid services are used.

Review personal photographs and reconstructed likeness locally in Thread. Do not send them, their texture atlases or model screenshots to external vision tools or chat services as part of validation. Local numerical diagnostics can be used without uploading those private images.

The native iOS config plugin excludes the app Documents directory and descendants from OS backup and applies complete file protection. Android app backup is disabled. Plugin source transformation is tested; actual iOS enforcement requires a native build and a phone test. Expo Go uses the cache policy instead; it does not apply these native build settings. Existing document-based capture records move to cache when reopened, with metadata committed before the old copy is removed. Thread backup/sync excludes reconstructed models and capture references independently of OS settings.

## Required real-photo run

1. Capture the face in Thread with stable light. Process locally and compare front and both profiles, including elevated views. Inspect recognizable eyes, nose, lips, jaw, ears, skin texture and head proportions. A successful file download alone is a failure of this acceptance step.
2. Capture the body in a fixed pose, including feet. Review all sides. The current result lacks calibrated physical scale and body-to-avatar registration; these must be implemented and checked before natural fitting can pass.
3. Save one actual garment as an owned wardrobe item, then capture it on a stable support. Inspect front, back, sleeves, hems, closures, seams and texture. Record missing surfaces, disconnected fragments and texture stretching privately. Infer unseen details only with an explicitly identified modeling method; current photogrammetry does not provide one.
4. Close and reopen the app. Reopen that item and the face/body capture. Confirm the correct model and source photos restore; switch views and rotate the model on the phone.
5. Integrate the measured body and garment into a common character coordinate system and implement wearable topology, collision handling and draping before testing outfits. Then test at least a top/bottom combination and an outer layer from all sides. Identity, proportion, layering, clipping, floating and believable fabric behavior all have to pass. This step cannot pass with the current implementation.
6. Delete one capture and verify it cannot be retrieved from its photo/artifact endpoints and no downloaded model or comparison photo remains. Test delete-all during processing. Disconnect the computer, attempt deletion, and confirm the app reports the incomplete operation and permits retry. Originals in Photos and user-exported copies are separate.

No step requiring actual iPhone interaction or real personal photographs has been marked passed.

## Evidence from this phase

- Native and server TypeScript checks passed.
- 87 automated tests passed, including owner-only photo retrieval, view-count validation, cancellation before complete deletion, Expo Go cache policy, private development-route blocking and iOS config transformation. HTTP reconstruction tests use a measured castle artifact with a mocked worker; they are transport/privacy tests, not facial or garment reconstruction evidence.
- The direct HTTPS check accepted the locally trusted certificate, rejected an unknown CA and wrong pairing token, and reported the installed free runtime ready. It supplied no photos and made no paid call.
- The running worker passed authenticated HTTPS readiness on the current private Wi-Fi address. The live Expo Go manifest returned Thread, and private photo/credential routes returned 403. The locally generated launch QR was decoded and checked against the intended Expo Go URL. Reachability from the actual iPhone and its certificate trust remain untested.
- The final iOS development bundle served by Metro returned HTTP 200 (11,226,854 bytes). The current Expo Go server runs with live reload enabled. The authenticated HTTPS worker remains running separately. Neither result proves native rendering or photographic reconstruction quality on the phone.
- Both iOS and Android Hermes bundles exported. This is not an IPA/APK, a native iOS compile, or phone camera/rendering evidence.
- The UI detector returned no findings. Real device visual review remains pending.

## Largest remaining failures

1. **No wearable garment reconstruction or fitting system:** surfaces have no sewing topology, calibrated correspondence, cloth constraints, collision-safe layering or draping. Uniformly scaling them onto a standard avatar would not satisfy the goal.
2. **Identity and full-body realism unvalidated:** facial likeness has no real user-photo evidence; the avatar still uses a standard body around the face. Body reconstruction is a standalone surface, not a registered personal character.
3. **Unseen geometry:** the local photogrammetry engine cannot faithfully recover surfaces absent from photos or reliably reconstruct smooth/shiny/dark fabrics. A supported completion method is still needed.
4. **Actual phone acceptance pending:** the native build, certificate pairing, camera sequence, textures, restart recovery and deletion must be exercised on the user's iPhone.

The improvements make the next real capture reviewable. They do not finish the intended digital twin and real-clothes experience.
