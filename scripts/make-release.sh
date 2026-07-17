#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p dist
rm -f dist/tenline-offline.zip
zip -X -r dist/tenline-offline.zip \
  index.html \
  styles.css \
  js \
  icons \
  manifest.webmanifest \
  sw.js \
  README.md \
  LICENSE \
  -x '*.DS_Store'
unzip -t dist/tenline-offline.zip
