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
# POC/debug APK는 별도 .env 파일이 없어도 Google 공식 테스트 리워드 광고를 사용한다.
# 실제 광고 배포 시 명시적으로 false와 운영 광고 단위 ID를 전달한다.
export NEXT_PUBLIC_ADMOB_USE_TEST_ADS="${NEXT_PUBLIC_ADMOB_USE_TEST_ADS:-true}"

cd "$ROOT"
npm run build

echo "Static export complete: $ROOT/out"
