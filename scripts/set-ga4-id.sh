#!/usr/bin/env bash
# GA4 measurement ID を index.html に差し込み deploy する 1 コマンドスクリプト
# 使い方: bash scripts/set-ga4-id.sh G-XXXXXXXXXX
# 前提: ~/credentials/cloudflare.conf に CLOUDFLARE_API_TOKEN

set -eu

if [ $# -ne 1 ]; then
  echo "usage: $0 <GA4_MEASUREMENT_ID e.g. G-ABC123XYZ>" >&2
  exit 1
fi

GA_ID="$1"
case "$GA_ID" in
  G-*) ;;
  *) echo "error: GA4 measurement ID must start with 'G-'" >&2; exit 1;;
esac

REPO="/home/ozawakiryu0902/projects/ex-dekasegi"
HTML="$REPO/public/index.html"

if ! grep -q "G-XXXXXXX" "$HTML"; then
  echo "warn: placeholder G-XXXXXXX not found in $HTML — assuming already set"
else
  # placeholder 文字列だけを置換 (guard 条件側の G-XXXXXXX も置換されると判定が壊れるので、
  # guard 条件側の文字列は事前に固定値へ書き換えてから本体を置換する)
  sed -i "s|__GA_ID__ !== 'G-XXXXXXX'|__GA_ID__|g; s/G-XXXXXXX/${GA_ID}/g" "$HTML"
  # 余分な `if(__GA_ID__ && __GA_ID__){` を `if(__GA_ID__){` に正規化
  sed -i "s/if(__GA_ID__ && __GA_ID__){/if(__GA_ID__){/g" "$HTML"
  echo "ok: replaced placeholder with $GA_ID (guard normalized)"
fi

cd "$REPO"
git add public/index.html
git -c commit.gpgsign=false commit -m "phase3-ga4-measurement-id-injection" 2>/dev/null || echo "info: no commit (no change)"

set -a; . /home/ozawakiryu0902/credentials/cloudflare.conf; set +a
CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-$CF_API_TOKEN}" npx --yes wrangler@latest pages deploy public \
  --project-name=ex-dekasegi --branch=main --commit-dirty=true \
  --commit-message="phase3-ga4-id-${GA_ID}" \
  --commit-hash="$(git rev-parse HEAD)"

git push origin main || true

echo "done: GA4 $GA_ID deployed. verify https://ex-dekasegi.pages.dev/ (view-source check)"
