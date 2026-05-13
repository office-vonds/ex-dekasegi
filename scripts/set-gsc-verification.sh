#!/usr/bin/env bash
# Google Search Console HTML file verification を public/ に配置 deploy
# 使い方: bash scripts/set-gsc-verification.sh google1234567890abcdef.html
# (NOYUTO は GSC verify 失敗時のみ実行)

set -eu

if [ $# -ne 1 ]; then
  echo "usage: $0 <google-XXXXXXX.html>" >&2
  exit 1
fi

FILENAME="$1"
case "$FILENAME" in
  google*.html) ;;
  *) echo "error: filename must match google*.html" >&2; exit 1;;
esac

REPO="/home/ozawakiryu0902/projects/ex-dekasegi"
TARGET="$REPO/public/$FILENAME"

cat > "$TARGET" <<EOF
google-site-verification: $FILENAME
EOF

cd "$REPO"
git add "public/$FILENAME"
git -c commit.gpgsign=false commit -m "phase3-gsc-verification-file"

set -a; . /home/ozawakiryu0902/credentials/cloudflare.conf; set +a
CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-$CF_API_TOKEN}" npx --yes wrangler@latest pages deploy public \
  --project-name=ex-dekasegi --branch=main --commit-dirty=true \
  --commit-message="phase3-gsc-verify-file" \
  --commit-hash="$(git rev-parse HEAD)"

git push origin main || true

echo "done: GSC verify file deployed."
echo "test: curl -sS https://ex-dekasegi.pages.dev/$FILENAME"
