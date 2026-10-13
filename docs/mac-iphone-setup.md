# Install Thread on your Mac and iPhone

Use a local Xcode development build to test the native 3D room and face scanner. No EAS cloud build or paid reconstruction service is needed. Swift compilation and real-phone acceptance have not yet been verified.

## Bring the source to your Mac

Transfer `thread-mac-test-2026-10-12.zip` using AirDrop, a USB drive or another method you control. It contains app source, the original avatar, local native module, tests and these instructions. It excludes credentials, personal captures, downloaded reconstruction models, Windows processing tools, caches and generated builds.

Extract it into a project folder on your Mac. The extracted folder is `thread-native`. Open Terminal in that folder.

If you already use Thread in Expo Go, export an encrypted wardrobe backup before switching. The installed app has its own storage container and does not automatically inherit Expo Go data or secure credentials. Restore the backup under Profile → Backup and restore. Face models/capture references are excluded from that backup; recapture or re-download them separately. Keep your backup and password separate from this source archive.

## One-time Mac setup

1. Install/open the full Xcode app, accept its license and install the iOS platform components it requests. Select Xcode under Xcode → Settings → Locations → Command Line Tools. This React Native version requires Xcode 16.1 or newer; use a current Xcode compatible with your Mac and phone.
2. Install a compatible Node.js. Node 24 LTS version 24.3 or newer is a suitable choice. The installed React Native engine accepts `^20.19.4 || ^22.13.0 || ^24.3.0 || >= 25.0.0`.
3. Install CocoaPods. If you use Homebrew:

   ```bash
   brew install cocoapods
   ```

4. Connect and unlock your iPhone, trust the Mac, and enable Developer Mode if iOS asks. The native module targets iOS 16.4 or newer. Live scanning also needs TrueDepth hardware; an iPhone SE does not provide it. Unsupported devices keep guided RGB capture.

## Build and launch

In the extracted project folder, run:

```bash
bash scripts/run-ios-local.sh
```

This installs the locked dependencies, runs source checks, generates `ios/`, installs the local pods, builds the native app and starts Metro. Choose your connected iPhone when prompted. Keep Terminal running while testing.

If signing stops the build, open the generated workspace:

```bash
open ios/*.xcworkspace
```

In Xcode, select the Thread app target → Signing & Capabilities → your own Apple team, with automatic signing enabled. A Personal Team can be used for local device development where Apple permits it; follow any trust/provisioning prompts. Do not purchase a membership or build service for this test. If the bundle identifier is unavailable to your team, choose a unique identifier for your local test and keep the existing app/backup until the new install is verified. Build for your connected iPhone with Run in Xcode, or rerun:

```bash
npx expo run:ios --device --no-install
```

After the first successful install, normal JavaScript edits can reload through Metro. Native Swift/module/plugin changes require another native build. The iOS simulator is useful for UI screenshots but cannot prove TrueDepth face scanning.

## First test

- Open Thread and confirm Home / Dressing Room / Profile, the room rendering, avatar rotation, clothing selection and manual avatar changes. Check light/dark and larger text.
- Profile → Edit character → Scan my face should expose **Live front-camera scan** only when the native module and supported hardware are detected.
- Start with one face, looking straight ahead in steady light. Confirm that instructions match actual left/right/up/down motion, that tracking and expression feedback react, and that restart/interruption clears old poses.
- Inspect the photo and face surface from front/side/back before accepting it. It is an estimated static face surface, not a complete head, identity verification or facial-expression rig.
- See `docs/live-face-native-acceptance.md` for restart, storage, deletion and native visual checks.

If a build fails, send the first relevant Xcode error and surrounding lines, with credentials and personal image data removed. If a scan fails, report phone model, iOS version, failed step and whether the issue is tracking, direction, texture orientation or storage. Review face photos locally; do not upload private captures just to debug a build.

## AI and the reconstruction computer

Save your existing Claude connection again under Profile → AI stylist; keys are not included in the source or wardrobe backup. The Mac build does not require an AI key to open the room or create a manual avatar.

Keep the free reconstruction worker on the existing Windows computer. The Mac source archive does not contain its Windows binaries or pairing secret. Use the phone's existing private certificate and current computer HTTPS address/token under Profile → Reconstruction computer, on the same private Wi-Fi. Retrieve those settings from your own existing setup; do not copy private server keys into this archive or send them in chat.

The live native face path runs on the phone. Guided multi-view RGB body/garment reconstruction still uses the paired computer. Garment surfaces remain unfitted; image-reference conversion, complete head/body realism and natural clothing fitting remain unfinished.
