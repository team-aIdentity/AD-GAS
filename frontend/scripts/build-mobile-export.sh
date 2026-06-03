#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$ROOT/src/app/api"
API_BAK="$ROOT/.api-server-bak-mobile-build"

cleanup() {
  if [ -d "$API_BAK" ]; then
    rm -rf "$API_DIR"
    mv "$API_BAK" "$API_DIR"
  fi
}
trap cleanup EXIT

if [ -d "$API_DIR" ]; then
  rm -rf "$API_BAK"
  mv "$API_DIR" "$API_BAK"
fi

export MOBILE_STATIC_EXPORT=1
export NEXT_PUBLIC_RELAYER_API_BASE="${NEXT_PUBLIC_RELAYER_API_BASE:-https://ad-gas.vercel.app/api}"

cd "$ROOT"
npm run build

echo "Static export complete: $ROOT/out"
