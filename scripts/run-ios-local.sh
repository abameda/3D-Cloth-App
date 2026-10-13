#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Run this script on your Mac. Live face tracking needs an installed iOS build."
  exit 1
fi
for required_tool in node npm xcodebuild pod; do
  if ! command -v "$required_tool" >/dev/null 2>&1; then
    echo "Missing $required_tool. See docs/mac-iphone-setup.md."
    exit 1
  fi
done

echo "Checking the local toolchain"
node --version
xcodebuild -version
echo "Installing the locked app dependencies"
npm ci
npm run typecheck
npm test
echo "Generating the iOS project with Thread's local face module"
npx expo prebuild --platform ios --no-install
npx pod-install ios
echo "Choose your connected iPhone. Xcode may request a signing team."
npx expo run:ios --device --no-install
