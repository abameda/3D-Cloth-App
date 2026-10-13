# Thread on your iPhone: build once on the Mac, then develop from Windows

The Mac does one job: compiling and signing the native iOS app, which is a **development build**. After that, the iPhone loads the app's JavaScript and 3D assets from the Windows PC over Wi-Fi. Day-to-day changes then need no Mac and no rebuild.

| Task | Machine |
|---|---|
| Native build and signing (Xcode) | Mac, only when native code changes or the signature expires |
| Code, Metro bundler, hot reload | Windows |
| Body fitting, garment sewing and draping, asset export | Windows (`pipeline/`) |
| Interactive 3D, live face tracking | iPhone |

Every push to GitHub that touches native code also compiles the iOS app on GitHub's macOS runners: `.github/workflows/ios-native-build.yml`. Compile errors therefore show up before you sit down at the Mac.

## 1. One-time Mac setup

1. Install Xcode from the App Store and open it once. Accept the licence and install the iOS platform it offers. Then select Xcode under **Xcode → Settings → Locations → Command Line Tools**.
2. Install Node.js 24 LTS and CocoaPods (`brew install node@24 cocoapods`).
3. Connect and unlock your iPhone and tap **Trust**. On the iPhone, enable **Settings → Privacy & Security → Developer Mode** and restart when asked.

## 2. Get the code

```bash
git clone https://github.com/abameda/3D-Cloth-App.git thread
cd thread
```

The repository contains no keys, photos, scans or personal models.

## 3. Build and install the development app

```bash
bash scripts/run-ios-local.sh
```

The script does the following:
- installs the locked dependencies and runs type checks and tests;
- generates `ios/` (this includes the ARKit face module and the dev-client launcher);
- installs the pods;
- builds the app and installs it on the connected iPhone.

When Xcode asks for signing, open `ios/*.xcworkspace` and go to the **Thread** target → **Signing & Capabilities**. Choose your Apple ID's **Personal Team**, keep automatic signing on, and run again.
- If the bundle identifier is taken, change it to something unique, such as `com.<yourname>.thread`.
- On the iPhone, trust the developer profile under **Settings → General → VPN & Device Management**.

**Free signing expires after 7 days.** When the app stops opening, rebuild from the Mac with `npx expo run:ios --device`. A paid Apple Developer membership ($99/year) would remove this limit. It is optional and not required for personal testing.

## 4. Daily development from Windows (no Mac)

On the Windows PC, from the project folder:

```powershell
npx expo start --dev-client
```

On the iPhone, open **Thread** (the development build). It lists the Windows dev server, or you can scan the QR code shown in the terminal. The phone and PC must be on the same Wi-Fi network.

From then on:
- JavaScript, screens and logic changes reload instantly.
- Avatar and garment GLBs produced by `pipeline/` arrive through the paired computer connection.
- Only native changes need the Mac again: Swift modules, new native libraries, or app permissions in `app.json`.

Metro's privacy middleware (`metro.config.js`) refuses to serve private folders (`.data`, `.runtime`, `work`, captures, env files) to the phone.

## 5. Connect the asset factory

1. On Windows, start the local engine: `npm run server:reconstruction`. Pairing uses the existing private HTTPS certificate; see `local-engine/README.md` and `local-engine/setup-phone-tls.ps1`.
2. On the iPhone, go to **Profile → Reconstruction computer** and enter the HTTPS address and token from your own setup. Never paste the token into chats or commits.
3. Go to **Profile → My body**, enter your height and tape measurements, and tap **Create my body**. The PC fits your body in about a minute.
4. Open a top, bottom or layer in your wardrobe and tap **Fit on my body**. The PC sews and drapes it on your body; on CPU this takes 5–15 minutes per piece. The piece then appears in the dressing room, skinned to your avatar.

## 6. What to check on the first run

- Home and the Dressing Room show the realistic body (no longer the primitive mannequin). It breathes and blinks, and it turns smoothly when you drag.
- Changing a top or bottom swaps the draped garment, with no skin showing through.
- **Profile → Edit character → Scan my face** offers **Live front-camera scan** on TrueDepth iPhones. That module has been compile-checked in CI but not yet tested on a device. Report what you see.
- Check light and dark mode, and larger text sizes.

If a build fails, copy the first `error:` line from Xcode, with any personal paths removed.
