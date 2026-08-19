#!/usr/bin/env bash
# apparness の main ブランチから、apps/ と apparness 開発者向けメモ（ROADMAP.md, scripts/）を
# 除いたスナップショットを作り、apparness-harness リポジトリ（配布用テンプレート、
# harness-origin remote）の main へ同期する。
#
# ハーネス本体（harness/, .claude/, README.md, HARNESS_GUIDE.md/.pdf）に変更を加えて
# main にマージ・pushした後、テンプレート配布先にも反映したいときに実行する。
#
# 使い方: ./scripts/sync-harness-template.sh
#
# 注意: apparness-harness 側の main を force push で丸ごと差し替える。
#       apparness-harness 側で直接編集した内容があれば失われるので、
#       編集は必ず apparness (このリポジトリ) 側の main で行うこと。

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if [ -n "$(git status --short)" ]; then
  echo "エラー: 作業ツリーに未コミットの変更があります。先にコミット/退避してください。" >&2
  exit 1
fi

if ! git remote get-url harness-origin >/dev/null 2>&1; then
  echo "エラー: remote 'harness-origin' が設定されていません。" >&2
  echo "  git remote add harness-origin git@github.com:studioyukidaruma-dev/apparness-harness.git" >&2
  exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"
MAIN_SHA="$(git rev-parse --short main)"
# apparness-harness (配布先) には含めない、apparness 開発者向けの内容
EXCLUDE_PATHS=(apps ROADMAP.md scripts)

echo "main (${MAIN_SHA}) から harness-template を再生成します..."

git branch -D harness-template >/dev/null 2>&1 || true
git checkout --orphan harness-template main
for p in "${EXCLUDE_PATHS[@]}"; do
  git rm -r --cached -- "$p" >/dev/null 2>&1 || true
  rm -rf -- "$p"
done
git add -A
git commit -q -m "chore: harness-template を main (${MAIN_SHA}) から再生成"

echo "apparness-harness の main へ push します（force push）..."
git push --force harness-origin harness-template:main

git checkout -q "$CURRENT_BRANCH"
git branch -D harness-template >/dev/null 2>&1 || true

echo "同期完了: https://github.com/studioyukidaruma-dev/apparness-harness"
