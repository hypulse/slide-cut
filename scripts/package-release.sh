#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APP_NAME="Slide Cut"
VERSION="$(node -p "require('./package.json').version")"
ARCH="$(uname -m)"
APP_PATH="$ROOT_DIR/src-tauri/target/release/bundle/macos/${APP_NAME}.app"
RELEASE_DIR="$ROOT_DIR/release"
ZIP_NAME="Slide-Cut-v${VERSION}-macos-${ARCH}.zip"
ZIP_PATH="$RELEASE_DIR/$ZIP_NAME"
CHECKSUM_PATH="$ZIP_PATH.sha256"

if [[ ! -d "$APP_PATH" ]]; then
  echo "Missing app bundle: $APP_PATH" >&2
  echo "Run: npm run build:app" >&2
  exit 1
fi

rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

ditto -c -k --norsrc --noextattr --keepParent "$APP_PATH" "$ZIP_PATH"
shasum -a 256 "$ZIP_PATH" > "$CHECKSUM_PATH"

echo "Release artifact: $ZIP_PATH"
echo "Checksum: $CHECKSUM_PATH"
